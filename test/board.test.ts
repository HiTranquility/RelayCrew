import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderBoard } from '../src/ui/board';
import { flowEditor } from '../src/ui/flow-editor';
import { newJob } from '../src/core/engine';
import { rotateProfile, validateFlow } from '../src/core/domain';
import type { Profile, Role } from '../src/core/domain';
import { backlogDecision } from '../src/core/utilization';
import { Script } from 'node:vm';
const roles:Record<Role,string>={builder:'a',auditor:'a',worker:'a',lead:'a'};
const p:Profile={id:'a',label:'Account A',provider:'codex',executable:'codex',model:'user-model',effort:'medium'};
test('board shows assignments, controls, quota source and public conversation while escaping HTML',()=>{
  const job=newJob('<img src=x onerror=alert(1)>','.',roles);job.timeline=[{at:'today',from:'builder:a',to:'auditor:a',kind:'response',text:'<script>evil</script>'}];
  const html=renderBoard([job],[p],{}, {items:[],enabled:false,remaining:0,until:0},'not connected');
  assert.match(html,/&lt;img src=x/);assert.ok(!html.includes('<script>evil</script>'));
  assert.match(html,/builder:a/);assert.match(html,/unknown/);assert.match(html,/data-action="cancel"/);assert.match(html,/script-src 'nonce-/);
  assert.ok(!html.includes('onerror=alert(1)>'));
  for(const script of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))assert.doesNotThrow(()=>new Script(script[1]));
});
test('flow designer allows only supported 3/4 node shapes and hides secret/env metadata',()=>{
  assert.deepEqual(validateFlow(['builder','auditor','lead']),['builder','auditor','lead']);assert.throws(()=>validateFlow(['worker','builder']));
  const html=flowEditor([{...p,env:{TOKEN:'SECRET_NOT_FOR_WEBVIEW'}}],['builder','auditor','lead'],roles,{builder:{model:'<bad-model>'}});
  assert.ok(!html.includes('SECRET_NOT_FOR_WEBVIEW'));assert.match(html,/&lt;bad-model&gt;/);assert.match(html,/saveFlow/);
  for(const script of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))assert.doesNotThrow(()=>new Script(script[1]));
});
test('round robin honors explicit cross-provider pool, skips exhausted/stale accounts, advances cursor',()=>{
  const now=Date.now();const quotas={a:{usedPercent:10,observedAt:new Date(now).toISOString(),source:'test'},b:{usedPercent:20,observedAt:new Date(now).toISOString(),source:'test'}};
  const profiles=[p,{...p,id:'b',provider:'claude' as const,model:'another'}];
  const first=rotateProfile(['a','b'],profiles,quotas,0,95,now);const second=rotateProfile(['a','b'],profiles,quotas,first.cursor,95,now);
  assert.equal(first.profile.id,'a');assert.equal(second.profile.id,'b');
  assert.equal(rotateProfile(['a','b'],profiles,{...quotas,a:{...quotas.a,usedPercent:100}},0,95,now).profile.id,'b');
  assert.throws(()=>rotateProfile(['a'],profiles,{},0,95,now));
});
test('useful backlog requires fresh capacity and obeys run/time/pause/failure budgets',()=>{
  const now=Date.now();const backlog={items:[{id:'1',prompt:'improve tests',cwd:'.'}],enabled:true,remaining:2,until:now+1000,sessionJobs:[] as string[]};
  const q={a:{usedPercent:10,observedAt:new Date(now).toISOString(),source:'test'}};
  const decide=(b=backlog,paused=false,quotas=q,jobs:any[]=[])=>backlogDecision(b,jobs,['builder'],()=>p,quotas,95,paused,now);
  assert.equal(decide().action,'run');assert.equal(decide(backlog,true).action,'wait');
  assert.equal(decide({...backlog,remaining:0}).action,'stop');assert.equal(decide({...backlog,until:now}).action,'stop');
  assert.equal(decide(backlog,false,{} as typeof q).action,'wait');
  const failed=newJob('x','.',roles);failed.status='failed';
  assert.equal(decide({...backlog,sessionJobs:[failed.id]},false,q,[failed]).action,'stop');
});
