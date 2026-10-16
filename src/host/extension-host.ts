import * as vscode from 'vscode';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { answerOwner, assignCoordinatorProfile, assignTaskProfile, claimSchedule, fresh, fullFlow, nextCron, parseQuota, QuotaWait, resolveTimezone, rotateProfile, routeProfile, validateFlow, validateManagement, validateProfiles } from '../core/domain';
import type { Backlog, Job, Management, Profile, Quota, Role, RoleOverrides, Schedule } from '../core/domain';
import { Engine, newJob, stepPrompt } from '../core/engine';
import { execute } from '../adapters/cli/runner';
import { MessagingHub } from '../adapters/messaging/messaging-hub';
import { chatCommand } from '../adapters/messaging/messaging';
import { connectionWizard } from '../ui/connection-ui';
import { renderBoard } from '../ui/board';
import { flowEditor } from '../ui/flow-editor';
import { backlogDecision } from '../core/utilization';
import { JsonStore } from '../storage/json-store';
import { listBackups, snapshotWorkspace } from '../storage/backup';
import { QuotaService, quotaSummary, usageStatus } from '../adapters/quota/quota-service';
import { resolveLanguage, roleLabel, statusLabel, translator, type Translator } from '../core/i18n';
import { dailyCanRun, dailyProfile, emptyDailyPlan, syncDecisions, type DailyPlan } from '../core/daily-plan';
import { DailyController } from './daily-controller';
import { numericSettings, validateSettingsPatch } from '../core/settings';
import { editProfiles } from '../ui/profile-editor';
import { codexProjectLink, projectSummaries } from '../core/projects';
import { prepareWorktree } from '../storage/worktrees';

