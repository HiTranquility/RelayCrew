import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseClaudeAuth,parseCodexAccount,parseAntigravityUsage,identityMatches} from '../src/adapters/cli/account-data';
import {accountReadout,accountList} from '../src/ui/account-list';
import {CodexQuotaSource} from '../src/adapters/quota/codex-source';
import {QuotaService} from '../src/adapters/quota/quota-service';
import type {Quota} from '../src/core/domain';

const profile={id:'one',label:'Account 1',provider:'codex' as const,executable:'codex',accountEmail:'owner@example.com'};
test('native identity readers whitelist email/plan and never return tokens or whole auth responses',()=>{
 const claude=parseClaudeAuth({loggedIn:true,email:'owner@example.com',subscriptionType:'pro',authMethod:'claude.ai',access_token:'must-not-appear',refresh_token:'also-private'});
 assert.equal(claude.identity?.email,'owner@example.com');assert.equal(claude.identity?.plan,'pro');assert.ok(!JSON.stringify(claude).includes('private'));assert.ok(!JSON.stringify(claude).includes('token'));
 assert.equal(parseClaudeAuth({loggedIn:false,email:'stale@example.com'}).identity,undefined);
 const codex=parseCodexAccount({account:{type:'chatgpt',email:'owner@example.com',planType:'plus',token:'private'}},{});
 assert.equal(codex.identity?.plan,'plus');assert.ok(!JSON.stringify(codex).includes('private'));assert.equal(parseCodexAccount({account:null},{}).authenticated,'no');
 assert.equal(identityMatches({...profile,accountEmail:'OWNER@example.com'},claude),true);
 assert.equal(identityMatches({...profile,accountEmail:'other@example.com'},claude),false);
 assert.equal(identityMatches(profile,{authenticated:'unknown'}),false);
});
test('Codex quota uses the codex bucket and both windows without mixing unrelated model limits',()=>{
 const w=(usedPercent:number,minutes:number)=>({usedPercent,windowDurationMins:minutes,resetsAt:1900000000});
 const data=parseCodexAccount({account:{type:'chatgpt',email:profile.accountEmail}},{rateLimits:{primary:w(99,300)},rateLimitsByLimitId:{codex:{primary:w(40,300),secondary:w(15,10080)},unrelated:{limitName:'Another model',primary:w(100,300)}}});
 assert.equal(data.quota?.usedPercent,40);assert.equal(data.usage?.windows.length,3);assert.equal(data.usage?.windows[0].remainingPercent,60);assert.equal(data.quota?.windows?.[1].label,'7d');assert.equal(data.quota?.windows?.[0].resetsAt,'2030-03-17T17:46:40.000Z');
 const legacy=parseCodexAccount({}, {rateLimits:{primary:w(50,300)}});assert.equal(legacy.quota?.usedPercent,50);
 assert.equal(parseCodexAccount({}, {rateLimitsByLimitId:{unrelated:{primary:w(100,300)}}}).quota,undefined);
 for(const usedPercent of [null,'20',NaN,101,-1])assert.equal(parseCodexAccount({}, {rateLimits:{primary:{usedPercent}}}).quota,undefined);
});
test('Antigravity usage preserves model groups, zero, disabled and unknown reset separately',()=>{
 const usage=parseAntigravityUsage('Gemini Models\tWeekly Limit Remaining\t80%\t2026-10-24T02:50:12Z\nClaude and GPT models\tWeekly Limit Remaining\t0%\t2026-10-19T02:18:49Z\nClaude and GPT models\tFive Hour Limit Remaining\tdisabled\t\nwrong\tbad\t101%\tinvalid\nnoise and secrets never parsed');
 assert.equal(usage?.scope,'shared-cli');assert.equal(usage?.windows.length,3);assert.equal(usage?.windows[1].remainingPercent,0);assert.equal(usage?.windows[2].remainingPercent,undefined);assert.equal(usage?.windows[2].disabled,true);assert.equal(usage?.windows[2].resetsAt,undefined);
 assert.equal(parseAntigravityUsage('permission denied'),undefined);assert.ok(!JSON.stringify(usage).includes('secrets'));
});
test('account UI distinguishes verified identity, mismatches, shared quota and unavailable token balances',()=>{
 const usage=parseAntigravityUsage('Gemini Models\tWeekly\t80%\t2026-10-24T02:50:12Z');
 const status={installed:true,authenticated:'yes' as const,checkedAt:new Date().toISOString(),message:'Checked',identity:{email:'other@example.com'},usage};
 const html=accountReadout(profile,status,'en');assert.match(html,/differs from the profile email/);assert.match(html,/Current shared CLI login/);assert.match(html,/does not verify either email/);assert.match(html,/80%/);assert.ok(!html.includes('80000'));
 const list=accountList([profile],{one:status},'vi');assert.match(list,/data-account-row="one"/);assert.match(list,/data-action="loginCli"/);assert.match(list,/data-account-usage="one"/);assert.match(list,/owner@example.com/);assert.match(list,/other@example.com/);
 const escaped=accountReadout(profile,{...status,identity:{email:'<img src=x>'}},'en');assert.ok(!escaped.includes('<img src=x>'));assert.match(escaped,/&lt;img/);
});
test('native quota source invalidates mismatched, unavailable and missing observations instead of routing on old data',async()=>{
 const quota:Quota={usedPercent:40,observedAt:new Date().toISOString(),source:'native fixture'};
 let email='different@example.com',fail=false,seen='';const selected={...profile,executable:process.execPath};
 const source=new CodexQuotaSource(async()=>({}),(_p,data)=>{seen=data.identity?.email??'';},async()=>{if(fail)throw new Error('offline');return {authenticated:'yes',identity:{email},quota};});
 assert.equal(source.supports({...selected,quotaFile:'/quota.json'}),false);assert.equal(source.supports({...selected,transport:'http'}),false);
 const snapshots:Record<string,Quota>={one:quota};const service=new QuotaService([source]);await service.refresh([selected],snapshots);assert.equal(snapshots.one,undefined);assert.equal(seen,email);
 email=profile.accountEmail;await service.refresh([selected],snapshots);assert.equal((snapshots.one as Quota|undefined)?.usedPercent,40);
 fail=true;const errors=await service.refresh([selected],snapshots);assert.equal(errors.length,1);assert.equal(snapshots.one,undefined);
});
