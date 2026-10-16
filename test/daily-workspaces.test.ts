import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dailyWorkspaces,permissionAllows} from '../src/core/daily-workspaces';
import {emptyDailyPlan,startDailyPlan,makeDailyJob,dailyCanRun,dailyDecision} from '../src/core/daily-plan';
import {invocation} from '../src/adapters/cli/runner';
test('multi-folder validation rejects unapproved, duplicate and malformed permissions',()=>{
 assert.deepEqual(dailyWorkspaces([{path:'/a',permission:'auto'}],['/a']),[{path:'/a',permission:'auto',enabled:true}]);
 for(const raw of [[],[{path:'/b',permission:'full'}],[{path:'/a',permission:'custom'}],[{path:'/a',permission:'auto'},{path:'/a',permission:'full'}]])assert.throws(()=>dailyWorkspaces(raw,['/a']));
 assert.equal(permissionAllows('read-only','full'),false);assert.equal(permissionAllows('full','auto'),true);
});
test('daily jobs snapshot the item folder and never gain elevated permission from a plan change',()=>{
 const now=Date.now(),plan=emptyDailyPlan();startDailyPlan(plan,'/a','Asia/Bangkok',['dev'],10,95,now);plan.allowEdits=true;plan.workspaces=[{path:'/a',permission:'auto',enabled:true},{path:'/b',permission:'read-only',enabled:true}];
 const item={id:'b',day:plan.day,profileId:'dev',category:'task' as const,cwd:'/b',prompt:'Review only'};plan.items.push(item);
 const job=makeDailyJob(plan,item,{primaryProfileId:'dev',coordinatorIds:[]});assert.equal(job.cwd,'/b');assert.equal(job.readOnly,true);assert.equal(dailyCanRun(plan,job,now),true);
 plan.workspaces[1].permission='full';assert.equal(job.permission,'read-only');assert.equal(dailyCanRun(plan,job,now),true);
 job.permission='full';plan.workspaces[1].permission='auto';assert.equal(dailyCanRun(plan,job,now),false);
 const decision=dailyDecision(plan,[],[{id:'dev',label:'Dev',provider:'codex',executable:'codex'}],{dev:{usedPercent:2,observedAt:new Date(now).toISOString(),source:'test'}},false,now);assert.equal(decision.action,'run');
});
test('Full CLI flags apply only to explicitly editable steps',()=>{
 for(const provider of ['codex','claude','gemini','antigravity'] as const){
  const p={id:'p',label:'P',provider,executable:provider};const readonly=invocation(p,'x',false,'out',[],'full'),full=invocation(p,'x',true,'out',[],'full');
  assert.ok(!readonly.args.some(a=>/bypassPermissions|dangerously|yolo/.test(a)));assert.ok(full.args.some(a=>/bypassPermissions|dangerously|yolo/.test(a)));
 }
});
