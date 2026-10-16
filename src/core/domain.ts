import type { PromptTemplateSnapshot } from './prompt-templates';
import { CronExpressionParser } from 'cron-parser';
import type { Attachment } from '../storage/attachments';
import type { WorkflowDocument } from './workflow';

export type Provider = 'codex' | 'claude' | 'gemini' | 'antigravity' | 'compatible';
export type Role = 'builder' | 'auditor' | 'worker' | 'lead';
export type RoleOverrides = Partial<Record<Role, { model?: string; effort?: string }>>;
export interface Management { primaryProfileId: string; coordinatorIds: string[] }
export function validateManagement(value: unknown, profiles: Profile[]): Management {
  const m = value as Management, ids = new Set(profiles.map(p => p.id));
  if (!m || !ids.has(m.primaryProfileId) || !Array.isArray(m.coordinatorIds) || m.coordinatorIds.length > 4
    || new Set(m.coordinatorIds).size !== m.coordinatorIds.length || m.coordinatorIds.some(id => id === m.primaryProfileId || !ids.has(id))) {
    throw new Error('Choose one primary manager and up to four different supporting coordinators.');
  }
  return { primaryProfileId: m.primaryProfileId, coordinatorIds: [...m.coordinatorIds] };
}
export const fullFlow: Role[] = ['builder', 'auditor', 'worker', 'lead'];
export function validateFlow(value: unknown): Role[] {
  if (!Array.isArray(value) || !['builder,auditor,lead', 'builder,auditor,worker,lead'].includes(value.join(','))) throw new Error('Choose Dev → Audit → Lead, with optional Repair before Lead.');
  return [...value] as Role[];
}
export interface Profile {
  id: string; label: string; provider: Provider; executable: string;
  hosting?: 'cloud' | 'local'; transport?: 'cli' | 'http'; endpoint?: string;
  modelPolicy?:'flagship'|'cli'|'custom'; quotaCeiling?:number;
  model?: string; effort?: string; env?: Record<string, string>; secretEnv?: string[]; quotaFile?: string;
}
export function profileModelPolicy(profile:Profile):'flagship'|'cli'|'custom' {return profile.modelPolicy??(profile.model?'custom':'flagship');}
export function validateEndpoint(value:unknown,hosting:'cloud'|'local'):string {
  if(typeof value!=='string'||value.length>500||/[\s\x00-\x1f]/.test(value))throw new Error('Enter a valid API base URL.');
  let url:URL;try{url=new URL(value);}catch{throw new Error('Enter a valid API base URL.');}
  const loopback=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if(url.username||url.password||url.search||url.hash||!['https:','http:'].includes(url.protocol)||(url.protocol==='http:'&&!(hosting==='local'&&loopback))||(hosting==='local'&&!loopback))throw new Error('Local endpoints must use loopback; cloud endpoints require HTTPS without credentials or query parameters.');
  return url.href.replace(/\/+$/,'');
}
export interface Quota {
  usedPercent: number; observedAt: string; resetsAt?: string; source: string;
  limitTokens?: number; remainingTokens?: number;
  windows?: QuotaWindow[];
}
export interface QuotaWindow { id: string; label: string; usedPercent: number; resetsAt?: string; limitTokens?: number; remainingTokens?: number }
export class ProviderLimit extends Error {}
export interface Issue { title: string; body: string; severity: 'bug' | 'improvement' }
export interface ChildTask { title: string; instructions: string }
export interface Audit { summary: string; issues: Issue[]; tasks: ChildTask[] }
export interface Step {
  transport?:'cli'|'http';hosting?:'cloud'|'local';endpoint?:string;
  role: Role; title: string; prompt: string; profileId?: string; model?: string; effort?: string; response?: string;
  status: 'pending' | 'running' | 'done' | 'failed' | 'waiting_owner'; error?: string;
  request?: string; startedAt?: string; finishedAt?: string; attempts?: number;
  limitRetries?: number;
  backupPath?: string;
  timeoutAt?: string; phase?: 'backing_up' | 'cli';
  coordinatorProfileId?: string;
  modelSource?:'custom'|'alias'|'catalog'|'cli-default';
}
export interface Job {
  permission?:import('./daily-workspaces').TaskPermission;
  acceptance?: {id:string;text:string;checked:boolean;checkedAt?:string}[];
  kind?:'chat';
  chatHistory?:{role:'user'|'assistant';text:string}[];
  id: string; prompt: string; cwd: string; createdAt: string;
  status: 'queued' | 'running' | 'completed' | 'needs_attention' | 'waiting_owner' | 'waiting_quota' | 'failed' | 'cancelled' | 'interrupted';
  roles: Record<Role, string>; steps: Step[]; audit?: Audit; error?: string;
  scheduleOccurrence?: string;
  ownerQuestion?: string;
  ownerReplies?: string[];
  flow?: Role[]; overrides?: RoleOverrides;
  limitDetectedAt?: string; blockedProfileId?: string;
  timeline?: { at: string; from: string; to: string; kind: string; text: string }[];
  profilePins?: Partial<Record<Role,string>>;
  management?: Management;
  dailyItemId?: string;
  readOnly?: boolean;
  isolationMode?: 'shared' | 'worktree';
  sourceCwd?: string;
  worktree?: { path: string; repository: string; branch: string; baseCommit: string };
  openInCodex?: boolean;
  codexLinkAttemptedAt?: string;
  codexLinkError?: string;
  consoleRequestId?: string;
  consoleReplyIds?: string[];
  attachments?: Attachment[];
  workflow?: WorkflowDocument;
  connectionTrial?: boolean;
  promptTemplates?:PromptTemplateSnapshot;
}

