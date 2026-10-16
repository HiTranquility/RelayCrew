import * as vscode from 'vscode';
import { randomUUID } from 'node:crypto';
import type { Job, Management, Profile } from '../core/domain';
import { resolveTimezone } from '../core/domain';
import { carryDailyTasks, dailyDecision, makeDailyJob, syncDecisions, startDailyPlan, dayKey, type DailyPlan } from '../core/daily-plan';
import { translator, type Language } from '../core/i18n';
import type { Quota } from '../core/domain';

interface Hooks {
  plan: DailyPlan; jobs: Job[]; profiles: () => Profile[]; quotas: () => Record<string, Quota>;
  management: () => Management; language: () => Language; timezone: () => string;
  isolation: () => boolean;
  openInCodex: () => boolean;
  paused: () => boolean; pauseActive: (profileId?: string) => void; save: () => Promise<void>; changed: () => void;
  cwd: () => Promise<string | undefined>; start: () => void;
}
export class DailyController {
  constructor(private hooks: Hooks) {}
  async startPlan(): Promise<void> {
    const h = this.hooks, p = h.plan, t = translator(h.language()), all = h.profiles();
    const accounts = await vscode.window.showQuickPick(all.map(profile => ({ label: profile.label, description: `${profile.id} · ${profile.model || t('CLI default')}`, id: profile.id, picked: p.accounts[profile.id] ?? true })), { title: t('Accounts allowed to use daily quota'), canPickMany: true, placeHolder: t('Uncheck weaker models or accounts you want to preserve.') });
    if (!accounts?.length) return;
    const runs = await vscode.window.showInputBox({ title: t('Maximum daily tasks (1–200)'), value: String(p.remainingRuns || 20), validateInput: value => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 200 ? undefined : t('Enter 1–200.') });
    if (!runs) return;
    const target = await vscode.window.showInputBox({ title: t('Stop each account at usage % (1–100)'), value: String(p.targetPercent), validateInput: value => value.trim() && Number.isFinite(Number(value)) && Number(value) >= 1 && Number(value) <= 100 ? undefined : t('Enter 1–100.') });
    if (!target) return;
    const cwd = await h.cwd(); if (!cwd) return;
    const timezone=resolveTimezone(h.timezone()), day=dayKey(timezone);
    const old=h.jobs.filter(job=>['queued','waiting_quota','waiting_owner'].includes(job.status)&&(job.sourceCwd??job.cwd)===cwd&&p.items.some(item=>item.jobId===job.id&&item.day!==day&&accounts.some(account=>account.id===item.profileId)));
    const carry=old.length?await vscode.window.showQuickPick(old.map(job=>({label:job.prompt.slice(0,100),description:job.id.slice(0,8),id:job.id,picked:false})),{title:t('Select unfinished tasks to carry into this day (optional)'),canPickMany:true}):[];
    if(!carry)return;
    if(carry.length>Number(runs))throw new Error(t('Carried tasks must fit the new daily task budget.'));
    startDailyPlan(p, cwd, timezone, accounts.map(a => a.id), Number(runs), Number(target));
    carryDailyTasks(p,h.jobs,carry.map(job=>job.id));
    const included = new Set(accounts.map(a => a.id)); p.accounts = Object.fromEntries(all.map(profile => [profile.id, included.has(profile.id)]));
    this.tick(); await h.save(); h.changed(); h.start();
  }
  async stopPlan(): Promise<void> {
    const h = this.hooks; h.plan.enabled = false; h.plan.reason = 'Daily plan paused.'; h.pauseActive(); await h.save(); h.changed();
  }
  async addItem(): Promise<void> {
    const h = this.hooks, t = translator(h.language());
    const prompt = await vscode.window.showInputBox({ title: t('Add daily task'), prompt: t('Describe useful work and acceptance criteria. Important decisions will wait for your reply.') });
    if (!prompt?.trim()) return;
    const profile = await vscode.window.showQuickPick(h.profiles().map(p => ({ label: p.label, description: `${p.id} · ${p.model || t('CLI default')}`, id: p.id })), { title: t('Account for this daily task') });
    if (!profile) return;
    const timezone = resolveTimezone(h.timezone());
    h.plan.items.push({ id: randomUUID(), day: dayKey(timezone), profileId: profile.id, prompt: prompt.trim(), category: 'task' });
    await h.save(); h.changed();
  }
  async account(id: unknown, enabled: unknown): Promise<void> {
    const h = this.hooks;
    if (typeof id !== 'string' || typeof enabled !== 'boolean' || !h.profiles().some(p => p.id === id)) return;
    h.plan.accounts[id] = enabled;
    if (!enabled) h.pauseActive(id);
    await h.save(); h.changed(); h.start();
  }
  async option(key: unknown, value: unknown): Promise<void> {
    const h = this.hooks;
    if ((key !== 'allowEdits' && key !== 'fallback') || typeof value !== 'boolean') return;
    h.plan[key] = value;
    if (key === 'allowEdits' && !value) { for (const job of h.jobs.filter(job => job.dailyItemId)) job.readOnly = true; h.pauseActive(); }
    await h.save(); h.changed();
  }
  tick(now = Date.now()): void {
    const h = this.hooks, p = h.plan;
    syncDecisions(p, h.jobs, now);
    if (!p.enabled) return;
    const decision = dailyDecision(p, h.jobs, h.profiles(), h.quotas(), h.paused(), now);
    p.reason = 'reason' in decision ? decision.reason : undefined;
    if (decision.action === 'stop') { p.enabled = false; if (now >= p.until) h.pauseActive(); }
    if (decision.action !== 'run') return;
    const item = decision.item;
    item.day = p.day;
    if (decision.generated) p.items.push(item);
    const job = makeDailyJob(p, item, h.management());
    job.isolationMode=h.isolation()?'worktree':'shared';
    job.openInCodex=h.openInCodex();
    item.jobId = job.id; h.jobs.push(job); p.remainingRuns--;
  }
}
