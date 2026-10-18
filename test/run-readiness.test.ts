import {test} from 'node:test';
import assert from 'node:assert/strict';
import {accountHealth} from '../src/core/account-health';
import {RunReviewGate,reviewRun,isTeamRequest,type RunReviewContext} from '../src/core/run-preview';
import {recoverInterruptedJobs,retryInterruptedJob} from '../src/core/restart-recovery';
import {recordPublicProgress} from '../src/core/public-progress';
import {newJob} from '../src/core/engine';
import {observeRun,effectiveStepStatus} from '../src/core/run-observation';
import {renderAgentMap} from '../src/ui/agent-map';
import {renderTaskCards} from '../src/ui/task-workbench';
import {renderSession} from '../src/ui/live-console';
import type {Profile} from '../src/core/domain';
import type {Job} from '../src/core/domain';
import {Engine} from '../src/core/engine';
import {ConsoleController} from '../src/host/console-controller';

const now=Date.parse('2026-10-18T09:00:00Z');
const profiles:Profile[]=[{id:'c',label:'Codex',provider:'codex',executable:'codex',env:{NOT_FOR_DISPLAY:'private-value'}}];
const context=():RunReviewContext=>({profiles,roles:{builder:'c',auditor:'c',worker:'c',lead:'c'},flow:['builder','auditor','lead'],roots:['/repo'],quotas:{},allowEdits:false,isolateTasks:true,queuePaused:false,maxReviewRounds:3,maxWorkers:4,timeoutMinutes:30,threshold:95});
const request=()=>({requestId:'console-12345678-1234-1234-1234-123456789012',text:'Review a bounded change',mode:'task',cwd:'/repo',acceptance:'Tests pass\nChanged lines reviewed'});

