import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine,newJob,type EngineHooks} from '../src/core/engine';
import {chooseDecisionPolicy,rememberDecisionPolicy,resolveReviewDecision} from '../src/core/review-team';
import {flowConfiguration} from '../src/core/configuration';
import type {DecisionPolicy,Profile} from '../src/core/domain';
const profiles:Profile[]=['dev','audit1','audit2','m1','m2','m3'].map(id=>({id,label:id,provider:'codex',executable:'fake'})),roles={builder:'dev',auditor:'audit1',worker:'dev',lead:'m1'};
function job(policy:DecisionPolicy='all',ids=['m1','m2']){const j=newJob('Review','.',roles,undefined,{}, {primaryProfileId:'m1',coordinatorIds:ids.slice(1),deciderIds:ids,decisionPolicy:policy,names:Object.fromEntries(ids.map((id,i)=>[id,'Manager '+(i+1)]))});j.auditors=[{profileId:'audit2',name:'Audit 2'}];return j;}
function hooks(votes:Record<string,string>,calls:string[]=[]):EngineHooks{return {profiles:()=>profiles,quotas:()=>({}),settings:()=>({autoSwitch:false,threshold:95,maxTasks:2,edits:false}),save:async()=>{},changed:()=>{},run:async(p,s,_j,edits)=>{assert.equal(edits,false);calls.push(p.id);if(s.role==='auditor')return JSON.stringify({summary:p.id+' evidence',issues:[],tasks:s.reviewProfileId?[]:[{title:'Bounded check',instructions:'Read one scope'}]});if(s.role==='lead')return JSON.stringify({decision:votes[p.id]??'approved',summary:p.id+' public rationale'});return 'evidence';}};}
test('additional auditors run before workers and their aggregate tasks share one hard ceiling',async()=>{
 const j=job(),calls:string[]=[];await new Engine([j],hooks({},calls)).drain();assert.equal(j.status,'completed');assert.deepEqual(calls,['dev','audit1','audit2','dev','m2','m1']);assert.equal(j.audit?.tasks.length,1);assert.equal(j.steps.find(s=>s.role==='worker')?.parentStepIndex,1);assert.equal(j.reviewDecision?.votes.length,2);
 const excessive=job(),base=hooks({});await new Engine([excessive],{...base,run:async(p,s,j,e,signal)=>s.role==='auditor'?JSON.stringify({summary:p.id,issues:[],tasks:[{title:p.id+'a',instructions:'a'},{title:p.id+'b',instructions:'b'}]}):base.run(p,s,j,e,signal)}).drain();assert.equal(excessive.status,'failed');assert.equal(excessive.steps.filter(s=>s.role==='worker').length,0);
});
test('all three decision policies preserve dissent; unresolved outcomes wait for explicit owner resolution',async()=>{
 for(const [policy,ids,votes,outcome]of [['all',['m1','m2'],{m2:'changes_requested'},'blocked'],['majority',['m1','m2'],{m2:'changes_requested'},'tie'],['majority',['m1','m2','m3'],{m2:'changes_requested'},'approved'],['chair',['m1','m2'],{m2:'changes_requested'},'approved']] as const){const j=job(policy,[...ids]);await new Engine([j],hooks(votes)).drain();assert.equal(j.reviewDecision?.outcome,outcome);assert.equal(j.status,outcome==='approved'?'completed':'waiting_owner');assert.ok(j.reviewDecision!.votes.some(v=>v.decision==='changes_requested'));if(j.status==='waiting_owner'){const before=JSON.stringify(j.reviewDecision!.votes);resolveReviewDecision(j,'changes_requested');assert.equal(j.status,'needs_attention');assert.equal(JSON.stringify(j.reviewDecision!.votes),before);assert.throws(()=>resolveReviewDecision(j,'approved'));}}
 const override=job();await new Engine([override],hooks({m2:'changes_requested'})).drain();resolveReviewDecision(override,'approved');assert.equal(override.status,'completed');assert.equal(override.reviewDecision?.ownerResolution,'approved');assert.ok(override.timeline?.some(e=>e.kind==='owner_decision'));
});
test('ask-before-run makes no provider call and records the selected task policy without changing other jobs',async()=>{
 const j=job('ask'),calls:string[]=[],engine=new Engine([j],hooks({},calls));await engine.drain();assert.equal(calls.length,0);assert.equal(j.status,'waiting_owner');assert.equal(j.decisionPolicyPending,true);assert.throws(()=>chooseDecisionPolicy(j,'invented'));chooseDecisionPolicy(j,'majority');await engine.drain();assert.equal(j.status,'completed');assert.equal(j.management?.decisionPolicy,'majority');assert.equal(job('ask').management?.decisionPolicy,'ask');
});
test('configuration rejects duplicate auditors, unknown voting managers and invalid policy/names',()=>{
 const j=job(),value={roles,flow:j.flow,overrides:{},management:j.management,auditors:j.auditors};assert.equal(flowConfiguration(value,profiles).auditors?.[0].name,'Audit 2');for(const raw of [{...value,auditors:[{profileId:'audit1',name:'duplicate'}]},{...value,management:{...j.management,deciderIds:['m1','audit1']}},{...value,management:{...j.management,decisionPolicy:'unbounded'}},{...value,management:{...j.management,names:{m1:'x\ny'}}}])assert.throws(()=>flowConfiguration(raw,profiles));
});

test('remembered policy resumes only unstarted members of the same folder group and keeps other snapshots',()=>{
 const source=job('ask'),waiting=job('ask'),queued=job('ask'),otherGroup=job('ask'),started=job('ask'),differentTeam=job('ask',['m1','m3']);
 for(const [index,j]of [source,waiting,queued,started,differentTeam].entries())j.batch={id:'group',prompt:'Review',folders:['one','two'],index};
 otherGroup.batch={id:'other',prompt:'Review',folders:['one','two'],index:0};started.steps[0].attempts=1;
 source.status=waiting.status='waiting_owner';source.decisionPolicyPending=waiting.decisionPolicyPending=true;chooseDecisionPolicy(source,'majority');const saved=structuredClone(waiting.management!);
 rememberDecisionPolicy(source,saved,[source,waiting,queued,otherGroup,started,differentTeam]);assert.equal(saved.decisionPolicy,'majority');assert.equal(waiting.status,'queued');assert.equal(waiting.decisionPolicyPending,false);assert.equal(queued.management!.decisionPolicy,'majority');for(const j of [otherGroup,started,differentTeam])assert.equal(j.management!.decisionPolicy,'ask');
});