export function ownerQuestion(raw: string): string | undefined {
  let value: any;
  try { value = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')); } catch { return; }
  if (value?.needs_owner !== true) return;
  if (typeof value.question !== 'string' || !value.question.trim() || value.question.length > 3000) throw new Error('Invalid owner question.');
  return value.question.trim();
}
export function answerOwner(job: Job, answer: string): void {
  if (job.status !== 'waiting_owner') throw new Error('Task is not waiting for an owner reply.');
  const step = job.steps.find(s => s.status === 'waiting_owner');
  if (!step || !answer.trim() || answer.length > 8000) throw new Error('Invalid owner reply.');
  if ((job.ownerReplies?.length ?? 0) >= 10) throw new Error('Owner reply limit reached. Start a new task with clarified requirements.');
  (job.ownerReplies ??= []).push(`Question: ${job.ownerQuestion}\nOwner answer: ${answer.trim()}`);
  (job.timeline ??= []).push({ at: new Date().toISOString(), from: 'owner', to: step.role, kind: 'owner_reply', text: answer.trim() });
  step.status = 'pending'; step.response = undefined;
  job.ownerQuestion = undefined; job.status = 'queued';
}
export interface Schedule {
  id: string; title: string; kind: 'reminder' | 'task'; prompt: string; cwd: string;
  roles: Record<Role, string>; nextAt: string; cron?: string; timezone: string; enabled: boolean;
  flow?: Role[]; overrides?: RoleOverrides;
  management?: Management;
  durationMinutes?:number; acceptance?:Job['acceptance'];
}

export function validateProfiles(value: unknown): Profile[] {
  if (!Array.isArray(value)) throw new Error('Profiles must be an array.');
  const ids = new Set<string>();
  for (const p of value) {
    if (!p || typeof p !== 'object' || !/^[a-zA-Z0-9_-]+$/.test(p.id) || ids.has(p.id)
      || !['codex', 'claude', 'gemini', 'antigravity', 'compatible'].includes(p.provider)
      || typeof p.label !== 'string' || !p.label || typeof p.executable !== 'string' || !p.executable) {
      throw new Error('Each profile needs a unique id, label, provider and executable.');
    }
    ids.add(p.id);
    if(p.hosting!==undefined&&!['cloud','local'].includes(p.hosting))throw new Error('Invalid hosting location.');
    if(p.transport!==undefined&&!['cli','http'].includes(p.transport))throw new Error('Invalid transport.');
    if(p.provider==='compatible'){
      if(p.transport!=='http')throw new Error('Compatible providers require the HTTP adapter.');
      validateEndpoint(p.endpoint,p.hosting??'cloud');
    }else if(p.transport==='http'||p.hosting==='local')throw new Error('Use a compatible HTTP profile for local or third-party models.');
    if(p.modelPolicy!==undefined&&!['flagship','cli','custom'].includes(p.modelPolicy))throw new Error('Invalid model policy.');
    if(p.quotaCeiling!==undefined&&(!Number.isFinite(p.quotaCeiling)||p.quotaCeiling<1||p.quotaCeiling>100))throw new Error('Account quota ceiling must be between 1 and 100.');
    for (const key of ['model', 'effort', 'quotaFile']) {
      if (p[key] !== undefined && typeof p[key] !== 'string') throw new Error(`Invalid ${key}.`);
    }
    if (p.env !== undefined && (!p.env || Array.isArray(p.env) || typeof p.env !== 'object'
      || Object.entries(p.env).some(([k, v]) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(k) || typeof v !== 'string'))) {
      throw new Error('Profile env must map variable names to strings.');
    }
    if (p.secretEnv !== undefined && (!Array.isArray(p.secretEnv)
      || p.secretEnv.some((k: unknown) => typeof k !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)))) {
      throw new Error('Invalid secretEnv.');
    }
  }
  return value as Profile[];
}

