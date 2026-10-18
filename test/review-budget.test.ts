import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine,newJob,stepPrompt} from '../src/core/engine';
import {jobPromptTemplates} from '../src/core/delegation';
import {queueDirectionBranches} from '../src/core/session-branches';
import {answerOwner,type Step} from '../src/core/domain';
import {reviewPolicy} from '../src/core/review-budget';
import {switchPrimaryManager} from '../src/core/team-selection';
const roles={builder:'one',auditor:'one',worker:'one',lead:'one'};
const audit=(repair:boolean)=>JSON.stringify({summary:repair?'Concrete unresolved finding':'Inspected repaired diff; finding closed',issues:repair?[{title:'Finding',body:'src/file.ts:3 · evidence',severity:'bug'}]:[],tasks:repair?[{title:'Bounded repair',instructions:'Fix the observed behavior and verify it'}]:[]});
function hooks(run:(step:Step)=>string){return {profiles:()=>[{id:'one',label:'Account',provider:'codex' as const,executable:'mock'}],quotas:()=>({}),settings:()=>({autoSwitch:false,threshold:95,maxTasks:4,edits:true}),save:async()=>{},changed:()=>{},run:async(_p:unknown,s:Step)=>run(s)};}
test('repair/review oscillation stops at three rounds without manager approval or another provider call',async()=>{
 const job=newJob('Fix behavior','/repo',roles);job.reviewPolicy=reviewPolicy(3);const calls:Step[]=[];const h=hooks(step=>{calls.push(step);return step.role==='auditor'?audit(true):'Implemented bounded work';});
 await new Engine([job],h).drain();assert.equal(job.status,'needs_attention');assert.equal(calls.filter(s=>s.role==='builder').length,1);assert.equal(calls.filter(s=>s.role==='worker').length,2);assert.equal(calls.filter(s=>s.role==='auditor').length,3);assert.equal(calls.filter(s=>s.role==='lead').length,0);assert.equal(job.reviewStop?.round,3);assert.equal(job.audit?.tasks.length,1);
 job.status='queued';await new Engine([job],h).drain();assert.equal(calls.length,6);assert.equal(job.status,'needs_attention','requeue/restart cannot reset the saved budget');
});
test('an independent repair recheck closes findings before a manager can approve',async()=>{
 const job=newJob('Fix behavior','/repo',roles);job.reviewPolicy=reviewPolicy(3);const order:string[]=[];let audits=0;
 await new Engine([job],hooks(step=>{order.push(step.role);return step.role==='auditor'?audit(++audits===1):step.role==='lead'?'{"decision":"approved","summary":"Repair and recheck verified"}':'Work complete';})).drain();
 assert.equal(job.status,'completed');assert.deepEqual(order,['builder','auditor','worker','auditor','lead']);assert.equal(job.steps[3].postImplementationReview,true);assert.equal(job.steps[3].reviewRound,2);
});

test('a one-round budget allows initial implementation and audit but no repair batch',async()=>{
 const job=newJob('Fix behavior','/repo',roles);job.reviewPolicy=reviewPolicy(1);const order:string[]=[];
 await new Engine([job],hooks(step=>{order.push(step.role);return step.role==='auditor'?audit(true):'Initial work';})).drain();assert.deepEqual(order,['builder','auditor']);assert.equal(job.status,'needs_attention');assert.equal(job.reviewStop?.round,1);
});
test('plan/execute gets its first code audit after execution without padding a fixed worker minimum',async()=>{
 const job=newJob('Implement bounded task','/repo',roles);job.reviewPolicy=reviewPolicy(2);job.delegation={workflow:'plan-execute',mode:'fixed',minWorkers:1,maxWorkers:1};let audits=0;
 await new Engine([job],hooks(step=>step.role==='auditor'?audit(++audits===1):step.role==='lead'?'{"decision":"approved","summary":"Verified"}':'Done')).drain();
 assert.equal(job.status,'completed');assert.equal(audits,2);assert.equal(job.steps[1].reviewRound,0);assert.equal(job.steps[3].reviewRound,1);
});
test('owner replies cannot create unlimited repeated coding attempts',async()=>{
 const job=newJob('Task','/repo',roles);job.reviewPolicy=reviewPolicy(3);let calls=0;const h=hooks(()=>{calls++;return '{"needs_owner":true,"question":"Which bounded choice?"}';});
 for(let i=0;i<3;i++){await new Engine([job],h).drain();assert.equal(job.status,'waiting_owner');answerOwner(job,'Continue within the same scope');}
 await new Engine([job],h).drain();assert.equal(calls,3);assert.equal(job.status,'needs_attention');assert.ok(job.reviewStop);for(const value of [0,11,1.2,'3',NaN])assert.throws(()=>reviewPolicy(value));
});

test('a post-execution audit uses review instructions and the saved guide rather than the planner template',()=>{
 const job=newJob('Implement task','/repo',roles);job.reviewPolicy=reviewPolicy(3);job.delegation={workflow:'plan-execute',mode:'fixed',minWorkers:2,maxWorkers:2};job.promptTemplates=jobPromptTemplates(undefined,job.delegation);job.promptTemplates.roles.auditor.guideName='conventions.md';job.promptTemplates.roles.auditor.guideMarkdown='Check canonical module boundaries.';
 const request=stepPrompt(job,{role:'auditor',title:'Recheck',prompt:'Inspect repaired diff',status:'pending',reviewRound:1,postImplementationReview:true});
 assert.match(request,/independent read-only conventions auditor, not the planner/);assert.match(request,/Initial planning worker minimums do not apply/);assert.match(request,/Independently inspect the changed code/);assert.match(request,/Check canonical module boundaries/);assert.doesNotMatch(request,/Owner-configured role name: Planner/);assert.doesNotMatch(request,/This mapping takes precedence/);assert.match(request,/Required response contract/);
});

test('approved automatic follow-ups retain an independent copy of the saved review budget',()=>{
 const parent=newJob('Done','/repo',roles);parent.status='completed';parent.reviewPolicy=reviewPolicy(2);parent.direction={label:'A',title:'Scoped work',summary:'Summary',scope:'One module',plan:'Inspect and verify',structure:'src/',done:'Verified',risks:'None',branches:[{title:'Follow-up',prompt:'Check separate module',cwd:'/other'}]};parent.sessionBranching={maxBranches:1,scopes:[{path:'/other',permission:'read-only'}]};
 const [child]=queueDirectionBranches(parent,[parent]);assert.deepEqual(child.reviewPolicy,{maxRounds:2});parent.reviewPolicy.maxRounds=3;assert.equal(child.reviewPolicy?.maxRounds,2);
});
test('primary promotion preserves voters, policy and names while replacing the chair seat',()=>{
 const original={primaryProfileId:'a',coordinatorIds:['b','c'],deciderIds:['a','b'],decisionPolicy:'majority' as const,names:{a:'Chair A',b:'Reviewer B',c:'Observer'}};
 const promoted=switchPrimaryManager(original,'b',['a','b','c','d']);assert.deepEqual(promoted.coordinatorIds,['a','c']);assert.deepEqual(promoted.deciderIds,['b','a']);assert.equal(promoted.decisionPolicy,'majority');assert.equal(promoted.names?.a,'Chair A');assert.equal(original.primaryProfileId,'a');
 const outside=switchPrimaryManager(original,'d',['a','b','c','d']);assert.deepEqual(outside.coordinatorIds,['b','c']);assert.deepEqual(outside.deciderIds,['d','b']);assert.equal(outside.names?.a,undefined);assert.throws(()=>switchPrimaryManager(original,'missing',['a']));
});
