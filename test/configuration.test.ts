import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flowConfiguration, manualQuota, routingConfiguration } from '../src/core/configuration';
import { renderBoard } from '../src/ui/board';
const profiles=[{id:'dev',label:'Dev',provider:'codex' as const,executable:'codex'},{id:'lead',label:'Lead',provider:'claude' as const,executable:'claude'}];
const roles={builder:'dev',auditor:'lead',worker:'dev',lead:'lead'};
test('inline team saves validate all accounts, role overrides and primary/coordinator authority before mutation',()=>{
  const request={flow:['builder','auditor','lead'],roles,overrides:{builder:{model:' exact-model ',effort:' medium '}},management:{primaryProfileId:'lead',coordinatorIds:['dev']}};
  const before=JSON.stringify(request),result=flowConfiguration(request,profiles);assert.equal(result.overrides.builder?.model,'exact-model');assert.equal(result.management.coordinatorIds[0],'dev');assert.equal(JSON.stringify(request),before);
  for(const value of [{...request,roles:{...roles,builder:'missing'}},{...request,management:{primaryProfileId:'dev',coordinatorIds:[]}},{...request,management:{primaryProfileId:'lead',coordinatorIds:['lead']}},{...request,overrides:{builder:{model:'x\nflag'}}},{...request,overrides:{lead:{executable:'sh'}}}])assert.throws(()=>flowConfiguration(value,profiles));
});
test('routing forms require a real nonempty pool per active role and reject duplicate or missing accounts',()=>{
  const pools={builder:['dev'],auditor:['lead'],lead:['lead']},request={mode:'roundRobin',pools};
  assert.deepEqual(routingConfiguration(request,profiles,['builder','auditor','lead']).pools.builder,['dev']);
  assert.throws(()=>routingConfiguration({...request,pools:{...pools,builder:[]}},profiles,['builder','auditor','lead']));
  assert.throws(()=>routingConfiguration({...request,pools:{...pools,builder:['dev','dev']}},profiles,['builder','auditor','lead']));
  assert.throws(()=>routingConfiguration({...request,pools:{...pools,builder:['missing']}},profiles,['builder','auditor','lead']));
  assert.equal(routingConfiguration({mode:'selected',pools:{}},profiles,['builder','auditor','lead']).mode,'selected');
});
test('manual quota forms keep omitted token counts unknown and validate explicit counts/reset timestamps',()=>{
  const quota=manualQuota({usedPercent:42});assert.equal(quota.remainingTokens,undefined);assert.equal(quota.source,'manual');assert.ok(Date.parse(quota.observedAt));
  assert.equal(manualQuota({usedPercent:20,remainingTokens:8,limitTokens:10}).remainingTokens,8);
  for(const value of [{usedPercent:NaN},{usedPercent:-1},{usedPercent:101},{usedPercent:40,remainingTokens:5,limitTokens:2},{usedPercent:40,resetsAt:'invalid'}])assert.throws(()=>manualQuota(value));
});
test('board embeds complete team/routing/quota/switch forms while keeping credential values out of HTML and drafts',()=>{
  const html=renderBoard([],profiles.map(p=>({...p,env:{TOKEN:'NEVER_RENDER_THIS'}})),{},{items:[],enabled:false,remaining:0,until:0},'',{queuePaused:false,autoSwitch:false,resumeAfterQuota:false,resumeProviderLimited:false,allowEdits:false,routingMode:'selected',timeoutMinutes:30,roles,flow:['builder','auditor','lead']});
  for(const id of ['team-form','routing-form','workflow-form','assignment-form','quota-form','connection-form','profile-secret-form'])assert.ok(html.includes(`id="${id}"`),id);
  assert.ok(!html.includes('NEVER_RENDER_THIS'));assert.ok(!html.includes('data-action="connectCli"'));
});
