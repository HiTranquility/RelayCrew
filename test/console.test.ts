import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseConsoleInput } from '../src/core/console-input';
import { ConsoleController } from '../src/host/console-controller';
import { Engine,newJob,stepPrompt } from '../src/core/engine';
import type { Job } from '../src/core/domain';
import { renderLiveConsole } from '../src/ui/live-console';
import { renderOverview,quotaMeter } from '../src/ui/overview';

const roles={builder:'a',auditor:'a',worker:'a',lead:'a'},requestId='console-12345678-1234-1234-1234-123456789abc';
const profiles=[{id:'a',label:'Account <A>',provider:'codex' as const,executable:'fake',model:'exact-model'}];
test('console parses multiline tasks and bounded orchestration commands without executing shell text',()=>{
  assert.deepEqual(parseConsoleInput('hello!'),{kind:'chat',text:'hello!'});
  assert.deepEqual(parseConsoleInput('/ask Explain this'),{kind:'chat',text:'Explain this'});
  assert.deepEqual(parseConsoleInput('Build this\nAcceptance: tests pass'),{kind:'task',text:'Build this\nAcceptance: tests pass'});
  assert.deepEqual(parseConsoleInput('/new /some/path\nKeep data'),{kind:'task',text:'/some/path\nKeep data'});
  assert.deepEqual(parseConsoleInput('/reply Option A'),{kind:'reply',text:'Option A'});
  for(const command of ['pause','resume','stop','status'])assert.deepEqual(parseConsoleInput('/'+command),{kind:command});
  for(const invalid of ['',{},'x'.repeat(16001),'/exec rm file','/pause extra','/new'])assert.throws(()=>parseConsoleInput(invalid));
});

test('chat uses one read-only provider call, keeps conversational context and never dispatches audit or manager stages',async()=>{
  const jobs:Job[]=[];const controller=new ConsoleController({jobs,roots:()=>['/project'],create:(prompt,cwd)=>newJob(prompt,cwd,roles),createChat:(prompt,cwd,id,parent)=>{const job=newJob(prompt,cwd,roles);job.kind='chat';job.readOnly=true;job.profilePins={builder:id};job.chatHistory=parent?[{role:'user',text:parent.prompt},{role:'assistant',text:parent.steps[0].response??''}]:[];return job;},prepare:async()=>{},paused:()=>false,pause:()=>{},cancel:()=>{},save:async()=>{},changed:()=>{},start:()=>{}});
  const request={requestId,text:'hello',cwd:'/project',mode:'chat',profileId:'a'};await controller.submit(request);await controller.submit(request);assert.equal(jobs.length,1);let calls=0;
  await new Engine(jobs,{profiles:()=>profiles,quotas:()=>({}),settings:()=>({autoSwitch:false,threshold:95,maxTasks:4,edits:true}),save:async()=>{},changed:()=>{},run:async(_p,step,_job,edits)=>{calls++;assert.equal(edits,false);assert.match(step.request!,/not a coding assignment/);return 'Hello!';}}).drain();
  assert.equal(calls,1);assert.equal(jobs[0].status,'completed');assert.equal(jobs[0].steps.length,1);
  await controller.submit({...request,requestId:requestId.replace('abc','abd'),text:'Explain more',sessionId:jobs[0].id});assert.equal(jobs[1].chatHistory?.[1].text,'Hello!');
});

test('missing CLI preflight preserves the draft without creating or dispatching a job',async()=>{
  const jobs:Job[]=[];let started=false;const controller=new ConsoleController({jobs,roots:()=>['/project'],create:(prompt,cwd)=>newJob(prompt,cwd,roles),prepare:async()=>{throw new Error('CLI missing');},paused:()=>false,pause:()=>{},cancel:()=>{},save:async()=>{},changed:()=>{},start:()=>{started=true;}});
  await assert.rejects(controller.submit({requestId,text:'Implement feature',cwd:'/project',mode:'task'}),/CLI missing/);assert.equal(jobs.length,0);assert.equal(started,false);
});

