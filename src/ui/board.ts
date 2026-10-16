import type { Backlog, Job, Management, Profile, Quota, Role } from '../core/domain';
import { fresh } from '../core/domain';
import { roleLabel, statusLabel, translator, type Language } from '../core/i18n';
import { randomBytes } from 'node:crypto';
import { escapeHtml } from './html';
export { escapeHtml } from './html';
import { renderLiveConsole } from './live-console';
import { consoleClient } from './console-client';
import { attachmentClient } from './attachment-client';
import { accountClient, renderAccounts } from './account-panel';
import { boardStyles } from './board-styles';
import { renderOverview, quotaMeter } from './overview';
import { renderDailyPanel } from './daily-panel';
import { renderProjectsPanel } from './projects-panel';
import type { ProjectRoot } from '../core/projects';
import { renderSetupPanel } from './setup-panel';
import { maintenanceLabels, type DailyPlan } from '../core/daily-plan';
function summary(response: string | undefined, language: Language): string {
  if (!response) return translator(language)('No response yet');
  try { const data = JSON.parse(response); return String(data.summary ?? data.question ?? response).slice(0, 500); }
  catch { return response.slice(0, 500); }
}
export interface BoardOptions {
  queuePaused: boolean; autoSwitch: boolean; resumeAfterQuota: boolean; resumeProviderLimited: boolean;
  allowEdits: boolean; routingMode: string; timeoutMinutes: number; remoteTranscript?: string; language?: Language;
  languagePreference?: string; management?: Management; flow?: Role[]; settings?: Record<string, number>;
  backupBeforeEdits?: boolean; dailyPlan?: DailyPlan; requestedPage?: string; pageRequest?: number; projectRoots?: ProjectRoot[]; isolateTasks?:boolean; openTasksInCodex?:boolean; roles?:Record<Role,string>;
  workflow?: {name:string;sha256:string};
  initialState?:Record<string,unknown>;
}
export function renderBoard(jobs: Job[], profiles: Profile[], quotas: Record<string, Quota>, backlog: Backlog, connectionStatus: string, options?: BoardOptions): string {
  const language = options?.language ?? 'en', t = translator(language), h = escapeHtml;
  const tr = (message: string, ...values: unknown[]) => h(t(message, ...values));
  const nonce = randomBytes(20).toString('hex');
  const button = (action: string, text: string, id = '') => `<button data-action="${h(action)}" data-id="${h(id)}">${h(text)}</button>`;
  const profileName = (id: string) => { const p = profiles.find(p => p.id === id); return p ? `${p.label} · ${p.model || t('CLI default')}${p.effort ? ' / ' + p.effort : ''}` : id; };
  const rank = (job: Job) => job.status === 'running' ? 0 : ['waiting_owner', 'waiting_quota'].includes(job.status) ? 1 : job.status === 'queued' ? 2 : 3;
  const taskTitle = (job: Job) => { const item=options?.dailyPlan?.items.find(item=>item.jobId===job.id); return item && item.category!=='task' ? t(maintenanceLabels[item.category]) : job.prompt.slice(0,120); };
  const taskCards = jobs.slice().sort((a, b) => rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt)).slice(0, 30).map(j => `
    <section class="task-card" data-task-status="${h(j.status)}" data-task-search="${h([j.id,j.prompt,j.cwd,...Object.values(j.roles)].join(' '))}"><div class="row"><h2>${h(taskTitle(j))}</h2><span class="status-pill" data-status="${h(j.status)}">${h(statusLabel(j.status, language))}</span></div>
    <div class="muted">${h(j.id)} · ${h(j.cwd)}</div>
    ${j.management?`<p class="muted"><span class="badge">${tr('Primary manager')}</span> ${h(profileName(j.management.primaryProfileId))}${j.management.coordinatorIds.length?' · '+tr('Supporting coordinators')+': '+j.management.coordinatorIds.map(id=>h(profileName(id))).join(' · '):''}</p>`:''}
    <p>${button('report', t('Report'), j.id)} ${['running', 'queued', 'waiting_owner', 'waiting_quota'].includes(j.status) ? button('switch', t('Switch account'), j.id) + button('cancel', t('Stop task'), j.id) : ''}
    ${j.status === 'waiting_owner' ? button('reply', t('Reply to agent'), j.id) : ''} ${j.status === 'waiting_quota' ? button('resume', t('Resume after reviewing changes'), j.id) : ''}</p>
    ${j.ownerQuestion ? `<aside><b>${tr('The agent needs your reply')}</b><p>${h(j.ownerQuestion)}</p><code>/reply ${h(j.id.slice(0, 8))} ${tr('your answer')}</code> · ${tr('or use Reply to Agent')}</aside>` : ''}
    ${j.error ? `<p class="warning">${h(t(j.error))}</p>` : ''}
    <div class="task-stage-heading"><span class="muted">${tr('{0} / {1} recorded steps complete',j.steps.filter(s=>s.status==='done').length,j.steps.length)}</span></div><ol class="step-track">${j.steps.map(s=>`<li data-status="${h(s.status)}"><span class="step-dot" aria-hidden="true">${s.status==='done'?'✓':s.status==='running'?'●':'○'}</span><span>${s.coordinatorProfileId?tr('Coordinator'):h(roleLabel(s.role,language))}<small>${h(statusLabel(s.status,language))}</small></span></li>`).join('')}</ol>
    <details data-detail="${h(j.id)}:assignments" class="assignment-details"><summary>${tr('Assignments, models and results')}</summary><table><thead><tr>${['Role', 'Task', 'Model / account', 'Status', 'Summary'].map(label => `<th>${tr(label)}</th>`).join('')}</tr></thead><tbody>
    ${j.steps.map(s => `<tr><td>${s.coordinatorProfileId?tr('Coordinator'):s.role==='lead'&&j.management?tr('Primary manager'):h(roleLabel(s.role, language))}</td><td>${h(s.role==='worker'?s.title:t(s.title))}</td>
      <td>${button('account', profiles.find(p=>p.id===(s.profileId??s.coordinatorProfileId??j.roles[s.role]))?.label??s.profileId??s.coordinatorProfileId??j.roles[s.role], s.profileId??s.coordinatorProfileId??j.roles[s.role])}<small>${h(s.profileId??s.coordinatorProfileId??j.roles[s.role])}</small><small>${tr(s.profileId?'Run model':'Model')}: ${h(s.profileId?s.model??t('CLI default'):(!s.coordinatorProfileId?j.overrides?.[s.role]?.model:undefined)??profiles.find(p=>p.id===(s.coordinatorProfileId??j.roles[s.role]))?.model??t('CLI default'))}${s.effort?' / '+h(s.effort):''}</small></td>
      <td>${h(statusLabel(s.status, language))}${s.startedAt ? '<br><span class="muted">' + (s.status === 'running' ? tr('{0} seconds elapsed · ETA unknown', Math.max(0, Math.floor((Date.now() - Date.parse(s.startedAt)) / 1000))) + '<br>' + (s.phase === 'backing_up' ? tr('Creating source backup') : tr('Timeout') + ': ' + h(s.timeoutAt ?? t('CLI not started'))) : h(s.startedAt)) + '</span>' : ''}</td>
      <td class="summary">${h(summary(s.response, language))}</td></tr>`).join('')}
    </tbody></table></details><p class="muted">${tr('Team')}: ${Object.entries(j.roles).map(([role, id]) => `${h(roleLabel(role, language))} → ${h(profileName(id))}`).join(' · ')}</p>
    ${j.audit ? `<h3>${tr('Audit · {0} findings / {1} repairs', j.audit.issues.length, j.audit.tasks.length)}</h3><p>${h(j.audit.summary)}</p><ul>${j.audit.issues.map(i => `<li><b>${h(i.severity)}: ${h(i.title)}</b> — ${h(i.body.slice(0, 400))}</li>`).join('')}</ul>` : ''}
    <details data-detail="${h(j.id)}:conversation"><summary>${tr('Conversation · who asked / who replied ({0} events)', j.timeline?.length ?? 0)}</summary>${(j.timeline ?? []).slice(-120).map(e => `<article><div class="muted">${h(e.at)} · ${h(e.kind)}</div><b>${h(e.from)} → ${h(e.to)}</b><pre>${h(e.text.slice(0, 8000))}</pre></article>`).join('') || '<p>' + tr('No conversation yet.') + '</p>'}</details>
    ${j.steps.map((s, index) => `<details data-detail="${h(j.id)}:step:${index}"><summary>${s.coordinatorProfileId?tr('Coordinator'):s.role==='lead'&&j.management?tr('Primary manager'):h(roleLabel(s.role, language))} · ${tr('Sent / received')}</summary><h4>${tr('Input sent to {0}', s.profileId ?? s.coordinatorProfileId ?? j.roles[s.role])}</h4><pre>${h(s.request?.slice(0, 16000) ?? s.prompt)}</pre><h4>${tr('Response')}</h4><pre>${h(s.response?.slice(0, 16000) ?? t('Waiting for a response; see live events above.'))}</pre></details>`).join('')}
    <p class="muted">${tr('Long inputs and responses are shortened here; local reports contain the full text.')}</p></section>`).join('');
  const toggles = {
    autoSwitch: 'Switch accounts at the quota threshold', resumeAfterQuota: 'Resume when quota recovers',
    resumeProviderLimited: 'Retry provider-limited steps (files may already have changed)', allowEdits: 'Allow Dev / Repair to edit files',
  } as const;
  const page = ['console', 'overview', 'tasks', 'accounts', 'setup', 'daily', 'projects'].includes(options?.requestedPage ?? '') ? options!.requestedPage! : 'console';
  const pageRequest = Number.isFinite(options?.pageRequest) ? options!.pageRequest! : 0;
  return `<!doctype html><html lang="${language}"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    ${boardStyles}
    </style></head><body>
    <header class="toolbar"><h1>RelayCrew · ${tr('Assignment board')}</h1><div class="toolbar-actions"><button class="primary" data-action="newTask">${tr('New task')}</button>${button('pause',t(options?.queuePaused?'Resume queue':'Pause immediately'))}${button('language',language==='vi'?'Tiếng Việt':'English')}<details class="layout-menu" data-detail="layout-menu"><summary title="${tr('Controls')}">⋯</summary><div>${button('toggleSidebar',t('Toggle VS Code sidebar'))}${button('togglePanel',t('Toggle VS Code panel'))}${button('closeBoard',t('Close RelayCrew board'))}</div></details></div></header>
    <nav class="tabs" role="tablist" aria-label="RelayCrew">${[['console','Live console'],['overview','Overview'],['tasks','Tasks'],['accounts','Accounts & quota'],['setup','Setup'],['daily','Daily quota tasklist'],['projects','Projects']].map(([id,label])=>`<button id="tab-${id}" role="tab" aria-controls="page-${id}" aria-selected="${page===id}" tabindex="${page===id?'0':'-1'}" data-tab="${id}">${tr(label)}</button>`).join('')}</nav>
    <main><div class="metrics" id="task-metrics"><span><b>${jobs.filter(j=>['running','queued'].includes(j.status)).length}</b> ${tr('Running / queued')}</span><span><b>${jobs.filter(j=>['waiting_owner','waiting_quota','needs_attention'].includes(j.status)).length}</b> ${tr('Needs attention / waiting')}</span><span><b>${jobs.filter(j=>j.status==='completed').length}</b> ${tr('Completed')}</span><span>${tr(options?.queuePaused?'Queue paused':'Queue active')}</span></div>
    <div id="page-console" data-page="console" role="tabpanel" aria-labelledby="tab-console" ${page!=='console'?'hidden':''}>${renderLiveConsole(jobs,profiles,options,language)}</div>
    <div id="page-overview" data-page="overview" role="tabpanel" aria-labelledby="tab-overview" ${page!=='overview'?'hidden':''}>${renderOverview(jobs,profiles,quotas,options,language)}</div>
    <div id="page-tasks" data-page="tasks" role="tabpanel" aria-labelledby="tab-tasks" ${page!=='tasks'?'hidden':''}><div class="row"><h2>${tr('Tasks')}</h2><div>${button('backlog',t('Add backlog item'))}${button('utilization',t(backlog.enabled?'Stop quota utilization':'Use available quota'))}</div></div>
    <p class="muted">${tr('Live CLI status, inputs, handoffs and public replies. Private reasoning is not displayed.')}</p>
    <div class="task-tools"><input id="task-search" type="search" aria-label="${tr('Search tasks')}" placeholder="${tr('Search task, folder or account…')}"><div class="task-filters" role="group" aria-label="${tr('Filter tasks')}">${[['all','All'],['active','Active'],['attention','Needs attention'],['finished','Finished']].map(([id,label])=>`<button data-filter="${id}" aria-pressed="${id==='all'}">${tr(label)}</button>`).join('')}</div><span id="task-count" class="muted" role="status"></span></div>
    <div id="task-list">${taskCards||'<section class="empty-state">'+tr('No tasks yet. Use New Task or Add Backlog Item.')+'</section>'}</div><p id="no-task-matches" class="empty-state" hidden>${tr('No tasks match this filter.')}</p>
    <section><h2>${tr('Backlog & connections')}</h2><p>${tr('Quota utilization')}: <b>${tr(backlog.enabled?'On':'Off')}</b> · ${tr('{0} runs remaining',backlog.remaining)} · ${backlog.until?tr('until {0}',new Date(backlog.until).toISOString()):tr('No deadline')}</p><ul>${backlog.items.map(i=>`<li>${h(i.prompt.slice(0,160))} <span class="muted">${i.jobId?'→ '+h(i.jobId.slice(0,8)):h(statusLabel('pending',language))}</span></li>`).join('')||'<li>'+tr('No backlog items')+'</li>'}</ul><pre>${h(connectionStatus)}</pre>${button('connections',t('Messaging connections'))}</section>
    <section><details data-detail="remote-chat"><summary>${tr('User ↔ agent chat through Telegram / Zalo')}</summary><pre>${h(options?.remoteTranscript||t('No conversation yet.'))}</pre></details></section></div>
    <div id="page-accounts" data-page="accounts" role="tabpanel" aria-labelledby="tab-accounts" ${page!=='accounts'?'hidden':''}>${renderAccounts(profiles,quotas,options,language)}</div>
    <div id="page-setup" data-page="setup" role="tabpanel" aria-labelledby="tab-setup" ${page!=='setup'?'hidden':''}>${renderSetupPanel(options,language)}<section><h2>${tr('Controls')}</h2><p class="muted">${tr('Pause stops the process and preserves existing edits. On resume, the agent inspects the unfinished step.')}</p>${(Object.keys(toggles) as (keyof typeof toggles)[]).map(key=>`<label class="check-row"><input type="checkbox" data-setting="${key}" ${options?.[key]?'checked':''}>${tr(toggles[key])}</label>`).join('')}</section></div>
    <div id="page-daily" data-page="daily" role="tabpanel" aria-labelledby="tab-daily" ${page!=='daily'?'hidden':''}>${renderDailyPanel(options?.dailyPlan,profiles,quotas,jobs,language,options?.management)}</div><div id="page-projects" data-page="projects" role="tabpanel" aria-labelledby="tab-projects" ${page!=='projects'?'hidden':''}>${renderProjectsPanel(options?.projectRoots??[],jobs,profiles,language,options?.isolateTasks,options?.openTasksInCodex)}</div></main>
    <script nonce="${nonce}">
    const vscode=acquireVsCodeApi(),saved=vscode.getState()||${JSON.stringify(options?.initialState??{}).replace(/</g,'\\u003c')};let request=${pageRequest};const pages=['console','overview','tasks','accounts','setup','daily','projects'];let tab=saved.pageRequest===request&&pages.includes(saved.tab)?saved.tab:${JSON.stringify(page)},drafts=saved.drafts||{},taskFilter=['all','active','attention','finished'].includes(saved.taskFilter)?saved.taskFilter:'all',taskQuery=typeof saved.taskQuery==='string'?saved.taskQuery:'';
    for(const input of document.querySelectorAll('[data-number-setting]'))if(typeof drafts[input.dataset.numberSetting]==='string')input.value=drafts[input.dataset.numberSetting];
    for(const d of document.querySelectorAll('details')){if(Object.hasOwn(saved.details||{},d.dataset.detail))d.open=saved.details[d.dataset.detail];d.addEventListener('toggle',persist);}
    function persist(){const state={tab,pageRequest:request,scroll:window.scrollY,drafts,taskFilter,taskQuery,accountDraft,...consoleState(),searchFocus:document.activeElement?.id==='task-search',details:Object.fromEntries([...document.querySelectorAll('details')].map(d=>[d.dataset.detail,d.open]))};vscode.setState(state);vscode.postMessage({action:'boardState',state});}
    function showPage(next,focus=false){if(!pages.includes(next))return;tab=next;document.getElementById('task-metrics').hidden=['overview','console'].includes(tab);for(const p of document.querySelectorAll('[data-page]'))p.hidden=p.dataset.page!==tab;for(const b of document.querySelectorAll('[data-tab]')){const active=b.dataset.tab===tab;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;if(active&&focus)b.focus();}}
    ${consoleClient}
    ${attachmentClient}
    ${accountClient}
    let search=document.getElementById('task-search');search.value=taskQuery;
    function filterTasks(){const groups={active:['running','queued'],attention:['waiting_owner','waiting_quota','needs_attention','failed','interrupted'],finished:['completed','cancelled']},cards=[...document.querySelectorAll('[data-task-status]')];let count=0;for(const card of cards){card.hidden=(taskFilter!=='all'&&!groups[taskFilter].includes(card.dataset.taskStatus))||!card.dataset.taskSearch.toLocaleLowerCase().includes(taskQuery.toLocaleLowerCase());if(!card.hidden)count++;}for(const b of document.querySelectorAll('[data-filter]'))b.setAttribute('aria-pressed',String(b.dataset.filter===taskFilter));document.getElementById('task-count').textContent=count+' / '+cards.length;document.getElementById('no-task-matches').hidden=count>0||cards.length===0;}
    filterTasks();showPage(tab);window.scrollTo(0,saved.pageRequest===request?saved.scroll||0:0);window.addEventListener('scroll',persist);if(saved.searchFocus&&tab==='tasks')search.focus({preventScroll:true});
    document.addEventListener('input',e=>{if(e.target.id==='task-search'){taskQuery=e.target.value;filterTasks();persist();}if(e.target.dataset.numberSetting){drafts[e.target.dataset.numberSetting]=e.target.value;persist();}});
    document.addEventListener('click',e=>{const jump=e.target.closest('[data-open-page]');if(jump){if(jump.dataset.taskFilter){taskFilter=jump.dataset.taskFilter;taskQuery='';search.value='';filterTasks();}showPage(jump.dataset.openPage);window.scrollTo(0,0);persist();return;}const filter=e.target.closest('[data-filter]');if(filter){taskFilter=filter.dataset.filter;filterTasks();persist();return;}const page=e.target.closest('button[data-tab]');if(page){showPage(page.dataset.tab);window.scrollTo(0,0);persist();return;}const b=e.target.closest('button[data-action]');if(!b)return;if(b.dataset.action==='reply'&&[...document.querySelectorAll('[data-session-panel]')].some(p=>p.dataset.sessionPanel===b.dataset.id)){showPage('console');consoleHideComposer=false;applyConsoleLayout();selectConsole(b.dataset.id);consoleMode.value='reply';consoleReplyVersion=Number(document.querySelector('[data-session-panel]:not([hidden])')?.dataset.ownerVersion??0);consoleInput.focus();persist();return;}if(b.dataset.action==='saveSettings'){const inputs=[...document.querySelectorAll('[data-number-setting]')],invalid=inputs.find(i=>!i.checkValidity());if(invalid){invalid.reportValidity();return;}vscode.postMessage({action:'saveSettings',settings:Object.fromEntries(inputs.map(i=>[i.dataset.numberSetting,Number(i.value)]))});return;}vscode.postMessage({action:b.dataset.action,id:b.dataset.id});});
    document.querySelector('.tabs').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const index=pages.indexOf(tab),next=e.key==='Home'?0:e.key==='End'?pages.length-1:(index+(e.key==='ArrowRight'?1:-1)+pages.length)%pages.length;showPage(pages[next],true);persist();});
    document.addEventListener('change',e=>{const target=e.target;if(target.dataset.setting)vscode.postMessage({action:'toggle',key:target.dataset.setting,value:target.checked});if(target.dataset.dailyAccount)vscode.postMessage({action:'dailyAccount',id:target.dataset.dailyAccount,value:target.checked});if(target.dataset.dailyOption)vscode.postMessage({action:'dailyOption',key:target.dataset.dailyOption,value:target.checked});if(target.hasAttribute('data-language'))vscode.postMessage({action:'setLanguage',value:target.value});});
    window.addEventListener('message',e=>{if(e.data.type==='boardSnapshot'){
      const parsed=new DOMParser().parseFromString(e.data.html,'text/html'),focus=document.activeElement?.id,selection=focus==='task-search'?[search.selectionStart,search.selectionEnd]:undefined,scroll=window.scrollY,details=Object.fromEntries([...document.querySelectorAll('details')].map(d=>[d.dataset.detail,d.open]));
      for(const id of pages){if(id==='console'||id==='accounts'&&accountDraft||id==='setup'&&(Object.keys(drafts).length||document.getElementById('page-setup').contains(document.activeElement)))continue;const incoming=parsed.getElementById('page-'+id);if(incoming)document.getElementById('page-'+id).innerHTML=incoming.innerHTML;}
      const metrics=parsed.getElementById('task-metrics');if(metrics)document.getElementById('task-metrics').innerHTML=metrics.innerHTML;const toolbar=parsed.querySelector('.toolbar');if(toolbar)document.querySelector('.toolbar').innerHTML=toolbar.innerHTML;
      for(const d of document.querySelectorAll('details')){if(Object.hasOwn(details,d.dataset.detail))d.open=details[d.dataset.detail];d.addEventListener('toggle',persist);}
      search=document.getElementById('task-search');search.value=taskQuery;filterTasks();const cwd=parsed.getElementById('console-cwd');if(cwd&&[...cwd.options].some(o=>o.value===consoleCwd.value)){const value=consoleCwd.value;consoleCwd.innerHTML=cwd.innerHTML;consoleCwd.value=value;}patchConsole(e.data.html);if(e.data.pageRequest!==request){request=e.data.pageRequest;showPage(e.data.page);window.scrollTo(0,0);}else window.scrollTo(0,scroll);
      if(focus&&focus!=='console-input'){const input=document.getElementById(focus);if(input){input.focus({preventScroll:true});if(selection&&input.setSelectionRange)input.setSelectionRange(...selection);}}
      persist();return;
    }if(e.data.type==='settingsSaved'){drafts={};persist();document.getElementById('settings-status').textContent=e.data.message;}});
    vscode.postMessage({action:'consoleReady'});
    </script></body></html>`;
}
