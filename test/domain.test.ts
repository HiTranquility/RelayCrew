import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claimSchedule, fresh, nextCron, parseAudit, parseDecision, parseQuota, routeProfile, validateProfiles } from '../src/core/domain';
import type { Profile, Schedule } from '../src/core/domain';
const now = Date.parse('2026-10-16T00:00:00Z');
const profiles: Profile[] = [
  { id: 'a', label: 'A', provider: 'codex', executable: 'codex', model: 'requested-model' },
  { id: 'b', label: 'B', provider: 'codex', executable: 'codex', model: 'requested-model' },
  { id: 'c', label: 'C', provider: 'claude', executable: 'claude' }
];
const quota = (usedPercent: number) => ({ usedPercent, observedAt: new Date(now).toISOString(), source: 'test' });
test('validates profiles and refuses duplicate or malformed environment definitions', () => {
  assert.equal(validateProfiles(profiles).length, 3);
  assert.throws(() => validateProfiles([profiles[0], profiles[0]]));
  assert.throws(() => validateProfiles([{ ...profiles[0], env: { X: 12 } }]));
});
test('auto switch preserves provider, model and reasoning and requires fresh quota', () => {
  const quotas = { a: quota(100), b: quota(10) };
  assert.equal(routeProfile('a', profiles, quotas, true, 95, now).id, 'b');
  assert.throws(() => routeProfile('a', profiles, quotas, false, 95, now));
  assert.throws(() => routeProfile('a', profiles, { a: quota(100) }, true, 95, now));
  assert.throws(() => routeProfile('a', profiles.map(p => p.id === 'b' ? { ...p, model: 'different' } : p), quotas, true, 95, now));
  assert.equal(routeProfile('a', profiles, {}, true, 95, now).id, 'a');
});
test('quota source is explicit; stale/future/reset snapshots are not fresh', () => {
  assert.throws(() => parseQuota({ ...quota(10), usedPercent: 101 }));
  assert.equal(fresh(quota(10), now + 300_001), false);
  assert.equal(fresh(quota(10), now - 1), false);
  assert.equal(fresh({ ...quota(10), resetsAt: new Date(now).toISOString() }, now), false);
});
test('audit rejects malformed/oversized task plans before delegation', () => {
  assert.deepEqual(parseAudit('```json\n{"summary":"ok","issues":[],"tasks":[]}\n```', 4).tasks, []);
  assert.throws(() => parseAudit('{"summary":"ok","issues":[],"tasks":[{"title":"x","instructions":"fix"}]}', 0));
  assert.throws(() => parseAudit('audit prose', 4));
  assert.throws(() => parseAudit('{"summary":"x","issues":[{}],"tasks":[]}', 4));
  assert.throws(() => parseDecision('{"decision":"looks good"}'));
});
test('daily cron uses Bangkok timezone; claim skips backlog and fires once', () => {
  assert.equal(nextCron('0 9 * * *', 'Asia/Bangkok', new Date(now)), '2026-10-16T02:00:00.000Z');
  const schedule: Schedule = { id: 's', title: 'x', kind: 'task', prompt: 'x', cwd: '.', roles: { builder: 'a', auditor: 'c', worker: 'b', lead: 'a' }, timezone: 'Asia/Bangkok', cron: '0 9 * * *', nextAt: '2026-10-15T02:00:00.000Z', enabled: true };
  const claim = claimSchedule(schedule, new Date(now))!;
  assert.equal(claim.next.nextAt, '2026-10-16T02:00:00.000Z');
  assert.equal(claimSchedule(claim.next, new Date(now)), undefined);
  const once = claimSchedule({ ...schedule, cron: undefined }, new Date(now))!;
  assert.equal(once.next.enabled, false);
});