test('chat clarification replies reach the resumed request and completed chat summaries remain readable',()=>{
  const job=newJob('hello','/project',roles);job.kind='chat';job.readOnly=true;job.ownerReplies=['Owner answer: concise Vietnamese'];assert.match(stepPrompt(job,job.steps[0]),/concise Vietnamese/);job.steps[0].response='Xin chào!';job.steps[0].status='done';job.status='completed';const html=renderLiveConsole([job],profiles,undefined,'vi');assert.match(html,/friendly-answer/);assert.match(html,/Xin chào!/);assert.match(html,/data-console-activity/);
});
function fixture(){
  const jobs:Job[]=[];let paused=false,saves=0,starts=0;
  const controller=new ConsoleController({jobs,roots:()=>['/project'],create:(prompt,cwd)=>newJob(prompt,cwd,roles,['builder','auditor','lead']),paused:()=>paused,pause:value=>{paused=value;},cancel:id=>{jobs.find(job=>job.id===id)!.status='cancelled';},save:async()=>{saves++;},changed:()=>{},start:()=>{starts++;}});
  return {jobs,controller,paused:()=>paused,saves:()=>saves,starts:()=>starts};
}
test('console submissions are durable before dispatch, deduplicated and limited to open roots',async()=>{
  const f=fixture(),request={requestId,text:'Build with tests\nKeep compatibility',cwd:'/project'};
  await assert.rejects(f.controller.submit({...request,cwd:'/outside'}));assert.equal(f.jobs.length,0);
  const first=await f.controller.submit(request),again=await f.controller.submit(request);
  assert.equal(first.jobId,again.jobId);assert.equal(f.jobs.length,1);assert.equal(f.saves(),2);assert.equal(f.starts(),2);
  await assert.rejects(f.controller.submit({...request,requestId:'invalid'}));
});
test('console replies target a waiting session, preserve its question history and cannot be delivered twice',async()=>{
  const f=fixture(),job=newJob('task','/project',roles);f.jobs.push(job);job.status='waiting_owner';job.steps[0].status='waiting_owner';job.ownerQuestion='Which behavior?';
  await assert.rejects(f.controller.submit({requestId,text:'/reply A',cwd:'/project',sessionId:'missing'}));
  const request={requestId,text:'/reply A',cwd:'/project',sessionId:job.id,replyVersion:0};await f.controller.submit(request);await f.controller.submit(request);
  assert.equal(job.status,'queued');assert.equal(job.ownerReplies?.length,1);assert.match(job.ownerReplies![0],/Which behavior/);
  job.status='waiting_owner';job.steps[0].status='waiting_owner';job.ownerQuestion='A newer question';
  await assert.rejects(f.controller.submit({...request,requestId:requestId.replace('abc','aaa')}),/question changed/);assert.equal(job.ownerReplies?.length,1);
  await f.controller.submit({...request,requestId:requestId.replace('abc','abd'),text:'/pause'});assert.equal(f.paused(),true);
  await f.controller.submit({...request,requestId:requestId.replace('abc','abe'),text:'/pause'});assert.equal(f.paused(),true);
  await f.controller.submit({...request,requestId:requestId.replace('abc','abf'),text:'/resume'});assert.equal(f.paused(),false);
});
test('console tasks use the real engine lifecycle and expose public handoffs without HTML injection',async()=>{
  const f=fixture();await f.controller.submit({requestId,text:'task <owner>',cwd:'/project'});
  await new Engine(f.jobs,{profiles:()=>profiles,quotas:()=>({}),settings:()=>({autoSwitch:false,threshold:95,maxTasks:0,edits:false}),save:async()=>{},changed:()=>{},run:async(_p,step)=>step.role==='auditor'?'{"summary":"reviewed","issues":[],"tasks":[]}':step.role==='lead'?'{"decision":"approved","summary":"verified"}':'Public answer <script>never()</script>'}).drain();
  const job=f.jobs[0];assert.equal(job.status,'completed');
  const html=renderLiveConsole(f.jobs,profiles,undefined,'vi');assert.ok(html.includes('Public answer &lt;script&gt;never()&lt;/script&gt;'));assert.ok(!html.includes('<script>never'));
  assert.ok(html.includes('data-session-panel="'+job.id+'"'));assert.match(html,/console-input/);assert.match(html,/builder:a/);
});
test('overview uses configured roles and actual running identity; stale quota has no invented percentage',()=>{
  const job=newJob('task','/project',roles);job.status='running';job.steps[0].status='running';job.steps[0].profileId='a';
  const before=JSON.stringify(job),options={queuePaused:false,autoSwitch:false,resumeAfterQuota:false,resumeProviderLimited:false,allowEdits:false,routingMode:'selected',timeoutMinutes:30,roles,management:{primaryProfileId:'a',coordinatorIds:[]}};
  for(const language of ['en','vi'] as const){const html=renderOverview([job],profiles,{},options,language);assert.ok(html.includes('Account &lt;A&gt;'));assert.ok(html.includes('exact-model'));assert.ok(!html.includes('aria-valuenow'));}
  assert.equal(JSON.stringify(job),before);assert.ok(!quotaMeter(undefined,'en').includes('0%'));
  assert.match(quotaMeter({usedPercent:62,observedAt:new Date().toISOString(),source:'fixture'},'en'),/aria-valuenow="62"/);
});
