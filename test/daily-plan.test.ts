import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answerOwner, assignCoordinatorProfile, assignTaskProfile, validateManagement, type Profile, type Role } from '../src/core/domain';
import { Engine, newJob, type EngineHooks } from '../src/core/engine';
import { carryDailyTasks, dailyCanRun, dailyDecision, dailyProfile, dailyPrompt, emptyDailyPlan, makeDailyJob, startDailyPlan, syncDecisions } from '../src/core/daily-plan';

const profiles: Profile[] = [
  { id: 'dev', label: 'Dev', provider: 'codex', executable: 'codex' },
  { id: 'claude-primary', label: 'Claude main', provider: 'claude', executable: 'claude', model: 'same-model' },
  { id: 'claude-support', label: 'Claude support', provider: 'claude', executable: 'claude', model: 'same-model' },
  { id: 'weak', label: 'Excluded model', provider: 'gemini', executable: 'gemini' },
];
const roles: Record<Role,string> = { builder:'dev',auditor:'dev',worker:'dev',lead:'claude-primary' };
const management = { primaryProfileId: 'claude-primary', coordinatorIds: ['claude-support'] };
const now=Date.parse('2026-10-16T07:00:00Z');
function fixture(ids=['dev','claude-primary','claude-support']) {
  const plan=emptyDailyPlan();startDailyPlan(plan,'.','Asia/Bangkok',ids,20,95,now);
  const quotas=Object.fromEntries(profiles.map(profile=>[profile.id,{usedPercent:10,observedAt:new Date(now).toISOString(),source:'fixture'}]));
  return {plan,quotas};
}
function hooks(overrides:Partial<EngineHooks>={}):EngineHooks {
  return {profiles:()=>profiles,quotas:()=>({}),settings:()=>({autoSwitch:true,threshold:95,maxTasks:4,edits:true}),save:async()=>{},changed:()=>{},run:async(_p,step)=>step.role==='auditor'?'{"summary":"reviewed","issues":[],"tasks":[]}':step.role==='lead'?'{"decision":"approved","summary":"verified"}':'work done',...overrides};
}
test('daily plan expires at midnight in its configured timezone and validates budgets',()=>{
  const {plan}=fixture();assert.equal(plan.day,'2026-10-16');assert.equal(new Date(plan.until).toISOString(),'2026-10-16T17:00:00.000Z');
  assert.throws(()=>startDailyPlan(plan,'.','Asia/Bangkok',[],20,95,now));
  assert.throws(()=>startDailyPlan(plan,'.','Asia/Bangkok',['dev'],201,95,now));
  assert.throws(()=>startDailyPlan(plan,'.','Asia/Bangkok',['dev'],20,101,now));
});
test('daily account gates exclude disabled, exhausted, unknown, stale and zero-token profiles',()=>{
  const {plan,quotas}=fixture(['dev']);
  assert.equal(dailyProfile(plan,'dev',profiles,quotas,[],now).id,'dev');
  assert.throws(()=>dailyProfile(plan,'weak',profiles,quotas,[],now));
  for(const q of [undefined,{...quotas.dev,usedPercent:95},{...quotas.dev,remainingTokens:0},{...quotas.dev,observedAt:new Date(now-300001).toISOString()}])assert.throws(()=>dailyProfile(plan,'dev',profiles,{...quotas,dev:q as any},[],now));
  plan.enabled=false;assert.throws(()=>dailyProfile(plan,'dev',profiles,quotas,[],now));
});
test('a provider limit blocks new daily work until a newer available observation arrives',()=>{
  const {plan,quotas}=fixture(['dev']);const limited=newJob('x','.',roles);limited.blockedProfileId='dev';limited.limitDetectedAt=new Date(now).toISOString();
  assert.throws(()=>dailyProfile(plan,'dev',profiles,quotas,[limited],now));
  assert.equal(dailyProfile(plan,'dev',profiles,{...quotas,dev:{...quotas.dev,observedAt:new Date(now+1).toISOString()}},[limited],now+1).id,'dev');
});
test('blocked owner decisions permit bounded independent maintenance without resuming the decision',()=>{
  const {plan,quotas}=fixture(['dev']);const blocked=newJob('Choose architecture','.',roles);blocked.dailyItemId='owner-task';blocked.status='waiting_owner';blocked.ownerQuestion='Which database?';blocked.steps[0].status='waiting_owner';
  plan.items.push({id:'owner-task',day:plan.day,profileId:'dev',category:'task',prompt:'Choose architecture',jobId:blocked.id});
  const jobs=[blocked];syncDecisions(plan,jobs,now);
  for(let i=0;i<5;i++){
    const decision=dailyDecision(plan,jobs,profiles,quotas,false,now);assert.equal(decision.action,'run');if(decision.action!=='run')throw Error('Expected maintenance');
    assert.equal(decision.generated,true);assert.equal(decision.item.profileId,'dev');assert.notEqual(decision.item.category,'task');
    assert.match(dailyPrompt(plan,decision.item),/Which database/);assert.match(dailyPrompt(plan,decision.item),/Do not resolve, bypass or implement/);
    const job=makeDailyJob(plan,decision.item,{primaryProfileId:'dev',coordinatorIds:[]});job.status='completed';decision.item.jobId=job.id;plan.items.push(decision.item);jobs.push(job);plan.remainingRuns--;
  }
  assert.equal(dailyDecision(plan,jobs,profiles,quotas,false,now).action,'wait');assert.equal(blocked.status,'waiting_owner');assert.equal(plan.decisions[0].status,'pending');
});
test('daily decisions preserve question/answer history and do not duplicate records after recovery',()=>{
  const {plan}=fixture();const job=newJob('task','.',roles);job.status='waiting_owner';job.ownerQuestion='Which behavior?';job.steps[0].status='waiting_owner';
  plan.items.push({id:'1',day:plan.day,profileId:'dev',category:'task',prompt:'task',jobId:job.id});syncDecisions(plan,[job],now);syncDecisions(plan,[job],now);
  assert.equal(plan.decisions.length,1);answerOwner(job,'Option A');syncDecisions(plan,[job],now);
  assert.equal(plan.decisions[0].question,'Which behavior?');assert.match(plan.decisions[0].answer!,/Option A/);assert.equal(plan.decisions[0].status,'answered');
  const restored=JSON.parse(JSON.stringify(plan));syncDecisions(restored,[job],now);assert.equal(restored.decisions.length,1);
});
test('last budgeted task may finish; midnight, pause and account exclusion stop daily dispatch',()=>{
  const {plan,quotas}=fixture(['dev']);const item={id:'one',day:plan.day,profileId:'dev',category:'task' as const,prompt:'test'};const job=makeDailyJob(plan,item,{primaryProfileId:'dev',coordinatorIds:[]});plan.items.push({...item,jobId:job.id});
  plan.remainingRuns=0;assert.equal(dailyCanRun(plan,job,now),true);assert.equal(dailyDecision(plan,[job],profiles,quotas,false,now).action,'wait');
  job.status='waiting_quota';assert.equal(dailyDecision(plan,[job],profiles,quotas,false,now).action,'wait');
  job.status='completed';assert.equal(dailyDecision(plan,[job],profiles,quotas,false,now).action,'stop');assert.equal(dailyCanRun(plan,job,plan.until),false);
  plan.accounts.dev=false;assert.equal(dailyCanRun(plan,job,now),false);
});

