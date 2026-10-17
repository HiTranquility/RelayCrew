import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,unlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {observeWorkspace,statusPaths} from '../src/adapters/workspace-changes';
import {newJob} from '../src/core/engine';
import {accountDisplayNames,preferAccount} from '../src/core/account-identity';
import {validateProfiles,type Profile} from '../src/core/domain';
import {agentModelLabel} from '../src/ui/agent-model-label';
import {agentNodes} from '../src/ui/agent-map';
const exec=promisify(execFile),roles={builder:'a',auditor:'a',worker:'a',lead:'a'};
test('Git status parser preserves spaces, Unicode and NUL-delimited rename paths',()=>{const entries=statusPaths(' M path with space.ts\0R  mới.ts\0old.ts\0?? new.md\0');assert.equal(entries.get('mới.ts')?.previousPath,'old.ts');assert.equal(entries.get('path with space.ts')?.status,' M');assert.equal(entries.size,3);});
test('workspace observation excludes pre-existing edits, observes create/edit/delete, reverts and resumed steps',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'relaycrew-changes-'));try{const git=(...args:string[])=>exec('git',args,{cwd:dir,windowsHide:true});await git('init');for(const name of ['dirty.txt','delete.txt'])await writeFile(join(dir,name),'original\n');await git('add','.');await git('-c','user.name=Test','-c','user.email=test@example.invalid','commit','-m','fixture');await writeFile(join(dir,'dirty.txt'),'already edited before session\n');const job=newJob('bounded work',dir,roles);let refreshes=0;const stop=await observeWorkspace(job,0,()=>refreshes++,60000);assert.equal(job.fileChanges?.length??0,0);await writeFile(join(dir,'new file.md'),'added\n');await stop();assert.deepEqual(job.fileChanges?.map(c=>[c.path,c.kind]),[['new file.md','added']]);assert.ok(refreshes>0);
 const stopNext=await observeWorkspace(job,1,()=>{},60000);await writeFile(join(dir,'dirty.txt'),'changed during second step\n');await unlink(join(dir,'delete.txt'));await unlink(join(dir,'new file.md'));await stopNext();assert.equal(job.fileChanges?.find(c=>c.path==='dirty.txt')?.kind,'modified');assert.equal(job.fileChanges?.find(c=>c.path==='dirty.txt')?.stepIndex,1);assert.equal(job.fileChanges?.find(c=>c.path==='delete.txt')?.kind,'deleted');assert.equal(job.fileChanges?.find(c=>c.path==='new file.md')?.reverted,true);assert.equal(job.fileTracking,'complete');
 }finally{if(!resolve(dir).startsWith(join(tmpdir(),'relaycrew-changes-')))throw new Error('Unexpected test directory');await rm(dir,{recursive:true,force:true});}
});
test('account names keep custom labels and IDs while preferred accounts are exclusive per provider connection',()=>{
 const profiles:Profile[]=[{id:'one',label:'Claude · Main',provider:'claude',executable:'claude'},{id:'two',label:'Work subscription',provider:'claude',executable:'claude'},{id:'agy',label:'Antigravity · Main',provider:'antigravity',executable:'agy',preferred:true}];const before=JSON.stringify(profiles),display=accountDisplayNames(profiles);assert.equal(display[0].label,'Claude · Account 1');assert.equal(display[1].label,'Work subscription');assert.equal(display[0].id,'one');assert.equal(JSON.stringify(profiles),before);const preferred=preferAccount(preferAccount(profiles,'one',true),'two',true);assert.equal(preferred[0].preferred,false);assert.equal(preferred[1].preferred,true);assert.equal(preferred[2].preferred,true);validateProfiles(preferred);assert.throws(()=>validateProfiles(profiles.map(p=>({...p,preferred:true}))));
});
test('runtime model labels never substitute an old pin for an unreported native model',()=>{
 const p:Profile={id:'a',label:'Account',provider:'antigravity',executable:'agy',model:'obsolete-pin',modelPolicy:'custom'},job=newJob('read','.',roles);job.overrides={builder:{modelPolicy:'cli'}};job.steps[0].startedAt=new Date().toISOString();job.steps[0].status='running';assert.equal(agentModelLabel(job,agentNodes(job)[0],[p],'en'),'CLI default · exact model not reported');job.steps[0].model='reported-model';assert.equal(agentModelLabel(job,agentNodes(job)[0],[p],'en'),'reported-model');
});
