import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine, newJob, stepPrompt } from '../src/core/engine';
import type { EngineHooks } from '../src/core/engine';
import type { Profile, Role } from '../src/core/domain';
import { answerOwner, ProviderLimit, QuotaWait } from '../src/core/domain';
const profiles: Profile[] = ['codex', 'claude', 'gemini'].map(provider => ({ id: provider, label: provider, executable: provider, provider: provider as Profile['provider'] }));
const team: Record<Role, string> = { builder: 'codex', auditor: 'claude', worker: 'gemini', lead: 'codex' };
function hooks(overrides: Partial<EngineHooks> = {}): EngineHooks {
  return {
    profiles: () => profiles, quotas: () => ({}), settings: () => ({ autoSwitch: false, threshold: 95, maxTasks: 4, edits: true }),
    save: async () => {}, changed: () => {}, run: async (_p, step) => {
      if (step.role === 'auditor') return JSON.stringify({ summary: 'one bug', issues: [{ title: 'bug', body: 'evidence', severity: 'bug' }], tasks: [{ title: 'repair', instructions: 'fix it' }] });
      if (step.role === 'lead') return JSON.stringify({ decision: 'approved', summary: 'verified' });
      return 'work done';
    }, ...overrides
  };
}
test('pipeline delegates bounded repairs, keeps audit read-only, stores role/profile evidence', async () => {
  const job = newJob('implement feature', '.', team);
  const calls: string[] = [];
  const base = hooks();
  const engine = new Engine([job], hooks({ run: async (p, s, j, edits, signal) => {
    calls.push(`${s.role}:${p.id}:${edits}`);
    return base.run(p, s, j, edits, signal);
  } }));
  await engine.drain();
  assert.equal(job.status, 'completed');
  assert.deepEqual(calls, ['builder:codex:true', 'auditor:claude:false', 'worker:gemini:true', 'lead:codex:false']);
  assert.equal(job.audit?.issues.length, 1);
  assert.match(stepPrompt(job, job.steps.at(-1)!), /untrusted evidence/);
});
test('invalid audit stops pipeline; changes_requested is never completed', async () => {
  const malformed = newJob('x', '.', team);
  await new Engine([malformed], hooks({ run: async () => 'not JSON' })).drain();
  assert.equal(malformed.status, 'failed');
  assert.equal(malformed.steps.length, 2);
  const rejected = newJob('x', '.', team);
  const base = hooks();
  await new Engine([rejected], hooks({ run: async (p, s, j, e, signal) => s.role === 'lead' ? '{"decision":"changes_requested","summary":"test failed"}' : base.run(p, s, j, e, signal) })).drain();
  assert.equal(rejected.status, 'needs_attention');
});
test('cancel aborts active CLI and does not dispatch following steps', async () => {
  const job = newJob('x', '.', team);
  let entered!: () => void;
  const ready = new Promise<void>(resolve => { entered = resolve; });
  const engine = new Engine([job], hooks({ run: async (_p, _s, _j, _e, signal) => {
    entered(); await new Promise<void>(resolve => signal.addEventListener('abort', () => resolve(), { once: true })); return 'partial';
  } }));
  const draining = engine.drain(); await ready; engine.cancel(job.id); await draining;
  assert.equal(job.status, 'cancelled'); assert.equal(job.steps.length, 1);
});
test('stop never starts queued tasks during host shutdown; concurrent drain is serialized', async () => {
  const jobs = [newJob('a', '.', team), newJob('b', '.', team)];
  let engine: Engine;
  let calls = 0;
  engine = new Engine(jobs, hooks({ run: async () => { calls++; engine.stop(); return 'partial'; } }));
  await Promise.all([engine.drain(), engine.drain()]);
  assert.equal(calls, 1); assert.equal(jobs[0].status, 'cancelled'); assert.equal(jobs[1].status, 'queued');
});
test('owner question pauses only that step; reply resumes without replaying completed work', async()=>{
  const job=newJob('x','.',team);const base=hooks();let audits=0;const calls:string[]=[];
  const engine=new Engine([job],hooks({run:async(p,s,j,e,signal)=>{
    calls.push(s.role);if(s.role==='auditor'&&audits++===0)return '{"needs_owner":true,"question":"Which behavior?"}';
    return base.run(p,s,j,e,signal);
  }}));
  await engine.drain();assert.equal(job.status,'waiting_owner');assert.equal(job.ownerQuestion,'Which behavior?');
  answerOwner(job,'Use behavior A');await engine.drain();assert.equal(job.status,'completed');
  assert.equal(calls.filter(r=>r==='builder').length,1);assert.equal(calls.filter(r=>r==='auditor').length,2);
  assert.match(job.steps[1].request!,/Use behavior A/);assert.match(job.steps[1].request!,/resuming after/);
});
test('three-node flow records findings without launching repair agents',async()=>{
  const job=newJob('x','.',team,['builder','auditor','lead']);
  await new Engine([job],hooks()).drain();assert.deepEqual(job.steps.map(s=>s.role),['builder','auditor','lead']);assert.equal(job.audit?.tasks.length,1);
});
test('quota preflight pauses before CLI side effects; provider limits preserve retry metadata',async()=>{
  const job=newJob('x','.',team);let limited=true,calls=0;
  const base=hooks();const engine=new Engine([job],hooks({chooseProfile:(_j,s)=>{if(limited)throw new QuotaWait('exhausted');return profiles.find(p=>p.id===team[s.role])!;},run:async(p,s,j,e,signal)=>{calls++;return base.run(p,s,j,e,signal);}}));
  await engine.drain();assert.equal(job.status,'waiting_quota');assert.equal(calls,0);assert.equal(job.steps[0].status,'pending');
  limited=false;job.status='queued';await engine.drain();assert.equal(job.status,'completed');
  const partial=newJob('x','.',team);
  await new Engine([partial],hooks({run:async()=>{throw new ProviderLimit('provider exhausted');}})).drain();
  assert.equal(partial.status,'waiting_quota');assert.equal(partial.steps[0].status,'pending');assert.equal(partial.blockedProfileId,'codex');assert.ok(partial.limitDetectedAt);
});
test('pause finishes current step and blocks the next; unpause resumes in order',async()=>{
  const job=newJob('x','.',team);let paused=false;const base=hooks();const calls:string[]=[];
  const engine=new Engine([job],hooks({canRun:()=>!paused,run:async(p,s,j,e,signal)=>{calls.push(s.role);if(s.role==='builder')paused=true;return base.run(p,s,j,e,signal);}}));
  await engine.drain();assert.equal(job.status,'queued');assert.deepEqual(calls,['builder']);
  paused=false;await engine.drain();assert.equal(job.status,'completed');assert.equal(calls.filter(x=>x==='builder').length,1);
});
test('immediate pause aborts current process and leaves a resumable step with previous work retained',async()=>{
  const job=newJob('x','.',team);let paused=false,entered!:()=>void;const ready=new Promise<void>(r=>entered=r);
  const base=hooks();let first=true;const engine=new Engine([job],hooks({canRun:()=>!paused,run:async(p,s,j,e,signal)=>{
    if(first){first=false;entered();await new Promise<void>(r=>signal.addEventListener('abort',()=>r(),{once:true}));throw new Error('paused');}return base.run(p,s,j,e,signal);
  }}));
  const active=engine.drain();await ready;paused=true;engine.pause();await active;
  assert.equal(job.status,'queued');assert.equal(job.steps[0].status,'pending');assert.equal(job.steps.length,1);
  paused=false;await engine.drain();assert.equal(job.status,'completed');assert.match(job.steps[0].request!,/resuming after/);
});
