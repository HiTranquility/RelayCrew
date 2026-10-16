import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newJob, stepPrompt } from '../src/core/engine';
import { taskProgress, acceptanceFromText, conversationEvents } from '../src/core/task-insights';
import { scheduleFromForm, scheduleOccurrences } from '../src/core/schedule-form';
import { claimSchedule } from '../src/core/domain';
import { renderResponse, renderTaskCards } from '../src/ui/task-workbench';
import { ConsoleController } from '../src/host/console-controller';
import { emptyDailyPlan,startDailyPlan,dailyDecision } from '../src/core/daily-plan';
import type { Profile } from '../src/core/domain';
import { renderLiveConsole } from '../src/ui/live-console';
const roles={builder:'a',auditor:'b',worker:'c',lead:'a'};

test('a selected older task remains inspectable beyond the recent-session window',()=>{
  const jobs=Array.from({length:25},(_,i)=>({...newJob(`Task ${i}`,'/repo',roles),createdAt:new Date(1700000000000+i*1000).toISOString()}));
  const html=renderLiveConsole(jobs,[],{queuePaused:false,autoSwitch:false,resumeAfterQuota:false,resumeProviderLimited:false,allowEdits:false,routingMode:'selected',timeoutMinutes:30,initialState:{consoleSelected:jobs[0].id}},'en');
  assert.match(html,new RegExp(`data-session-panel="${jobs[0].id}"`));assert.match(html,new RegExp(`data-session-panel="${jobs.at(-1)!.id}"`));assert.equal((html.match(/data-session-panel=/g)??[]).length,20);
});

test('daily explicit work uses HTTP accounts only read-only; repository maintenance needs a CLI and fresh quota',()=>{
  const now=Date.parse('2026-10-17T00:00:00Z'),plan=emptyDailyPlan(),profile:Profile={id:'local',label:'Local API',provider:'compatible',transport:'http',hosting:'local',endpoint:'http://localhost:11434/v1',executable:'http'};
  startDailyPlan(plan,'/repo','Asia/Bangkok',[profile.id],2,90,now);const quotas={local:{usedPercent:10,observedAt:new Date(now).toISOString(),source:'fixture'}};
  assert.notEqual(dailyDecision(plan,[],[profile],quotas,false,now).action,'run');plan.items.push({id:'review',day:plan.day,profileId:profile.id,prompt:'Review this supplied text: bounded retry specification.',category:'task'});assert.equal(dailyDecision(plan,[],[profile],quotas,false,now).action,'run');plan.allowEdits=true;assert.notEqual(dailyDecision(plan,[],[profile],quotas,false,now).action,'run');plan.allowEdits=false;assert.notEqual(dailyDecision(plan,[],[profile],{},false,now).action,'run');
});

test('task phase progress includes future audit/manager phases and stays separate from owner acceptance',()=>{
  const job=newJob('Feature','/repo',roles,['builder','auditor','worker','lead']);job.steps[0].status='done';job.acceptance=acceptanceFromText('- [x] Tests pass\n- Keyboard access');
  assert.equal(taskProgress(job).percent,33);assert.equal(taskProgress(job).total,3);assert.equal(taskProgress(job).criteriaDone,0);assert.equal(taskProgress(job).accounts,3);
  job.audit={summary:'repair',issues:[],tasks:[{title:'a',instructions:'a'},{title:'b',instructions:'b'}]};assert.equal(taskProgress(job).total,5);assert.equal(taskProgress(job).percent,20);
  job.acceptance[0].checked=true;assert.equal(taskProgress(job).criteriaDone,1);assert.match(stepPrompt(job,job.steps[0]),/Tests pass/);assert.match(stepPrompt(job,job.steps[0]),/owner checks acceptance/i);
  assert.throws(()=>acceptanceFromText('a\n'.repeat(31)));assert.throws(()=>acceptanceFromText('x'.repeat(501)));
});

test('console acceptance is persisted with the job before dispatch and duplicate requests do not duplicate criteria',async()=>{
  const jobs:ReturnType<typeof newJob>[]=[],controller=new ConsoleController({jobs,roots:()=>['/repo'],create:(prompt,cwd)=>newJob(prompt,cwd,roles),paused:()=>false,pause:()=>{},cancel:()=>{},changed:()=>{},save:async()=>{assert.equal(jobs[0].acceptance?.length,2);},start:()=>{assert.equal(jobs[0].acceptance?.[0].checked,false);}});
  const request={requestId:'console-12345678-1234-1234-1234-123456789abc',text:'Build feature',cwd:'/repo',acceptance:'Tests pass\nWorks with keyboard'};await controller.submit(request);await controller.submit(request);assert.equal(jobs.length,1);assert.equal(jobs[0].acceptance?.length,2);
});

test('public conversation renders clear audit findings and decisions without duplicating completed streams or executing HTML',()=>{
  const job=newJob('Feature','/repo',roles);job.timeline=[{at:'2026-10-17T00:00:00Z',from:'builder:a',to:'observer',kind:'stream',text:'already streamed'},{at:'2026-10-17T00:00:01Z',from:'builder:a',to:'orchestrator',kind:'response',text:'Final result'},{at:'2026-10-17T00:00:02Z',from:'auditor:b',to:'orchestrator',kind:'response',text:'{"summary":"Checked","issues":[{"title":"<script>bad</script>","body":"Evidence"}],"tasks":[]}'}];
  assert.equal(conversationEvents(job).length,2);const html=renderTaskCards([job],[], 'en');assert.match(html,/Team conversation/);assert.match(html,/Findings/);assert.match(html,/&lt;script&gt;bad/);assert.ok(!html.includes('<script>bad'));assert.ok(!html.includes('already streamed'));
  assert.match(renderResponse('{"summary":','en'),/Receiving a structured/);assert.match(renderResponse('{"decision":"approved","summary":"Tests pass"}','en'),/Approved/);
});

test('schedule form validates explicit timezones, future windows and workspace and snapshots independent criteria per recurrence',()=>{
  const now=Date.parse('2026-10-17T00:00:00Z'),form={title:'Night review',kind:'task',prompt:'Review API',cwd:'/repo',nextAt:'2026-10-17T09:00:00+07:00',cron:'0 9 * * *',timezone:'Asia/Bangkok',durationMinutes:'45',acceptance:'Evidence for every issue'};
  const schedule=scheduleFromForm(form,['/repo'],roles,undefined,now);assert.equal(schedule.nextAt,'2026-10-17T02:00:00.000Z');assert.equal(schedule.durationMinutes,45);assert.equal(schedule.acceptance?.[0].checked,false);
  const occurrences=scheduleOccurrences([schedule],now);assert.equal(occurrences.length,7);assert.equal(Date.parse(occurrences[0].end)-Date.parse(occurrences[0].at),45*60000);assert.equal(claimSchedule(schedule,new Date('2026-10-17T02:00:00Z'))?.next.nextAt,'2026-10-18T02:00:00.000Z');
  for(const bad of [{cwd:'/outside'},{nextAt:'2026-10-17T09:00:00'},{nextAt:'2026-10-16T09:00:00Z'},{durationMinutes:'0'},{cron:'invalid'},{timezone:'invalid'}])assert.throws(()=>scheduleFromForm({...form,...bad},['/repo'],roles,undefined,now));
  assert.equal(scheduleOccurrences([{...schedule,enabled:false}],now).length,0);
});
