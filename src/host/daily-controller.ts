import { acceptanceFromText } from '../core/task-insights';
import { dailyWorkspaces } from '../core/daily-workspaces';
import type { PromptTemplateSnapshot } from '../core/prompt-templates';
import * as vscode from 'vscode';
import { randomUUID } from 'node:crypto';
import type { Job, Management, Profile } from '../core/domain';
import { resolveTimezone } from '../core/domain';
import { dailyDecision, makeDailyJob, syncDecisions, startDailyPlan, dayKey, type DailyPlan } from '../core/daily-plan';
import { type Language } from '../core/i18n';
import type { Quota } from '../core/domain';
import type { WorkflowDocument } from '../core/workflow';

interface Hooks {
  plan: DailyPlan; jobs: Job[]; profiles: () => Profile[]; quotas: () => Record<string, Quota>;
  management: () => Management; language: () => Language; timezone: () => string;
  isolation: () => boolean;
  workflow?:()=>WorkflowDocument|undefined;
  promptTemplates?:()=>PromptTemplateSnapshot;
  openInCodex: () => boolean;
  paused: () => boolean; pauseActive: (profileId?: string) => void; save: () => Promise<void>; changed: () => void;
  cwd: () => Promise<string | undefined>; start: () => void;
}
export class DailyController {
  constructor(private hooks: Hooks) {}
  async configure(raw:unknown,roots:string[]):Promise<void>{
    const value=raw as Record<string,unknown>,h=this.hooks;
    if(!value||Array.isArray(value)||Object.keys(value).some(k=>!['cwd','timezone','runs','target','workspaces','start'].includes(k))||typeof value.cwd!=='string'||!roots.includes(value.cwd)||typeof value.timezone!=='string')throw new Error('Invalid daily plan settings.');
    const ids=h.profiles().filter(p=>h.plan.accounts[p.id]===true).map(p=>p.id),timezone=resolveTimezone(value.timezone),runs=Number(value.runs),target=Number(value.target);
    if(!ids.length)throw new Error('Select at least one account in the daily quota table.');
    // Validate a copy before pausing or mutating the durable plan.
    const next=structuredClone(h.plan),workspaces=dailyWorkspaces(value.workspaces??[{path:value.cwd,permission:h.plan.allowEdits?'auto':'read-only'}],roots);
    if(workspaces.some(w=>w.permission==='full')){const choice=await vscode.window.showWarningMessage('Full permission permits commands beyond the folder sandbox.',{modal:true,detail:workspaces.filter(w=>w.permission==='full').map(w=>w.path).join('\n')},'Enable full permission');if(choice!=='Enable full permission')throw new Error('Permission change cancelled; daily plan was not changed.');}
    next.workspaces=[...workspaces,...(h.plan.workspaces??[]).filter(w=>!workspaces.some(n=>n.path===w.path)).map(w=>({...w,enabled:false}))];
    startDailyPlan(next,value.cwd,timezone,ids,runs,target);
    if(value.start===false)next.enabled=false;h.pauseActive();Object.assign(h.plan,next);this.tick();await h.save();h.changed();h.start();
  }
  async addInline(raw:unknown,roots:string[]=[]):Promise<void>{
    const value=raw as Record<string,unknown>,h=this.hooks;
    if(!value||Array.isArray(value)||Object.keys(value).some(k=>!['profileId','prompt','cwd','acceptance'].includes(k))||typeof value.prompt!=='string'||!value.prompt.trim()||value.prompt.length>16000||!h.profiles().some(p=>p.id===value.profileId))throw new Error('Choose an account and enter a useful daily task.');
    if(value.cwd!==undefined&&(typeof value.cwd!=='string'||!roots.includes(value.cwd)))throw new Error('Choose an approved local folder.');
    acceptanceFromText(value.acceptance);const timezone=resolveTimezone(h.plan.timezone||h.timezone());h.plan.items.push({id:randomUUID(),day:dayKey(timezone),profileId:value.profileId as string,prompt:value.prompt.trim(),category:'task',cwd:value.cwd as string|undefined,acceptance:value.acceptance as string|undefined});await h.save();h.changed();h.start();
  }
  async moveItem(id:unknown,direction:unknown):Promise<void>{
    const h=this.hooks,items=h.plan.items,index=items.findIndex(i=>i.id===id&&!i.jobId&&i.category==='task');
    if(index<0||![-1,1].includes(direction as number))throw new Error('Only unstarted daily tasks can be reordered.');
    let target=index+(direction as number);while(target>=0&&target<items.length&&(items[target].jobId||items[target].category!=='task'))target+=direction as number;
    if(target>=0&&target<items.length)[items[index],items[target]]=[items[target],items[index]];await h.save();h.changed();
  }
  async stopPlan(): Promise<void> {
    const h = this.hooks; h.plan.enabled = false; h.plan.reason = 'Daily plan paused.'; h.pauseActive(); await h.save(); h.changed();
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
    const templates=h.promptTemplates?.();if(templates)job.promptTemplates=structuredClone(templates);
    const workflow=h.workflow?.();if(workflow)job.workflow=structuredClone(workflow);
    item.jobId = job.id; h.jobs.push(job); p.remainingRuns--;
  }
}
