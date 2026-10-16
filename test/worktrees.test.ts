import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { prepareWorktree } from '../src/storage/worktrees';
import { Engine, newJob, type EngineHooks } from '../src/core/engine';
import { projectSummaries } from '../src/core/projects';

const exec=promisify(execFile),roles={builder:'a',auditor:'a',worker:'a',lead:'a'};
const git=async(cwd:string,...args:string[])=>(await exec('git',['-C',cwd,...args],{windowsHide:true})).stdout.trim();
async function fixture(t:any){
  const root=await mkdtemp(join(tmpdir(),'relaycrew-worktree-')),repo=join(root,'source with spaces'),storage=join(root,'checkouts');
  t.after(async()=>{assert.ok(resolve(root).startsWith(resolve(tmpdir())+sep));await rm(root,{recursive:true,force:true});});
  await mkdir(repo);await git(repo,'init');await writeFile(join(repo,'.gitattributes'),'*.txt text eol=lf\n');await writeFile(join(repo,'file.txt'),'original\n');await mkdir(join(repo,'sub'));await writeFile(join(repo,'sub','nested.txt'),'nested\n');
  await git(repo,'add','.');await git(repo,'-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','base');
  return {root,repo,storage};
}
test('task worktrees isolate actual files, preserve source and resume the same branch',async t=>{
  const {repo,storage}=await fixture(t),job=newJob('task',repo,roles);job.isolationMode='worktree';
  await prepareWorktree(job,storage);assert.notEqual(job.cwd,repo);assert.equal(job.sourceCwd,repo);
  assert.equal(await readFile(join(job.cwd,'file.txt'),'utf8'),'original\n');
  await writeFile(join(job.cwd,'file.txt'),'task edit\n');assert.equal(await readFile(join(repo,'file.txt'),'utf8'),'original\n');
  const before=JSON.stringify(job.worktree);await prepareWorktree(job,storage);assert.equal(JSON.stringify(job.worktree),before);
  assert.equal(await readFile(join(job.cwd,'file.txt'),'utf8'),'task edit\n');
  assert.equal(projectSummaries([{name:'Project',path:repo}],[job])[0].jobs.length,1);
  const second=newJob('another task',repo,roles);second.isolationMode='worktree';await prepareWorktree(second,storage);
  assert.notEqual(second.cwd,job.cwd);assert.equal(await readFile(join(second.cwd,'file.txt'),'utf8'),'original\n');
});
test('worktree policy rejects dirty source, invalid storage and conflicting destinations',async t=>{
  const {repo,storage}=await fixture(t),job=newJob('task',repo,roles);job.isolationMode='worktree';
  await writeFile(join(repo,'untracked.txt'),'owner work');await assert.rejects(prepareWorktree(job,storage),/Commit or stash/);
  assert.equal(job.cwd,repo);await rm(join(repo,'untracked.txt'));
  await assert.rejects(prepareWorktree(job,join(repo,'nested-storage')),/separate/);
  await prepareWorktree(job,storage);const branch=job.worktree!.branch;
  await git(job.cwd,'checkout','-b',branch+'-changed');await assert.rejects(prepareWorktree(job,storage),/no longer matches/);
});
test('nested project paths and interrupted preparation recover without creating another checkout',async t=>{
  const {repo,storage}=await fixture(t),job=newJob('nested task',join(repo,'sub'),roles);job.isolationMode='worktree';
  const original=structuredClone(job);await prepareWorktree(job,storage);assert.equal(await readFile(join(job.cwd,'nested.txt'),'utf8'),'nested\n');
  await prepareWorktree(original,storage);assert.deepEqual(original.worktree,job.worktree);assert.equal(original.cwd,job.cwd);
});
test('the engine prepares isolation before any provider call and does not run after preparation fails',async t=>{
  const {repo,storage}=await fixture(t),job=newJob('task',repo,roles);job.isolationMode='worktree';let calls=0;
  const hooks:EngineHooks={profiles:()=>[{id:'a',label:'A',provider:'codex',executable:'fake'}],quotas:()=>({}),settings:()=>({autoSwitch:false,threshold:95,maxTasks:0,edits:false}),save:async()=>{},changed:()=>{},prepareJob:(job,signal)=>prepareWorktree(job,storage,signal),run:async(_p,step,j)=>{calls++;assert.ok(j.worktree);return step.role==='auditor'?'{"summary":"ok","issues":[],"tasks":[]}':step.role==='lead'?'{"decision":"approved","summary":"ok"}':'done';}};
  await new Engine([job],hooks).drain();assert.equal(job.status,'completed');assert.equal(calls,3);
  const blocked=newJob('blocked',repo,roles);blocked.isolationMode='worktree';await writeFile(join(repo,'file.txt'),'owner edit');
  await new Engine([blocked],hooks).drain();assert.equal(blocked.status,'failed');assert.equal(calls,3);
});
