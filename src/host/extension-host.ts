import {safeBoardState} from '../core/board-state';
import { budgetModel,validateDailyBudget } from '../core/daily-budget';
import { normalizeLayout } from '../core/layout';
import { scheduleFromForm } from '../core/schedule-form';
import { acceptanceFromText } from '../core/task-insights';
import { inspectCli,installPlan,loginArguments,quotedCommand,type CliStatus } from '../adapters/cli/setup';
import { profileModelLabel } from '../core/i18n';
import { prepareProfile } from '../adapters/runtime';
import { listModels } from '../adapters/http/compatible';
import { snapshotPromptTemplates, validatePromptTemplates, templateRoles, type PromptTemplates } from '../core/prompt-templates';
import * as vscode from 'vscode';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { auditInstructions, leadInstructions, answerOwner, assignCoordinatorProfile, assignTaskProfile, claimSchedule, fresh, fullFlow, nextCron, QuotaWait, rotateProfile, routeProfile, validateFlow, validateManagement, validateProfiles } from '../core/domain';
import type { Backlog, Job, Management, Profile, Quota, Role, RoleOverrides, Schedule } from '../core/domain';
import { Engine, newJob, stepPrompt } from '../core/engine';
import { execute } from '../adapters/runtime';
import { MessagingHub } from '../adapters/messaging/messaging-hub';
import { chatCommand } from '../adapters/messaging/messaging';
import { renderBoard } from '../ui/board';
import { backlogDecision } from '../core/utilization';
import { JsonStore } from '../storage/json-store';
import { listBackups, snapshotWorkspace } from '../storage/backup';
import { QuotaService, quotaSummary, usageStatus } from '../adapters/quota/quota-service';
import { resolveLanguage, roleLabel, statusLabel, translator, type Translator } from '../core/i18n';
import { dailyCanRun, dailyProfile, emptyDailyPlan, syncDecisions, type DailyPlan } from '../core/daily-plan';
import { ConsoleController } from './console-controller';
import { renderLiveConsole } from '../ui/live-console';
import { DailyController } from './daily-controller';
import { numericSettings, validateSettingsPatch } from '../core/settings';
import { codexProjectLink, projectSummaries } from '../core/projects';
import { prepareWorktree } from '../storage/worktrees';
import { AttachmentStore, attachmentLimits } from '../storage/attachments';
import { cliVersion, findLocalCli } from '../adapters/cli/local-cli';
import { importWorkflow, type WorkflowDocument } from '../core/workflow';
import { accountFromForm } from '../core/account';
import { flowConfiguration, manualQuota, routingConfiguration } from '../core/configuration';

