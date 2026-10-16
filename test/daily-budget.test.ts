import {test} from 'node:test';
import assert from 'node:assert/strict';
import {budgetRuns,budgetModel,checkDailyBudget,observedDelta,validateDailyBudget} from '../src/core/daily-budget';
import {emptyDailyPlan,startDailyPlan,dailyProfile,makeDailyJob} from '../src/core/daily-plan';
const p={id:'dev',label:'Dev',provider:'codex' as const,executable:'codex'};
test('daily model ceiling and run budget gate each role before dispatch, including retries',()=>{
 const plan=emptyDailyPlan(),now=Date.now();startDailyPlan(plan,'/a','Asia/Bangkok',['dev'],20,95,now);const budget=validateDailyBudget({profileId:'dev',modelKey:'*',ceiling:70,maxAgentRuns:2},[p]);plan.budgets=[budget];
 const item:import('../src/core/daily-plan').DailyItem={id:'i',day:plan.day,profileId:'dev',prompt:'Useful work',category:'task' as const,acceptance:'- [ ] Tests pass'};plan.items.push(item);const job=makeDailyJob(plan,item,{primaryProfileId:'dev',coordinatorIds:[]});item.jobId=job.id;
 assert.equal(job.acceptance?.[0].text,'Tests pass');assert.equal(job.acceptance?.[0].checked,false);
 assert.throws(()=>dailyProfile(plan,'dev',[p],{dev:{usedPercent:70,observedAt:new Date(now).toISOString(),source:'file'}},[],now));
 job.steps[0].dailyAttempts=[{profileId:'dev',modelKey:'@automatic',at:'a'},{profileId:'dev',modelKey:'@automatic',at:'b'},{profileId:'other',modelKey:'pinned',at:'c'}];
 assert.equal(budgetRuns([job],'dev','*',new Set([job.id])),2);assert.throws(()=>checkDailyBudget([budget],p,[job],new Set([job.id])));assert.equal(budgetModel(p),'@automatic');
});
test('quota deltas are absent for repeated observations, reset windows and incompatible sources',()=>{
 const now=Date.now(),a={usedPercent:10,observedAt:new Date(now-1000).toISOString(),source:'file'};
 assert.equal(observedDelta(a,a),undefined);assert.equal(observedDelta(a,{...a,usedPercent:15,observedAt:new Date(now).toISOString()}),5);
 assert.equal(observedDelta(a,{...a,usedPercent:5,observedAt:new Date(now).toISOString()}),undefined);assert.equal(observedDelta(a,{...a,source:'manual'}),undefined);assert.equal(observedDelta(undefined,a),undefined);
});
