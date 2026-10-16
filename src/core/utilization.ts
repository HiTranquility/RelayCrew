import { fresh } from './domain';
import type { Backlog, Job, Profile, Quota, Role } from './domain';
export function backlogDecision(backlog: Backlog, jobs: Job[], roles: Role[], choose: (role: Role) => Profile, quotas: Record<string, Quota>, threshold: number, paused: boolean, now = Date.now()): { action: 'stop' | 'wait' | 'run'; reason?: string } {
  if (!backlog.enabled) return { action: 'wait' };
  if (now >= backlog.until || backlog.remaining <= 0 || !backlog.items.some(i => !i.jobId)) return { action: 'stop', reason: 'Backlog dispatch budget ended.' };
  if (paused || jobs.some(j => ['running','queued','waiting_owner','waiting_quota'].includes(j.status))) return { action: 'wait' };
  const last = jobs.find(j => j.id === backlog.sessionJobs?.at(-1));
  if (last && last.status !== 'completed') return { action: 'stop', reason: 'Previous backlog item needs review.' };
  try {
    for (const role of roles) {
      const profile=choose(role),q = quotas[profile.id];
      if (!fresh(q, now) || q.usedPercent >= Math.min(threshold,profile.quotaCeiling??100)) return { action: 'wait', reason: 'Waiting for fresh available quota.' };
    }
  } catch { return { action: 'wait', reason: 'Check role routing / quota configuration.' }; }
  return { action: 'run' };
}