export function parseQuota(raw: unknown): Quota {
  let q = raw as Quota;
  if(q?.windows!==undefined){
    if(!Array.isArray(q.windows)||!q.windows.length||q.windows.length>20)throw new Error('Quota windows must contain 1–20 entries.');
    const ids=new Set<string>();
    for(const w of q.windows){
      if(!w||typeof w.id!=='string'||!w.id||ids.has(w.id)||typeof w.label!=='string'||!w.label||!Number.isFinite(w.usedPercent)||w.usedPercent<0||w.usedPercent>100||(w.resetsAt!==undefined&&!Number.isFinite(Date.parse(w.resetsAt))))throw new Error('Invalid quota window.');
      ids.add(w.id);
      for(const count of [w.limitTokens,w.remainingTokens])if(count!==undefined&&(!Number.isSafeInteger(count)||count<0))throw new Error('Invalid window token count.');
    }
    q={...q,usedPercent:Math.max(q.usedPercent??0,...q.windows.map(w=>w.usedPercent)),windows:structuredClone(q.windows)};
  }
  if (!q || typeof q.usedPercent !== 'number' || !Number.isFinite(q.usedPercent)
    || q.usedPercent < 0 || q.usedPercent > 100 || typeof q.source !== 'string' || !q.source
    || !Number.isFinite(Date.parse(q.observedAt))
    || (q.resetsAt !== undefined && !Number.isFinite(Date.parse(q.resetsAt)))) throw new Error('Invalid quota data.');
  for (const count of [q.limitTokens, q.remainingTokens]) if (count !== undefined && (!Number.isSafeInteger(count) || count < 0)) throw new Error('Invalid token count.');
  return { usedPercent: q.usedPercent, observedAt: q.observedAt, source: q.source, resetsAt: q.resetsAt, limitTokens: q.limitTokens, remainingTokens: q.remainingTokens, windows:q.windows };
}
export function fresh(q: Quota | undefined, now = Date.now()): q is Quota {
  return !!q && now - Date.parse(q.observedAt) >= 0 && now - Date.parse(q.observedAt) <= 300_000
    && (!q.resetsAt || Date.parse(q.resetsAt) > now)
    && !q.windows?.some(w=>w.resetsAt&&Date.parse(w.resetsAt)<=now);
}

export function assignTaskProfile(job:Job,role:Role,profileId:string,profiles:Profile[]):void{
  if(!['queued','waiting_quota','waiting_owner'].includes(job.status)||job.steps.some(s=>s.status==='running'))throw new Error('Pause the running task before changing its account.');
  if(!profiles.some(p=>p.id===profileId))throw new Error('Choose an existing account profile.');
  if(!(job.flow??fullFlow).includes(role))throw new Error('This role is not in the task flow.');
  if(job.steps.some(s=>s.role===role)&&job.steps.filter(s=>s.role===role).every(s=>s.status==='done'))throw new Error('This role already finished. Its account history is preserved.');
  if(role==='lead'&&job.steps.some(s=>s.coordinatorProfileId===profileId&&s.status!=='done'))throw new Error('Reassign the unfinished coordinator before making that account the primary manager.');
  job.roles[role]=profileId;(job.profilePins??={})[role]=profileId;
  if(role==='lead'&&job.management){job.management.primaryProfileId=profileId;job.management.coordinatorIds=job.management.coordinatorIds.filter(id=>id!==profileId);}
  if(job.overrides)delete job.overrides[role];
  (job.timeline??=[]).push({at:new Date().toISOString(),from:'owner',to:role,kind:'account_switch',text:`Use profile ${profileId} for remaining work; completed steps retain their recorded profile.`});
}
export function assignCoordinatorProfile(job: Job, index: number, profileId: string, profiles: Profile[]): void {
  const step=job.steps[index];
  if(!['queued','waiting_quota','waiting_owner'].includes(job.status)||job.steps.some(s=>s.status==='running'))throw new Error('Pause the running task before changing its account.');
  if(!step?.coordinatorProfileId||step.status==='done'||!profiles.some(p=>p.id===profileId))throw new Error('Choose an unfinished coordinator step and an existing account.');
  if(job.management?.primaryProfileId===profileId||job.steps.some((s,i)=>i!==index&&s.coordinatorProfileId===profileId))throw new Error('Coordinator accounts must be distinct from the primary manager and other coordinators.');
  const previous=step.coordinatorProfileId;step.coordinatorProfileId=profileId;
  if(job.management)job.management.coordinatorIds=job.management.coordinatorIds.map(id=>id===previous?profileId:id);
  (job.timeline??=[]).push({at:new Date().toISOString(),from:'owner',to:'coordinator',kind:'account_switch',text:`Use profile ${profileId} for the unfinished coordinator step. Primary manager authority is unchanged.`});
}
export function routeProfile(id: string, profiles: Profile[], quotas: Record<string, Quota>, auto: boolean, threshold: number, now = Date.now()): Profile {
  const selected = profiles.find(p => p.id === id);
  if (!selected) throw new Error(`Missing profile ${id}. Configure role assignments.`);
  const q = quotas[id];
  if (!fresh(q, now) || q.usedPercent < Math.min(threshold,selected.quotaCeiling??100)) return selected;
  if (auto) {
    const fallback = profiles.find(p => p.id !== id && p.provider === selected.provider
      && (p.transport??'cli')===(selected.transport??'cli') && (p.hosting??'cloud')===(selected.hosting??'cloud') && p.endpoint===selected.endpoint
      && p.modelPolicy === selected.modelPolicy && p.model === selected.model && p.effort === selected.effort
      && fresh(quotas[p.id], now) && quotas[p.id].usedPercent < Math.min(threshold,p.quotaCeiling??100));
    if (fallback) return fallback;
  }
  throw new QuotaWait(`${selected.label}: quota at ${q.usedPercent}%. Select another account or wait for a fresh quota refresh.`);
}