interface State { version: 1; roles: Record<Role, string>; jobs: Job[]; schedules: Schedule[]; quotas: Record<string, Quota>; backlog?: Backlog; rotationCursor?: Partial<Record<Role, number>>; quotaAlerted?: Record<string, boolean>; flow?: Role[]; overrides?: RoleOverrides; queuePaused?: boolean; management?: Management; dailyPlan?: DailyPlan }
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
  const projectRoots = () => (vscode.workspace.workspaceFolders ?? []).map(root => ({name:root.name,path:root.uri.fsPath}));
  const createJob = (...args: Parameters<typeof newJob>) => {
    const job=newJob(...args);job.isolationMode=cfg().get('isolateTasks',false)?'worktree':'shared';job.openInCodex=cfg().get('openTasksInCodex',false);return job;
  };
  const eventKey = (j: Job) => `${j.id}:${j.status}:${j.ownerReplies?.length ?? 0}:${j.limitDetectedAt ?? ''}`;
  const announced = new Set(state.jobs.filter(j => !['running', 'queued'].includes(j.status)).map(eventKey));
  let messaging: MessagingHub | undefined;
  let board: vscode.WebviewPanel | undefined;
  const flowPanels = new Set<vscode.WebviewPanel>();
  let requestedPage = 'tasks', pageRequest = 0, applyingSettings = false;
  const reportText = (job: Job) => `# RelayCrew · ${job.id}\n\n${t('Status')}: ${stateName(job.status)}\n\n${t('Workspace')}: ${job.cwd}\n\n${t('Owner task')}:\n\n${job.prompt}\n\n${job.error ? t(job.error) : ''}\n\n`
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
    if (board && refreshBoard) { try { board.title = 'RelayCrew · ' + t('Assignment board'); board.webview.html = renderBoard(state.jobs, profiles(), state.quotas, backlog, messaging?.summary(language()) ?? t('No channels connected'), {
      queuePaused: state.queuePaused ?? false, autoSwitch: cfg().get('autoSwitch', false), resumeAfterQuota: cfg().get('resumeAfterQuota', false), resumeProviderLimited: cfg().get('resumeProviderLimited', false), allowEdits: cfg().get('allowEdits', false), routingMode: cfg().get('routingMode', 'selected'), timeoutMinutes: cfg().get('timeoutMinutes', 30), remoteTranscript: messaging?.chatTranscript(language()), language: language(),
      languagePreference: cfg().get('language','auto'), management: state.management, flow: state.flow, dailyPlan: daily, backupBeforeEdits: cfg().get('backupBeforeEdits',true),
      settings: Object.fromEntries(Object.entries(numericSettings).map(([key,rule])=>[key,cfg().get(key,rule.default)])), requestedPage, pageRequest, projectRoots:projectRoots(),isolateTasks:cfg().get('isolateTasks',false),openTasksInCodex:cfg().get('openTasksInCodex',false)
    }); } catch { /* configuration editor may be temporarily invalid */ } }
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
    const candidates = profiles().map(p => ({ ...p, ...(override?.model ? { model: override.model } : {}), ...(override?.effort ? { effort: override.effort } : {}) }));
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
      if(pin){const p=routeProfile(pin,profiles(),state.quotas,false,cfg().get('quotaThreshold',95));const override=step.coordinatorProfileId?undefined:job.overrides?.[step.role];return {...p,...(override?.model?{model:override.model}:{}),...(override?.effort?{effort:override.effort}:{})};}
      return choose(step.role, job.roles[step.role], true, job.overrides ?? {});
    }, save: async () => { await save(); await persistReports(); },
    run: async (profile, step, job, edits, signal) => {
      edits = edits && (!job.dailyItemId || daily.allowEdits);
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
      output.appendLine(`[${job.id}] ${step.role} → ${profile.id}, model=${profile.model || t("CLI default")}, effort=${profile.effort || t("default")}, edits=${edits}`);
      step.phase='cli';step.timeoutAt=new Date(Date.now()+cfg().get('timeoutMinutes',30)*60_000).toISOString();changed();
      let lastRefresh = 0;
      const result = await execute({ profile, prompt: step.request ?? stepPrompt(job, step), cwd: job.cwd, edits, signal, secretValues: secrets,
        timeoutMs: cfg().get('timeoutMinutes', 30) * 60_000,
        onEvent: event => {
          const timeline = job.timeline ??= [];
          const last = timeline.at(-1);
          if (event.kind === 'assistant' && last?.kind === 'stream' && last.from === `${step.role}:${profile.id}` && last.text.length < 6000) last.text += event.text;
          else timeline.push({ at: new Date().toISOString(), from: `${step.role}:${profile.id}`, to: 'orchestrator / observer', kind: event.kind === 'assistant' ? 'stream' : event.kind, text: event.text });
          if (timeline.length > 300) timeline.splice(0, timeline.length - 300);
          if (Date.now() - lastRefresh > 750) { lastRefresh = Date.now(); changed(); }
        },
        log: text => { output.append(text); void appendRunLog(job.id, text); }
      });
      return result;
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
  const command = (id: string, handler: (...args: any[]) => unknown) => context.subscriptions.push(vscode.commands.registerCommand(id, (...args) => guard(() => handler(...args))));
  command('aiTeam.language', async () => {
    const choice = await vscode.window.showQuickPick([
      { label: t('Follow VS Code'), value: 'auto' }, { label: 'English', value: 'en' }, { label: 'Tiếng Việt', value: 'vi' }
    ], { title: 'RelayCrew · ' + t('Language') });
    if (choice) await cfg().update('language', choice.value, vscode.ConfigurationTarget.Global);
  });
  const provider: vscode.TreeDataProvider<Node> = {
    onDidChangeTreeData: events.event,
    getTreeItem: item => item,
    getChildren: parent => {
      if (parent) return parent.children ?? [];
      let accountNodes: Node[];
      try { accountNodes = profiles().map(p => {
        const q = state.quotas[p.id];
        const item = node(p.label, `${p.model || t("CLI default")} · ${quotaLabel(p.id)}`, 'aiTeam.quota', p.id);
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
  const pickProfile = async () => {
    const choice = await vscode.window.showQuickPick(profiles().map(p => ({ label: p.label, description: `${p.id} · ${p.model || t("CLI default")} · ${quotaLabel(p.id)}`, id: p.id })), { title: t("Select model / account profile") });
    return choice?.id;
  };
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
  const dailyController = new DailyController({plan:daily,jobs:state.jobs,profiles,quotas:()=>state.quotas,management:()=>state.management!,isolation:()=>cfg().get('isolateTasks',false),openInCodex:()=>cfg().get('openTasksInCodex',false),language,timezone:()=>cfg().get('timezone',''),paused:()=>!!state.queuePaused,save,changed,cwd:pickCwd,start,pauseActive:id=>{
    const active=state.jobs.find(job=>job.status==='running'&&job.dailyItemId);
    if(active&&(!id||active.steps.some(step=>step.status==='running'&&step.profileId===id)||daily.items.some(item=>item.jobId===active.id&&item.profileId===id)))engine.pause();
  }});
  command('aiTeam.setup',()=>vscode.commands.executeCommand('aiTeam.board','setup'));
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
  command('aiTeam.dailyStart',()=>dailyController.startPlan());
  command('aiTeam.dailyStop',()=>dailyController.stopPlan());
  command('aiTeam.dailyTask',()=>dailyController.addItem());
  command('aiTeam.shortcuts',()=>vscode.commands.executeCommand('workbench.action.openGlobalKeybindings'));
  command('aiTeam.board', (page?:string) => {
    if(page&&['tasks','accounts','setup','daily','projects'].includes(page)){requestedPage=page;pageRequest++;}
    if (board) board.reveal();
    else {
      board = vscode.window.createWebviewPanel('aiTeam.board', 'RelayCrew · ' + t('Assignment board'), vscode.ViewColumn.One, { enableScripts: true });
      board.onDidDispose(() => { board = undefined; }, undefined, context.subscriptions);
      board.webview.onDidReceiveMessage(message => void guard(async () => {
        const actions: Record<string,string> = { language:'aiTeam.language', flow:'aiTeam.flow', connections:'aiTeam.connections', newTask:'aiTeam.newTask', backlog:'aiTeam.backlog', utilization:'aiTeam.utilization', account:'aiTeam.accountDetails', report:'aiTeam.report', reply:'aiTeam.reply', resume:'aiTeam.resume', backups:'aiTeam.backups', routing:'aiTeam.routing', switch:'aiTeam.switch', profiles:'aiTeam.profiles', editProfile:'aiTeam.profiles', quota:'aiTeam.quota', settings:'aiTeam.settings',shortcuts:'aiTeam.shortcuts',refreshQuota:'aiTeam.refreshQuota',dailyStart:'aiTeam.dailyStart',dailyStop:'aiTeam.dailyStop',dailyTask:'aiTeam.dailyTask',projectTask:'aiTeam.newTask',projectFolder:'aiTeam.projectFolder',projectCodex:'aiTeam.projectCodex' };
        if(message?.action==='setLanguage'&&['auto','en','vi'].includes(message.value)){await cfg().update('language',message.value,vscode.ConfigurationTarget.Global);return;}
        if(message?.action==='dailyAccount'){await dailyController.account(message.id,message.value);return;}
        if(message?.action==='dailyOption'){await dailyController.option(message.key,message.value);return;}
        if(message?.action==='assignAccount'&&typeof message.id==='string'){await vscode.commands.executeCommand('aiTeam.switch',undefined,message.id);return;}
        if(message?.action==='saveSettings'){
          const settings=validateSettingsPatch(message.settings); applyingSettings=true;
          try{for(const [key,value]of Object.entries(settings))await cfg().update(key,value,vscode.ConfigurationTarget.Global);}finally{applyingSettings=false;}
          changed(false);await board?.webview.postMessage({type:'settingsSaved',message:t('Settings applied.')});return;
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
  command('aiTeam.routing',async()=>{
    const choice=await vscode.window.showQuickPick([{value:'selected',label:t('Selected account')},{value:'roundRobin',label:t('Round robin')}],{title:t("Routing policy · next steps"),placeHolder:t("Round robin opts into the profiles/models/providers you select per role.")});if(!choice)return; const mode=choice.value;
    if(mode==='roundRobin'){
      const pools=cfg().get<Record<string,string[]>>('rotationPools',{});
      for(const role of state.flow??fullFlow){
        const selected=await vscode.window.showQuickPick(profiles().map(p=>({label:p.label,description:`${p.id} · ${p.model||t("CLI default")}`,id:p.id,picked:(pools[role]??[]).includes(p.id)})),{title:t('Allowed rotation pool · {0}',roleName(role)),canPickMany:true});
        if(!selected)return;if(!selected.length)throw new Error(`Select at least one profile for ${role}.`);pools[role]=selected.map(p=>p.id);
      }
      await cfg().update('rotationPools',pools,vscode.ConfigurationTarget.Global);
    }
    await cfg().update('routingMode',mode,vscode.ConfigurationTarget.Global);changed();
  });
  command('aiTeam.backups', async () => {
    const snapshots=await listBackups(join(storage,'source-backups'));
    const selected=await vscode.window.showQuickPick([{label:t("State / chat backup locations"),path:''},...snapshots.map(b=>({label:`${b.manifest.createdAt} · ${roleName(b.manifest.role)}`,description:`${t('{0} files',b.manifest.files.length)} · ${(b.manifest.totalBytes/1024/1024).toFixed(1)} MB · ${b.manifest.jobId.slice(0,8)}`,path:join(b.path,'manifest.json')}))],{title:t("Local backups (snapshots do not overwrite your working tree)")});
    if (!selected) return;
    if(selected.path)await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(selected.path));
    else await vscode.window.showTextDocument(await vscode.workspace.openTextDocument({language:'markdown',content:`# ${t('Local persistence')}\n\n${t('State')}: ${statePath}\n\n${t('State backups (last 50 changes)')}: ${stateStore.backups}\n\n${t('Messaging state')}: ${join(storage,'messaging.json')}\n\n${t('Messaging backups')}: ${join(storage,'messaging.json.backups')}\n\n${t('Source snapshots')}: ${join(storage,'source-backups')}\n\n${t('Source snapshots include Git tracked and non-ignored files plus explicit extra paths. Ignored databases, Git history, symlinks and submodules need separate backups. Snapshots are kept; storage caps block editable work. Compare files before restoring manually.')}`}));
  });
  command('aiTeam.accountDetails', async (id?: string) => {
    const selected = id ?? await pickProfile(), p = profiles().find(p => p.id === selected); if (!p) return;
    const q = state.quotas[p.id];
    const text = `# ${p.label}\n\n${t('Profile ID')}: ${p.id}\n\n${t('Provider')}: ${p.provider}\n\n${t('Model')}: ${p.model || t('CLI default')} · ${t('Reasoning')}: ${p.effort || t('default')}\n\n${t('Executable')}: ${p.executable}\n\n${t('This is a configured CLI profile; account email/identity is not automatically verified.')}\n\n${t('Quota')}: ${quotaLabel(p.id)}\n\n${t('Tokens remaining / total')}: ${q?.remainingTokens ?? t('unknown')} / ${q?.limitTokens ?? t('unknown')}\n\n${t('Observed')}: ${q?.observedAt ?? t('unknown')}\n\n${t('Reset')}: ${q?.resetsAt ?? t('unknown')}\n\n${t('Assigned roles')}: ${roles.filter(r => state.roles[r] === p.id).map(roleName).join(', ') || t('none')}\n\n${t('Use Update Quota for a manual snapshot or Configure Profiles for a quotaFile. Token counts are not inferred from percentages.')}`;
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument({ language: 'markdown', content: text }));
  });
  command('aiTeam.accountMenu',async()=>{
    const picked=await vscode.window.showQuickPick(profiles().map(p=>({label:p.label,description:`${p.id} · ${quotaLabel(p.id)}`,detail:`${p.provider} · ${p.model||t('CLI default')}`,id:p.id})),{title:'RelayCrew · '+t('Accounts & limits')});if(!picked)return;
    const action=await vscode.window.showQuickPick([{id:'inspect',label:t('Inspect account and quota')},{id:'switch',label:t('Switch a task to this account')},{id:'refresh',label:t('Refresh quota sources')},{id:'quota',label:t('Update manual quota')}],{title:picked.label});
    if(action?.id==='inspect')await vscode.commands.executeCommand('aiTeam.accountDetails',picked.id);
    if(action?.id==='switch')await vscode.commands.executeCommand('aiTeam.switch',undefined,picked.id);
    if(action?.id==='quota')await vscode.commands.executeCommand('aiTeam.quota',picked.id);
    if(action?.id==='refresh')await vscode.commands.executeCommand('aiTeam.refreshQuota');
  });
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
    const selected = id ?? (await vscode.window.showQuickPick(state.jobs.filter(j => j.status === 'waiting_quota').map(j => ({label:j.prompt.slice(0,80),id:j.id}))))?.id;
    const job = state.jobs.find(j => j.id === selected); if (!job) return;
    resume(job, false); await save(); changed(); start();
  });
  command('aiTeam.flow', () => {
    const panel = vscode.window.createWebviewPanel('aiTeam.flow', 'RelayCrew · ' + t('Setup flow'), vscode.ViewColumn.One, { enableScripts: true });
    flowPanels.add(panel);
    panel.onDidDispose(() => flowPanels.delete(panel), undefined, context.subscriptions);
    panel.webview.html = flowEditor(profiles(), state.flow ?? fullFlow, state.roles, state.overrides ?? {}, language(),state.management);
    panel.webview.onDidReceiveMessage(message => void guard(async () => {
      if (message?.type === 'language') { await vscode.commands.executeCommand('aiTeam.language'); return; }
      if (message?.type !== 'saveFlow') return;
      const flow = validateFlow(message.flow), ids = new Set(profiles().map(p => p.id));
      const assignments = { ...state.roles }, overrides: RoleOverrides = {};
      for (const role of roles) {
        if (typeof message.roles?.[role] !== 'string' || !ids.has(message.roles[role])) throw new Error('Choose an existing profile for every node.');
        assignments[role] = message.roles[role];
        const model = message.overrides?.[role]?.model, effort = message.overrides?.[role]?.effort;
        if (typeof model !== 'string' || typeof effort !== 'string' || model.length > 200 || effort.length > 40 || /[\r\n\0]/.test(model + effort)) throw new Error('Invalid model / reasoning value.');
        overrides[role] = { model: model.trim() || undefined, effort: effort.trim() || undefined };
      }
      const management=validateManagement(message.management??{primaryProfileId:assignments.lead,coordinatorIds:[]},profiles());
      if(management.primaryProfileId!==assignments.lead)throw new Error('Primary manager must match the Lead account.');
      state.flow = flow; state.roles = assignments; state.overrides = overrides; state.management=management;
      await save(); changed(); await panel.webview.postMessage({ type: 'saved', message: t("Saved. New tasks use this flow; existing tasks and schedules keep their configuration.") });
    }), undefined, context.subscriptions);
  });
  command('aiTeam.connections', async () => { if (messaging) await connectionWizard(messaging, language()); changed(); });
  command('aiTeam.reply', async (id?: string) => {
    const chosen = id ?? (await vscode.window.showQuickPick(state.jobs.filter(j => j.status === 'waiting_owner').map(j => ({ label: j.prompt.slice(0, 80), description: j.ownerQuestion, id: j.id }))))?.id;
    const job = state.jobs.find(j => j.id === chosen); if (!job) return;
    const answer = await vscode.window.showInputBox({ title: t("Reply to agent"), prompt: job.ownerQuestion, ignoreFocusOut: true });
    if (!answer?.trim()) return;
    answerOwner(job, answer); await save(); changed(); start();
  });
  command('aiTeam.backlog', async () => {
    const prompt = await vscode.window.showInputBox({ title: t("Useful backlog task"), prompt: t("Describe a real improvement and acceptance criteria. It will run once when utilization is enabled.") });
    if (!prompt?.trim()) return;
    const cwd = await pickCwd(); if (!cwd) return;
    backlog.items.push({ id: randomUUID(), prompt: prompt.trim(), cwd }); await save(); changed();
  });
  command('aiTeam.utilization', async () => {
    if (backlog.enabled) { backlog.enabled = false; await save(); changed(); return; }
    if (!backlog.items.some(i => !i.jobId)) throw new Error('Add useful backlog items first.');
    const runs = await vscode.window.showInputBox({ title: t("Maximum backlog runs this session"), value: '3', validateInput: s => Number.isInteger(Number(s)) && Number(s) >= 1 && Number(s) <= 20 ? undefined : t("Enter 1–20.") });
    if (!runs) return;
    const minutes = await vscode.window.showInputBox({ title: t("Stop dispatching backlog after (minutes)"), value: '60', validateInput: s => Number.isInteger(Number(s)) && Number(s) >= 1 && Number(s) <= 180 ? undefined : t("Enter 1–180.") });
    if (!minutes) return;
    validateRoles(); backlog.enabled = true; backlog.remaining = Number(runs); backlog.until = Date.now() + Number(minutes) * 60_000;
    backlog.sessionJobs = [];
    await save(); changed();
    void vscode.window.showInformationMessage(t("Useful backlog mode enabled. Requires fresh quota below threshold for all roles. Each item runs once; no dummy token-burning calls."));
  });
  command('aiTeam.newTask', async (project?:string) => {
    const selectedProject = project === undefined ? undefined : await projectPath(project);
    if(selectedProject&&!projectRoots().some(root=>root.path===selectedProject))throw new Error(t('Open this folder in your VS Code workspace before creating a task.'));
    validateRoles();
    const prompt = await vscode.window.showInputBox({ title: t("Task for your AI team"), prompt: t("Describe the result and acceptance criteria. CLI permissions and Allow Edits apply.") });
    if (!prompt?.trim()) return;
    const cwd = selectedProject ?? await pickCwd(); if (!cwd) return;
    state.jobs.push(createJob(prompt.trim(), cwd, state.roles, state.flow, state.overrides,state.management));
    await save(); changed(); start();
  });
  command('aiTeam.switch', async (taskId?:string,preferredProfile?:string) => {
    const targets = [{ label: t("Future tasks"), id: '' }, ...state.jobs.filter(j => ['queued','waiting_quota','waiting_owner','running'].includes(j.status)).map(j => ({ label: `${stateName(j.status)}: ${j.prompt.slice(0, 70)}`, id: j.id }))];
    const target = taskId?targets.find(t=>t.id===taskId):await vscode.window.showQuickPick(targets, { title: t("Switch account · running tasks are paused before switching") });
    if (!target) return;
    const assignments = target.id ? state.jobs.find(j => j.id === target.id)!.roles : state.roles;
    const job=target.id?state.jobs.find(j=>j.id===target.id):undefined;
    const availableRoles=job?(job.flow??fullFlow).filter(r=>!job.steps.some(s=>s.role===r)||job.steps.some(s=>s.role===r&&s.status!=='done')):state.flow??fullFlow;
    const choices=availableRoles.map(r=>({label:r==='lead'?t('Primary manager'):roleName(r),role:r,coordinatorIndex:-1,description:assignments[r]}));
    if(job)job.steps.forEach((step,index)=>{if(step.coordinatorProfileId&&step.status!=='done')choices.push({label:t('Coordinator'),role:'lead',coordinatorIndex:index,description:step.coordinatorProfileId});});
    const role = await vscode.window.showQuickPick(choices, { title: t("Select remaining role to change") });
    if (!role) return;
    const id = preferredProfile??await pickProfile(); if (!id) return;
    if(!profiles().some(p=>p.id===id))throw new Error('Choose an existing account profile.');
    if(job){
      if(job.status==='running') {state.queuePaused=true;engine.pause();await save();await draining;}
      if(role.coordinatorIndex>=0)assignCoordinatorProfile(job,role.coordinatorIndex,id,profiles());else assignTaskProfile(job,role.role,id,profiles());
    }else {assignments[role.role] = id;if(role.role==='lead')state.management={primaryProfileId:id,coordinatorIds:state.management!.coordinatorIds.filter(p=>p!==id)};}
    await save(); changed();
    void vscode.window.showInformationMessage(`RelayCrew: ${role.label} → ${id}. ${job?t("Pinned for this task; queue remains paused if it was running."):t("Applies to future tasks; rotation policy still applies.")}`);
  });
  command('aiTeam.profiles', (id?:string) => editProfiles(language(),new Set([...Object.values(state.roles),...state.management!.coordinatorIds,...state.jobs.filter(job=>['running','queued','waiting_owner','waiting_quota'].includes(job.status)).flatMap(job=>[...Object.values(job.roles),...(job.management?.coordinatorIds??[])])]),id));
  command('aiTeam.settings', () => vscode.commands.executeCommand('workbench.action.openSettings', '@ext:local-ai-team.ai-team-workbench'));
  command('aiTeam.logs', () => output.show());
  command('aiTeam.secret', async (selected?:string) => {
    const id = selected??await pickProfile(); if (!id) return;
    const p = profiles().find(x => x.id === id)!;
    const key = await vscode.window.showQuickPick(p.secretEnv ?? [], { title: t("Environment variable (configure secretEnv first)") });
    if (!key) return;
    const value = await vscode.window.showInputBox({ title: t('Secret for {0}: {1}', id, key), password: true, ignoreFocusOut: true });
    if (!value) return;
    await context.secrets.store(`aiTeam:${id}:${key}`, value);
    void vscode.window.showInformationMessage('RelayCrew: '+t('Secret stored in VS Code SecretStorage.'));
  });
  command('aiTeam.quota', async (selected?: string) => {
    const id = selected ?? await pickProfile(); if (!id) return;
    const value = await vscode.window.showInputBox({ title: t('Quota used % · {0} (manual snapshot)', id), validateInput: s => s.trim() && Number.isFinite(Number(s)) && Number(s) >= 0 && Number(s) <= 100 ? undefined : t("Enter 0–100.") });
    if (value === undefined) return;
    state.quotas[id] = parseQuota({ usedPercent: Number(value), observedAt: new Date().toISOString(), source: 'manual' });
    await save(); changed();
  });
  command('aiTeam.report', async (id?: string) => {
    const chosen = id ?? (await vscode.window.showQuickPick(state.jobs.slice().reverse().map(j => ({ label: j.prompt.slice(0, 90), description: stateName(j.status), id: j.id }))))?.id;
    const job = state.jobs.find(j => j.id === chosen); if (!job) return;
    await persistReports();
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(join(storage, 'reports', `${job.id}.md`)));
  });
  command('aiTeam.cancel', async () => {
    const choice = await vscode.window.showQuickPick(state.jobs.filter(j => ['queued', 'running', 'waiting_owner', 'waiting_quota'].includes(j.status)).map(j => ({ label: j.prompt.slice(0, 90), description: stateName(j.status), id: j.id })), { title: t("Stop task (existing edits remain for review)") });
    if (!choice) return;
    engine.cancel(choice.id); await save();
  });
  command('aiTeam.schedule', async () => {
    const kindChoice = await vscode.window.showQuickPick([{id:'reminder' as const,label:t('Reminder')},{id:'task' as const,label:t('Automatic task')}], { title: t("Reminder or automatic team run") });
    if (!kindChoice) return; const kind=kindChoice.id;
    if (kind === 'task') validateRoles();
    const prompt = await vscode.window.showInputBox({ title: kind === 'task' ? t("Task to run automatically") : t("Reminder text") });
    if (!prompt?.trim()) return;
    const modeChoice = await vscode.window.showQuickPick([{id:'once',label:t('Once')},{id:'cron',label:t('Recurring cron')}], { title: t("Schedule frequency") });
    if (!modeChoice) return; const mode=modeChoice.id;
    const timezone = resolveTimezone(cfg().get('timezone', ''));
    let cron: string | undefined, nextAt: string;
    if (mode === 'once') {
      const input = await vscode.window.showInputBox({ title: t("Date/time with explicit UTC offset"), placeHolder: new Date(Date.now()+86400000).toISOString(), validateInput: s => /(?:Z|[+-]\d\d:\d\d)$/.test(s) && Date.parse(s) > Date.now() ? undefined : t("Enter a future ISO date/time including Z or +07:00.") });
      if (!input) return;
      nextAt = new Date(input).toISOString();
    } else {
      cron = await vscode.window.showInputBox({ title: t('Cron in {0}',timezone), placeHolder: t("0 9 * * *  (daily at 09:00)"), validateInput: s => { try { nextCron(s, timezone); return undefined; } catch { return t("Invalid cron expression or timezone."); } } });
      if (!cron) return;
      nextAt = nextCron(cron, timezone);
    }
    const cwd = await pickCwd(); if (!cwd) return;
    state.schedules.push({ id: randomUUID(), title: prompt.slice(0, 80), kind: kind as 'reminder' | 'task', prompt: prompt.trim(), cwd, roles: { ...state.roles }, flow: [...state.flow!], overrides: structuredClone(state.overrides),management:structuredClone(state.management), cron, nextAt, timezone, enabled: true });
    await save(); changed();
    void vscode.window.showInformationMessage('RelayCrew: '+t('Saved for {0} ({1}). VS Code must stay open. Missed automatic runs are skipped after 60 seconds.',new Date(nextAt).toLocaleString(language()==='vi'?'vi-VN':'en-GB', { timeZone: timezone }),timezone));
  });
  command('aiTeam.pauseSchedule', async (id?: string) => {
    const selected = id ?? (await vscode.window.showQuickPick(state.schedules.map(s => ({ label: s.title, id: s.id }))))?.id;
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
      return execute({ profile, cwd: connection.cwd, edits: false, signal, timeoutMs: Math.min(120_000, cfg().get('timeoutMinutes', 30) * 60_000), secretValues,
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
            const job = createJob(s.prompt, s.cwd, s.roles, s.flow, s.overrides,s.management); job.scheduleOccurrence = claim.occurrence; state.jobs.push(job);
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
    if (e.affectsConfiguration('aiTeam.language')) for (const panel of flowPanels) {
      panel.title = 'RelayCrew · ' + t('Setup flow');
      panel.webview.html = flowEditor(profiles(), state.flow ?? fullFlow, state.roles, state.overrides ?? {}, language(),state.management);
    }
  }));
  shutdown = async () => {
    closing = true; clearInterval(timer); engine.stop();
    await messaging?.stop(); await tickInFlight; await draining; await writeQueue; await logQueue; await release();
    shutdown = undefined;
  };
  output.appendLine(`RelayCrew ready. State and reports: ${storage}`);
  await save(); changed(); await safeTick();
}

export async function deactivate(): Promise<void> { await shutdown?.(); }
