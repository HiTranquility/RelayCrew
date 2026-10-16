import { renderTaskCards } from './task-workbench';
import { renderSchedulePanel, planningClient } from './schedule-panel';
import { missionStyles } from './mission-styles';
import type { PromptTemplates } from '../core/prompt-templates';
import { promptTemplateClient } from './prompt-template-panel';
import type { Backlog, Job, Management, Profile, Quota, Role, RoleOverrides } from '../core/domain';
import { statusLabel, translator, type Language } from '../core/i18n';
import { randomBytes } from 'node:crypto';
import { escapeHtml } from './html';
export { escapeHtml } from './html';
import { renderLiveConsole } from './live-console';
import { consoleClient } from './console-client';
import { attachmentClient } from './attachment-client';
import { accountClient, renderAccounts } from './account-panel';
import { boardStyles } from './board-styles';
import { workbenchStyles } from './workbench-styles';
import { renderOverview } from './overview';
import { renderDailyPanel } from './daily-panel';
import { renderProjectsPanel } from './projects-panel';
import type { ProjectRoot } from '../core/projects';
import { renderSetupPanel } from './setup-panel';
import { renderInlineTools } from './inline-tools';
import { configurationClient } from './configuration-client';
import { connectionsClient } from './connections-panel';
import type { Connection } from '../adapters/messaging/messaging';
import { type DailyPlan } from '../core/daily-plan';
export interface BoardOptions {
  schedules?:import('../core/domain').Schedule[];
  cliStatuses?:Record<string,import('../adapters/cli/setup').CliStatus>;
  queuePaused: boolean; autoSwitch: boolean; resumeAfterQuota: boolean; resumeProviderLimited: boolean;
  allowEdits: boolean; routingMode: string; timeoutMinutes: number; remoteTranscript?: string; language?: Language;
  languagePreference?: string; management?: Management; flow?: Role[]; settings?: Record<string, number>;
  backupBeforeEdits?: boolean; dailyPlan?: DailyPlan; requestedPage?: string; pageRequest?: number; projectRoots?: ProjectRoot[]; isolateTasks?:boolean; openTasksInCodex?:boolean; roles?:Record<Role,string>;
  workflow?: {name:string;sha256:string;markdown?:string};
  promptTemplates?:PromptTemplates;
  overrides?:RoleOverrides; rotationPools?:Partial<Record<Role,string[]>>;quotaSnapshots?:Record<string,Quota>;
  initialState?:Record<string,unknown>;
  connections?:Connection[];
}
export function renderBoard(jobs: Job[], profiles: Profile[], quotas: Record<string, Quota>, backlog: Backlog, connectionStatus: string, options?: BoardOptions): string {
  const language = options?.language ?? 'en', t = translator(language), h = escapeHtml;
  const tr = (message: string, ...values: unknown[]) => h(t(message, ...values));
  const nonce = randomBytes(20).toString('hex');
  const button = (action: string, text: string, id = '') => `<button data-action="${h(action)}" data-id="${h(id)}">${h(text)}</button>`;
  const taskCards=renderTaskCards(jobs,profiles,language);
  const toggles = {
    autoSwitch: 'Switch accounts at the quota threshold', resumeAfterQuota: 'Resume when quota recovers',
    resumeProviderLimited: 'Retry provider-limited steps (files may already have changed)', allowEdits: 'Allow Dev / Repair to edit files',
  } as const;
  const page = ['console', 'overview', 'tasks', 'accounts', 'setup', 'daily', 'schedules', 'projects'].includes(options?.requestedPage ?? '') ? options!.requestedPage! : 'console';
  const pageRequest = Number.isFinite(options?.pageRequest) ? options!.pageRequest! : 0;
  return `<!doctype html><html lang="${language}"><head><meta charset="UTF-8"><title>RelayCrew · ${tr('Assignment board')}</title><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    ${boardStyles}
    ${workbenchStyles}
    ${missionStyles}
    </style></head><body>
    <header class="toolbar"><div class="brand-lockup"><span class="brand-mark" aria-hidden="true">R<span>↗</span></span><div><h1>RelayCrew <small class="build-version">0.9.1</small> <span class="workspace-label">${tr('Assignment board')}</span></h1><span class="brand-subtitle">${tr('Your AI team workspace')}</span></div></div><div class="toolbar-actions"><button class="primary" data-action="newTask">${tr('New task')}</button>${button('pause',t(options?.queuePaused?'Resume queue':'Pause immediately'))}<select class="language-select" data-language aria-label="${tr('Language')}"><option value="en" ${language==='en'?'selected':''}>EN</option><option value="vi" ${language==='vi'?'selected':''}>VI</option></select><details class="layout-menu" data-detail="layout-menu"><summary title="${tr('Controls')}">⋯</summary><div>${button('toggleSidebar',t('Toggle VS Code sidebar'))}${button('togglePanel',t('Toggle VS Code panel'))}${button('closeBoard',t('Close RelayCrew board'))}</div></details></div></header>
    <nav class="tabs" role="tablist" aria-label="RelayCrew">${[['console','Live console'],['overview','Overview'],['tasks','Tasks'],['accounts','Accounts & quota'],['setup','Setup'],['daily','Daily quota tasklist'],['schedules','Schedules'],['projects','Projects']].map(([id,label])=>`<button id="tab-${id}" role="tab" aria-controls="page-${id}" aria-selected="${page===id}" tabindex="${page===id?'0':'-1'}" data-tab="${id}">${tr(label)}</button>`).join('')}</nav>
    <main>${renderInlineTools(jobs,profiles,{...options,quotaSnapshots:quotas} as BoardOptions,language)}<div class="metrics" id="task-metrics"><span><b>${jobs.filter(j=>['running','queued'].includes(j.status)).length}</b> ${tr('Running / queued')}</span><span><b>${jobs.filter(j=>['waiting_owner','waiting_quota','needs_attention'].includes(j.status)).length}</b> ${tr('Needs attention / waiting')}</span><span><b>${jobs.filter(j=>j.status==='completed').length}</b> ${tr('Completed')}</span><span>${tr(options?.queuePaused?'Queue paused':'Queue active')}</span></div>
    <div id="page-console" data-page="console" role="tabpanel" aria-labelledby="tab-console" ${page!=='console'?'hidden':''}>${renderLiveConsole(jobs,profiles,options,language)}</div>
    <div id="page-overview" data-page="overview" role="tabpanel" aria-labelledby="tab-overview" ${page!=='overview'?'hidden':''}>${renderOverview(jobs,profiles,quotas,options,language)}</div>
    <div id="page-tasks" data-page="tasks" role="tabpanel" aria-labelledby="tab-tasks" ${page!=='tasks'?'hidden':''}><div class="row"><h2>${tr('Tasks')}</h2><div>${button('backlog',t('Add backlog item'))}${button('utilization',t(backlog.enabled?'Stop quota utilization':'Use available quota'))}</div></div>
    <p class="muted">${tr('Live CLI status, inputs, handoffs and public replies. Private reasoning is not displayed.')}</p>
    <div class="task-tools"><input id="task-search" type="search" aria-label="${tr('Search tasks')}" placeholder="${tr('Search task, folder or account…')}"><div class="task-filters" role="group" aria-label="${tr('Filter tasks')}">${[['all','All'],['active','Active'],['attention','Needs attention'],['finished','Finished']].map(([id,label])=>`<button data-filter="${id}" aria-pressed="${id==='all'}">${tr(label)}</button>`).join('')}</div><span id="task-count" class="muted" role="status"></span></div>
    <p id="task-planning-message" role="status"></p><div id="task-list">${taskCards||'<section class="empty-state">'+tr('No tasks yet. Use New Task or Add Backlog Item.')+'</section>'}</div><p id="no-task-matches" class="empty-state" hidden>${tr('No tasks match this filter.')}</p>
    <section><h2>${tr('Backlog & connections')}</h2><p>${tr('Quota utilization')}: <b>${tr(backlog.enabled?'On':'Off')}</b> · ${tr('{0} runs remaining',backlog.remaining)} · ${backlog.until?tr('until {0}',new Date(backlog.until).toISOString()):tr('No deadline')}</p><ul>${backlog.items.map(i=>`<li>${h(i.prompt.slice(0,160))} <span class="muted">${i.jobId?'→ '+h(i.jobId.slice(0,8)):h(statusLabel('pending',language))}</span></li>`).join('')||'<li>'+tr('No backlog items')+'</li>'}</ul><pre>${h(connectionStatus)}</pre>${button('connections',t('Messaging connections'))}</section>
    <section><details data-detail="remote-chat"><summary>${tr('User ↔ agent chat through Telegram / Zalo')}</summary><pre>${h(options?.remoteTranscript||t('No conversation yet.'))}</pre></details></section></div>
    <div id="page-accounts" data-page="accounts" role="tabpanel" aria-labelledby="tab-accounts" ${page!=='accounts'?'hidden':''}>${renderAccounts(profiles,quotas,options,language)}</div>
    <div id="page-setup" data-page="setup" role="tabpanel" aria-labelledby="tab-setup" ${page!=='setup'?'hidden':''}>${renderSetupPanel(options,language,profiles)}<section><h2>${tr('Controls')}</h2><p class="muted">${tr('Pause stops the process and preserves existing edits. On resume, the agent inspects the unfinished step.')}</p>${(Object.keys(toggles) as (keyof typeof toggles)[]).map(key=>`<label class="check-row"><input type="checkbox" data-setting="${key}" ${options?.[key]?'checked':''}>${tr(toggles[key])}</label>`).join('')}</section></div>
    <div id="page-daily" data-page="daily" role="tabpanel" aria-labelledby="tab-daily" ${page!=='daily'?'hidden':''}>${renderDailyPanel(options?.dailyPlan,profiles,quotas,jobs,language,options?.management,options?.projectRoots,options?.queuePaused)}</div><div id="page-schedules" data-page="schedules" role="tabpanel" aria-labelledby="tab-schedules" ${page!=='schedules'?'hidden':''}>${renderSchedulePanel(options?.schedules??[],jobs,options?.projectRoots??[],language)}</div><div id="page-projects" data-page="projects" role="tabpanel" aria-labelledby="tab-projects" ${page!=='projects'?'hidden':''}>${renderProjectsPanel(options?.projectRoots??[],jobs,profiles,language,options?.isolateTasks,options?.openTasksInCodex)}</div></main>
    <script nonce="${nonce}">
    const vscode=acquireVsCodeApi(),saved=vscode.getState()||${JSON.stringify(options?.initialState??{}).replace(/</g,'\\u003c')};let request=${pageRequest};const pages=['console','overview','tasks','accounts','setup','daily','schedules','projects'];let tab=saved.pageRequest===request&&pages.includes(saved.tab)?saved.tab:${JSON.stringify(page)},drafts=saved.drafts||{},taskFilter=['all','active','attention','finished'].includes(saved.taskFilter)?saved.taskFilter:'all',taskQuery=typeof saved.taskQuery==='string'?saved.taskQuery:'',teamDraft=saved.teamDraft||null,routingDraft=saved.routingDraft||null,workflowDraft=saved.workflowDraft||null,assignmentDraft=saved.assignmentDraft||null,quotaDraft=saved.quotaDraft||null,trialDraft=saved.trialDraft||null,templatesDraft=saved.templatesDraft||null,workflowPreviewValue=null;
    for(const input of document.querySelectorAll('[data-number-setting]'))if(typeof drafts[input.dataset.numberSetting]==='string')input.value=drafts[input.dataset.numberSetting];
    for(const d of document.querySelectorAll('details')){if(Object.hasOwn(saved.details||{},d.dataset.detail))d.open=saved.details[d.dataset.detail];d.addEventListener('toggle',persist);}
    function persist(){const state={tab,pageRequest:request,scroll:window.scrollY,drafts,taskFilter,taskQuery,accountDraft,...planningState(),...configurationState(),...consoleState(),searchFocus:document.activeElement?.id==='task-search',details:Object.fromEntries([...document.querySelectorAll('details')].map(d=>[d.dataset.detail,d.open]))};vscode.setState(state);vscode.postMessage({action:'boardState',state});}
    function showPage(next,focus=false){if(!pages.includes(next))return;tab=next;document.getElementById('task-metrics').hidden=['overview','console'].includes(tab);for(const p of document.querySelectorAll('[data-page]'))p.hidden=p.dataset.page!==tab;for(const b of document.querySelectorAll('[data-tab]')){const active=b.dataset.tab===tab;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;if(active&&focus)b.focus();}}
    ${planningClient}
    ${consoleClient}
    ${attachmentClient}
    ${accountClient}
    ${configurationClient}
    ${connectionsClient}
    ${promptTemplateClient}
    let search=document.getElementById('task-search');search.value=taskQuery;
    function filterTasks(){const groups={active:['running','queued'],attention:['waiting_owner','waiting_quota','needs_attention','failed','interrupted'],finished:['completed','cancelled']},cards=[...document.querySelectorAll('[data-task-status]')];let count=0;for(const card of cards){card.hidden=(taskFilter!=='all'&&!groups[taskFilter].includes(card.dataset.taskStatus))||!card.dataset.taskSearch.toLocaleLowerCase().includes(taskQuery.toLocaleLowerCase());if(!card.hidden)count++;}for(const b of document.querySelectorAll('[data-filter]'))b.setAttribute('aria-pressed',String(b.dataset.filter===taskFilter));document.getElementById('task-count').textContent=count+' / '+cards.length;document.getElementById('no-task-matches').hidden=count>0||cards.length===0;}
    filterTasks();showPage(tab);window.scrollTo(0,saved.pageRequest===request?saved.scroll||0:0);window.addEventListener('scroll',persist);if(saved.searchFocus&&tab==='tasks')search.focus({preventScroll:true});
    document.addEventListener('input',e=>{if(e.target.id==='task-search'){taskQuery=e.target.value;filterTasks();persist();}if(e.target.dataset.numberSetting){drafts[e.target.dataset.numberSetting]=e.target.value;persist();}});
    document.addEventListener('click',e=>{const jump=e.target.closest('[data-open-page]');if(jump){if(jump.dataset.taskFilter){taskFilter=jump.dataset.taskFilter;taskQuery='';search.value='';filterTasks();}showPage(jump.dataset.openPage);window.scrollTo(0,0);persist();return;}const filter=e.target.closest('[data-filter]');if(filter){taskFilter=filter.dataset.filter;filterTasks();persist();return;}const page=e.target.closest('button[data-tab]');if(page){showPage(page.dataset.tab);window.scrollTo(0,0);persist();return;}const b=e.target.closest('button[data-action]');if(!b)return;const action=b.dataset.action;if(['connectCli','profiles','editProfile','account'].includes(action)){openConfiguration('account',{id:b.dataset.id});return;}if(action==='flow'||action==='routing'||action==='connections'){openConfiguration(action==='flow'?'team':action);return;}if(action==='quota'){openConfiguration('quota',{id:b.dataset.id});return;}if(action==='switch'){openConfiguration('assignment',{id:b.dataset.id});return;}if(action==='checkCli'){vscode.postMessage({action:'checkCli',profileId:b.dataset.id});return;}if(action==='tryCli'&&!b.dataset.id){openConfiguration('trial');return;}if(b.dataset.action==='reply'&&[...document.querySelectorAll('[data-session-panel]')].some(p=>p.dataset.sessionPanel===b.dataset.id)){showPage('console');consoleHideComposer=false;applyConsoleLayout();selectConsole(b.dataset.id);consoleMode.value='reply';consoleReplyVersion=Number(document.querySelector('[data-session-panel]:not([hidden])')?.dataset.ownerVersion??0);consoleInput.focus();persist();return;}if(b.dataset.action==='saveSettings'){const inputs=[...document.querySelectorAll('[data-number-setting]')],invalid=inputs.find(i=>!i.checkValidity());if(invalid){invalid.reportValidity();return;}vscode.postMessage({action:'saveSettings',settings:Object.fromEntries(inputs.map(i=>[i.dataset.numberSetting,Number(i.value)]))});return;}vscode.postMessage({action:b.dataset.action,id:b.dataset.id});});
    document.addEventListener('keydown',e=>{if(e.key!=='Enter'||e.isComposing||e.shiftKey||e.altKey||!(e.ctrlKey||e.metaKey))return;const form=e.target.closest('form');if(form&&form.id!=='console-form'){e.preventDefault();form.requestSubmit();}});
    document.querySelector('.tabs').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const index=pages.indexOf(tab),next=e.key==='Home'?0:e.key==='End'?pages.length-1:(index+(e.key==='ArrowRight'?1:-1)+pages.length)%pages.length;showPage(pages[next],true);persist();});
    document.addEventListener('change',e=>{const target=e.target;if(target.dataset.setting)vscode.postMessage({action:'toggle',key:target.dataset.setting,value:target.checked});if(target.dataset.dailyAccount)vscode.postMessage({action:'dailyAccount',id:target.dataset.dailyAccount,value:target.checked});if(target.dataset.dailyOption)vscode.postMessage({action:'dailyOption',key:target.dataset.dailyOption,value:target.checked});if(target.hasAttribute('data-language'))vscode.postMessage({action:'setLanguage',value:target.value});});
    window.addEventListener('message',e=>{if(e.data.type==='boardSnapshot'){
      const parsed=new DOMParser().parseFromString(e.data.html,'text/html'),focus=document.activeElement?.id,selection=focus==='task-search'?[search.selectionStart,search.selectionEnd]:undefined,scroll=window.scrollY,details=Object.fromEntries([...document.querySelectorAll('details')].map(d=>[d.dataset.detail,d.open]));
      let setupReplaced=false;for(const id of pages){if(id==='console'||id==='accounts'&&accountDraft||id==='setup'&&(Object.keys(drafts).length||teamDraft||routingDraft||workflowDraft||templatesDraft||document.getElementById('page-setup').contains(document.activeElement)))continue;const incoming=parsed.getElementById('page-'+id);if(incoming){document.getElementById('page-'+id).innerHTML=incoming.innerHTML;if(id==='setup')setupReplaced=true;}}
      const incomingConfig=parsed.getElementById('configuration-data');if(incomingConfig)document.getElementById('configuration-data').dataset.value=incomingConfig.dataset.value;const metrics=parsed.getElementById('task-metrics');if(metrics)document.getElementById('task-metrics').innerHTML=metrics.innerHTML;const toolbar=parsed.querySelector('.toolbar');if(toolbar)document.querySelector('.toolbar').innerHTML=toolbar.innerHTML;
      for(const d of document.querySelectorAll('details')){if(Object.hasOwn(details,d.dataset.detail))d.open=details[d.dataset.detail];d.addEventListener('toggle',persist);}
      search=document.getElementById('task-search');search.value=taskQuery;filterTasks();refreshConfigurationChoices(parsed);layoutTeam();restoreConfigurationMessages();if(setupReplaced){layoutConnection(true);refreshTemplatePanel();}restorePlanning();const cwd=parsed.getElementById('console-cwd');if(cwd&&[...cwd.options].some(o=>o.value===consoleCwd.value)){const value=consoleCwd.value;consoleCwd.innerHTML=cwd.innerHTML;consoleCwd.value=value;}patchConsole(e.data.html);if(e.data.pageRequest!==request){request=e.data.pageRequest;showPage(e.data.page);window.scrollTo(0,0);}else window.scrollTo(0,scroll);
      if(focus&&focus!=='console-input'){const input=document.getElementById(focus);if(input){input.focus({preventScroll:true});if(selection&&input.setSelectionRange)input.setSelectionRange(...selection);}}
      persist();return;
    }if(e.data.type==='settingsSaved'){if(e.data.ok!==false)drafts={};persist();document.getElementById('settings-status').textContent=e.data.message;}});
    vscode.postMessage({action:'consoleReady'});
    </script></body></html>`;
}