export class QuotaWait extends Error {}
export function rotateProfile(pool: string[], profiles: Profile[], quotas: Record<string, Quota>, cursor: number, threshold: number, now = Date.now()): { profile: Profile; cursor: number } {
  if (!pool.length) throw new Error('Configure the rotation pool for this role before enabling round robin.');
  for (let offset = 0; offset < pool.length; offset++) {
    const index = (cursor + offset) % pool.length;
    const p = profiles.find(p => p.id === pool[index]);
    if (!p) throw new Error(`Rotation profile missing: ${pool[index]}`);
    if (fresh(quotas[p.id], now) && quotas[p.id].usedPercent < Math.min(threshold,p.quotaCeiling??100)) return { profile: p, cursor: (index + 1) % pool.length };
  }
  throw new QuotaWait('Rotation pool has no account with fresh available quota. Refresh quota data to continue.');
}

function objectJson(raw: string): any {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(text);
}
export function parseAudit(raw: string, max: number): Audit {
  const a = objectJson(raw);
  if (!a || typeof a.summary !== 'string' || !Array.isArray(a.issues) || !Array.isArray(a.tasks)
    || a.issues.some((i: any) => !i || typeof i.title !== 'string' || typeof i.body !== 'string' || !['bug', 'improvement'].includes(i.severity))
    || a.tasks.some((t: any) => !t || typeof t.title !== 'string' || typeof t.instructions !== 'string')) {
    throw new Error('Audit returned invalid JSON. Review the raw response; no repair tasks were dispatched.');
  }
  if (a.tasks.length > max) throw new Error(`Audit requested ${a.tasks.length} tasks; limit is ${max}. No repairs dispatched.`);
  return a;
}
export function parseDecision(raw: string): { decision: 'approved' | 'changes_requested'; summary: string } {
  const d = objectJson(raw);
  if (!d || !['approved', 'changes_requested'].includes(d.decision) || typeof d.summary !== 'string') {
    throw new Error('Lead must return a JSON decision: approved or changes_requested, with summary.');
  }
  return d;
}
export function nextCron(cron: string, timezone: string, after = new Date()): string {
  return CronExpressionParser.parse(cron, { tz: timezone, currentDate: after }).next().toISOString()!;
}
export function resolveTimezone(value:string):string{
  const timezone=value.trim()||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
  new Intl.DateTimeFormat('en',{timeZone:timezone}).format();return timezone;
}
export function claimSchedule(s: Schedule, now: Date): { occurrence: string; next: Schedule } | undefined {
  if (!s.enabled || Date.parse(s.nextAt) > now.getTime()) return;
  return {
    occurrence: `${s.id}:${s.nextAt}`,
    next: { ...s, enabled: !!s.cron, nextAt: s.cron ? nextCron(s.cron, s.timezone, now) : s.nextAt }
  };
}

export const auditInstructions = `Audit the repository and the preceding implementation. Do not edit files.
Identify concrete bugs and best-practice problems with evidence, file paths, validation and acceptance criteria.
Return ONLY JSON: {"summary":"...","issues":[{"title":"...","body":"evidence, impact, reproduction","severity":"bug"}],"tasks":[{"title":"...","instructions":"bounded repair with acceptance criteria"}]}.
Use empty arrays when there are no findings. Do not invent findings.`;
export const leadInstructions = `Act as tech lead. Inspect the current code, repository guidance, implementation, audit findings and repairs.
Verify acceptance criteria and relevant tests. Do not edit files. Report unresolved risks to the product owner.
Return ONLY JSON: {"decision":"approved" or "changes_requested","summary":"evidence, tests, remaining issues"}.`;

export interface Backlog {
  items: { id: string; prompt: string; cwd: string; jobId?: string }[];
  enabled: boolean; remaining: number; until: number;
  sessionJobs?: string[];
}
