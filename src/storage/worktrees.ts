import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, realpath, stat } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import type { Job } from '../core/domain';

const execute = promisify(execFile);
const within = (root:string,path:string) => {const rel=relative(root,path);return rel===''||!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+sep);};
async function git(cwd:string,args:string[],signal?:AbortSignal):Promise<string> {
  const {stdout}=await execute('git',['-C',cwd,...args],{windowsHide:true,encoding:'utf8',timeout:60_000,maxBuffer:1024*1024,signal});
  return stdout.trim();
}

/** Keep checkouts for inspection. Never remove a worktree or change the source checkout. */
export async function prepareWorktree(job: Job, storageRoot: string, signal?: AbortSignal): Promise<void> {
  if(job.isolationMode!=='worktree')return;
  if(!isAbsolute(storageRoot)||!isAbsolute(job.sourceCwd??job.cwd))throw new Error('Worktree storage and project folders must be absolute.');
  if(job.worktree){
    const path=await realpath(job.worktree.path);
    const expected=await realpath(join(storageRoot,createHash('sha256').update(job.id).digest('hex').slice(0,24)));
    if(path!==expected||!within(path,await realpath(job.cwd))||await git(path,['branch','--show-current'],signal)!==job.worktree.branch)throw new Error('Stored task worktree no longer matches its branch or working folder.');
    return;
  }
  const source=await realpath(job.sourceCwd??job.cwd),repository=await realpath(await git(source,['rev-parse','--show-toplevel'],signal));
  if(!within(repository,source))throw new Error('Project is outside its Git repository.');
  // Require a clean starting point: a task must not silently miss uncommitted owner work.
  if(await git(repository,['status','--porcelain','--untracked-files=normal'],signal))throw new Error('Commit or stash source changes before starting an isolated task. Worktrees start from committed HEAD.');
  if(within(repository,resolve(storageRoot))||within(resolve(storageRoot),repository))throw new Error('Worktree storage must be separate from the source repository.');
  await mkdir(storageRoot,{recursive:true});
  const root=await realpath(storageRoot);
  if(within(repository,root)||within(root,repository))throw new Error('Worktree storage must be separate from the source repository.');
  const key=createHash('sha256').update(job.id).digest('hex').slice(0,24),path=resolve(root,key),branch=`relaycrew/task-${key}`;
  if(!within(root,path)||path===root)throw new Error('Invalid task worktree destination.');
  let baseCommit=await git(repository,['rev-parse','HEAD'],signal);
  let exists=false;try{await stat(path);exists=true;}catch(error:any){if(error.code!=='ENOENT')throw error;}
  if(exists){
    // Recover a checkout created before state was saved. Do not claim an unrelated folder.
    const top=await realpath(await git(path,['rev-parse','--show-toplevel'],signal));
    const common=await realpath(await git(path,['rev-parse','--path-format=absolute','--git-common-dir'],signal));
    const sourceCommon=await realpath(await git(repository,['rev-parse','--path-format=absolute','--git-common-dir'],signal));
    if(top!==path||common!==sourceCommon||await git(path,['branch','--show-current'],signal)!==branch)throw new Error('Task worktree destination is already occupied.');
    baseCommit=await git(path,['rev-parse','HEAD'],signal);
  }else await git(repository,['worktree','add','--no-track','-b',branch,'--',path,'HEAD'],signal);
  const cwd=join(path,relative(repository,source));
  if(!(await stat(cwd)).isDirectory())throw new Error('The project folder does not exist in committed HEAD.');
  job.sourceCwd=job.sourceCwd??job.cwd;job.cwd=cwd;job.worktree={path,repository,branch,baseCommit};
  (job.timeline??=[]).push({at:new Date().toISOString(),from:'orchestrator',to:'project',kind:'worktree',text:`Task checkout: ${cwd}\nBranch: ${branch}\nBase: ${baseCommit}\nSource: ${source}\nCheckout is retained for review; changes are not merged automatically.`});
}
