import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addEmailAccounts} from '../src/core/multiple-accounts';
import {accountDisplayNames,independentLogin} from '../src/core/account-identity';
import {applyRecovery,recoveryPlan} from '../src/core/recovery';
import {newJob,Engine} from '../src/core/engine';
import {ProviderLimit,routeProfile,rotateProfile,type Profile} from '../src/core/domain';
const now=Date.now(),q=(usedPercent:number,extra={})=>({usedPercent,observedAt:new Date(now).toISOString(),source:'test',...extra});
const profiles:Profile[]=[{id:'a',label:'A',provider:'codex',executable:'codex',env:{CODEX_HOME:'/accounts/a'},modelPolicy:'flagship'},{id:'b',label:'B',provider:'codex',executable:'codex',env:{CODEX_HOME:'/accounts/b'},modelPolicy:'flagship'}];
const policy={autoSwitch:true,resumeAfterQuota:true,resumeProviderLimited:true,threshold:95};
function blocked(){const j=newJob('Inspect safely','/repo',{builder:'a',auditor:'a',worker:'a',lead:'a'});j.readOnly=true;j.status='waiting_quota';j.steps[0].profileId='a';j.steps[0].limitRetries=1;j.blockedProfileId='a';j.limitDetectedAt=new Date(now).toISOString();j.error='Provider quota exhausted';return j;}
test('email setup preserves an existing Antigravity role ID, names two accounts honestly and copies no secrets',()=>{
 const existing:Profile={id:'agy-main',label:'Antigravity',provider:'antigravity',executable:'agy',env:{GEMINI_API_KEY:'sensitive'}};
 const next=addEmailAccounts('antigravity','owner@example.com\nbackup@example.com',[existing],'/accounts');
 assert.equal(next.length,2);assert.equal(next[0].id,'agy-main');assert.equal(next[0].preferred,true);assert.equal(next[1].accountEmail,'backup@example.com');assert.equal(next[1].env,undefined);assert.equal(next[1].secretEnv,undefined);
 // No credentials are created or Google identities selected from an email.
 const oauth=next.map(p=>({...p,env:undefined}));assert.equal(independentLogin(oauth[0],oauth[1]),false);assert.throws(()=>rotateProfile(oauth.map(p=>p.id),oauth,{},0,95));
 assert.equal(addEmailAccounts('antigravity','owner@example.com\nbackup@example.com',next,'/accounts').length,2);
 assert.throws(()=>addEmailAccounts('antigravity','bad',[existing],'/accounts'));
 const codex=addEmailAccounts('codex','one@example.com two@example.com',[],'/accounts');assert.ok(independentLogin(codex[0],codex[1]));assert.notEqual(codex[0].env!.CODEX_HOME,codex[1].env!.CODEX_HOME);
});
test('fallback refuses aliases of one login, exhausted token counts, excluded accounts and stale quota',()=>{
 const same=profiles.map(p=>({...p,env:undefined}));assert.throws(()=>routeProfile('a',same,{a:q(100),b:q(5)},true,95,now));
 for(const candidate of [{...profiles[1],fallbackEligible:false},profiles[1]]){
  const quota=candidate.fallbackEligible===false?q(5):q(5,{remainingTokens:0});assert.equal(recoveryPlan(blocked(),[profiles[0],candidate],{b:quota},policy,now).next,undefined);
 }
 assert.equal(recoveryPlan(blocked(),profiles,{b:q(5,{observedAt:new Date(now-300001).toISOString()})},policy,now).next,undefined);
 assert.equal(recoveryPlan(blocked(),profiles,{b:q(5)},{...policy,pools:{builder:['a']}},now).next,undefined);
});
test('recovery retries one unfinished step, preserves model settings, files, completed work and limits',()=>{
 const j=blocked();j.overrides={builder:{modelPolicy:'custom',model:'owner-model',effort:'medium'}};j.fileChanges=[{path:'src/work.ts',kind:'modified',at:new Date(now).toISOString(),stepIndex:0}];
 assert.equal(applyRecovery(j,profiles,{b:q(10)},{...policy,autoSwitch:false},true,now),false);
 assert.equal(applyRecovery(j,profiles,{b:q(10)},{...policy,resumeProviderLimited:false},true,now),false);
 assert.equal(applyRecovery(j,profiles,{b:q(10)},policy,true,now),true);assert.equal(j.status,'queued');assert.equal(j.profilePins!.builder,'b');assert.equal(j.overrides.builder!.model,'owner-model');assert.equal(j.steps.length,1);assert.equal(j.fileChanges.length,1);assert.equal(j.recoveryHistory!.length,1);assert.equal(j.steps[0].limitRetries,1);
 j.status='waiting_quota';j.blockedProfileId='b';j.steps[0].profileId='b';assert.equal(recoveryPlan(j,profiles,{a:q(5),b:q(100)},policy,now).next,undefined,'do not bounce back to an already attempted login');
 j.steps[0].limitRetries=3;assert.equal(applyRecovery(j,[...profiles,{...profiles[1],id:'c',env:{CODEX_HOME:'/accounts/c'}}],{c:q(1)},policy,true,now),false);
});
test('recovery does not replace manager or reviewer seats and cannot run in a cancelled task',()=>{
 const j=blocked();j.steps[0].role='lead';assert.equal(recoveryPlan(j,profiles,{b:q(5)},policy,now).next,undefined);
 j.steps[0].role='builder';j.status='cancelled';assert.equal(applyRecovery(j,profiles,{b:q(5)},policy,true,now),false);
});
test('a limited CLI resumes with the independent backup without replaying completed stages',async()=>{
 const j=newJob('Read-only chat','/repo',{builder:'a',auditor:'a',worker:'a',lead:'a'});j.kind='chat';j.readOnly=true;const calls:string[]=[];
 const engine=new Engine([j],{profiles:()=>profiles,quotas:()=>({a:q(5),b:q(5)}),settings:()=>({autoSwitch:false,threshold:95,maxTasks:4,edits:false}),save:async()=>{},changed:()=>{},run:async p=>{calls.push(p.id);if(p.id==='a')throw new ProviderLimit('quota');return 'Completed by backup';}});
 await engine.drain();assert.equal(j.status,'waiting_quota');assert.equal(applyRecovery(j,profiles,{b:q(5)},policy,true,now),true);await engine.drain();assert.equal(j.status,'completed');assert.deepEqual(calls,['a','b']);assert.equal(j.steps.length,1);assert.equal(j.blockedProfileId,undefined);
});

test('account emails remain visible in runtime labels without changing saved names or selecting a login',()=>{
 const p={...profiles[0],accountEmail:'owner@example.com',label:'Work'};const rendered=accountDisplayNames([p])[0];assert.equal(rendered.label,'Work · owner@example.com');assert.equal(p.label,'Work');assert.equal(independentLogin({...p,env:{CODEX_HOME:'/one'}},{...p,id:'another',env:{CODEX_HOME:'/two'}}),false);
});
test('preflight quota fallback records the selected backup and respects the per-account ceiling',async()=>{
 const candidates=[{...profiles[0],quotaCeiling:80},profiles[1]],quotas={a:q(81),b:q(5)},j=newJob('hello','/repo',{builder:'a',auditor:'a',worker:'a',lead:'a'});j.kind='chat';
 await new Engine([j],{profiles:()=>candidates,quotas:()=>quotas,settings:()=>({autoSwitch:true,threshold:95,maxTasks:4,edits:false}),save:async()=>{},changed:()=>{},run:async p=>'Reply from '+p.id}).drain();assert.equal(j.status,'completed');assert.equal(j.steps[0].profileId,'b');assert.equal(j.recoveryHistory?.[0].to,'b');
});
