import {liveTabsClient,liveTabsStyles} from './live-tabs';
import {teamControlClient,teamControlStyles} from './team-control';
import {releaseStyles} from './release-styles';
import {accountListStyles} from './account-list';
import {accountSessionsClient,accountSessionsStyles} from './account-sessions';
import {preparationClient,preparationStyles} from './preparation';
import {sessionViewsClient,sessionViewsStyles} from './session-views';
import {version as extensionVersion} from '../../package.json';
import {nativeAgentsStyles} from './native-agents';
import {maintenanceClient,maintenanceStyles} from './maintenance-controls';
import {branchClient,branchStyles} from './session-branches';
import {quotaWatch,quotaWatchClient,quotaWatchStyles} from './quota-watch';
import {directionClient,directionStyles} from './direction-composer';
import {taskBatchStyles} from './task-batches';
import {fileChangesClient,fileChangesStyles} from './file-changes';
import {reviewTeamClient,reviewTeamStyles} from './review-team-controls';
import {delegationControlStyles} from './delegation-controls';
import {mapViewStyles} from './map-views';
import {headerChrome,headerChromeClient,headerChromeStyles} from './header-chrome';
import {mapCommunicationStyles} from './map-communication';
import {mapTeamEditorClient,mapTeamEditorStyles} from './map-team-editor';
import {renderCompletionCenter,completionCenterStyles} from './completion-center';
import {composerExperienceClient,composerExperienceStyles} from './composer-experience';
import type {CompletionNotice} from '../core/completion-notices';
import {agentCanvasClient,agentCanvasStyles} from './agent-canvas';
import {movablePanelClient,movablePanelStyles} from './movable-panels';
import {agentMapClient,agentMapStyles} from './agent-map';
import {backlogClient,renderBacklog} from './backlog-panel';
import {scopedClient} from './scoped-filters';
import {voiceClient} from './voice-input';
import {dailyMonitorClient} from './daily-monitor';
import { renderTaskCards } from './task-workbench';
import { renderSchedulePanel, planningClient } from './schedule-panel';
import { visualStyles } from './visual-styles';
import { missionStyles } from './mission-styles';
import { interactionPanel, interactionClient, interactionStyles } from './interaction-panel';
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
  auditors?:import('../core/domain').AuditReviewer[];
  delegation?:import('../core/delegation').DelegationPolicy;
  completionNotices?:CompletionNotice[];completionNotificationLevel?:string;
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
  const page = ['console', 'overview', 'tasks', 'accounts', 'setup', 'daily', 'schedules', 'projects'].includes(options?.requestedPage ?? '') ? options!.requestedPage! : 'setup';
  const pageRequest = Number.isFinite(options?.pageRequest) ? options!.pageRequest! : 0;
  return `<!doctype html><html lang="${language}"><head><meta charset="UTF-8"><title>RelayCrew · ${tr('Assignment board')}</title><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    ${boardStyles}${quotaWatchStyles}${directionStyles}${branchStyles}${maintenanceStyles}
    ${workbenchStyles}
    ${missionStyles}
    ${interactionStyles}
    ${visualStyles}
    ${agentMapStyles}
    ${movablePanelStyles}
    ${agentCanvasStyles}
    ${completionCenterStyles}
    ${composerExperienceStyles}
    ${mapTeamEditorStyles}
    ${mapCommunicationStyles}
    ${headerChromeStyles}
    ${mapViewStyles}
    ${delegationControlStyles}
${reviewTeamStyles}
${fileChangesStyles}
${taskBatchStyles}
    ${nativeAgentsStyles}${preparationStyles}${sessionViewsStyles}${accountSessionsStyles}${accountListStyles}${releaseStyles}${teamControlStyles}${liveTabsStyles}</style></head><body>
    ${headerChrome(language)}${quotaWatch(profiles,quotas,jobs,options?.settings?.quotaThreshold??95,language)}<header class="toolbar"><div class="brand-lockup"><span class="brand-mark" aria-hidden="true">R<span>↗</span></span><div><h1>RelayCrew <small class="build-version">${h(extensionVersion)}</small> <span class="workspace-label">${tr('Assignment board')}</span></h1><span class="brand-subtitle">${tr('Your AI team workspace')}</span></div></div><div class="toolbar-actions"><button class="primary" data-action="newTask">${tr('New task')}</button>${button('pause',t(options?.queuePaused?'Resume queue':'Pause immediately'))}${renderCompletionCenter(options?.completionNotices??[],jobs,profiles,language,options?.completionNotificationLevel)}<select class="language-select" data-language aria-label="${tr('Language')}"><option value="en" ${language==='en'?'selected':''}>EN</option><option value="vi" ${language==='vi'?'selected':''}>VI</option></select><details class="layout-menu" data-detail="layout-menu"><summary title="${tr('Controls')}">⋯</summary><div><button type="button" data-layout-open>${tr('Layout and shortcuts')}</button>${button('toggleSidebar',t('Toggle VS Code sidebar'))}${button('togglePanel',t('Toggle VS Code panel'))}${button('closeBoard',t('Close RelayCrew board'))}</div></details></div></header>
    <nav class="tabs" role="tablist" aria-label="RelayCrew">${[['setup','Prepare a run'],['console','Live console'],['tasks','Tasks'],['accounts','Accounts & quota'],['overview','Overview'],['daily','Daily quota tasklist'],['schedules','Schedules'],['projects','Projects']].map(([id,label])=>`<button id="tab-${id}" role="tab" aria-controls="page-${id}" aria-selected="${page===id}" tabindex="${page===id?'0':'-1'}" data-tab="${id}">${tr(label)}</button>`).join('')}</nav>
    <main>${interactionPanel(language)}${renderInlineTools(jobs,profiles,{...options,quotaSnapshots:quotas} as BoardOptions,language)}<div class="metrics" id="task-metrics"><span><b>${jobs.filter(j=>['running','queued'].includes(j.status)).length}</b> ${tr('Running / queued')}</span><span><b>${jobs.filter(j=>['waiting_owner','waiting_quota','needs_attention'].includes(j.status)).length}</b> ${tr('Needs attention / waiting')}</span><span><b>${jobs.filter(j=>j.status==='completed').length}</b> ${tr('Completed')}</span><span>${tr(options?.queuePaused?'Queue paused':'Queue active')}</span></div>
    <div id="page-console" data-page="console" role="tabpanel" aria-labelledby="tab-console" ${page!=='console'?'hidden':''}>${renderLiveConsole(jobs,profiles,options,language)}</div>
    <div id="page-overview" data-page="overview" role="tabpanel" aria-labelledby="tab-overview" ${page!=='overview'?'hidden':''}>${renderOverview(jobs,profiles,quotas,options,language)}</div>
    <div id="page-tasks" data-page="tasks" role="tabpanel" aria-labelledby="tab-tasks" ${page!=='tasks'?'hidden':''}><div class="row"><h2>${tr('Tasks')}</h2><div>${button('backlog',t('Add backlog item'))}${button('utilization',t(backlog.enabled?'Stop quota utilization':'Use available quota'))}</div></div>
    <p class="muted">${tr('Live CLI status, inputs, handoffs and public replies. Private reasoning is not displayed.')}</p>
    <div class="task-tools"><input id="task-search" type="search" aria-label="${tr('Search tasks')}" placeholder="${tr('Search task, folder or account…')}"><input id="task-exclude" type="search" aria-label="${tr('Exclude search')}" placeholder="${tr('Exclude terms, separated by commas')}"><select id="task-page-size" aria-label="${tr('Rows per page')}"><option>10</option><option selected>20</option><option>50</option><option>100</option></select><button data-task-page="-1" aria-label="${tr('Previous page')}">‹</button><span id="task-page-label"></span><button data-task-page="1" aria-label="${tr('Next page')}">›</button><div class="task-filters" role="group" aria-label="${tr('Filter tasks')}">${[['all','All'],['active','Active'],['attention','Needs attention'],['finished','Finished']].map(([id,label])=>`<button data-filter="${id}" aria-pressed="${id==='all'}">${tr(label)}</button>`).join('')}</div><span id="task-count" class="muted" role="status"></span></div>
    <p id="task-planning-message" role="status"></p><div id="task-list">${taskCards||'<section class="empty-state">'+tr('No tasks yet. Use New Task or Add Backlog Item.')+'</section>'}</div><p id="no-task-matches" class="empty-state" hidden>${tr('No tasks match this filter.')}</p>
    ${renderBacklog(backlog,options?.projectRoots??[],language)}<section><h2>${tr('Backlog & connections')}</h2><p>${tr('Quota utilization')}: <b>${tr(backlog.enabled?'On':'Off')}</b> · ${tr('{0} runs remaining',backlog.remaining)} · ${backlog.until?tr('until {0}',new Date(backlog.until).toISOString()):tr('No deadline')}</p><ul>${backlog.items.map(i=>`<li>${h(i.prompt.slice(0,160))} <span class="muted">${i.jobId?'→ '+h(i.jobId.slice(0,8)):h(statusLabel('pending',language))}</span></li>`).join('')||'<li>'+tr('No backlog items')+'</li>'}</ul><pre>${h(connectionStatus)}</pre>${button('connections',t('Messaging connections'))}</section>
    <section><details data-detail="remote-chat"><summary>${tr('User ↔ agent chat through Telegram / Zalo')}</summary><pre>${h(options?.remoteTranscript||t('No conversation yet.'))}</pre></details></section></div>
    <div id="page-accounts" data-page="accounts" role="tabpanel" aria-labelledby="tab-accounts" ${page!=='accounts'?'hidden':''}>${renderAccounts(profiles,quotas,options,language,jobs)}</div>
    <div id="page-setup" data-page="setup" role="tabpanel" aria-labelledby="tab-setup" ${page!=='setup'?'hidden':''}>${renderSetupPanel(options,language,profiles)}<section id="setup-controls" class="config-section"><h2>${tr('Controls')}</h2><p class="muted">${tr('Pause stops the process and preserves existing edits. On resume, the agent inspects the unfinished step.')}</p>${(Object.keys(toggles) as (keyof typeof toggles)[]).map(key=>`<label class="check-row"><input type="checkbox" data-setting="${key}" ${options?.[key]?'checked':''}>${tr(toggles[key])}</label>`).join('')}</section></div>
    <div id="page-daily" data-page="daily" role="tabpanel" aria-labelledby="tab-daily" ${page!=='daily'?'hidden':''}>${renderDailyPanel(options?.dailyPlan,profiles,quotas,jobs,language,options?.management,options?.projectRoots,options?.queuePaused)}</div><div id="page-schedules" data-page="schedules" role="tabpanel" aria-labelledby="tab-schedules" ${page!=='schedules'?'hidden':''}>${renderSchedulePanel(options?.schedules??[],jobs,options?.projectRoots??[],language)}</div><div id="page-projects" data-page="projects" role="tabpanel" aria-labelledby="tab-projects" ${page!=='projects'?'hidden':''}>${renderProjectsPanel(options?.projectRoots??[],jobs,profiles,language,options?.isolateTasks,options?.openTasksInCodex)}</div></main>
    <script nonce="${nonce}">
    const vscode=acquireVsCodeApi(),saved=vscode.getState()||${JSON.stringify(options?.initialState??{}).replace(/</g,'\\u003c')};let request=${pageRequest};const pages=['setup','console','tasks','accounts','overview','daily','schedules','projects'];let tab=saved.pageRequest===request&&pages.includes(saved.tab)?saved.tab:${JSON.stringify(page)},drafts=saved.drafts||{},taskFilter=['all','active','attention','finished'].includes(saved.taskFilter)?saved.taskFilter:'all',taskQuery=typeof saved.taskQuery==='string'?saved.taskQuery:'',teamDraft=saved.teamDraft||null,routingDraft=saved.routingDraft||null,workflowDraft=saved.workflowDraft||null,assignmentDraft=saved.assignmentDraft||null,quotaDraft=saved.quotaDraft||null,trialDraft=saved.trialDraft||null,templatesDraft=saved.templatesDraft||null,workflowPreviewValue=null;
    var taskExclude=typeof saved.taskExclude==='string'?saved.taskExclude:'',taskPage=Number(saved.taskPage)||1,taskPageSize=[10,20,50,100].includes(saved.taskPageSize)?saved.taskPageSize:20;
    for(const input of document.querySelectorAll('[data-number-setting]'))if(typeof drafts[input.dataset.numberSetting]==='string')input.value=drafts[input.dataset.numberSetting];
    for(const d of document.querySelectorAll('details[data-detail]')){if(Object.hasOwn(saved.details||{},d.dataset.detail))d.open=saved.details[d.dataset.detail];d.addEventListener('toggle',persist);}
    function persist(){const state={tab,preparationStep,sessionViews,pageRequest:request,scroll:window.scrollY,drafts,taskFilter,taskQuery,accountDraft,...planningState(),...configurationState(),...consoleState(),...directionState(),...branchState(),...maintenanceState(),quotaWatch:quotaWatchChoice,...interactionState(),...scopedState(),...backlogState(),taskExclude,taskPage,taskPageSize,searchFocus:document.activeElement?.id==='task-search',details:Object.fromEntries([...document.querySelectorAll('details[data-detail]')].map(d=>[d.dataset.detail,d.open]))};vscode.setState(state);vscode.postMessage({action:'boardState',state});}
    function showPage(next,focus=false){if(!pages.includes(next))return;tab=next;document.getElementById('task-metrics').hidden=['overview','console','setup'].includes(tab);for(const p of document.querySelectorAll('[data-page]'))p.hidden=p.dataset.page!==tab;for(const b of document.querySelectorAll('[data-tab]')){const active=b.dataset.tab===tab;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;if(active&&focus){b.focus();b.scrollIntoView({block:'nearest',inline:'nearest'});}}if(typeof updateHeaderChrome==='function')updateHeaderChrome();queueWorkbenchLayout();}
    ${planningClient}
    ${consoleClient}
    ${attachmentClient}
    ${accountClient}
    ${accountSessionsClient}
    ${fileChangesClient}
${reviewTeamClient}
${configurationClient}
    ${connectionsClient}
    ${promptTemplateClient}
    ${interactionClient}
    ${dailyMonitorClient}
${maintenanceClient}
    ${voiceClient}
    ${agentCanvasClient}
    ${agentMapClient}
    ${movablePanelClient}
    ${directionClient}
${branchClient}
    ${quotaWatchClient}
    ${composerExperienceClient}
    ${scopedClient}
    ${backlogClient}
    ${mapTeamEditorClient}
${teamControlClient}
${liveTabsClient}
    ${headerChromeClient}
    ${preparationClient}
    ${sessionViewsClient}
    let search=document.getElementById('task-search');search.value=taskQuery;
    function filterTasks(){const groups={active:['running','queued'],attention:['waiting_owner','waiting_quota','needs_attention','failed','interrupted'],finished:['completed','cancelled']},cards=[...document.querySelectorAll('[data-task-status]')],excluded=taskExclude.toLocaleLowerCase().split(',').map(s=>s.trim()).filter(Boolean),matched=cards.filter(card=>{const text=card.dataset.taskSearch.toLocaleLowerCase();return (taskFilter==='all'||groups[taskFilter].includes(card.dataset.taskStatus))&&text.includes(taskQuery.toLocaleLowerCase())&&!excluded.some(t=>text.includes(t));});taskPage=Math.max(1,Math.min(Math.ceil(matched.length/taskPageSize)||1,taskPage));cards.forEach(c=>c.hidden=true);matched.slice((taskPage-1)*taskPageSize,taskPage*taskPageSize).forEach(c=>c.hidden=false);for(const b of document.querySelectorAll('[data-filter]'))b.setAttribute('aria-pressed',String(b.dataset.filter===taskFilter));document.getElementById('task-count').textContent=matched.length+' / '+cards.length;document.getElementById('task-page-label').textContent=taskPage+' / '+(Math.ceil(matched.length/taskPageSize)||1);document.getElementById('task-exclude').value=taskExclude;document.getElementById('task-page-size').value=String(taskPageSize);for(const b of document.querySelectorAll('[data-task-page]'))b.disabled=Number(b.dataset.taskPage)<0?taskPage===1:taskPage*taskPageSize>=matched.length;document.getElementById('no-task-matches').hidden=matched.length>0||cards.length===0;}
    document.addEventListener('input',e=>{if(e.target.id==='task-exclude'){taskExclude=e.target.value;taskPage=1;filterTasks();persist();}});document.addEventListener('change',e=>{if(e.target.id==='task-page-size'){taskPageSize=Number(e.target.value);taskPage=1;filterTasks();persist();}});document.addEventListener('click',e=>{const b=e.target.closest('[data-task-page]');if(b){taskPage+=Number(b.dataset.taskPage);filterTasks();persist();}});
    filterTasks();showPage(tab);window.scrollTo(0,saved.pageRequest===request?saved.scroll||0:0);window.addEventListener('scroll',persist);if(saved.searchFocus&&tab==='tasks')search.focus({preventScroll:true});
    document.addEventListener('input',e=>{if(e.target.id==='task-search'){taskQuery=e.target.value;taskPage=1;filterTasks();persist();}if(e.target.dataset.numberSetting){drafts[e.target.dataset.numberSetting]=e.target.value;persist();}});
    document.addEventListener('click',e=>{const jump=e.target.closest('[data-open-page]');if(jump){if(jump.dataset.taskFilter){taskFilter=jump.dataset.taskFilter;taskQuery='';search.value='';filterTasks();}showPage(jump.dataset.openPage);window.scrollTo(0,0);persist();return;}const filter=e.target.closest('[data-filter]');if(filter){taskFilter=filter.dataset.filter;taskPage=1;filterTasks();persist();return;}const page=e.target.closest('button[data-tab]');if(page){showPage(page.dataset.tab);window.scrollTo(0,0);persist();return;}const b=e.target.closest('button[data-action]');if(!b)return;const action=b.dataset.action;if(['connectCli','profiles','editProfile','account'].includes(action)){openConfiguration('account',{id:b.dataset.id});return;}if(action==='newTask'){setPreparationStep('review');return;}if(action==='flow'||action==='routing'||action==='connections'){openConfiguration(action==='flow'?'team':action);return;}if(action==='quota'){openConfiguration('quota',{id:b.dataset.id});return;}if(action==='switch'){openConfiguration('assignment',{id:b.dataset.id});return;}if(action==='checkCli'){vscode.postMessage({action:'checkCli',profileId:b.dataset.id});return;}if(action==='tryCli'&&!b.dataset.id){openConfiguration('trial');return;}if(b.dataset.action==='reply'&&[...document.querySelectorAll('[data-session-panel]')].some(p=>p.dataset.sessionPanel===b.dataset.id)){showPage('console');consoleHideComposer=false;applyConsoleLayout();selectConsole(b.dataset.id);consoleMode.value='reply';consoleReplyVersion=Number(document.querySelector('[data-session-panel]:not([hidden])')?.dataset.ownerVersion??0);consoleInput.focus();persist();return;}if(b.dataset.action==='saveSettings'){const inputs=[...document.querySelectorAll('[data-number-setting]')],invalid=inputs.find(i=>!i.checkValidity());if(invalid){invalid.reportValidity();return;}vscode.postMessage({action:'saveSettings',settings:Object.fromEntries(inputs.map(i=>[i.dataset.numberSetting,Number(i.value)]))});return;}vscode.postMessage({action:b.dataset.action,id:b.dataset.id});});
    document.addEventListener('keydown',e=>{if(e.defaultPrevented||e.repeat||e.keyCode===229||e.key!=='Enter'||e.isComposing||e.shiftKey||e.altKey||!(e.ctrlKey||e.metaKey))return;const form=e.target.closest('form');if(form&&form.getAttribute('id')!=='console-form'){e.preventDefault();form.requestSubmit();}});
    document.querySelector('.tabs').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const index=pages.indexOf(tab),next=e.key==='Home'?0:e.key==='End'?pages.length-1:(index+(e.key==='ArrowRight'?1:-1)+pages.length)%pages.length;showPage(pages[next],true);persist();});
    document.addEventListener('change',e=>{const target=e.target;if(target.dataset.setting)vscode.postMessage({action:'toggle',key:target.dataset.setting,value:target.checked});if(target.dataset.dailyAccount)vscode.postMessage({action:'dailyAccount',id:target.dataset.dailyAccount,value:target.checked});if(target.dataset.dailyOption)vscode.postMessage({action:'dailyOption',key:target.dataset.dailyOption,value:target.checked});if(target.hasAttribute('data-language'))vscode.postMessage({action:'setLanguage',value:target.value});});
    window.addEventListener('message',e=>{if(e.data.type==='boardSnapshot'){
      const active=document.activeElement,activeForm=active?.closest('form'),focus=active?.id,focusName=active?.name,focusForm=activeForm?.getAttribute('id'),focusCriteria=activeForm?.dataset.acceptanceForm,focusButton=active?.tagName==='BUTTON'?[...activeForm?.querySelectorAll('button')||[]].indexOf(active):-1,selection=typeof active?.selectionStart==='number'?[active.selectionStart,active.selectionEnd]:undefined,parsed=new DOMParser().parseFromString(e.data.html,'text/html'),scroll=window.scrollY,details=Object.fromEntries([...document.querySelectorAll('details[data-detail]')].map(d=>[d.dataset.detail,d.open]));
      let setupReplaced=false;for(const id of pages){if(id==='console'||id==='accounts'&&(accountDraft||document.activeElement?.matches('#multiple-accounts-form input,#multiple-accounts-form textarea,#multiple-accounts-form select')||document.querySelector('#multiple-accounts-form [name=emails]')?.value?.trim())||id==='setup'&&(Object.keys(drafts).length||teamDraft||routingDraft||workflowDraft||templatesDraft||document.getElementById('page-setup').contains(document.activeElement)))continue;const incoming=parsed.getElementById('page-'+id);if(incoming){document.getElementById('page-'+id).innerHTML=incoming.innerHTML;if(id==='setup')setupReplaced=true;}}
      const incomingConfig=parsed.getElementById('configuration-data');if(incomingConfig)document.getElementById('configuration-data').dataset.value=incomingConfig.dataset.value;const metrics=parsed.getElementById('task-metrics');if(metrics)document.getElementById('task-metrics').innerHTML=metrics.innerHTML;const toolbar=parsed.querySelector('.toolbar');if(toolbar)document.querySelector('.toolbar').innerHTML=toolbar.innerHTML;
      for(const d of document.querySelectorAll('details[data-detail]')){if(Object.hasOwn(details,d.dataset.detail))d.open=details[d.dataset.detail];d.addEventListener('toggle',persist);}
      search=document.getElementById('task-search');search.value=taskQuery;filterTasks();refreshConfigurationChoices(parsed);layoutTeam();restoreConfigurationMessages();if(setupReplaced){layoutConnection(true);refreshTemplatePanel();}applyPreparation();restorePlanning();restoreBacklog();applyScopedFilters();const cwd=parsed.getElementById('console-cwd');if(cwd&&[...cwd.options].some(o=>o.value===consoleCwd.value)){const value=consoleCwd.value;consoleCwd.innerHTML=cwd.innerHTML;consoleCwd.value=value;}patchConsole(e.data.html);if(e.data.pageRequest!==request){request=e.data.pageRequest;showPage(e.data.page);window.scrollTo(0,0);}else window.scrollTo(0,scroll);
      if(focus!=='console-input'){const form=focusForm?document.getElementById(focusForm):focusCriteria?[...document.querySelectorAll('[data-acceptance-form]')].find(f=>f.dataset.acceptanceForm===focusCriteria):null,input=focus?document.getElementById(focus):focusName?form?.elements.namedItem(focusName):focusButton>=0?form?.querySelectorAll('button')[focusButton]:null;if(input?.focus){input.focus({preventScroll:true});if(selection&&input.setSelectionRange)try{input.setSelectionRange(...selection);}catch{}}}
      persist();return;
    }if(e.data.type==='settingsSaved'){if(e.data.ok!==false)drafts={};persist();document.getElementById('settings-status').textContent=e.data.message;}});
    vscode.postMessage({action:'consoleReady'});
    </script></body></html>`;
}
