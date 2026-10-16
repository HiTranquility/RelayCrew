import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assignTaskProfile, fresh, parseQuota, resolveTimezone } from '../src/core/domain';
import type { Profile, Quota, Role } from '../src/core/domain';
import { FileQuotaSource, QuotaService, usageStatus } from '../src/adapters/quota/quota-service';
import { newJob } from '../src/core/engine';
const profile:Profile={id:'a',label:'Account A',provider:'codex',executable:'codex'};
const team:Record<Role,string>={builder:'a',auditor:'a',worker:'a',lead:'a'};
test('multiple quota windows use the most constrained limit and require refresh after any reset',()=>{
  const now=Date.now();const q=parseQuota({observedAt:new Date(now).toISOString(),source:'test',windows:[{id:'5h',label:'5-hour',usedPercent:10,resetsAt:new Date(now+60000).toISOString()},{id:'week',label:'Weekly',usedPercent:99}]});
  assert.equal(q.usedPercent,99);assert.equal(fresh(q,now),true);assert.equal(fresh(q,now+60000),false);
  assert.throws(()=>parseQuota({...q,windows:[q.windows![0],q.windows![0]]}));
  assert.throws(()=>parseQuota({...q,windows:[{id:'bad',label:'Bad',usedPercent:Infinity}]}));
});
test('file quota source is bounded, refresh invalidates failed data and preserves manual-only observations',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'relay-quota-'));const path=join(dir,'quota.json');
  try{
    const q={usedPercent:50,source:'test',observedAt:new Date().toISOString()};await writeFile(path,JSON.stringify(q));
    const service=new QuotaService();const snapshots:Record<string,Quota>={manual:q};
    const errors=await service.refresh([{...profile,quotaFile:path},{...profile,id:'manual'}],snapshots);
    assert.deepEqual(errors,[]);assert.equal(snapshots.a.usedPercent,50);assert.equal(snapshots.manual.usedPercent,50);
    await writeFile(path,'x'.repeat(32001));assert.equal((await service.refresh([{...profile,quotaFile:path}],snapshots)).length,1);assert.equal(snapshots.a,undefined);
    await assert.rejects(new FileQuotaSource().read({...profile,quotaFile:'relative.json'}),/absolute/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('status bar follows the actual running account, not the default role assignment',()=>{
  const job=newJob('x','.',team);job.status='running';job.steps[0].status='running';job.steps[0].profileId='b';
  const profiles=[profile,{...profile,id:'b',label:'Rotated Account B'}];const now=Date.now();
  const quotas={b:{usedPercent:96,source:'test',observedAt:new Date(now).toISOString()}};
  const status=usageStatus(profiles,[job],quotas,95,now);assert.match(status.text,/Rotated Account B: 96%/);assert.equal(status.warning,true);
  assert.match(usageStatus(profiles,[],quotas,95,now).text,/1 unknown/);
});
test('task account changes require a paused state and pin only remaining work',()=>{
  const job=newJob('x','.',team);job.status='running';job.steps[0].status='running';
  const profiles=[profile,{...profile,id:'b'}];assert.throws(()=>assignTaskProfile(job,'builder','b',profiles),/Pause/);
  job.status='queued';job.steps[0].status='pending';job.overrides={builder:{model:'previous-override'}};
  assignTaskProfile(job,'builder','b',profiles);assert.equal(job.profilePins?.builder,'b');assert.equal(job.roles.builder,'b');assert.equal(job.overrides.builder,undefined);
  job.steps[0].status='done';job.steps[0].profileId='a';assert.throws(()=>assignTaskProfile(job,'builder','b',profiles),/finished/);assert.equal(job.steps[0].profileId,'a');
});
test('schedule timezone can use a system default without changing explicit zones',()=>{
  assert.equal(resolveTimezone('Asia/Bangkok'),'Asia/Bangkok');assert.equal(resolveTimezone(''),Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC');assert.throws(()=>resolveTimezone('invalid/timezone'));
});