test('run review is a credential-free, non-running plan; unknown quota is explicit and permissions cannot grow',()=>{
  const plan=reviewRun(request(),context(),now);
  assert.equal(plan.blocked,false);assert.equal(plan.team[0].health.quotaState,'Quota unknown');
  assert.equal(plan.folders[0].effectivePermission,'read-only');assert.equal(plan.maxReviewRounds,3);assert.equal(plan.criteria.length,2);
  assert.ok(!JSON.stringify(plan).includes('private-value'));
  assert.equal(isTeamRequest({text:'hello',mode:'task'}),false);assert.equal(isTeamRequest({text:'/new implement feature',mode:'chat'}),true);assert.equal(isTeamRequest({text:'implement feature',mode:'chat'}),false);
  assert.throws(()=>reviewRun({...request(),folders:[{path:'/outside',permission:'full'}]},context(),now));
});
test('host review receipt binds the task and all execution settings, expires, and rechecks changed quota',()=>{
  const gate=new RunReviewGate(),config=context(),input=request(),token=gate.issue(input,config,now);
  gate.verify(token,{action:'consoleSubmit',...input,reviewToken:token},config,now+1);
  assert.throws(()=>gate.verify(token,{...input,text:'Changed task'},config,now+1),/changed/);
  assert.throws(()=>gate.verify(token,input,{...config,allowEdits:true},now+1),/changed/);
  assert.throws(()=>gate.verify(token,input,config,now+300001),/changed/);
  assert.throws(()=>gate.verify(token,input,{...config,quotas:{c:{source:'test',usedPercent:99,observedAt:new Date(now).toISOString()}}},now+1),/blocked/);
});
test('account health never treats stale login, mismatched identity or absent quota as verified capacity',()=>{
  const profile={...profiles[0],accountEmail:'owner@example.test'},probe={installed:true,authenticated:'yes' as const,identity:{email:'other@example.test'},checkedAt:new Date(now).toISOString()};
  assert.equal(accountHealth(profile,probe,undefined,95,now).blocked,true);
  assert.equal(accountHealth(profiles[0],{...probe,checkedAt:new Date(now-400000).toISOString()},undefined,95,now).connection,'Connection check required');
  assert.equal(accountHealth(profiles[0],undefined,undefined,95,now).usedPercent,undefined);
});
test('restart recovery pauses unfinished work without replaying completed calls or resetting review budgets',()=>{
  const job=newJob('work','/repo',context().roles);job.status='running';job.steps[0].status='done';job.steps[0].response='KEEP';job.steps.push({role:'auditor',title:'Review',prompt:'Review',status:'running',attempts:2,limitRetries:1});job.reviewPolicy={maxRounds:3};
  assert.equal(recoverInterruptedJobs([job],false,new Date(now).toISOString()),true);
  assert.equal(job.status,'interrupted');assert.equal(job.steps[0].response,'KEEP');assert.equal(job.steps[1].status,'failed');assert.equal(job.steps[1].attempts,2);assert.equal(job.steps[1].limitRetries,1);assert.equal(job.reviewPolicy.maxRounds,3);
  assert.equal(recoverInterruptedJobs([job],false,new Date(now+1).toISOString()),false);assert.equal(job.timeline?.length,1);
  assert.throws(()=>retryInterruptedJob(job,false),/Inspect/);retryInterruptedJob(job,true);
  assert.equal(job.status,'queued');assert.equal(job.steps[0].response,'KEEP');assert.equal(job.steps[1].attempts,2);assert.equal(job.reviewPolicy.maxRounds,3);
});
test('public progress normalizes adapter events, keeps current heartbeat time, and excludes private events',()=>{
  const job=newJob('work','/repo',context().roles),step=job.steps[0];
  assert.equal(recordPublicProgress(job,step,profiles[0],{kind:'reasoning',text:'PRIVATE'}),false);
  recordPublicProgress(job,step,profiles[0],{kind:'assistant',text:'Checking '},new Date(now).toISOString());
  recordPublicProgress(job,step,profiles[0],{kind:'assistant',text:'public files.'},new Date(now+1000).toISOString());
  assert.equal(job.timeline?.length,1);assert.equal(job.timeline![0].kind,'stream');assert.equal(job.timeline![0].text,'Checking public files.');assert.equal(job.timeline![0].at,new Date(now+1000).toISOString());assert.equal(job.timeline![0].stepIndex,0);
  assert.ok(!JSON.stringify(job).includes('PRIVATE'));
});
test('Tasks, Live and Map share recorded status, observed files and the unfinished step',()=>{
  const job=newJob('bounded work','/repo',context().roles);job.status='waiting_quota';job.blockedProfileId='c';job.steps[0].profileId='c';job.steps[0].status='failed';job.fileTracking='complete';job.fileChanges=[{path:'src/real.ts',kind:'modified',stepIndex:0,at:new Date(now).toISOString()}];
  job.steps.push({role:'lead',profileId:'c',title:'Future manager',prompt:'Review',status:'pending'});assert.equal(effectiveStepStatus(job,job.steps[1]),'pending');
  assert.equal(effectiveStepStatus(job,job.steps[0]),'waiting_quota');assert.equal(observeRun(job).changedFiles,1);
  for(const html of [renderAgentMap([job],profiles,'en'),renderTaskCards([job],profiles,'en'),renderSession(job,profiles,'en',[job])]){assert.match(html,/data-observed-status="waiting_quota"/);assert.match(html,/Refresh quota or choose a ready backup/);}
});

test('confirmed review queues exactly once and the fake delivery flow records all three stages',async()=>{
  const jobs:Job[]=[],calls:string[]=[],config=context(),input=request(),gate=new RunReviewGate();
  const controller=new ConsoleController({jobs,roots:()=>config.roots,create:(prompt,cwd)=>newJob(prompt,cwd,config.roles,config.flow),paused:()=>false,pause:()=>{},cancel:()=>{},save:async()=>{},changed:()=>{},start:()=>{}});
  reviewRun(input,config,now);const token=gate.issue(input,config,now);assert.equal(jobs.length,0);assert.equal(calls.length,0);
  gate.verify(token,input,config,now);await controller.submit(input);await controller.submit(input);assert.equal(jobs.length,1);
  const engine=new Engine(jobs,{profiles:()=>profiles,quotas:()=>({}),settings:()=>({edits:false,threshold:95,maxTasks:0,autoSwitch:false}),save:async()=>{},changed:()=>{},run:async(profile,step,job)=>{calls.push(step.role);recordPublicProgress(job,step,profile,{kind:'assistant',text:'Public fake-stage progress.'});return step.role==='auditor'?'{"summary":"read-only checked","issues":[],"tasks":[]}':step.role==='lead'?'{"decision":"approved","summary":"acceptance evidence checked"}':'bounded result';}});
  await engine.drain();assert.deepEqual(calls,['builder','auditor','lead']);assert.equal(jobs[0].status,'completed');assert.equal(jobs[0].acceptance?.length,2);
});
