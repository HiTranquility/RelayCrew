import { profileModelLabel } from '../core/i18n';
import type { Job, Profile, Quota, Role } from '../core/domain';
import { fresh } from '../core/domain';
import { roleLabel, statusLabel, translator, type Language } from '../core/i18n';
import { escapeHtml as h } from './html';
import type { BoardOptions } from './board';

export function quotaMeter(quota:Quota|undefined,language:Language):string {
  const t=translator(language);
  if(!fresh(quota))return `<div class="quota-meter unknown" aria-hidden="true"></div><small>${h(t('No fresh observation'))}</small>`;
  const used=Math.max(0,Math.min(100,quota.usedPercent));
  return `<div class="quota-meter ${used>=95?'limited':used>=80?'near-limit':''}" role="meter" aria-label="${h(t('Quota used'))}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${used}"><span style="width:${used}%"></span></div><small>${h(t('{0}% used · {1}',used,quota.source))}</small>`;
}

export function renderOverview(jobs:Job[],profiles:Profile[],quotas:Record<string,Quota>,options:BoardOptions|undefined,language:Language):string {
  const t=translator(language),tr=(message:string,...values:unknown[])=>h(t(message,...values));
  const button=(action:string,label:string,id='')=>`<button data-action="${action}" data-id="${h(id)}">${h(t(label))}</button>`;
  const running=jobs.filter(job=>job.status==='running'),waiting=jobs.filter(job=>['waiting_owner','waiting_quota','needs_attention','failed','interrupted'].includes(job.status));
  const assigned=options?.roles??jobs.at(-1)?.roles;
  const flow=options?.flow??['builder','auditor','worker','lead'] as Role[];
  const focus=jobs.filter(job=>['running','waiting_owner','waiting_quota','queued'].includes(job.status)).sort((a,b)=>Number(b.status==='running')-Number(a.status==='running')).slice(0,4);
  const activity=jobs.flatMap(job=>(job.timeline??[]).map(event=>({...event,job}))).reverse().sort((a,b)=>b.at.localeCompare(a.at)).slice(0,5);
  return `<div class="overview-hero"><div><div class="eyebrow">${tr('YOUR WORKSPACE, YOUR CREW')}</div><h2>${tr(jobs.length?'Keep the whole crew in view.':'Build your first AI crew.')}</h2><p>${tr(jobs.length?'See who is working, what changed, and where your decision is needed.':'Choose your accounts, assign the roles, then start with a small task.')}</p><div class="hero-actions"><button class="primary" data-action="${jobs.length?'newTask':'profiles'}">${tr(jobs.length?'New task':'Configure profiles')}</button>${button('flow','Configure team flow')}</div></div><div class="hero-note"><span class="live-dot ${options?.queuePaused?'is-paused':''}"></span><b>${tr(options?.queuePaused?'Queue paused':'Queue active')}</b><small>${tr(options?.allowEdits?'Dev / Repair edits enabled':'Read-only by default')}</small><small>${tr('Local CLI workflow · you stay in control')}</small></div></div>
    <div class="stat-grid">${[
      ['Running now',running.length,'tasks','active'],['Needs your attention',waiting.length,'tasks','attention'],['Queued',jobs.filter(job=>job.status==='queued').length,'tasks','active'],['Fresh quota',`${profiles.filter(p=>fresh(quotas[p.id])).length} / ${profiles.length}`,'accounts','all']
    ].map(([label,value,page,filter])=>`<button class="stat-card" data-open-page="${page}" data-task-filter="${filter}"><span>${tr(String(label))}</span><strong>${h(value)}</strong><span class="stat-link">${tr('Inspect')} ↗</span></button>`).join('')}</div>
    <section class="crew-section"><div class="section-heading"><div><h2>${tr('Your team')}</h2><p class="muted">${tr('Assignments for new tasks. Saved tasks keep their own team.')}</p></div>${button('flow','Edit team')}</div><div class="crew-grid">${flow.map((role,index)=>{
      const id=role==='lead'?options?.management?.primaryProfileId??assigned?.lead:assigned?.[role],profile=profiles.find(profile=>profile.id===id);
      const active=running.flatMap(job=>job.steps.filter(step=>step.status==='running'&&step.role===role&&!step.coordinatorProfileId&&(step.profileId??job.roles[step.role])===id));
      return `<div class="crew-card ${role==='lead'?'is-primary':''}" data-role="${role}"><div class="crew-top"><span class="role-icon role-${role}">${index+1}</span><span class="eyebrow">${role==='lead'?tr('Primary manager'):h(roleLabel(role,language))}</span><span class="state-dot ${active.length?'is-running':''}" title="${tr(active.length?'Running':'Idle')}"></span></div><h3>${h(profile?.label??t('Unassigned'))}</h3><p class="model-name">${h(profileModelLabel(profile,language))}${profile?.effort?' · '+h(profile.effort):''}</p>${quotaMeter(id?quotas[id]:undefined,language)}<div class="crew-footer"><span>${h(profile?.provider??'—')}</span>${profile?button('account','Account details',profile.id):button('flow','Assign account')}</div></div>`;
    }).join('')}</div>${options?.management?.coordinatorIds.length?`<div class="support-row"><span class="muted">${tr('Supporting coordinators')}</span>${options.management.coordinatorIds.map(id=>`<button class="profile-chip" data-action="account" data-id="${h(id)}">${h(profiles.find(profile=>profile.id===id)?.label??id)}</button>`).join('')}</div>`:''}</section>
    <div class="overview-columns"><section><div class="section-heading"><h2>${tr('Work in focus')}</h2><button class="text-button" data-open-page="tasks">${tr('View all tasks')} →</button></div>${focus.length?focus.map(job=>{
      const step=job.steps.find(step=>step.status==='running'),profile=profiles.find(profile=>profile.id===step?.profileId);
      return `<div class="focus-task"><div class="row"><span class="status-pill" data-status="${h(job.status)}">${h(statusLabel(job.status,language))}</span><span class="muted">${h(job.id.slice(0,8))}</span></div><h3>${h(job.prompt.slice(0,130))}</h3><p class="muted">${h(job.ownerQuestion?.slice(0,180)??(profile?`${profile.label} · ${step?.model||t('CLI default')}`:job.sourceCwd??job.cwd))}</p>${button(job.status==='waiting_owner'?'reply':'report',job.status==='waiting_owner'?'Reply to agent':'Open report',job.id)}</div>`;
    }).join(''):`<div class="empty-state"><div class="empty-icon" aria-hidden="true">◇</div><h3>${tr('Ready when you are')}</h3><p>${tr('Start with a clear result and acceptance criteria. Your agents will appear here as work begins.')}</p>${button('newTask','New task')}</div>`}</section>
    <section><div class="section-heading"><h2>${tr(activity.length?'Recent handoffs':'Get started')}</h2>${activity.length?'<button class="text-button" data-open-page="tasks">'+tr('Inspect conversation')+' →</button>':''}</div>${activity.length?`<ol class="activity-list">${activity.map(event=>`<li><div class="activity-meta"><span>${h(event.from)} → ${h(event.to)}</span><time>${h(new Date(event.at).toLocaleTimeString(language==='vi'?'vi-VN':'en-US',{hour:'2-digit',minute:'2-digit'}))}</time></div><p>${h(event.text.slice(0,220))}</p>${button('report','Open report',event.job.id)}</li>`).join('')}</ol>`:`<ol class="getting-started">${[
      ['profiles','Connect your accounts','Set CLI paths, account labels and optional model preferences.'],['flow','Choose who leads','Assign Dev, Audit and one primary manager.'],['newTask','Try a small task','Observe the input, handoffs and public replies.']
    ].map(([action,title,description],index)=>`<li><span class="guide-number">${index+1}</span><div><button class="text-button" data-action="${action}">${tr(title)}</button><p>${tr(description)}</p></div></li>`).join('')}</ol><p class="muted guide-note">${tr('Profile settings do not verify sign-in. Authenticate each CLI separately.')}</p>`}</section></div>`;
}
