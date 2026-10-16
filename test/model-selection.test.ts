import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveModel, recommendedModel } from '../src/adapters/cli/model-selection';
import { invocation } from '../src/adapters/cli/runner';
import { accountFromForm } from '../src/core/account';
import { routeProfile, rotateProfile, QuotaWait, type Profile } from '../src/core/domain';
import { dailyProfile, emptyDailyPlan, startDailyPlan } from '../src/core/daily-plan';
const profile:Profile={id:'a',label:'A',provider:'codex',executable:'codex'},signal=()=>new AbortController().signal;
test('automatic models follow live catalog recommendations without a pinned model version',async()=>{
  let calls=0;const load=async()=>{calls++;return {data:[{model:'old',isDefault:false},{model:'new-recommended',displayName:'New',isDefault:true}]};};
  const result=await resolveModel(profile,{},signal(),load);assert.equal(calls,1);assert.equal(result.profile.model,'new-recommended');assert.equal(result.source,'catalog');assert.ok(invocation(result.profile,'task',false,'out').args.includes('new-recommended'));
  assert.equal(recommendedModel({data:[{model:'hidden',isDefault:true,hidden:true}]}),undefined);
});
test('custom model choices remain optional and explicit CLI defaults bypass discovery',async()=>{
  const forbidden=async()=>{throw new Error('Discovery should not run');};
  const custom=await resolveModel({...profile,model:'user-model'}, {},signal(),forbidden);assert.equal(custom.profile.model,'user-model');assert.equal(custom.source,'custom');
  const native=await resolveModel({...profile,modelPolicy:'cli',model:'legacy-pin'}, {},signal(),forbidden);assert.equal(native.profile.model,undefined);assert.equal(native.source,'cli-default');
  const saved=accountFromForm({id:'a',label:'A',provider:'codex',executable:'codex',modelPolicy:'flagship',model:'old-pin',quotaCeiling:'85'},[]);assert.equal(saved.model,undefined);assert.equal(saved.quotaCeiling,85);
  for(const value of ['101','0','invalid',true,{}])assert.throws(()=>accountFromForm({id:'a',label:'A',provider:'codex',executable:'codex',quotaCeiling:value},[]));
});
test('provider flagship aliases update through the CLI and unresolved Codex catalogs are labelled honestly',async()=>{
  const load=async()=>{throw new Error('offline');};
  for(const [provider,alias]of [['claude','best'],['gemini','pro']] as const){const result=await resolveModel({...profile,provider}, {},signal(),load);assert.equal(result.profile.model,alias);assert.equal(result.source,'alias');}
  const fallback=await resolveModel(profile,{},signal(),load);assert.equal(fallback.profile.model,undefined);assert.equal(fallback.source,'cli-default');assert.match(fallback.note,/unavailable/);
  const aborted=new AbortController();aborted.abort();await assert.rejects(resolveModel(profile,{},aborted.signal,load));
});
test('account quota ceilings bound manual routing, compatible fallback and explicit rotation pools',()=>{
  const now=Date.now(),profiles=[{...profile,quotaCeiling:80},{...profile,id:'b',quotaCeiling:90}],quota=(usedPercent:number)=>({usedPercent,observedAt:new Date(now).toISOString(),source:'fixture'}),quotas={a:quota(81),b:quota(89)};
  assert.throws(()=>routeProfile('a',profiles,quotas,false,95,now),QuotaWait);assert.equal(routeProfile('a',profiles,quotas,true,95,now).id,'b');assert.equal(rotateProfile(['a','b'],profiles,quotas,0,95,now).profile.id,'b');
  assert.throws(()=>rotateProfile(['a','b'],profiles,{...quotas,b:quota(90)},0,95,now),QuotaWait);
});
test('daily plans honor the lower account ceiling and keep exhausted accounts waiting',()=>{
  const now=Date.now(),plan=emptyDailyPlan();startDailyPlan(plan,'/repo','UTC',['a'],3,95,now);const selected={...profile,quotaCeiling:70};
  const quota=(usedPercent:number)=>({a:{usedPercent,observedAt:new Date(now).toISOString(),source:'fixture'}});
  assert.equal(dailyProfile(plan,'a',[selected],quota(69),[],now).id,'a');assert.throws(()=>dailyProfile(plan,'a',[selected],quota(70),[],now),QuotaWait);
});
