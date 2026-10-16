import type { Job, Profile, Quota } from '../core/domain';
import { fresh } from '../core/domain';
import { statusLabel, translator, type Language } from '../core/i18n';
import { escapeHtml as h } from './html';
import type { BoardOptions } from './board';

export function quotaMeter(quota:Quota|undefined,language:Language):string {
  const t=translator(language);
  if(!fresh(quota))return `<div class="quota-meter unknown" aria-hidden="true"></div><small>${h(t('No fresh observation'))}</small>`;
  const used=Math.max(0,Math.min(100,quota.usedPercent));
  return `<div class="quota-meter ${used>=95?'limited':used>=80?'near-limit':''}" role="meter" aria-label="${h(t('Quota used'))}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${used}"><span style="width:${used}%"></span></div><small>${h(t('{0}% used · {1}',used,quota.source))}</small>`;
}

export function renderOverview(jobs:Job[],profiles:Profile[],quotas:Record<string,Quota>,options:BoardOptions|undefined,language:Language):string {
  const t=translator(language),tr=(key:string,...values:unknown[])=>h(t(key,...values));
  const active=jobs.find(j=>j.status==='running'),queue=jobs.filter(j=>j.status==='queued'),blocked=jobs.filter(j=>['waiting_owner','waiting_quota','needs_attention','failed','interrupted'].includes(j.status));
  const stale=profiles.filter(p=>!fresh(quotas[p.id])),next=(options?.schedules??[]).filter(s=>s.enabled).sort((a,b)=>a.nextAt.localeCompare(b.nextAt))[0];
  const open=(job:Job,label:string)=>`<button data-inspect-session="${h(job.id)}">${tr(label)}</button>`;
  return `<div class="section-heading"><div><span class="eyebrow">${tr('WORKSPACE CONTROL ROOM')}</span><h2>${tr('What needs to happen next')}</h2><p class="muted">${tr(options?.queuePaused?'Queue paused':'Queue active')} · ${tr('One task runs at a time')}</p></div><div class="setup-actions"><button class="primary" data-action="newTask">${tr('New task')}</button><button data-action="flow">${tr('Configure team flow')}</button></div></div>
  <div class="operational-grid"><section><h3>${tr('Your decision inbox')} · ${blocked.length}</h3>${blocked.map(job=>`<article class="decision-item"><span class="status-pill" data-status="${h(job.status)}">${h(statusLabel(job.status,language))}</span><h4>${h(job.prompt.slice(0,130))}</h4><p>${h(job.ownerQuestion??job.error??t('Review the result before continuing.'))}</p>${job.status==='waiting_owner'?`<button data-action="reply" data-id="${h(job.id)}">${tr('Reply to agent')}</button>`:open(job,'Inspect blocker')}</article>`).join('')||`<p class="muted">${tr('No decisions or failures need your attention.')}</p>`}</section>
  <section><h3>${tr('Active work and queue')}</h3>${active?`<article class="focus-task"><span class="badge">${tr('Running now')}</span><h4>${h(active.prompt.slice(0,140))}</h4><p>${h(active.steps.find(s=>s.status==='running')?.title??t('Preparing task'))}</p><p class="muted">${h(profiles.find(p=>p.id===active.steps.find(s=>s.status==='running')?.profileId)?.label??'')} · ${h(active.steps.find(s=>s.status==='running')?.model??profiles.find(p=>p.id===active.steps.find(s=>s.status==='running')?.profileId)?.model??t('CLI default'))}</p>${open(active,'Watch live')}</article>`:`<p class="muted">${tr('No task is running.')}</p>`}<ol>${queue.slice(0,12).map(job=>`<li><b>${h(job.prompt.slice(0,110))}</b> ${open(job,'Inspect')}</li>`).join('')}</ol><p class="muted">${tr('{0} queued tasks · start times depend on the active task',queue.length)}</p><button data-open-page="tasks" data-task-filter="active">${tr('View all tasks')}</button></section>
  <section><h3>${tr('Capacity and next dispatch')}</h3><p>${tr('{0} accounts need a fresh quota observation',stale.length)}</p>${stale.map(p=>`<button data-action="quota" data-id="${h(p.id)}">${h(p.label)} · ${tr('Update quota')}</button>`).join('')}<p>${tr('Daily quota tasklist')}: <b>${tr(options?.dailyPlan?.enabled?'On':'Off')}</b></p><p>${h(t(options?.dailyPlan?.reason??'Daily plan paused.'))}</p><button data-open-page="daily">${tr('Inspect daily dispatch')}</button><button data-open-page="accounts">${tr('Accounts & quota')}</button></section>
  <section><h3>${tr('Next scheduled window')}</h3>${next?`<h4>${h(next.title)}</h4><p>${h(new Date(next.nextAt).toLocaleString(language==='vi'?'vi-VN':'en-GB',{timeZone:next.timezone}))} · ${h(next.timezone)}</p><p>${tr('Planned duration (minutes)')}: ${next.durationMinutes??30}</p>`:`<p class="muted">${tr('No upcoming schedules.')}</p>`}<button data-open-page="schedules">${tr('Open schedule planner')}</button></section></div>`;
}
