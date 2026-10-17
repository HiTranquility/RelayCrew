import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {lstat,readFile,readlink} from 'node:fs/promises';
import {isAbsolute,relative,resolve} from 'node:path';
import type {Job,ObservedFileChange} from '../core/domain';
const exec=promisify(execFile);
export function statusPaths(raw:string):Map<string,{status:string;previousPath?:string}>{
 const entries=raw.split('\0'),result=new Map<string,{status:string;previousPath?:string}>();for(let i=0;i<entries.length;i++){const item=entries[i];if(!item)continue;const status=item.slice(0,2),path=item.slice(3);if(!path)continue;const renamed=/[RC]/.test(status),previousPath=renamed?entries[++i]:undefined;result.set(path,{status,...(previousPath?{previousPath}:{})});}return result;
}
async function fingerprint(root:string,path:string):Promise<string>{
 const full=resolve(root,path),rel=relative(root,full);if(isAbsolute(rel)||rel==='..'||rel.startsWith('..\\')||rel.startsWith('../'))return 'outside';
 try{const stat=await lstat(full);if(stat.isSymbolicLink())return 'link:'+await readlink(full);if(!stat.isFile())return 'not-file';if(stat.size>16*1024*1024)return 'metadata:'+stat.size+':'+stat.mtimeMs;return createHash('sha256').update(await readFile(full)).digest('hex');}catch(error){return (error as NodeJS.ErrnoException).code==='ENOENT'?'missing':'unreadable';}
}
export async function observeWorkspace(job:Job,stepIndex:number,onChange:()=>void,interval=3000):Promise<()=>Promise<void>>{
 let root:string;try{root=(await exec('git',['rev-parse','--show-toplevel'],{cwd:job.cwd,windowsHide:true,timeout:3000,maxBuffer:1024*1024})).stdout.trim();}catch{job.fileTracking='unavailable';return async()=>{};}
 job.fileChangeRoot=root;const snapshot=async()=>statusPaths((await exec('git',['status','--porcelain=v1','-z','--untracked-files=all'],{cwd:root,windowsHide:true,timeout:5000,maxBuffer:4*1024*1024})).stdout);
 let initial:Map<string,{status:string;previousPath?:string}>;try{initial=await snapshot();}catch{job.fileTracking='unavailable';return async()=>{};}
 if(!job.fileChangeBaseline){job.fileChangeBaseline={};for(const path of [...initial.keys()].slice(0,500))job.fileChangeBaseline[path]=await fingerprint(root,path);}
 job.fileTracking=initial.size>500?'limited':'active';const rows=new Map((job.fileChanges??[]).map(row=>[row.path,row]));let stopped=false,busy:Promise<void>|undefined,timer:ReturnType<typeof setTimeout>|undefined;
 const poll=async()=>{if(busy)await busy;const work=async()=>{try{const current=await snapshot(),keys=[...new Set([...Object.keys(job.fileChangeBaseline!),...current.keys(),...rows.keys()])].slice(0,500);if(current.size>500)job.fileTracking='limited';let changed=false;
 for(const path of keys){const entry=current.get(path),before=job.fileChangeBaseline![path],after=await fingerprint(root,path),modified=before!==undefined?after!==before:!!entry,old=rows.get(path);if(modified){const kind=entry?.previousPath?'renamed':entry?.status.includes('D')||after==='missing'?'deleted':before==='missing'||before===undefined&&!!entry&&/[?A]/.test(entry.status)?'added':'modified';if(!old||old.reverted||old.kind!==kind||after!==old.fingerprint){rows.set(path,{path,kind,at:new Date().toISOString(),stepIndex,previousPath:entry?.previousPath,...{fingerprint:after??await fingerprint(root,path)}} as ObservedFileChange);changed=true;}}else if(old&&!old.reverted){rows.set(path,{...old,reverted:true});changed=true;}}
 if(changed){job.fileChanges=[...rows.values()].slice(0,500);onChange();}}catch{job.fileTracking='unavailable';onChange();}};
 busy=work();try{await busy;}finally{busy=undefined;}};
 const tick=()=>{timer=setTimeout(()=>{void poll().finally(()=>{if(!stopped)tick();});},interval);timer.unref();};tick();
 return async()=>{stopped=true;if(timer)clearTimeout(timer);await poll();job.fileTracking=job.fileTracking==='active'?'complete':job.fileTracking;};
}