test('starting another day or project cannot automatically replay earlier daily tasks',()=>{
  const {plan}=fixture(['dev']);const item={id:'old',day:plan.day,profileId:'dev',category:'task' as const,prompt:'work'};
  const job=makeDailyJob(plan,item,{primaryProfileId:'dev',coordinatorIds:[]});plan.items.push({...item,jobId:job.id});
  startDailyPlan(plan,'another-project','Asia/Bangkok',['dev'],20,95,now);
  assert.equal(dailyCanRun(plan,job,now),false);
  startDailyPlan(plan,'.','Asia/Bangkok',['dev'],20,95,now+86400000);
  assert.equal(dailyCanRun(plan,job,now+86400000),false);
  job.status='waiting_owner';job.ownerQuestion='Keep compatible behavior?';
  carryDailyTasks(plan,[job],[job.id]);assert.equal(dailyCanRun(plan,job,now+86400000),true);
  assert.equal(job.ownerQuestion,'Keep compatible behavior?');assert.equal(plan.remainingRuns,19);
  assert.throws(()=>carryDailyTasks(plan,[job],[job.id,job.id]));
});
test('pausing/excluding a daily task does not block unrelated manual tasks',async()=>{
  const {plan}=fixture(['dev']);const item={id:'one',day:plan.day,profileId:'dev',category:'task' as const,prompt:'daily'};const daily=makeDailyJob(plan,item,{primaryProfileId:'dev',coordinatorIds:[]});plan.items.push({...item,jobId:daily.id});plan.enabled=false;
  const manual=newJob('manual','.',roles);const calls:string[]=[];const base=hooks();
  await new Engine([daily,manual],hooks({canRun:job=>!job||dailyCanRun(plan,job,now),run:async(p,s,j,e,signal)=>{calls.push(j.id);return base.run(p,s,j,e,signal);}})).drain();
  assert.equal(daily.status,'queued');assert.equal(manual.status,'completed');assert.ok(calls.every(id=>id===manual.id));
});
test('daily jobs preserve primary authority, filter excluded coordinators and default to read-only',async()=>{
  const {plan,quotas}=fixture(['dev']);const item={id:'one',day:plan.day,profileId:'dev',category:'task' as const,prompt:'review'};const job=makeDailyJob(plan,item,management);plan.items.push({...item,jobId:job.id});
  assert.equal(job.roles.lead,'claude-primary');assert.deepEqual(job.management?.coordinatorIds,[]);assert.equal(job.readOnly,true);assert.deepEqual(job.overrides,{});
  const calls:string[]=[],base=hooks();
  await new Engine([job],hooks({chooseProfile:(j,s)=>dailyProfile(plan,s.coordinatorProfileId??j.profilePins?.[s.role]??j.roles[s.role],profiles,quotas,[job],now),run:async(p,s,j,edits,signal)=>{assert.equal(edits,false);calls.push(p.id);return base.run(p,s,j,edits,signal);}})).drain();
  assert.equal(job.status,'waiting_quota');assert.deepEqual(calls,['dev','dev']);assert.equal(job.roles.lead,'claude-primary');
});
test('supporting manager reports are read-only evidence; only the selected primary decides',async()=>{
  const job=newJob('implement','.',roles,['builder','auditor','lead'],{},management);const calls:string[]=[],base=hooks();
  await new Engine([job],hooks({run:async(p,s,j,edits,signal)=>{
    calls.push(p.id);if(s.coordinatorProfileId){assert.equal(p.id,'claude-support');assert.equal(edits,false);return '{"decision":"approved","summary":"supporting evidence"}';}
    if(s.role==='lead'){assert.equal(p.id,'claude-primary');assert.equal(j.status,'running');assert.equal(edits,false);assert.match(s.request!,/supporting evidence/);return '{"decision":"changes_requested","summary":"primary requires changes"}';}
    return base.run(p,s,j,edits,signal);
  }})).drain();
  assert.deepEqual(calls,['dev','dev','claude-support','claude-primary']);assert.equal(job.status,'needs_attention');
});
test('supporting manager owner question pauses before the primary is invoked',async()=>{
  const job=newJob('implement','.',roles,['builder','auditor','lead'],{},management);const base=hooks();let primaryCalls=0;
  await new Engine([job],hooks({run:async(p,s,j,e,signal)=>{if(s.coordinatorProfileId)return '{"needs_owner":true,"question":"Approve breaking change?"}';if(s.role==='lead')primaryCalls++;return base.run(p,s,j,e,signal);}})).drain();
  assert.equal(job.status,'waiting_owner');assert.equal(primaryCalls,0);assert.equal(job.steps.find(s=>s.status==='waiting_owner')?.profileId,'claude-support');
});
test('automatic fallback cannot silently replace a quota-limited primary manager',async()=>{
  const job=newJob('implement','.',roles,['builder','auditor','lead'],{},management);const snapshot={usedPercent:100,observedAt:new Date().toISOString(),source:'fixture'};const calls:string[]=[],base=hooks();
  await new Engine([job],hooks({quotas:()=>({'claude-primary':snapshot,'claude-support':{...snapshot,usedPercent:0}}),run:async(p,s,j,e,signal)=>{calls.push(p.id);return base.run(p,s,j,e,signal);}})).drain();
  assert.equal(job.status,'waiting_quota');assert.equal(calls.at(-1),'claude-support');assert.equal(job.roles.lead,'claude-primary');
});
test('management validates distinct identities even for two accounts using the same provider/model',()=>{
  assert.deepEqual(validateManagement(management,profiles),management);
  assert.throws(()=>validateManagement({primaryProfileId:'claude-primary',coordinatorIds:['claude-primary']},profiles));
  assert.throws(()=>validateManagement({primaryProfileId:'missing',coordinatorIds:[]},profiles));
  assert.throws(()=>validateManagement({...management,coordinatorIds:['claude-support','claude-support']},profiles));
});

test('switching an unfinished coordinator preserves primary authority and rejects conflicting accounts',async()=>{
  const job=newJob('implement','.',roles,['builder','auditor','lead'],{},management);
  const base=hooks();
  await new Engine([job],hooks({run:async(p,s,j,e,signal)=>s.coordinatorProfileId?'{"needs_owner":true,"question":"Which approach?"}':base.run(p,s,j,e,signal)})).drain();
  const index=job.steps.findIndex(s=>s.coordinatorProfileId);
  assert.throws(()=>assignTaskProfile(job,'lead','claude-support',profiles));
  assert.throws(()=>assignCoordinatorProfile(job,index,'claude-primary',profiles));
  assignCoordinatorProfile(job,index,'weak',profiles);
  assert.equal(job.steps[index].coordinatorProfileId,'weak');
  assert.equal(job.roles.lead,'claude-primary');assert.equal(job.profilePins?.lead,'claude-primary');
  assert.deepEqual(job.management?.coordinatorIds,['weak']);
  job.status='running';assert.throws(()=>assignCoordinatorProfile(job,index,'claude-support',profiles));
});