interface State { formReceipts?:string[]; version: 1; roles: Record<Role, string>; jobs: Job[]; schedules: Schedule[]; quotas: Record<string, Quota>; backlog?: Backlog; rotationCursor?: Partial<Record<Role, number>>; quotaAlerted?: Record<string, boolean>; flow?: Role[]; overrides?: RoleOverrides; queuePaused?: boolean; management?: Management; dailyPlan?: DailyPlan; workflow?:WorkflowDocument; promptTemplates?:PromptTemplates }
const roles: Role[] = ['builder', 'auditor', 'worker', 'lead'];
let shutdown: (() => Promise<void>) | undefined;
const initial = (): State => ({ version: 1, roles: { builder: 'codex-main', auditor: 'claude-main', worker: 'gemini-main', lead: 'codex-main' }, jobs: [], schedules: [], quotas: {} });
type Node = vscode.TreeItem & { children?: Node[] };
function node(label: string, description?: string, command?: string, arg?: unknown, children?: Node[]): Node {
  const item: Node = new vscode.TreeItem(label, children ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None);
  item.description = description;
  item.children = children;
  if (command) item.command = { command, title: label, arguments: arg === undefined ? [] : [arg] };
  return item;
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const language = () => resolveLanguage(vscode.workspace.getConfiguration('aiTeam').get('language', 'auto'), vscode.env.language);
  const t: Translator = (message, ...values) => translator(language())(message, ...values);
  const roleName = (role: string) => roleLabel(role, language());
  const stateName = (status: string) => statusLabel(status, language());
  if (!vscode.workspace.isTrusted || !context.storageUri) return;
  const roots = vscode.workspace.workspaceFolders;
  if (!roots?.length) return;
  const storage = context.storageUri.fsPath;
  const attachmentStore=new AttachmentStore(join(storage,'attachments'));
  await mkdir(storage, { recursive: true });
  const lockPath = join(storage, 'runner.lock');
  const lock = async () => {
    try { const f = await open(lockPath, 'wx'); await f.writeFile(String(process.pid)); await f.close(); return true; }
    catch (e: any) {
      if (e.code !== 'EEXIST') throw e;
      const pid = Number(await readFile(lockPath, 'utf8'));
      if (!Number.isInteger(pid) || pid <= 0) return false;
      try { process.kill(pid, 0); return false; }
      catch (probe: any) { if (probe.code !== 'ESRCH') return false; }
      await unlink(lockPath);
      try { const f = await open(lockPath, 'wx'); await f.writeFile(String(process.pid)); await f.close(); return true; }
      catch { return false; }
    }
  };
  if (!await lock()) {
    void vscode.window.showWarningMessage('RelayCrew: ' + t('This workspace already has a runner in another window.'));
    return;
  }
  let released = false;
  const release = async () => {
    if (released) return;
    released = true;
    try { if (await readFile(lockPath, 'utf8') === String(process.pid)) await unlink(lockPath); } catch { /* closed */ }
  };
  // Keep the lock until process exit on deactivation if a child is still stopping.
  // A subsequent host can recover the stale PID lock.
  let state = initial();
  let stateRecovered=false;
  const statePath = join(storage, 'state.json');
  const stateStore = new JsonStore<State>(statePath,(v:any):v is State=>!!v&&v.version===1&&Array.isArray(v.jobs)&&Array.isArray(v.schedules)&&!!v.roles&&!!v.quotas,path=>{stateRecovered=true;void vscode.window.showWarningMessage('RelayCrew: ' + t('State recovered from backup {0}. Queue paused; inspect the board before resuming.', path));});
  try {
    state = await stateStore.load(initial());
  } catch (e: any) {
    if (e.code !== 'ENOENT') { await release(); throw e; }
  }
  for (const j of state.jobs) if (j.status === 'running' || stateRecovered && j.status==='queued') {
    j.status = 'interrupted'; j.error = 'Extension host stopped. Inspect repository changes before starting a new task.';
    for (const s of j.steps) if (s.status === 'running') s.status = 'failed';
  }
  const backlog = state.backlog ??= { items: [], enabled: false, remaining: 0, until: 0 };
  const daily = state.dailyPlan ??= emptyDailyPlan();
  if (backlog.until <= Date.now() || backlog.remaining <= 0) backlog.enabled = false;
  state.rotationCursor ??= {}; state.quotaAlerted ??= {};
  state.flow = validateFlow(state.flow ?? fullFlow); state.overrides ??= {};
  state.management ??= { primaryProfileId: state.roles.lead, coordinatorIds: [] };
  state.roles.lead = state.management.primaryProfileId;
  state.queuePaused ??= false;
  if(stateRecovered){state.queuePaused=true;backlog.enabled=false;daily.enabled=false;}
  let writeQueue = Promise.resolve();
  const save = () => {
    syncDecisions(daily,state.jobs);
    writeQueue = stateStore.save(state);
    return writeQueue;
  };
  const output = vscode.window.createOutputChannel('RelayCrew');
  const events = new vscode.EventEmitter<Node | undefined>();
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 90);
  status.command = 'aiTeam.board';
  const usage=vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left,89);usage.command='aiTeam.accountMenu';
  const quotas=new QuotaService();
  let quotaReadAt=0;
  const cfg = () => vscode.workspace.getConfiguration('aiTeam');
  const profiles = () => validateProfiles(cfg().get('profiles'));
  const dailyRoots=()=>[...new Set([...projectRoots().map(r=>r.path),...(daily.workspaces??[]).map(w=>w.path)])];
  const projectRoots = () => (vscode.workspace.workspaceFolders ?? []).map(root => ({name:root.name,path:root.uri.fsPath}));
  const createJob = (...args: Parameters<typeof newJob>) => {
    const job=newJob(...args);job.isolationMode=cfg().get('isolateTasks',false)?'worktree':'shared';job.openInCodex=cfg().get('openTasksInCodex',false);job.promptTemplates=snapshotPromptTemplates(state.promptTemplates);if(state.workflow)job.workflow=structuredClone(state.workflow);return job;
  };
  const eventKey = (j: Job) => `${j.id}:${j.status}:${j.ownerReplies?.length ?? 0}:${j.limitDetectedAt ?? ''}`;
  const announced = new Set(state.jobs.filter(j => !['running', 'queued'].includes(j.status)).map(eventKey));
  let messaging: MessagingHub | undefined;
  let board: vscode.WebviewPanel | undefined;
  let boardState=safeBoardState(context.workspaceState.get<Record<string,unknown>>('boardState',{})),boardStateTimer:ReturnType<typeof setTimeout>|undefined;
  const saveBoardState=()=>context.workspaceState.update('boardState',boardState);
  let boardLanguage: string | undefined;
  const cliStatuses:Record<string,CliStatus>={};
  let pendingWorkflow:{type:'workflowLoaded';name:string;markdown:string}|undefined;
  const pendingForms=new Set<string>();let pendingReply:string|undefined;let boardReady=false,pendingCompose: {cwd?:string;mode?:'chat'|'task';profileId?:string}|undefined,pendingConfiguration:{type:'configurationOpen';kind:string;id?:string;profileId?:string}|undefined;
  const consoleOptions = () => ({queuePaused:!!state.queuePaused,allowEdits:cfg().get('allowEdits',false),projectRoots:projectRoots(),flow:state.flow,initialState:boardState} as Parameters<typeof renderLiveConsole>[2]);
  const refreshConsole = () => {if(board)void board.webview.postMessage({type:'consoleSnapshot',html:renderLiveConsole(state.jobs,profiles(),consoleOptions(),language())});};
  let requestedPage = 'console', pageRequest = 0, applyingSettings = false;
  const reportText = (job: Job) => `# RelayCrew · ${job.id}\n\n${t('Status')}: ${stateName(job.status)}\n\n${t('Workspace')}: ${job.cwd}\n\n${t('Owner task')}:\n\n${job.prompt}\n\n${job.error ? t(job.error) : ''}\n\n`
    + (job.acceptance?.length?`## Definition of Done (owner verification)\n\n${job.acceptance.map(c=>`- [${c.checked?'x':' '}] ${c.text}`).join('\n')}\n\n`:'')
    + (job.attachments?.length?`## ${t('Attachments')}\n\n${job.attachments.map(a=>`${a.name} · ${a.mime} · ${a.bytes} bytes · SHA-256 ${a.sha256} · ${a.id}`).join('\n\n')}\n\n`:'')
    + (job.promptTemplates?`## ${t('Input and response templates')} · SHA-256 ${job.promptTemplates.sha256}\n\n${JSON.stringify(job.promptTemplates,null,2)}\n\n`:'')
    + (job.workflow?`## ${t('Workflow guide')} · ${job.workflow.name}\n\nSHA-256 ${job.workflow.sha256}\n\n${job.workflow.markdown}\n\n`:'')
    + (job.ownerQuestion ? `## ${t('Question for owner')}\n\n${job.ownerQuestion}\n\n` : '')
    + (job.ownerReplies?.length ? `## ${t('Owner replies')}\n\n${job.ownerReplies.join('\n\n')}\n\n` : '')
    + job.steps.map(s => `## ${s.title} · ${s.coordinatorProfileId?t('Coordinator'):roleName(s.role)}\n\n${t('Profile')}: ${s.profileId ?? s.coordinatorProfileId ?? job.roles[s.role]} · ${t('Model')}: ${s.model ?? t('CLI default')} / ${s.effort ?? t('default')} · ${stateName(s.status)}\n\n${t('Backup')}: ${s.backupPath ?? t('not applicable')}\n\n${s.error ? t(s.error) : ''}\n\n### ${t('Input')}\n\n${s.request ?? s.prompt}\n\n### ${t('Response')}\n\n${s.response ?? t('No response yet')}\n`).join('\n')
    + (job.audit ? '\n## ' + t('Issue drafts') + '\n\n' + job.audit.issues.map(i => `### ${i.severity}: ${i.title}\n\n${i.body}\n`).join('\n') : '');
  const persistReports = async () => {
    await mkdir(join(storage, 'reports'), { recursive: true });
    for (const job of state.jobs) await writeFile(join(storage, 'reports', `${job.id}.md`), reportText(job), 'utf8');
  };
  const quotaLabel = (id: string) => quotaSummary(state.quotas[id], Date.now(), language());
  const changed = (refreshBoard = true) => {
    events.fire(undefined);
    try {
      const active = state.jobs.find(j => j.status === 'running');
      status.text = `$(hubot) RelayCrew · ${state.queuePaused ? stateName('paused') : active ? roleName(active.steps.find(s => s.status === 'running')?.role ?? 'running') : stateName('idle')}`;
      status.tooltip = t("Open assignment board · pause, observe or control tasks.");
      const summary=usageStatus(profiles(),state.jobs,state.quotas,cfg().get('quotaThreshold',95),Date.now(),language());
      usage.text=summary.text;usage.tooltip=summary.tooltip;usage.backgroundColor=summary.warning?new vscode.ThemeColor('statusBarItem.warningBackground'):undefined;usage.show();
    } catch { status.text = '$(warning) RelayCrew: ' + t('Fix profiles');usage.hide(); }
    status.show();
    if (board && refreshBoard) { try { board.title = 'RelayCrew · ' + t('Assignment board'); const html = renderBoard(state.jobs, profiles(), state.quotas, backlog, messaging?.summary(language()) ?? t('No channels connected'), {
      queuePaused: state.queuePaused ?? false, autoSwitch: cfg().get('autoSwitch', false), resumeAfterQuota: cfg().get('resumeAfterQuota', false), resumeProviderLimited: cfg().get('resumeProviderLimited', false), allowEdits: cfg().get('allowEdits', false), routingMode: cfg().get('routingMode', 'selected'), timeoutMinutes: cfg().get('timeoutMinutes', 30), remoteTranscript: messaging?.chatTranscript(language()), language: language(),
      languagePreference: cfg().get('language','auto'), management: state.management, roles:state.roles, flow: state.flow, dailyPlan: daily, backupBeforeEdits: cfg().get('backupBeforeEdits',true),workflow:state.workflow,initialState:boardState,overrides:state.overrides,rotationPools:cfg().get('rotationPools',{}),connections:messaging?.connections(),cliStatuses,promptTemplates:state.promptTemplates,schedules:state.schedules,
      settings: Object.fromEntries(Object.entries(numericSettings).map(([key,rule])=>[key,cfg().get(key,rule.default)])), requestedPage, pageRequest, projectRoots:projectRoots(),isolateTasks:cfg().get('isolateTasks',false),openTasksInCodex:cfg().get('openTasksInCodex',false)
    });if(boardLanguage!==language()){boardLanguage=language();boardReady=false;board.webview.html=html;}else void board.webview.postMessage({type:'boardSnapshot',html,page:requestedPage,pageRequest}); } catch { /* configuration editor may be temporarily invalid */ } }
    for (const [id, q] of Object.entries(state.quotas)) if (fresh(q)) {
      const exhausted = q.usedPercent >= cfg().get('quotaThreshold', 95);
      if (exhausted && !state.quotaAlerted![id]) {
        state.quotaAlerted![id] = true;
        const text = t('Quota alert · {0}: {1}% used. Reset: {2}. Source: {3}.', id, q.usedPercent, q.resetsAt ?? t('unknown'), q.source);
        void vscode.window.showWarningMessage(`RelayCrew: ${text}`);
        void messaging?.broadcast(`quota:${id}:${q.observedAt}`, text).catch(() => output.appendLine('Could not queue quota notification.'));
        void save().catch(() => output.appendLine('Could not save quota alert state.'));
      } else if (!exhausted) state.quotaAlerted![id] = false;
    }
    for (const j of state.jobs) if (!['queued', 'running'].includes(j.status) && !announced.has(eventKey(j))) {
      announced.add(eventKey(j));
      const message = `RelayCrew: ${stateName(j.status)} · ${j.prompt.slice(0, 70)}`;
      const notification = ['completed', 'cancelled'].includes(j.status) ? vscode.window.showInformationMessage : vscode.window.showWarningMessage;
      void notification(message, t("Report")).then(choice => { if (choice) void vscode.commands.executeCommand('aiTeam.report', j.id); });
      const remoteText = `RelayCrew · ${t('Task')} ${j.id}\n${t('Status')}: ${stateName(j.status)}`
        + (j.ownerQuestion ? `\n${j.ownerQuestion}\n/reply ${j.id.slice(0, 8)} ${t('your answer')}` : '')
        + (j.status === 'waiting_quota' ? `\n${j.error ? t(j.error) : ''}\n${t('Auto-resume')}: ${t(cfg().get('resumeAfterQuota', false) ? 'On; requires fresh available quota' : 'Off')}` : '')
        + (j.status === 'completed' || j.status === 'needs_attention' ? `\n${t('Lead')}: ${j.steps.find(s => s.role === 'lead' && !s.coordinatorProfileId)?.response?.slice(0, 1500) ?? t('See local board.')}` : '');
      void messaging?.broadcast(eventKey(j), remoteText).catch(() => output.appendLine('Could not queue task notification.'));
    }
  };
  const choose = (role: Role, preferred: string, advance = true, overrides: RoleOverrides = state.overrides ?? {}): Profile => {
    const override = overrides[role];
    const candidates = profiles().map(p => ({ ...p, ...(override?.model ? { model: override.model,modelPolicy:'custom' as const } : {}), ...(override?.effort ? { effort: override.effort } : {}) }));
    if (cfg().get<string>('routingMode', 'selected') !== 'roundRobin') return routeProfile(preferred, candidates, state.quotas, cfg().get('autoSwitch', false), cfg().get('quotaThreshold', 95));
    const pools = cfg().get<Record<string, string[]>>('rotationPools', {});
    const result = rotateProfile(pools[role] ?? [], candidates, state.quotas, state.rotationCursor![role] ?? 0, cfg().get('quotaThreshold', 95));
    if (advance) state.rotationCursor![role] = result.cursor;
    return result.profile;
  };
  const engine = new Engine(state.jobs, {
    profiles, quotas: () => state.quotas,
    prepareJob:async(job,signal)=>{
      await prepareWorktree(job,join(storage,'worktrees'),signal);
      if(signal.aborted)return;
      if(job.openInCodex&&!job.codexLinkAttemptedAt){
        job.codexLinkAttemptedAt=new Date().toISOString();await save();
        try{if(!await vscode.env.openExternal(vscode.Uri.parse(codexProjectLink(job.cwd))))throw new Error(t('Codex could not be opened. Install the desktop app and try again.'));}
        catch(error){job.codexLinkError=String(error);output.appendLine(job.codexLinkError);}
      }
      changed();
    },
    settings: () => ({ autoSwitch: cfg().get('autoSwitch', false), threshold: cfg().get('quotaThreshold', 95), maxTasks: cfg().get('maxChildTasks', 4), edits: cfg().get('allowEdits', false) }),
    changed, canRun: job => !state.queuePaused && (!job || dailyCanRun(daily,job)), chooseProfile: (job, step) => {
      const pin=step.coordinatorProfileId??job.profilePins?.[step.role];
      if(job.dailyItemId)return dailyProfile(daily,pin??job.roles[step.role],profiles(),state.quotas,state.jobs);
      if(pin){const p=routeProfile(pin,profiles(),state.quotas,false,cfg().get('quotaThreshold',95));const override=step.coordinatorProfileId?undefined:job.overrides?.[step.role];return {...p,...(override?.model?{model:override.model,modelPolicy:'custom' as const}:{}),...(override?.effort?{effort:override.effort}:{})};}
      return choose(step.role, job.roles[step.role], true, job.overrides ?? {});
    }, save: async () => { await save(); await persistReports(); },
    run: async (profile, step, job, edits, signal) => {
      if(job.dailyItemId){step.dailyBudgetModel=budgetModel(profile);(step.dailyAttempts??=[]).push({profileId:profile.id,modelKey:step.dailyBudgetModel,at:new Date().toISOString()});}
      edits = edits && (!job.dailyItemId || daily.allowEdits);
      if(profile.transport==='http'&&edits)throw new Error('The HTTP adapter is read-only. Use a CLI profile for file edits and repository tools.');
      if (edits && cfg().get('backupBeforeEdits', true)) {
        step.phase='backing_up';step.timeoutAt=undefined;changed();
        step.backupPath = await snapshotWorkspace(job.cwd,join(storage,'source-backups'),job.id,step.role,{
          maxBytes: cfg().get('backupMaxMB',100)*1024*1024, totalBytes:cfg().get('backupStorageMB',2048)*1024*1024, extraPaths:cfg().get<string[]>('backupExtraPaths',[])
        });
        await save();
        if (signal.aborted) throw new Error('Paused/cancelled before CLI start. Source backup preserved.');
      }
      const secrets: Record<string, string> = {};
      for (const key of profile.secretEnv ?? []) {
        const value = await context.secrets.get(`aiTeam:${profile.id}:${key}`);
        if (!value) throw new Error(`Missing secret ${key} for ${profile.label}. Use Store Profile Secret.`);
        secrets[key] = value;
      }
      if(job.dailyItemId)step.dailyBudgetModel=budgetModel(profile);
      const selection=await prepareProfile(profile,secrets,signal);profile=selection.profile;step.model=profile.model;step.modelSource=selection.source;step.effort=profile.effort;
      (job.timeline??=[]).push({at:new Date().toISOString(),from:'orchestrator',to:profile.id,kind:'model_selection',text:`${profile.model??t('CLI default')} · ${t(selection.note)}`});await save();
      output.appendLine(`[${job.id}] ${step.role} → ${profile.id}, model=${profile.model || t("CLI default")}, effort=${profile.effort || t("default")}, edits=${edits}`);
      step.phase='cli';step.timeoutAt=new Date(Date.now()+cfg().get('timeoutMinutes',30)*60_000).toISOString();changed();
      let lastRefresh = 0;
      if(job.dailyItemId){await quotas.refresh([profile],state.quotas);step.quotaBefore=state.quotas[profile.id]?structuredClone(state.quotas[profile.id]):undefined;await save();}
      try{const result = await execute({ permission:job.permission,profile, prompt: step.request ?? stepPrompt(job, step), cwd: job.cwd, edits, signal, secretValues: secrets,attachments:await attachmentStore.resolve(job.attachments?.map(a=>a.id)),
        timeoutMs: cfg().get('timeoutMinutes', 30) * 60_000,
        onEvent: event => {
          const timeline = job.timeline ??= [];
          const last = timeline.at(-1);
          if (event.kind === 'assistant' && last?.kind === 'stream' && last.from === `${step.role}:${profile.id}` && last.text.length < 6000) last.text += event.text;
          else timeline.push({ at: new Date().toISOString(), from: `${step.role}:${profile.id}`, to: 'orchestrator / observer', kind: event.kind === 'assistant' ? 'stream' : event.kind, text: event.text });
          if (timeline.length > 300) timeline.splice(0, timeline.length - 300);
          if (Date.now() - lastRefresh > 750) { lastRefresh = Date.now(); refreshConsole(); }
        },
        log: text => { output.append(text); void appendRunLog(job.id, text); }
      });
      return result;}finally{if(job.dailyItemId){await quotas.refresh([profile],state.quotas);step.quotaAfter=state.quotas[profile.id]?structuredClone(state.quotas[profile.id]):undefined;}}
    }
  });
  let logQueue = Promise.resolve();
  const appendRunLog = (id: string, text: string) => {
    logQueue = logQueue.catch(() => {}).then(async () => {
      const file = join(storage, `${id}.log`);
      const handle = await open(file, 'a');
      try { await handle.writeFile(text, 'utf8'); } finally { await handle.close(); }
    });
    return logQueue;
  };
  const guard = async (action: () => unknown | Promise<unknown>) => {
    try { return await action(); } catch (e) { void vscode.window.showErrorMessage(`RelayCrew: ${t(e instanceof Error ? e.message : String(e))}`); }
  };
  const command = (id: string, handler: (...args: any[]) => unknown) => context.subscriptions.push(vscode.commands.registerCommand(id, (...args) => guard(async()=>{try{return await handler(...args);}catch(error){if(['aiTeam.installCli','aiTeam.loginCli','aiTeam.checkConnection'].includes(id)&&typeof args[0]==='string'){await board?.webview.postMessage({type:'cliSetupStatus',profileId:args[0],message:t(error instanceof Error?error.message:String(error))});return;}throw error;}})));
  command('aiTeam.language',()=>vscode.commands.executeCommand('aiTeam.board','setup'));
  const provider: vscode.TreeDataProvider<Node> = {
    onDidChangeTreeData: events.event,
    getTreeItem: item => item,
    getChildren: parent => {
      if (parent) return parent.children ?? [];
      let accountNodes: Node[];
      try { accountNodes = profiles().map(p => {
        const q = state.quotas[p.id];
        const item = node(p.label, `${profileModelLabel(p,language())} · ${quotaLabel(p.id)}`, 'aiTeam.quota', p.id);
        item.command = { command: 'aiTeam.accountDetails', title: t("Account details"), arguments: [p.id] };
        item.tooltip = `${p.id}\n${t('Executable')}: ${p.executable}\n${t('Assigned roles')}: ${roles.filter(r => state.roles[r] === p.id).map(roleName).join(', ') || t('none')}\n${t('Observed')}: ${q?.observedAt ?? t('unknown')}\n${t('Reset')}: ${q?.resetsAt ?? t('unknown')}`;
        return item;
      }); } catch (e) { accountNodes = [node(String(e), '', 'aiTeam.profiles')]; }
      const group = (label:string,id:string,children:Node[],expanded=false) => {const item=node(label,undefined,undefined,undefined,children);item.id=id;item.collapsibleState=expanded?vscode.TreeItemCollapsibleState.Expanded:vscode.TreeItemCollapsibleState.Collapsed;return item;};
      return [
        node(t('New task'),state.flow?.map(roleName).join(' → '),'aiTeam.newTask'),
        node(t('Assignment board / summary'),undefined,'aiTeam.board'),
        node(t(state.queuePaused?'Resume queue':'Pause immediately'),undefined,'aiTeam.pauseQueue'),
        node(t('Daily quota tasklist'),t(daily.enabled?'On':'Off'),'aiTeam.dailyPlan'),
        node(t('Projects'),undefined,'aiTeam.projects'),
        group(t('Tasks'),'tasks',state.jobs.slice().reverse().map(j=>node(j.prompt.slice(0,80),stateName(j.status),undefined,undefined,[
          node(t('Open report'),j.id.slice(0,8),'aiTeam.report',j.id),
          ...j.steps.map(s=>node(`${s.coordinatorProfileId?t('Coordinator'):roleName(s.role)}: ${s.role==='worker'?s.title:t(s.title)}`,`${stateName(s.status)} · ${s.profileId??s.coordinatorProfileId??j.roles[s.role]}`,'aiTeam.report',j.id)),
          ...(j.ownerQuestion?[node(j.ownerQuestion.slice(0,100),t('Waiting for your reply'),'aiTeam.reply',j.id)]:[])
        ])),true),
        group(t('Accounts & quota'),'accounts',accountNodes),
        group(t('Schedules'),'schedules',[node(t('Schedule / remind me'),undefined,'aiTeam.schedule'),...state.schedules.map(s=>node(s.title,`${s.enabled?s.nextAt:stateName('paused')} · ${s.timezone}`,'aiTeam.pauseSchedule',s.id))]),
        group(t('Backlog / quota utilization'),'backlog',[node(t('Add backlog item'),undefined,'aiTeam.backlog'),node(t('Use available quota'),backlog.enabled?t('{0} runs remaining',backlog.remaining):t('Off'),'aiTeam.utilization')]),
        group(t('Setup'),'setup',[
          node(t('Quick setup'),undefined,'aiTeam.setup'),node(t('Configure profiles'),undefined,'aiTeam.profiles'),
          node(t('Team flow · setup roles'),undefined,'aiTeam.flow'),node(t('Routing'),undefined,'aiTeam.routing'),
          node(t('Messaging connections'),undefined,'aiTeam.connections'),node(t('Language'),language()==='vi'?'Tiếng Việt':'English','aiTeam.language'),
          node(t('Backups / saved data'),undefined,'aiTeam.backups'),node(t('Keyboard shortcuts'),undefined,'aiTeam.shortcuts'),node(t('All VS Code settings'),undefined,'aiTeam.settings')
        ])
      ];
    }
  };
  context.subscriptions.push(output, events, status, usage, vscode.window.registerTreeDataProvider('aiTeam.dashboard', provider));
  const pickCwd = async () => vscode.workspace.workspaceFolders?.length === 1 ? vscode.workspace.workspaceFolders[0].uri.fsPath : (await vscode.window.showWorkspaceFolderPick())?.uri.fsPath;
  const validateRoles = () => {
    const ids = new Set(profiles().map(p => p.id));
    for (const r of state.flow ?? fullFlow) if (!ids.has(state.roles[r])) throw new Error(`Assign a profile for ${r}.`);
    validateManagement(state.management, profiles());
  };
  let draining: Promise<unknown> | undefined;
  let closing = false;
  const start = () => {
    if (draining || closing) return;
    draining = guard(() => engine.drain()).finally(() => { draining = undefined; });
  };
  const dailyController = new DailyController({promptTemplates:()=>snapshotPromptTemplates(state.promptTemplates),workflow:()=>state.workflow,plan:daily,jobs:state.jobs,profiles,quotas:()=>state.quotas,management:()=>state.management!,isolation:()=>cfg().get('isolateTasks',false),openInCodex:()=>cfg().get('openTasksInCodex',false),language,timezone:()=>cfg().get('timezone',''),paused:()=>!!state.queuePaused,save,changed,cwd:pickCwd,start,pauseActive:id=>{
    const active=state.jobs.find(job=>job.status==='running'&&job.dailyItemId);
    if(active&&(!id||active.steps.some(step=>step.status==='running'&&step.profileId===id)||daily.items.some(item=>item.jobId===active.id&&item.profileId===id)))engine.pause();
  }});
  const consoleController=new ConsoleController({prepare:async(mode,profileId)=>{const ids=mode==='chat'?[profileId]:[...(state.flow??fullFlow).map(role=>state.roles[role]),...(state.management?.coordinatorIds??[])];for(const id of new Set(ids)){const profile=profiles().find(p=>p.id===id);if(!profile)throw new Error('Choose an existing account profile.');if(profile.transport==='http'){if(mode==='task'&&cfg().get('allowEdits',false)&&(state.roles.builder===id||(state.flow??fullFlow).includes('worker')&&state.roles.worker===id))throw new Error('The HTTP adapter is read-only. Use a CLI profile for file edits and repository tools.');continue;}if(!await findLocalCli(profile.provider,profile.executable))throw new Error(t('CLI missing for {0}. Open Accounts to install or sign in.',profile.label));}},createChat:(prompt,cwd,id,parent)=>{const profile=profiles().find(p=>p.id===id);if(!profile)throw new Error('Choose an existing account profile.');const assignments=Object.fromEntries(roles.map(role=>[role,id])) as Record<Role,string>,job=newJob(prompt,cwd,assignments,['builder','auditor','lead']);job.kind='chat';job.readOnly=true;job.isolationMode='shared';job.profilePins={builder:id};job.steps[0].title='Chat reply';if(parent)job.chatHistory=[...(parent.chatHistory??[]),{role:'user',text:parent.prompt},{role:'assistant',text:parent.steps.at(-1)?.response??''}].slice(-12).map(item=>({...item,text:item.text.slice(0,4000)})) as Job['chatHistory'];return job;},jobs:state.jobs,roots:()=>projectRoots().map(root=>root.path),create:(prompt,cwd)=>{validateRoles();return createJob(prompt,cwd,state.roles,state.flow,state.overrides,state.management);},paused:()=>!!state.queuePaused,pause:paused=>{state.queuePaused=paused;if(paused)engine.pause();},cancel:id=>engine.cancel(id),save,changed,start,attachments:ids=>attachmentStore.metadata(ids)});
  const runTrial=async(profile:Profile,selectedCwd?:string)=>{
    const cwd=selectedCwd??(projectRoots().length===1?projectRoots()[0].path:undefined);if(!cwd||!projectRoots().some(root=>root.path===cwd))throw new Error('Select an open workspace folder.');
    const assignments=Object.fromEntries(roles.map(role=>[role,profile.id])) as Record<Role,string>;
    const job=newJob('Connection trial: read only package.json in the workspace root. Report the project name and version in one short sentence. If it is missing, say so. Do not edit files, scan the repository, run tests, publish, or spawn agents.',cwd,assignments,['builder','auditor','lead'],{},{primaryProfileId:profile.id,coordinatorIds:[]});
    job.connectionTrial=true;job.profilePins={...assignments};job.readOnly=true;job.isolationMode='shared';state.jobs.push(job);await save();changed();await vscode.commands.executeCommand('aiTeam.board','console');start();return job.id;
  };
  command('aiTeam.chat',async(text?:string,profileId?:string)=>{if(typeof text==='string'&&text.trim())return consoleController.submit({requestId:'console-'+randomUUID(),text,cwd:projectRoots()[0]?.path,mode:'chat',profileId:profileId??state.roles.lead});pendingCompose={mode:'chat',profileId};await vscode.commands.executeCommand('aiTeam.board','console');if(boardReady){await board?.webview.postMessage({type:'consoleCompose',...pendingCompose});pendingCompose=undefined;}});
  command('aiTeam.tryCli',async(profileId?:unknown)=>{const profile=profiles().find(p=>p.id===profileId);if(profile&&projectRoots().length===1)return runTrial(profile);return openConfiguration('trial',profile?.id);});
  const profileSecrets=async(profile:Profile)=>{const env:Record<string,string>={};for(const key of profile.secretEnv??[]){const value=await context.secrets.get(`aiTeam:${profile.id}:${key}`);if(value)env[key]=value;}return env;};
  command('aiTeam.loginCli',async(id?:string)=>{
    if(!id)return openConfiguration('account');const profile=profiles().find(p=>p.id===id);if(!profile)return;if(profile.transport==='http')return openConfiguration('account',profile.id);
    const executable=await findLocalCli(profile.provider,profile.executable);if(!executable)throw new Error(t('CLI missing for {0}. Open Accounts to install or sign in.',profile.label));
    const env={...profile.env,...await profileSecrets(profile)};
    const dir=profile.provider==='codex'?env.CODEX_HOME:profile.provider==='claude'?env.CLAUDE_CONFIG_DIR:undefined;if(dir)await mkdir(dir,{recursive:true});
    const terminal=vscode.window.createTerminal({name:'RelayCrew · '+t('Sign in')+' · '+profile.label,cwd:process.env.USERPROFILE??process.env.HOME,env,...(process.platform==='win32'?{shellPath:'powershell.exe',shellArgs:['-NoLogo','-NoProfile']}:{} )});terminal.show();terminal.sendText(quotedCommand(executable,loginArguments(profile.provider)),true);
    await board?.webview.postMessage({type:'cliSetupStatus',profileId:id,message:t('Complete sign-in in the terminal/browser, then click Check connection.')});
  });
  command('aiTeam.installCli',async(id?:string)=>{const profile=profiles().find(p=>p.id===id);if(!profile)return openConfiguration('account');if(profile.transport==='http')return openConfiguration('account',profile.id);const installed=await findLocalCli(profile.provider,profile.executable);if(installed){await vscode.commands.executeCommand('aiTeam.checkConnection',id);return;}const plan=installPlan(profile.provider);const confirmation=await vscode.window.showWarningMessage(t('Install CLI on this computer?'),{modal:true,detail:plan.command+'\n'+plan.docs},t('Install CLI'));if(confirmation!==t('Install CLI'))return;const terminal=vscode.window.createTerminal({name:'RelayCrew · '+t('Install CLI')+' · '+profile.provider,cwd:process.env.USERPROFILE??process.env.HOME,...(process.platform==='win32'?{shellPath:'powershell.exe',shellArgs:['-NoLogo','-NoProfile']}:{} )});terminal.show();terminal.sendText(plan.command,true);await board?.webview.postMessage({type:'cliSetupStatus',profileId:id,message:t('Installer opened in the terminal. When it finishes, click Check connection.')});});
  command('aiTeam.checkConnection',async(id?:string)=>{const profile=profiles().find(p=>p.id===id);if(!profile)return openConfiguration('account');let result:CliStatus;try{result=profile.transport==='http'?{installed:true,authenticated:'unknown',checkedAt:new Date().toISOString(),message:'API catalog connected. Repository tools are unavailable.',models:await listModels(profile,await profileSecrets(profile))}:await inspectCli(profile,await profileSecrets(profile));}catch{result={installed:false,authenticated:'unknown',checkedAt:new Date().toISOString(),message:'API connection failed. Verify endpoint, server and API key.'};}const missing=[];for(const key of profile.secretEnv??[])if(!await context.secrets.get(`aiTeam:${profile.id}:${key}`))missing.push(key);if(missing.length)result.message+=' '+t('Missing secret references: {0}',missing.join(', '));cliStatuses[profile.id]=result;if(result.executable&&result.executable!==profile.executable){await cfg().update('profiles',profiles().map(p=>p.id===profile.id?{...p,executable:result.executable!}:p),vscode.ConfigurationTarget.Global);}await board?.webview.postMessage({type:'cliSetupStatus',profileId:id,status:result,message:t(result.message)});changed();return result;});
  const openConfiguration=async(kind:string,id?:string,profileId?:string)=>{
    pendingConfiguration={type:'configurationOpen',kind,id,profileId};
    await vscode.commands.executeCommand('aiTeam.board',kind==='account'||kind==='quota'?'accounts':['team','routing','workflow','connections'].includes(kind)?'setup':'console');
    if(boardReady){await board?.webview.postMessage(pendingConfiguration);pendingConfiguration=undefined;}
  };
  command('aiTeam.connectCli',()=>openConfiguration('account'));
  command('aiTeam.importWorkflow',async()=>{
    const picked=await vscode.window.showOpenDialog({canSelectMany:false,canSelectFolders:false,filters:{Markdown:['md']},title:t('Import workflow from Markdown')});if(!picked?.[0])return;
    const uri=picked[0],info=await vscode.workspace.fs.stat(uri);if(info.type!==vscode.FileType.File||info.size>64*1024)throw new Error(t('Choose a Markdown file up to 64 KB.'));
    const name=uri.path.split('/').at(-1)!,bytes=Buffer.from(await vscode.workspace.fs.readFile(uri));
    pendingWorkflow={type:'workflowLoaded',name,markdown:new TextDecoder('utf-8',{fatal:true}).decode(bytes)};
    await openConfiguration('workflow');if(boardReady&&pendingWorkflow){await board?.webview.postMessage(pendingWorkflow);pendingWorkflow=undefined;}
  });
  command('aiTeam.viewWorkflow',()=>openConfiguration('workflow'));
  command('aiTeam.clearWorkflow',async()=>{state.workflow=undefined;await save();changed();});
  command('aiTeam.setup',()=>vscode.commands.executeCommand('aiTeam.board','setup'));
  command('aiTeam.closeBoard',()=>{board?.dispose();});
  command('aiTeam.toggleSidebar',()=>vscode.commands.executeCommand('workbench.action.toggleSidebarVisibility'));
  command('aiTeam.togglePanel',()=>vscode.commands.executeCommand('workbench.action.togglePanel'));
  command('aiTeam.projects',()=>vscode.commands.executeCommand('aiTeam.board','projects'));
  const projectPath = async (path: unknown) => {
    if(typeof path!=='string'||!(projectSummaries(projectRoots(),state.jobs).some(project=>project.path===path)||state.jobs.some(job=>job.cwd===path))||!isAbsolute(path)||!(await stat(path)).isDirectory())throw new Error(t('Choose an existing local project folder.'));
    return path;
  };
  command('aiTeam.projectFolder',async(path:unknown)=>vscode.commands.executeCommand('revealFileInOS',vscode.Uri.file(await projectPath(path))));
  command('aiTeam.projectCodex',async(path:unknown)=>{
    const opened=await vscode.env.openExternal(vscode.Uri.parse(codexProjectLink(await projectPath(path))));
    if(!opened)throw new Error(t('Codex could not be opened. Install the desktop app and try again.'));
  });
  command('aiTeam.dailyPlan',()=>vscode.commands.executeCommand('aiTeam.board','daily'));
  command('aiTeam.dailyStart',()=>vscode.commands.executeCommand('aiTeam.board','daily'));
  command('aiTeam.dailyStop',()=>dailyController.stopPlan());
  command('aiTeam.dailyTask',()=>vscode.commands.executeCommand('aiTeam.board','daily'));
  command('aiTeam.shortcuts',()=>vscode.commands.executeCommand('workbench.action.openGlobalKeybindings'));
  command('aiTeam.board', (page?:string) => {
    if(page&&['console','overview','tasks','accounts','setup','daily','schedules','projects'].includes(page)){requestedPage=page;pageRequest++;}
    if (board) board.reveal();
    else {
      board = vscode.window.createWebviewPanel('aiTeam.board', 'RelayCrew · ' + t('Assignment board'), vscode.ViewColumn.One, { enableScripts: true });
      board.onDidDispose(() => { board = undefined; boardLanguage=undefined; boardReady=false; }, undefined, context.subscriptions);
      board.webview.onDidReceiveMessage(message => void guard(async () => {
        if(message?.action==='removeProfileSecret'){const p=profiles().find(p=>p.id===message.profileId);if(!p||typeof message.key!=='string'||!p.secretEnv?.includes(message.key))return;const choice=await vscode.window.showWarningMessage(t('Delete stored secret {0} for {1}?',message.key,p.label),{modal:true},t('Delete secret'));if(choice!==t('Delete secret'))return;await context.secrets.delete(`aiTeam:${p.id}:${message.key}`);await cfg().update('profiles',profiles().map(v=>v.id===p.id?{...v,secretEnv:v.secretEnv?.filter(k=>k!==message.key)}:v),vscode.ConfigurationTarget.Global);changed();return;}
        if(message?.action==='checkAllAccounts'){for(const p of profiles())await vscode.commands.executeCommand('aiTeam.checkConnection',p.id);return;}
        if(['addBacklog','startBacklog','stopBacklog','removeBacklog'].includes(message?.action)){const receipt=typeof message.requestId==='string'&&/^form-[a-f0-9-]{36}$/.test(message.requestId)?message.action+':'+message.requestId:undefined;if(receipt&&pendingForms.has(receipt))return;if(receipt)pendingForms.add(receipt);try{const v=message.value;if(receipt&&state.formReceipts?.includes(receipt)){await save();await board?.webview.postMessage({type:'backlogResult',action:message.action,ok:true,message:t('Configuration saved.')});return;}if(message.action==='addBacklog'){if(typeof v?.prompt!=='string'||!v.prompt.trim()||v.prompt.length>16000||!projectRoots().some(r=>r.path===v.cwd))throw new Error('Choose an open folder and a useful task.');backlog.items.push({id:randomUUID(),prompt:v.prompt.trim(),cwd:v.cwd});}if(message.action==='removeBacklog'){const item=backlog.items.find(i=>i.id===message.id);if(!item||item.jobId)throw new Error('Only pending backlog items can be removed.');backlog.items=backlog.items.filter(i=>i.id!==item.id);}if(message.action==='stopBacklog')backlog.enabled=false;if(message.action==='startBacklog'){const runs=Number(v?.runs),minutes=Number(v?.minutes);if(!Number.isInteger(runs)||runs<1||runs>20||!Number.isInteger(minutes)||minutes<1||minutes>180||!backlog.items.some(i=>!i.jobId))throw new Error('Add pending work and use budgets within the displayed ranges.');validateRoles();backlog.enabled=true;backlog.remaining=runs;backlog.until=Date.now()+minutes*60000;backlog.sessionJobs=[];}if(receipt){(state.formReceipts??=[]).push(receipt);state.formReceipts=state.formReceipts.slice(-500);}await save();changed();start();await board?.webview.postMessage({type:'backlogResult',action:message.action,ok:true,message:t('Configuration saved.')});}catch(error){await board?.webview.postMessage({type:'backlogResult',action:message.action,ok:false,message:t(error instanceof Error?error.message:String(error))});}finally{if(receipt)pendingForms.delete(receipt);}return;}
        if(message?.action==='shareLayout'){if(message.kind==='export'){const uri=await vscode.window.showSaveDialog({defaultUri:vscode.Uri.file(join(storage,'relaycrew-layout.json')),filters:{JSON:['json']}});if(uri)await vscode.workspace.fs.writeFile(uri,Buffer.from(JSON.stringify({version:1,layout:normalizeLayout(message.layout)},null,2)));}else if(message.kind==='import'){const picked=await vscode.window.showOpenDialog({canSelectMany:false,filters:{JSON:['json']}});if(picked?.[0]){const info=await vscode.workspace.fs.stat(picked[0]);if(info.size>8192)throw new Error('Layout file is too large.');const value=JSON.parse(Buffer.from(await vscode.workspace.fs.readFile(picked[0])).toString('utf8'));if(value.version!==1||!value.layout)throw new Error('Invalid layout file.');await board?.webview.postMessage({type:'layoutImported',layout:normalizeLayout(value.layout),message:t('Layout imported.')});}}return;}
        if(message?.action==='removeDailyBudget'){daily.budgets=daily.budgets?.filter(b=>b.profileId!==message.profileId||b.modelKey!==message.modelKey);await save();changed();return;}
        if(message?.action==='saveDailyBudget'){try{const b=validateDailyBudget(message.value,profiles());daily.budgets??=[];const previous=daily.budgets.findIndex(v=>v.profileId===b.profileId&&v.modelKey===b.modelKey);if(previous<0){if(daily.budgets.length>=200)throw new Error('Too many daily model budgets.');daily.budgets.push(b);}else daily.budgets[previous]=b;await save();changed();await board?.webview.postMessage({type:'dailyBudgetResult',ok:true,message:t('Configuration saved.')});}catch{await board?.webview.postMessage({type:'dailyBudgetResult',ok:false,message:t('Use a quota ceiling of 1–100 and an agent-run budget of 1–1000.')});}return;}
        if(message?.action==='importDailyFolders'){const picked=await vscode.window.showOpenDialog({canSelectFolders:true,canSelectFiles:false,canSelectMany:true,title:t('Import local folders')});if(picked){daily.workspaces??=[];for(const uri of picked){if(uri.scheme!=='file'||!(await stat(uri.fsPath)).isDirectory())continue;if(dailyRoots().length>=20)break;if(!daily.workspaces.some(w=>w.path===uri.fsPath))daily.workspaces.push({path:uri.fsPath,permission:'read-only',enabled:false});}await save();changed();}return;}
        const sections:Record<string,string>={saveTeam:'team',saveRouting:'routing',previewWorkflow:'workflow',applyWorkflow:'workflow',saveQuota:'quota',switchAssignment:'assignment',tryCliInline:'trial',checkCli:'account',saveProfileSecret:'account',saveConnection:'connection',disconnectConnection:'connection',testConnection:'connection',saveTemplates:'templates',previewTemplates:'templates'};
        if(message&&Object.hasOwn(sections,message.action)){
          const section=sections[message.action];
          try{
            let result:Record<string,unknown>={};
            if(['saveTemplates','previewTemplates'].includes(message.action)){
              const templates=validatePromptTemplates(message.templates);
              if(message.action==='saveTemplates'){state.promptTemplates=templates;await save();}
              else {if(!templateRoles.includes(message.role)||typeof message.task!=='string'||!message.task.trim()||message.task.length>8000)throw new Error('Enter a sample task up to 8000 characters.');const job=newJob(message.task,projectRoots()[0]?.path??'',state.roles,state.flow,state.overrides,state.management);job.promptTemplates=snapshotPromptTemplates(templates);const role=message.role==='coordinator'?'lead':message.role;const step={role,title:'Template preview',prompt:role==='auditor'?auditInstructions+'\nMaximum repair tasks: '+cfg().get('maxChildTasks',4):role==='lead'?(message.role==='coordinator'?'Review the preceding evidence and report to the primary manager without approving.':leadInstructions):message.task,status:'pending' as const,...(message.role==='coordinator'?{coordinatorProfileId:'preview-coordinator'}:{})};result.preview=stepPrompt(job,step);result.templateRequestId=typeof message.templateRequestId==='string'?message.templateRequestId.slice(0,80):undefined;}
            }
            if(message.action==='saveTeam'){const next=flowConfiguration(message.configuration,profiles());state.flow=next.flow;state.roles=next.roles;state.overrides=next.overrides;state.management=next.management;await save();}
            if(message.action==='saveRouting'){const next=routingConfiguration(message.configuration,profiles(),state.flow??fullFlow);applyingSettings=true;try{await cfg().update('rotationPools',next.pools,vscode.ConfigurationTarget.Global);await cfg().update('routingMode',next.mode,vscode.ConfigurationTarget.Global);}finally{applyingSettings=false;}}
            if(['previewWorkflow','applyWorkflow'].includes(message.action)){
              if(typeof message.markdown!=='string'||message.markdown.length>65536||typeof message.name!=='string'||message.name.length>180||/[\\/\r\n\0]/.test(message.name))throw new Error('Choose a Markdown file up to 64 KB.');
              const imported=importWorkflow(message.name,Buffer.from(message.markdown,'utf8'),profiles(),{flow:state.flow??fullFlow,roles:state.roles,overrides:state.overrides??{},management:state.management!,promptTemplates:state.promptTemplates});
              if(message.action==='applyWorkflow'){state.workflow=imported.document;Object.assign(state,imported.configuration);await save();}
              else result={name:message.name,markdown:message.markdown,preview:imported.configuration.flow.map(role=>`${roleName(role)} → ${imported.configuration.roles[role]}${imported.configuration.overrides[role]?.model?' / '+imported.configuration.overrides[role]?.model:''}`)};
            }
            if(message.action==='saveQuota'){if(!profiles().some(p=>p.id===message.profileId))throw new Error('Choose an existing account profile.');state.quotas[message.profileId]=manualQuota(message.quota);await save();}
            if(message.action==='switchAssignment'){
              if(typeof message.role!=='string'||!profiles().some(p=>p.id===message.profileId))throw new Error('Choose an existing account profile.');
              const job=state.jobs.find(j=>j.id===message.jobId);
              if(message.jobId&&!job)throw new Error('Select an active session to stop.');
              const coordinator=/^coordinator:(\d+)$/.exec(message.role);
              if(!coordinator&&!roles.includes(message.role as Role))throw new Error('Choose an existing profile for every node.');
              if(job){if(job.status==='running'){state.queuePaused=true;engine.pause();await save();await draining;}if(coordinator)assignCoordinatorProfile(job,Number(coordinator[1]),message.profileId,profiles());else assignTaskProfile(job,message.role as Role,message.profileId,profiles());}
              else {const role=message.role as Role;if(coordinator)throw new Error('Invalid flow configuration.');state.roles[role]=message.profileId;if(role==='lead')state.management={primaryProfileId:message.profileId,coordinatorIds:state.management!.coordinatorIds.filter(id=>id!==message.profileId)};}
              await save();result.message=t(job?'Pinned for this task; queue remains paused if it was running.':'Applies to future tasks; rotation policy still applies.');
            }
            if(message.action==='tryCliInline'){const profile=profiles().find(p=>p.id===message.profileId);if(!profile)throw new Error('Choose an existing account profile.');await runTrial(profile,message.cwd);}
            if(message.action==='checkCli'){const profile=profiles().find(p=>p.id===message.profileId);if(!profile)throw new Error('Choose an existing account profile.');result.message=await cliVersion(profile.executable);}
            if(message.action==='saveProfileSecret'){
              const profile=profiles().find(p=>p.id===message.profileId);
              if(!profile||typeof message.key!=='string'||!/^[A-Za-z_][A-Za-z0-9_]*$/.test(message.key)||typeof message.value!=='string'||!message.value||message.value.length>16000)throw new Error('Enter valid environment variable names.');
              await context.secrets.store(`aiTeam:${profile.id}:${message.key}`,message.value);await cfg().update('profiles',profiles().map(p=>p.id===profile.id?{...p,secretEnv:[...new Set([...(p.secretEnv??[]),message.key])]}:p),vscode.ConfigurationTarget.Global);
            }
            if(['disconnectConnection','testConnection'].includes(message.action)){if(!messaging||!['telegram','zalo'].includes(message.channel))throw new Error('Invalid connection configuration.');if(message.action==='disconnectConnection'){await messaging.disconnect(message.channel);result.message=t('Channel disconnected; local credentials removed.');}else{await messaging.test(message.channel,language());result.message=t('Test queued. Check delivery status for the result.');}}
            if(message.action==='saveConnection'){
              const c=message.connection;
              if(!messaging||!c||!['telegram','zalo'].includes(c.channel)||typeof c.inbound!=='boolean'||!projectRoots().some(root=>root.path===c.cwd)||typeof c.recipient!=='string'||! /^-?\d{1,100}$/.test(c.recipient)||typeof message.token!=='string'||message.token.length>8192||/[\r\n]/.test(message.token)||typeof message.webhookSecret!=='string'||message.webhookSecret.length>8192)throw new Error('Invalid connection configuration.');
              for(const key of ['allowedUserId','appId','oaId'])if(c[key]!==undefined&&(typeof c[key]!=='string'||c[key].length>100))throw new Error('Invalid connection configuration.');
              await messaging.configure({channel:c.channel,enabled:true,inbound:c.inbound,recipient:c.recipient,cwd:c.cwd,allowedUserId:c.allowedUserId||undefined,appId:c.appId||undefined,oaId:c.oaId||undefined,port:c.port},message.token.trim(),message.webhookSecret||undefined);
            }
            await board?.webview.postMessage({type:'configurationResult',section,ok:true,message:t('Configuration saved.'),...result});changed();
          }catch(error){await board?.webview.postMessage({type:'configurationResult',section,ok:false,message:t(error instanceof Error?error.message:String(error))});}return;
        }
        if(message?.action==='importRoleGuide'&&templateRoles.includes(message.role)){try{
          const selected=await vscode.window.showOpenDialog({canSelectMany:false,filters:{Markdown:['md']},title:t('Attach role .md')});if(!selected?.[0])return;const uri=selected[0],info=await vscode.workspace.fs.stat(uri);if(info.type!==vscode.FileType.File||info.size>32768)throw new Error('Role Markdown must be UTF-8 text up to 32 KB.');const markdown=new TextDecoder('utf-8',{fatal:true}).decode(await vscode.workspace.fs.readFile(uri));if(markdown.includes('\0'))throw new Error('Role Markdown must be UTF-8 text up to 32 KB.');await board?.webview.postMessage({type:'roleGuideLoaded',role:message.role,name:uri.path.split('/').at(-1),markdown});}catch(error){await board?.webview.postMessage({type:'configurationResult',section:'templates',ok:false,message:t(error instanceof Error?error.message:String(error))});}return;
        }
        if(message?.action==='inspectSession'&&typeof message.id==='string'&&state.jobs.some(j=>j.id===message.id)){boardState={...boardState,consoleSelected:message.id,consoleNew:false};requestedPage='console';pageRequest++;changed();await board?.webview.postMessage({type:'consoleSelect',id:message.id});return;}
        if(message?.action==='boardState'){
          if(message.state&&typeof message.state==='object'&&!Array.isArray(message.state)&&JSON.stringify(message.state).length<=768000){boardState=safeBoardState(message.state);clearTimeout(boardStateTimer);boardStateTimer=setTimeout(()=>{void saveBoardState().then(undefined,error=>output.appendLine(String(error)));},400);}return;
        }
        if(['saveSchedule','saveDailyPlan','addDailyItem','moveDailyItem','addCriteria','checkCriterion'].includes(message?.action)){
          const target=message.action==='saveSchedule'?'schedule-message':message.action==='saveDailyPlan'?'daily-plan-message':message.action==='addDailyItem'||message.action==='moveDailyItem'?'daily-item-message':'task-planning-message';
          const receipt=typeof message.requestId==='string'&&/^form-[a-f0-9-]{36}$/.test(message.requestId)?message.action+':'+message.requestId:undefined;if(receipt&&pendingForms.has(receipt))return;if(receipt)pendingForms.add(receipt);
          try{
            if(receipt&&state.formReceipts?.includes(receipt)){await save();await board?.webview.postMessage({type:'planningResult',target,action:message.action,id:message.id,ok:true,message:t('Configuration saved.')});return;}
            if(receipt){(state.formReceipts??=[]).push(receipt);state.formReceipts=state.formReceipts.slice(-500);}
            if(message.action==='saveSchedule'){
              const previous=state.schedules.find(s=>s.id===message.value?.id),schedule=scheduleFromForm(message.value,projectRoots().map(r=>r.path),state.roles,previous);
              if(!previous){validateRoles();schedule.flow=[...state.flow!];schedule.overrides=structuredClone(state.overrides);schedule.management=structuredClone(state.management);state.schedules.push(schedule);}else state.schedules[state.schedules.indexOf(previous)]=schedule;
            }else if(message.action==='saveDailyPlan')await dailyController.configure(message.value,dailyRoots());
            else if(message.action==='addDailyItem')await dailyController.addInline(message.value,dailyRoots());
            else if(message.action==='moveDailyItem')await dailyController.moveItem(message.id,message.direction);
            else {
              const job=state.jobs.find(j=>j.id===message.id);if(!job)throw new Error('Task no longer exists.');
              if(message.action==='addCriteria'){const next=acceptanceFromText(message.text);if(!next.length||(job.acceptance?.length??0)+next.length>30)throw new Error('Use up to 30 criteria, at most 500 characters each.');(job.acceptance??=[]).push(...next);}
              else {const criterion=job.acceptance?.find(c=>c.id===message.criterionId);if(!criterion||typeof message.checked!=='boolean')throw new Error('Invalid acceptance criterion.');criterion.checked=message.checked;criterion.checkedAt=message.checked?new Date().toISOString():undefined;}
            }
            await save();changed();await board?.webview.postMessage({type:'planningResult',target,action:message.action,id:message.id,ok:true,message:t('Configuration saved.')});
          }catch(error){if(receipt)state.formReceipts=state.formReceipts?.filter(r=>r!==receipt);await board?.webview.postMessage({type:'planningResult',target,action:message.action,id:message.id,ok:false,message:t(error instanceof Error?error.message:String(error))});}finally{if(receipt)pendingForms.delete(receipt);}return;
        }
        if(message?.action==='saveAccount'){
          try{const profile=accountFromForm(message.profile,profiles()),next=profiles().some(p=>p.id===profile.id)?profiles().map(p=>p.id===profile.id?profile:p):[...profiles(),profile];await cfg().update('profiles',next,vscode.ConfigurationTarget.Global);await board?.webview.postMessage({type:'accountSaved',ok:true,message:t('Account saved. Assign its role, then run a trial or open CLI login.')});changed();}
          catch(error){await board?.webview.postMessage({type:'accountSaved',ok:false,message:t(error instanceof Error?error.message:String(error))});}return;
        }
        if(message?.action==='detectCli'&&['codex','claude','gemini','antigravity'].includes(message.provider)){
          const path=await findLocalCli(message.provider);await board?.webview.postMessage({type:'accountDetected',provider:message.provider,path,message:path?t('CLI found. Save this account to use it.'):t('CLI not found. Install it or enter its absolute executable path.')});return;
        }
        if(message?.action==='assignRole'){
          if(!roles.includes(message.role)||!profiles().some(p=>p.id===message.id))throw new Error(t('Choose an existing profile for every node.'));
          await cfg().update('routingMode','selected',vscode.ConfigurationTarget.Global);state.roles[message.role as Role]=message.checked===false&&message.role!=='lead'?'':message.id;
          if(message.role==='lead')state.management={primaryProfileId:message.id,coordinatorIds:(state.management?.coordinatorIds??[]).filter(id=>id!==message.id)};
          delete state.overrides?.[message.role as Role];await save();changed();return;
        }
        if(['consoleAttach','consolePickFiles','consoleRestoreAttachments'].includes(message?.action)){
          try {
            let attachments;
            if(message.action==='consoleRestoreAttachments')attachments=await attachmentStore.metadata(message.ids);
            else if(message.action==='consolePickFiles'){
              const uris=await vscode.window.showOpenDialog({canSelectMany:true,canSelectFolders:false,title:t('Attach files to Console')});
              if(!uris){await board?.webview.postMessage({type:'consoleAttachments',uploadId:message.uploadId,cancelled:true});return;}
              if(uris.length>attachmentLimits.count)throw new Error('Choose up to 8 attachments (16 MB total).');
              attachments=[];
              for(const uri of uris){const info=await vscode.workspace.fs.stat(uri);if(info.type!==vscode.FileType.File||info.size>attachmentLimits.image)throw new Error('Attachment too large: text 256 KB, image 4 MB.');const name=uri.path.split('/').at(-1)!;attachments.push(await attachmentStore.add(name,Buffer.from(await vscode.workspace.fs.readFile(uri))));}
            }else {
              if(typeof message.data!=='string'||message.data.length>Math.ceil(attachmentLimits.image/3)*4||/[^A-Za-z0-9+/=]/.test(message.data)||Buffer.from(message.data,'base64').toString('base64')!==message.data)throw new Error('Invalid attachment data.');
              attachments=[await attachmentStore.add(message.name,Buffer.from(message.data,'base64'))];
            }
            const contents=await attachmentStore.resolve(attachments.map(a=>a.id));
            await board?.webview.postMessage({type:'consoleAttachments',uploadId:message.uploadId,attachments:contents.map(({data,...a})=>({...a,...(a.mime==='text/plain'?{}:{preview:`data:${a.mime};base64,${data.toString('base64')}`} )})),restore:message.action==='consoleRestoreAttachments'});
          }catch(error){await board?.webview.postMessage({type:'consoleAttachments',uploadId:message.uploadId,error:t(error instanceof Error?error.message:String(error))});}return;
        }
        if(message?.action==='consoleCopy'){
          const job=state.jobs.find(job=>job.id===message.sessionId);
          if(job){await vscode.env.clipboard.writeText(message.part==='last'?job.steps.slice().reverse().find(step=>step.response)?.response??'':reportText(job));await board?.webview.postMessage({type:'consoleCopied',message:t('Copied to clipboard.')});}return;
        }
        if(message?.action==='consoleReady'){boardReady=true;refreshConsole();if(pendingReply){await board?.webview.postMessage({type:'consoleSelect',id:pendingReply,reply:true});pendingReply=undefined;}if(pendingConfiguration){await board?.webview.postMessage(pendingConfiguration);pendingConfiguration=undefined;}if(pendingWorkflow){await board?.webview.postMessage(pendingWorkflow);pendingWorkflow=undefined;}if(pendingCompose){await board?.webview.postMessage({type:'consoleCompose',...pendingCompose});pendingCompose=undefined;}return;}
        if(message?.action==='consoleSubmit'){try{const result=await consoleController.submit(message);await board?.webview.postMessage({type:'consoleAck',requestId:message.requestId,ok:true,...result,message:t(result.message)});}catch(error){await board?.webview.postMessage({type:'consoleAck',requestId:message.requestId,ok:false,message:t(error instanceof Error?error.message:String(error))});}return;}
        const actions: Record<string,string> = {examples:'aiTeam.examples',pauseSchedule:'aiTeam.pauseSchedule',schedule:'aiTeam.schedule',closeBoard:'aiTeam.closeBoard',toggleSidebar:'aiTeam.toggleSidebar',togglePanel:'aiTeam.togglePanel', installCli:'aiTeam.installCli',checkConnection:'aiTeam.checkConnection',chat:'aiTeam.chat',connectCli:'aiTeam.connectCli',tryCli:'aiTeam.tryCli',loginCli:'aiTeam.loginCli',importWorkflow:'aiTeam.importWorkflow',viewWorkflow:'aiTeam.viewWorkflow',clearWorkflow:'aiTeam.clearWorkflow', language:'aiTeam.language', flow:'aiTeam.flow', connections:'aiTeam.connections', newTask:'aiTeam.newTask', backlog:'aiTeam.backlog', utilization:'aiTeam.utilization', account:'aiTeam.accountDetails', report:'aiTeam.report', reply:'aiTeam.reply', resume:'aiTeam.resume', backups:'aiTeam.backups', routing:'aiTeam.routing', switch:'aiTeam.switch', profiles:'aiTeam.profiles', editProfile:'aiTeam.profiles', quota:'aiTeam.quota', settings:'aiTeam.settings',shortcuts:'aiTeam.shortcuts',refreshQuota:'aiTeam.refreshQuota',dailyStart:'aiTeam.dailyStart',dailyStop:'aiTeam.dailyStop',dailyTask:'aiTeam.dailyTask',projectTask:'aiTeam.newTask',projectFolder:'aiTeam.projectFolder',projectCodex:'aiTeam.projectCodex' };
        if(message?.action==='setLanguage'&&['auto','en','vi'].includes(message.value)){await cfg().update('language',message.value,vscode.ConfigurationTarget.Global);return;}
        if(message?.action==='dailyAccount'){await dailyController.account(message.id,message.value);return;}
        if(message?.action==='dailyOption'){await dailyController.option(message.key,message.value);return;}
        if(message?.action==='assignAccount'&&typeof message.id==='string'){await vscode.commands.executeCommand('aiTeam.switch',undefined,message.id);return;}
        if(message?.action==='saveSettings'){
          try{const settings=validateSettingsPatch(message.settings);applyingSettings=true;
            try{for(const [key,value]of Object.entries(settings))await cfg().update(key,value,vscode.ConfigurationTarget.Global);}finally{applyingSettings=false;}
            changed(false);await board?.webview.postMessage({type:'settingsSaved',ok:true,message:t('Settings applied.')});
          }catch(error){await board?.webview.postMessage({type:'settingsSaved',ok:false,message:t(error instanceof Error?error.message:String(error))});}return;
        }
        if (message?.action === 'toggle') {
          if (!['autoSwitch','resumeAfterQuota','resumeProviderLimited','allowEdits','backupBeforeEdits','isolateTasks','openTasksInCodex'].includes(message.key) || typeof message.value !== 'boolean') return;
          await cfg().update(message.key, message.value, vscode.ConfigurationTarget.Global); changed(); return;
        }
        if (message?.action === 'pause') { await vscode.commands.executeCommand('aiTeam.pauseQueue'); return; }
        if (message?.action === 'cancel' && typeof message.id === 'string') { engine.cancel(message.id); await save(); return; }
        if (typeof message?.action === 'string' && actions[message.action] && (message.id === undefined || typeof message.id === 'string')) await vscode.commands.executeCommand(actions[message.action], message.id || undefined);
      }), undefined, context.subscriptions);
    }
    changed();
  });
  command('aiTeam.pauseQueue',async()=>{state.queuePaused=!state.queuePaused;if(state.queuePaused)engine.pause();await save();changed();if(!state.queuePaused)start();});
  command('aiTeam.routing',()=>openConfiguration('routing'));
  command('aiTeam.backups', async () => {
    const snapshots=await listBackups(join(storage,'source-backups'));
    const selected=await vscode.window.showQuickPick([{label:t("State / chat backup locations"),path:''},...snapshots.map(b=>({label:`${b.manifest.createdAt} · ${roleName(b.manifest.role)}`,description:`${t('{0} files',b.manifest.files.length)} · ${(b.manifest.totalBytes/1024/1024).toFixed(1)} MB · ${b.manifest.jobId.slice(0,8)}`,path:join(b.path,'manifest.json')}))],{title:t("Local backups (snapshots do not overwrite your working tree)")});
    if (!selected) return;
    if(selected.path)await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(selected.path));
    else await vscode.window.showTextDocument(await vscode.workspace.openTextDocument({language:'markdown',content:`# ${t('Local persistence')}\n\n${t('State')}: ${statePath}\n\n${t('State backups (last 50 changes)')}: ${stateStore.backups}\n\n${t('Messaging state')}: ${join(storage,'messaging.json')}\n\n${t('Messaging backups')}: ${join(storage,'messaging.json.backups')}\n\n${t('Attachments')}: ${join(storage,'attachments')}\n\n${t('Source snapshots')}: ${join(storage,'source-backups')}\n\n${t('Source snapshots include Git tracked and non-ignored files plus explicit extra paths. Ignored databases, Git history, symlinks and submodules need separate backups. Snapshots are kept; storage caps block editable work. Compare files before restoring manually.')}`}));
  });
  command('aiTeam.accountDetails',(id?:string)=>openConfiguration('account',id));
  command('aiTeam.accountMenu',()=>vscode.commands.executeCommand('aiTeam.board','accounts'));
  command('aiTeam.refreshQuota',async()=>{await quotas.refresh(profiles(),state.quotas);quotaReadAt=Date.now();await save();changed();});
  const resume = (job: Job, automatic: boolean) => {
    if (job.status !== 'waiting_quota') throw new Error('Task is not waiting for quota.');
    const step = job.steps.find(s => s.status !== 'done'); if (!step) throw new Error('No paused step.');
    if (automatic && job.limitDetectedAt && !cfg().get('resumeProviderLimited', false)) return false;
    const pin=step.coordinatorProfileId??job.profilePins?.[step.role];
    if(job.dailyItemId&&!dailyCanRun(daily,job))throw new QuotaWait('Daily plan paused.');
    const profile = job.dailyItemId?dailyProfile(daily,pin??job.roles[step.role],profiles(),state.quotas,state.jobs):pin?routeProfile(pin,profiles(),state.quotas,false,cfg().get('quotaThreshold',95)):choose(step.role, job.roles[step.role], false, job.overrides ?? {}), q = state.quotas[profile.id];
    if (!fresh(q) || q.usedPercent >= (job.dailyItemId ? daily.targetPercent : cfg().get('quotaThreshold', 95))
      || (job.limitDetectedAt && profile.id === job.blockedProfileId && Date.parse(q.observedAt) <= Date.parse(job.limitDetectedAt))) throw new QuotaWait('A new available quota snapshot is required before resuming this account.');
    job.status = 'queued'; job.error = undefined; return true;
  };
  command('aiTeam.resume', async (id?: string) => {
    if(!id)return vscode.commands.executeCommand('aiTeam.board','tasks');const selected=id;
    const job = state.jobs.find(j => j.id === selected); if (!job) return;
    resume(job, false); await save(); changed(); start();
  });
  command('aiTeam.flow',()=>openConfiguration('team'));
  command('aiTeam.connections',()=>openConfiguration('connections'));
  command('aiTeam.reply', async(id?:string)=>{if(!id)return vscode.commands.executeCommand('aiTeam.board','tasks');const job=state.jobs.find(j=>j.id===id);if(!job)return;boardState={...boardState,consoleSelected:id,consoleNew:false};pendingReply=id;await vscode.commands.executeCommand('aiTeam.board','console');if(boardReady){await board?.webview.postMessage({type:'consoleSelect',id,reply:true});pendingReply=undefined;}});
  command('aiTeam.backlog',async()=>{await vscode.commands.executeCommand('aiTeam.board','tasks');await board?.webview.postMessage({type:'backlogOpen'});});
  command('aiTeam.utilization',()=>vscode.commands.executeCommand('aiTeam.backlog'));
  command('aiTeam.newTask', async (project?:string) => {
    const selectedProject = project === undefined ? undefined : await projectPath(project);
    if(selectedProject&&!projectRoots().some(root=>root.path===selectedProject))throw new Error(t('Open this folder in your VS Code workspace before creating a task.'));
    pendingCompose={mode:'task',cwd:selectedProject};
    await vscode.commands.executeCommand('aiTeam.board','console');
    if(boardReady){await board?.webview.postMessage({type:'consoleCompose',...pendingCompose});pendingCompose=undefined;}
  });
  command('aiTeam.switch',(id?:string,profileId?:string)=>openConfiguration('assignment',id,profileId));
  command('aiTeam.profiles',(id?:string)=>openConfiguration('account',id));
  command('aiTeam.settings', () => vscode.commands.executeCommand('workbench.action.openSettings', '@ext:local-ai-team.ai-team-workbench'));
  command('aiTeam.logs', () => output.show());
  command('aiTeam.secret',(id?:string)=>openConfiguration('account',id));
  command('aiTeam.quota',(id?:string)=>openConfiguration('quota',id));
  command('aiTeam.report', async (id?: string) => {
    if(!id)return vscode.commands.executeCommand('aiTeam.board','tasks');const chosen=id;
    const job = state.jobs.find(j => j.id === chosen); if (!job) return;
    await persistReports();
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(join(storage, 'reports', `${job.id}.md`)));
  });
  command('aiTeam.cancel',async(id?:string)=>{if(!id)return vscode.commands.executeCommand('aiTeam.board','tasks');if(!state.jobs.some(j=>j.id===id))return;engine.cancel(id);await save();changed();});
  command('aiTeam.examples',()=>vscode.commands.executeCommand('revealFileInOS',vscode.Uri.file(join(context.extensionPath,'examples'))));
  command('aiTeam.schedule',()=>vscode.commands.executeCommand('aiTeam.board','schedules'));
  command('aiTeam.pauseSchedule', async (id?: string) => {
    if(!id)return vscode.commands.executeCommand('aiTeam.board','schedules');const selected=id;
    const s = state.schedules.find(x => x.id === selected); if (!s) return;
    if (!s.enabled && s.cron) s.nextAt = nextCron(s.cron, s.timezone);
    if (!s.enabled && !s.cron && Date.parse(s.nextAt) <= Date.now()) throw new Error('One-time occurrence has passed. Create a new schedule.');
    s.enabled = !s.enabled; await save(); changed();
  });
  messaging = await MessagingHub.load(storage, context.globalStorageUri.fsPath, context.secrets, {
    changed, language, log: text => output.appendLine(`[Messaging] ${text}`),
    receive: async (message, connection, history, signal) => {
      if (!roots.some(r => r.uri.fsPath === connection.cwd)) throw new Error('Connected workspace is no longer open.');
      const command = chatCommand(message.text);
      if (command.kind === 'help') return ['RelayCrew · '+t('Two-way chat'),t('Send a normal question or /ask text → agent replies read-only.'),t('/task requirements → run the selected team (local Allow Edits applies).'),'/status · /tasks',t('/reply TASK_ID answer → resume a task waiting for you.'),t('/cancel TASK_ID → stop a task.'),t('/resume TASK_ID → retry after inspecting edits and refreshing quota.'),t('VS Code and this workspace must stay open.')].join('\n');
      const jobs = state.jobs.filter(j => j.cwd === connection.cwd);
      if (command.kind === 'status' || command.kind === 'tasks') return `${roots.find(r => r.uri.fsPath === connection.cwd)?.name ?? t("Workspace")}\n` + (jobs.slice(-12).reverse().map(j => `${j.id.slice(0, 8)} · ${stateName(j.status)}${j.ownerQuestion ? '\n' + t('Question for owner') + ': ' + j.ownerQuestion : ''}`).join('\n') || t("No tasks yet.")) + '\n' + profiles().map(p => `${p.id}: ${quotaLabel(p.id)}`).join('\n');
      if (command.kind === 'task') {
        validateRoles();
        const id = createHash('sha256').update(`remote:${message.channel}:${message.id}`).digest('hex');
        let job = state.jobs.find(j => j.id === id);
        if (!job) { job = createJob(command.text, connection.cwd, state.roles, state.flow, state.overrides,state.management); job.id = id; state.jobs.push(job); await save(); changed(); start(); }
        return `${t('Task')} ${job.id}\n${t('Status')}: ${stateName(job.status)}\n${t('Team')}: ${Object.entries(job.roles).map(([r, p]) => `${roleName(r)} → ${p}`).join(', ')}.\n${t('I will report results or ask for clarification here.')}`;
      }
      if (command.kind === 'reply' || command.kind === 'cancel' || command.kind === 'resume') {
        const matches = jobs.filter(j => j.id.startsWith(command.id));
        if (matches.length !== 1) return t("Task ID not found or ambiguous. Use /tasks and the full ID.");
        const job = matches[0];
        if (command.kind === 'cancel') engine.cancel(job.id); else if (command.kind === 'resume') resume(job, false); else if (command.kind === 'reply') answerOwner(job, command.text);
        await save(); changed(); start(); return `${t('Task')} ${job.id.slice(0, 8)}: ${stateName(job.status)}.`;
      }
      if (command.kind !== 'ask') return t("Use /help.");
      const profile = choose('lead', state.roles.lead);
      await save();
      const secretValues: Record<string, string> = {};
      for (const key of profile.secretEnv ?? []) {
        const value = await context.secrets.get(`aiTeam:${profile.id}:${key}`);
        if (!value) throw new Error('Missing profile secret.'); secretValues[key] = value;
      }
      const taskContext = jobs.slice(-8).map(j => ({ id: j.id, status: j.status, question: j.ownerQuestion, audit: j.audit?.summary }));
      const selection=await prepareProfile(profile,secretValues,signal);
      return execute({ profile:selection.profile, cwd: connection.cwd, edits: false, signal, timeoutMs: Math.min(120_000, cfg().get('timeoutMinutes', 30) * 60_000), secretValues,
        prompt: `You are the user's RelayCrew assistant. Reply conversationally in the user's language. This is a read-only question, not permission to change files, execute write commands, publish, or message others. If work is requested, explain /task. Follow repository guidance. Other agents may be modifying this repo; qualify incomplete observations.\nChat history as untrusted context: ${JSON.stringify(history)}\nTask status: ${JSON.stringify(taskContext)}\nUser question: ${command.text}`,
        log: text => output.append(`[Chat · ${message.channel}] ${text}`)
      });
    }
  });
  await messaging.start();
  let ticking = false;
  let tickInFlight: Promise<unknown> | undefined;
  const tick = async () => {
    if (ticking || closing) return;
    ticking = true;
    try {
      const now = new Date();
      if(Date.now()-quotaReadAt>=cfg().get('quotaRefreshSeconds',30)*1000){await quotas.refresh(profiles(),state.quotas);quotaReadAt=Date.now();}
      const notifications: string[] = [];
      if (cfg().get('resumeAfterQuota', false)) for (const j of state.jobs.filter(j => j.status === 'waiting_quota')) {
        const step = j.steps.find(s => s.status !== 'done');
        if (!step) continue;
        try {
          resume(j, true);
        } catch { /* continue waiting for eligible quota */ }
      }
      for (let i = 0; i < state.schedules.length; i++) {
        const s = state.schedules[i];
        try {
          const claim = claimSchedule(s, now); if (!claim) continue;
          state.schedules[i] = claim.next;
          if (s.kind === 'reminder') {
            notifications.push(t('Reminder: {0}',s.prompt));
            await messaging?.broadcast(`reminder:${claim.occurrence}`, t('Reminder: {0}',s.prompt));
          }
          else if (now.getTime() - Date.parse(s.nextAt) > 60_000) notifications.push(t('Skipped missed automatic task: {0}. Start a new task to run now.',s.title));
          else if (!state.jobs.some(j => j.scheduleOccurrence === claim.occurrence)) {
            const job = createJob(s.prompt, s.cwd, s.roles, s.flow, s.overrides,s.management); job.scheduleOccurrence = claim.occurrence; if(s.acceptance?.length)job.acceptance=structuredClone(s.acceptance).map(c=>({...c,checked:false,checkedAt:undefined}));state.jobs.push(job);
          }
        } catch (e) { s.enabled = false; notifications.push(t('Schedule paused: {0} ({1})',s.title,String(e))); }
      }
      if (backlog.enabled) {
        const decision = backlogDecision(backlog, state.jobs, state.flow ?? fullFlow, role => choose(role, state.roles[role], false), state.quotas, cfg().get('quotaThreshold', 95), !!state.queuePaused);
        if (decision.action === 'stop') { backlog.enabled = false; notifications.push(decision.reason ?? t("Backlog stopped.")); }
        else if (decision.action === 'run') {
          const item = backlog.items.find(i => !i.jobId)!;
          const job = createJob(item.prompt, item.cwd, state.roles, state.flow, state.overrides,state.management); item.jobId = job.id;
          (backlog.sessionJobs ??= []).push(job.id); state.jobs.push(job); backlog.remaining--;
        }
      }
      dailyController.tick(now.getTime());
      await save();
      for (const text of notifications) void vscode.window.showInformationMessage(`RelayCrew: ${text}`);
      changed(); start();
    } finally { ticking = false; }
  };
  const safeTick = () => {
    tickInFlight ??= guard(tick).finally(() => { tickInFlight = undefined; });
    return tickInFlight;
  };
  const timer = setInterval(() => void safeTick(), 15_000);
  context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(()=>changed()), { dispose: () => { clearInterval(timer); engine.stop(); } }, vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('aiTeam')&&!applyingSettings) changed();
  }));
  shutdown = async () => {
    closing = true; clearInterval(timer);clearTimeout(boardStateTimer);engine.stop();await saveBoardState();
    await messaging?.stop(); await tickInFlight; await draining; await writeQueue; await logQueue; await release();
    shutdown = undefined;
  };
  output.appendLine(`RelayCrew ready. State and reports: ${storage}`);
  await save(); changed(); await safeTick();
}

export async function deactivate(): Promise<void> { await shutdown?.(); }
