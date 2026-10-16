import * as vscode from 'vscode';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { answerOwner, assignTaskProfile, claimSchedule, fresh, fullFlow, nextCron, parseQuota, QuotaWait, resolveTimezone, rotateProfile, routeProfile, validateFlow, validateProfiles } from '../core/domain';
import type { Backlog, Job, Profile, Quota, Role, RoleOverrides, Schedule } from '../core/domain';
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

interface State { version: 1; roles: Record<Role, string>; jobs: Job[]; schedules: Schedule[]; quotas: Record<string, Quota>; backlog?: Backlog; rotationCursor?: Partial<Record<Role, number>>; quotaAlerted?: Record<string, boolean>; flow?: Role[]; overrides?: RoleOverrides; queuePaused?: boolean }
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
    void vscode.window.showWarningMessage('RelayCrew: this workspace already has a runner in another window.');
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
  const stateStore = new JsonStore<State>(statePath,(v:any):v is State=>!!v&&v.version===1&&Array.isArray(v.jobs)&&Array.isArray(v.schedules)&&!!v.roles&&!!v.quotas,path=>{stateRecovered=true;void vscode.window.showWarningMessage(`RelayCrew: state recovered from backup ${path}. Queue paused; inspect the board before resuming interrupted work.`);});
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
  if (backlog.until <= Date.now() || backlog.remaining <= 0) backlog.enabled = false;
  state.rotationCursor ??= {}; state.quotaAlerted ??= {};
  state.flow = validateFlow(state.flow ?? fullFlow); state.overrides ??= {};
  state.queuePaused ??= false;
  if(stateRecovered){state.queuePaused=true;backlog.enabled=false;}
  let writeQueue = Promise.resolve();
  const save = () => {
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
  const eventKey = (j: Job) => `${j.id}:${j.status}:${j.ownerReplies?.length ?? 0}:${j.limitDetectedAt ?? ''}`;
  const announced = new Set(state.jobs.filter(j => !['running', 'queued'].includes(j.status)).map(eventKey));
  let messaging: MessagingHub | undefined;
  let board: vscode.WebviewPanel | undefined;
  const reportText = (job: Job) => `# RelayCrew · ${job.id}\n\nStatus: ${job.status}\n\nWorkspace: ${job.cwd}\n\nOwner task:\n\n${job.prompt}\n\n${job.error ?? ''}\n\n`
    + (job.ownerQuestion ? `## Question for owner\n\n${job.ownerQuestion}\n\n` : '')
    + (job.ownerReplies?.length ? `## Owner replies\n\n${job.ownerReplies.join('\n\n')}\n\n` : '')
    + job.steps.map(s => `## ${s.title} · ${s.role}\n\nProfile: ${s.profileId ?? job.roles[s.role]} · Model: ${s.model ?? 'CLI default'} / ${s.effort ?? 'default'} · ${s.status}\n\nBackup: ${s.backupPath ?? 'not applicable'}\n\n${s.error ?? ''}\n\n### Input\n\n${s.request ?? s.prompt}\n\n### Response\n\n${s.response ?? '(No response yet)'}\n`).join('\n')
    + (job.audit ? '\n## Issue drafts\n\n' + job.audit.issues.map(i => `### ${i.severity}: ${i.title}\n\n${i.body}\n`).join('\n') : '');
  const persistReports = async () => {
    await mkdir(join(storage, 'reports'), { recursive: true });
    for (const job of state.jobs) await writeFile(join(storage, 'reports', `${job.id}.md`), reportText(job), 'utf8');
  };
  const quotaLabel = (id: string) => quotaSummary(state.quotas[id]);
  const changed = () => {
    events.fire(undefined);
    try {
      const active = state.jobs.find(j => j.status === 'running');
      status.text = `$(hubot) RelayCrew · ${state.queuePaused ? 'PAUSED' : active ? active.steps.find(s => s.status === 'running')?.role ?? 'running' : 'idle'}`;
      status.tooltip = 'Open assignment board · pause, observe or control tasks.';
      const summary=usageStatus(profiles(),state.jobs,state.quotas,cfg().get('quotaThreshold',95));
      usage.text=summary.text;usage.tooltip=summary.tooltip;usage.backgroundColor=summary.warning?new vscode.ThemeColor('statusBarItem.warningBackground'):undefined;usage.show();
    } catch { status.text = '$(warning) RelayCrew: fix profiles';usage.hide(); }
    status.show();
    if (board) { try { board.webview.html = renderBoard(state.jobs, profiles(), state.quotas, backlog, messaging?.summary() ?? 'No channels connected', {
      queuePaused: state.queuePaused ?? false, autoSwitch: cfg().get('autoSwitch', false), resumeAfterQuota: cfg().get('resumeAfterQuota', false), resumeProviderLimited: cfg().get('resumeProviderLimited', false), allowEdits: cfg().get('allowEdits', false), routingMode: cfg().get('routingMode', 'selected'), timeoutMinutes: cfg().get('timeoutMinutes', 30), remoteTranscript: messaging?.chatTranscript()
    }); } catch { /* configuration editor may be temporarily invalid */ } }
    for (const [id, q] of Object.entries(state.quotas)) if (fresh(q)) {
      const exhausted = q.usedPercent >= cfg().get('quotaThreshold', 95);
      if (exhausted && !state.quotaAlerted![id]) {
        state.quotaAlerted![id] = true;
        const text = `Quota alert · ${id}: ${q.usedPercent}% used. Reset: ${q.resetsAt ?? 'unknown'}. Source: ${q.source}.`;
        void vscode.window.showWarningMessage(`RelayCrew: ${text}`);
        void messaging?.broadcast(`quota:${id}:${q.observedAt}`, text).catch(() => output.appendLine('Could not queue quota notification.'));
        void save().catch(() => output.appendLine('Could not save quota alert state.'));
      } else if (!exhausted) state.quotaAlerted![id] = false;
    }
    for (const j of state.jobs) if (!['queued', 'running'].includes(j.status) && !announced.has(eventKey(j))) {
      announced.add(eventKey(j));
      const message = `RelayCrew: ${j.status} · ${j.prompt.slice(0, 70)}`;
      const notification = ['completed', 'cancelled'].includes(j.status) ? vscode.window.showInformationMessage : vscode.window.showWarningMessage;
      void notification(message, 'Report').then(choice => { if (choice) void vscode.commands.executeCommand('aiTeam.report', j.id); });
      const remoteText = `RelayCrew · task ${j.id}\nStatus: ${j.status}`
        + (j.ownerQuestion ? `\n${j.ownerQuestion}\nReply: /reply ${j.id.slice(0, 8)} your answer` : '')
        + (j.status === 'waiting_quota' ? `\n${j.error}\nAuto-resume: ${cfg().get('resumeAfterQuota', false) ? 'on; requires fresh available quota' : 'off'}` : '')
        + (j.status === 'completed' || j.status === 'needs_attention' ? `\nLead: ${j.steps.find(s => s.role === 'lead')?.response?.slice(0, 1500) ?? 'See local board.'}` : '');
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
    settings: () => ({ autoSwitch: cfg().get('autoSwitch', false), threshold: cfg().get('quotaThreshold', 95), maxTasks: cfg().get('maxChildTasks', 4), edits: cfg().get('allowEdits', false) }),
    changed, canRun: () => !state.queuePaused, chooseProfile: (job, step) => {
      if(job.profilePins?.[step.role])return routeProfile(job.profilePins[step.role]!,profiles(),state.quotas,false,cfg().get('quotaThreshold',95));
      return choose(step.role, job.roles[step.role], true, job.overrides ?? {});
    }, save: async () => { await save(); await persistReports(); },
    run: async (profile, step, job, edits, signal) => {
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
      output.appendLine(`[${job.id}] ${step.role} → ${profile.id}, model=${profile.model || 'CLI default'}, effort=${profile.effort || 'default'}, edits=${edits}`);
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
    try { return await action(); } catch (e) { void vscode.window.showErrorMessage(`RelayCrew: ${e instanceof Error ? e.message : String(e)}`); }
  };
  const command = (id: string, handler: (...args: any[]) => unknown) => context.subscriptions.push(vscode.commands.registerCommand(id, (...args) => guard(() => handler(...args))));
  const provider: vscode.TreeDataProvider<Node> = {
    onDidChangeTreeData: events.event,
    getTreeItem: item => item,
    getChildren: parent => {
      if (parent) return parent.children ?? [];
      let accountNodes: Node[];
      try { accountNodes = profiles().map(p => {
        const q = state.quotas[p.id];
        const item = node(p.label, `${p.model || 'CLI default'} · ${quotaLabel(p.id)}`, 'aiTeam.quota', p.id);
        item.command = { command: 'aiTeam.accountDetails', title: 'Account details', arguments: [p.id] };
        item.tooltip = `${p.id}\nExecutable: ${p.executable}\nAssigned roles: ${roles.filter(r => state.roles[r] === p.id).join(', ') || 'none'}\nObserved: ${q?.observedAt ?? 'unknown'}\nResets: ${q?.resetsAt ?? 'unknown'}`;
        return item;
      }); } catch (e) { accountNodes = [node(String(e), '', 'aiTeam.profiles')]; }
      return [
        node('New task', 'Builder → Audit → Repairs → Lead', 'aiTeam.newTask'),
        node('Assignment board / tóm tắt', undefined, 'aiTeam.board'),
        node(state.queuePaused ? 'Tiếp tục hàng đợi' : 'Tạm dừng ngay', undefined, 'aiTeam.pauseQueue'),
        node('Team flow · setup Dev / Audit / Lead', state.flow?.join(' → '), 'aiTeam.flow'),
        node('Backups / dữ liệu đã lưu', undefined, 'aiTeam.backups'),
        node('Messaging · Telegram / Zalo', messaging?.summary().split('\n')[0], 'aiTeam.connections'),
        node('Reply to agent', undefined, 'aiTeam.reply'),
        node('Backlog / tận dụng quota', backlog.enabled ? `${backlog.remaining} runs left` : 'off', 'aiTeam.utilization'),
        node('Add backlog item', undefined, 'aiTeam.backlog'),
        node('Roles / switch account', undefined, 'aiTeam.switch'),
        node('Schedule / remind me', undefined, 'aiTeam.schedule'),
        node('Stop queued / running task', undefined, 'aiTeam.cancel'),
        node('Configure profiles', undefined, 'aiTeam.profiles'),
        node('Accounts & quotas', undefined, undefined, undefined, accountNodes),
        node('Tasks', undefined, undefined, undefined, state.jobs.slice().reverse().map(j => node(j.prompt.slice(0, 80), j.status, undefined, undefined, [
          node('Open report', j.id.slice(0, 8), 'aiTeam.report', j.id),
          ...j.steps.map(s => node(`${s.role}: ${s.title}`, `${s.status} · ${s.profileId ?? j.roles[s.role]}`, 'aiTeam.report', j.id)),
          ...(j.ownerQuestion ? [node(j.ownerQuestion.slice(0, 100), 'waiting for you', 'aiTeam.reply', j.id)] : [])
        ]))),
        node('Schedules', undefined, undefined, undefined, state.schedules.map(s => node(s.title, `${s.enabled ? s.nextAt : 'paused'} · ${s.timezone}`, 'aiTeam.pauseSchedule', s.id)))
      ];
    }
  };
  context.subscriptions.push(output, events, status, usage, vscode.window.registerTreeDataProvider('aiTeam.dashboard', provider));
  const pickProfile = async () => {
    const choice = await vscode.window.showQuickPick(profiles().map(p => ({ label: p.label, description: `${p.id} · ${p.model || 'CLI default'} · ${quotaLabel(p.id)}`, id: p.id })), { title: 'Select model / account profile' });
    return choice?.id;
  };
  const pickCwd = async () => roots.length === 1 ? roots[0].uri.fsPath : (await vscode.window.showWorkspaceFolderPick())?.uri.fsPath;
  const validateRoles = () => {
    const ids = new Set(profiles().map(p => p.id));
    for (const r of state.flow ?? fullFlow) if (!ids.has(state.roles[r])) throw new Error(`Assign a profile for ${r}.`);
  };
  let draining: Promise<unknown> | undefined;
  let closing = false;
  const start = () => {
    if (draining || closing) return;
    draining = guard(() => engine.drain()).finally(() => { draining = undefined; });
  };
  command('aiTeam.board', () => {
    if (board) board.reveal();
    else {
      board = vscode.window.createWebviewPanel('aiTeam.board', 'RelayCrew · Bảng phân công', vscode.ViewColumn.One, { enableScripts: true });
      board.onDidDispose(() => { board = undefined; }, undefined, context.subscriptions);
      board.webview.onDidReceiveMessage(message => void guard(async () => {
        const actions: Record<string,string> = { flow:'aiTeam.flow', connections:'aiTeam.connections', newTask:'aiTeam.newTask', backlog:'aiTeam.backlog', utilization:'aiTeam.utilization', account:'aiTeam.accountDetails', report:'aiTeam.report', reply:'aiTeam.reply', resume:'aiTeam.resume', backups:'aiTeam.backups', routing:'aiTeam.routing', switch:'aiTeam.switch' };
        if (message?.action === 'toggle') {
          if (!['autoSwitch','resumeAfterQuota','resumeProviderLimited','allowEdits'].includes(message.key) || typeof message.value !== 'boolean') return;
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
    const mode=await vscode.window.showQuickPick(['selected','roundRobin'],{title:'Routing policy · next steps',placeHolder:'Round robin opts into the profiles/models/providers you select per role.'});if(!mode)return;
    if(mode==='roundRobin'){
      const pools=cfg().get<Record<string,string[]>>('rotationPools',{});
      for(const role of state.flow??fullFlow){
        const selected=await vscode.window.showQuickPick(profiles().map(p=>({label:p.label,description:`${p.id} · ${p.model||'CLI default'}`,id:p.id,picked:(pools[role]??[]).includes(p.id)})),{title:`Allowed rotation pool · ${role}`,canPickMany:true});
        if(!selected)return;if(!selected.length)throw new Error(`Select at least one profile for ${role}.`);pools[role]=selected.map(p=>p.id);
      }
      await cfg().update('rotationPools',pools,vscode.ConfigurationTarget.Global);
    }
    await cfg().update('routingMode',mode,vscode.ConfigurationTarget.Global);changed();
  });
  command('aiTeam.backups', async () => {
    const snapshots=await listBackups(join(storage,'source-backups'));
    const selected=await vscode.window.showQuickPick([{label:'State / chat backup locations',path:''},...snapshots.map(b=>({label:`${b.manifest.createdAt} · ${b.manifest.role}`,description:`${b.manifest.files.length} files · ${(b.manifest.totalBytes/1024/1024).toFixed(1)} MB · ${b.manifest.jobId.slice(0,8)}`,path:join(b.path,'manifest.json')}))],{title:'Local backups (snapshots do not overwrite your working tree)'});
    if (!selected) return;
    if(selected.path)await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(selected.path));
    else await vscode.window.showTextDocument(await vscode.workspace.openTextDocument({language:'markdown',content:`# Local persistence\n\nState: ${statePath}\n\nState backups (last 50 changes): ${stateStore.backups}\n\nMessaging state: ${join(storage,'messaging.json')}\n\nMessaging backups: ${join(storage,'messaging.json.backups')}\n\nSource snapshots: ${join(storage,'source-backups')}\n\nSource snapshots contain Git tracked + non-ignored files and explicit extra paths. Ignored runtime databases, .git history, symlinks and submodules need separate backups. Source snapshots are not automatically deleted. Snapshot/storage caps block editable CLI work rather than silently skipping backup.\n\nCompare a snapshot file with the working copy before restoring manually. No automatic restore overwrites source files.`}));
  });
  command('aiTeam.accountDetails', async (id?: string) => {
    const selected = id ?? await pickProfile(), p = profiles().find(p => p.id === selected); if (!p) return;
    const q = state.quotas[p.id];
    const text = `# ${p.label}\n\nProfile ID: ${p.id}\n\nProvider: ${p.provider}\n\nModel: ${p.model || 'CLI default'} · Reasoning: ${p.effort || 'default'}\n\nExecutable: ${p.executable}\n\nThis is a configured CLI account profile; account email/identity is not automatically verified.\n\nQuota: ${quotaLabel(p.id)}\n\nTokens remaining / limit: ${q?.remainingTokens ?? 'unknown'} / ${q?.limitTokens ?? 'unknown'}\n\nObserved: ${q?.observedAt ?? 'unknown'}\n\nReset: ${q?.resetsAt ?? 'unknown'}\n\nAssigned roles: ${roles.filter(r => state.roles[r] === p.id).join(', ') || 'none'}\n\nUse RelayCrew: Update Quota to enter a snapshot, or Configure Profiles to connect a quotaFile. Tokens are not inferred from percentages.`;
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument({ language: 'markdown', content: text }));
  });
  command('aiTeam.accountMenu',async()=>{
    const picked=await vscode.window.showQuickPick(profiles().map(p=>({label:p.label,description:`${p.id} · ${quotaLabel(p.id)}`,detail:`${p.provider} · ${p.model||'CLI default'}`,id:p.id})),{title:'RelayCrew · Accounts & limits'});if(!picked)return;
    const action=await vscode.window.showQuickPick(['Inspect account and quota','Switch a task to this account','Refresh quota sources','Update manual quota'],{title:picked.label});
    if(action==='Inspect account and quota')await vscode.commands.executeCommand('aiTeam.accountDetails',picked.id);
    if(action==='Switch a task to this account')await vscode.commands.executeCommand('aiTeam.switch',undefined,picked.id);
    if(action==='Update manual quota')await vscode.commands.executeCommand('aiTeam.quota',picked.id);
    if(action==='Refresh quota sources')await vscode.commands.executeCommand('aiTeam.refreshQuota');
  });
  command('aiTeam.refreshQuota',async()=>{await quotas.refresh(profiles(),state.quotas);quotaReadAt=Date.now();await save();changed();});
  const resume = (job: Job, automatic: boolean) => {
    if (job.status !== 'waiting_quota') throw new Error('Task is not waiting for quota.');
    const step = job.steps.find(s => s.status !== 'done'); if (!step) throw new Error('No paused step.');
    if (automatic && job.limitDetectedAt && !cfg().get('resumeProviderLimited', false)) return false;
    const profile = job.profilePins?.[step.role]?routeProfile(job.profilePins[step.role]!,profiles(),state.quotas,false,cfg().get('quotaThreshold',95)):choose(step.role, job.roles[step.role], false, job.overrides ?? {}), q = state.quotas[profile.id];
    if (!fresh(q) || q.usedPercent >= cfg().get('quotaThreshold', 95)
      || (job.limitDetectedAt && profile.id === job.blockedProfileId && Date.parse(q.observedAt) <= Date.parse(job.limitDetectedAt))) throw new QuotaWait('A new available quota snapshot is required before resuming this account.');
    job.status = 'queued'; job.error = undefined; return true;
  };
  command('aiTeam.resume', async (id?: string) => {
    const selected = id ?? (await vscode.window.showQuickPick(state.jobs.filter(j => j.status === 'waiting_quota').map(j => ({label:j.prompt.slice(0,80),id:j.id}))))?.id;
    const job = state.jobs.find(j => j.id === selected); if (!job) return;
    resume(job, false); await save(); changed(); start();
  });
  command('aiTeam.flow', () => {
    const panel = vscode.window.createWebviewPanel('aiTeam.flow', 'RelayCrew · Setup flow', vscode.ViewColumn.One, { enableScripts: true });
    panel.webview.html = flowEditor(profiles(), state.flow ?? fullFlow, state.roles, state.overrides ?? {});
    panel.webview.onDidReceiveMessage(message => void guard(async () => {
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
      state.flow = flow; state.roles = assignments; state.overrides = overrides;
      await save(); changed(); await panel.webview.postMessage({ type: 'saved', message: 'Đã lưu. Task mới dùng flow này; task/lịch cũ giữ cấu hình riêng.' });
    }), undefined, context.subscriptions);
  });
  command('aiTeam.connections', async () => { if (messaging) await connectionWizard(messaging); changed(); });
  command('aiTeam.reply', async (id?: string) => {
    const chosen = id ?? (await vscode.window.showQuickPick(state.jobs.filter(j => j.status === 'waiting_owner').map(j => ({ label: j.prompt.slice(0, 80), description: j.ownerQuestion, id: j.id }))))?.id;
    const job = state.jobs.find(j => j.id === chosen); if (!job) return;
    const answer = await vscode.window.showInputBox({ title: 'Reply to agent', prompt: job.ownerQuestion, ignoreFocusOut: true });
    if (!answer?.trim()) return;
    answerOwner(job, answer); await save(); changed(); start();
  });
  command('aiTeam.backlog', async () => {
    const prompt = await vscode.window.showInputBox({ title: 'Useful backlog task', prompt: 'Describe a real improvement and acceptance criteria. It will run once when utilization is enabled.' });
    if (!prompt?.trim()) return;
    const cwd = await pickCwd(); if (!cwd) return;
    backlog.items.push({ id: randomUUID(), prompt: prompt.trim(), cwd }); await save(); changed();
  });
  command('aiTeam.utilization', async () => {
    if (backlog.enabled) { backlog.enabled = false; await save(); changed(); return; }
    if (!backlog.items.some(i => !i.jobId)) throw new Error('Add useful backlog items first.');
    const runs = await vscode.window.showInputBox({ title: 'Maximum backlog runs this session', value: '3', validateInput: s => Number.isInteger(Number(s)) && Number(s) >= 1 && Number(s) <= 20 ? undefined : 'Enter 1–20.' });
    if (!runs) return;
    const minutes = await vscode.window.showInputBox({ title: 'Stop dispatching backlog after (minutes)', value: '60', validateInput: s => Number.isInteger(Number(s)) && Number(s) >= 1 && Number(s) <= 180 ? undefined : 'Enter 1–180.' });
    if (!minutes) return;
    validateRoles(); backlog.enabled = true; backlog.remaining = Number(runs); backlog.until = Date.now() + Number(minutes) * 60_000;
    backlog.sessionJobs = [];
    await save(); changed();
    void vscode.window.showInformationMessage('Useful backlog mode enabled. Requires fresh quota below threshold for all roles. Each item runs once; no dummy token-burning calls.');
  });
  command('aiTeam.newTask', async () => {
    validateRoles();
    const prompt = await vscode.window.showInputBox({ title: 'Task for your AI team', prompt: 'Describe the result and acceptance criteria. CLI permissions and allowEdits apply.' });
    if (!prompt?.trim()) return;
    const cwd = await pickCwd(); if (!cwd) return;
    state.jobs.push(newJob(prompt.trim(), cwd, state.roles, state.flow, state.overrides));
    await save(); changed(); start();
  });
  command('aiTeam.switch', async (taskId?:string,preferredProfile?:string) => {
    const targets = [{ label: 'Future tasks', id: '' }, ...state.jobs.filter(j => ['queued','waiting_quota','waiting_owner','running'].includes(j.status)).map(j => ({ label: `${j.status}: ${j.prompt.slice(0, 70)}`, id: j.id }))];
    const target = taskId?targets.find(t=>t.id===taskId):await vscode.window.showQuickPick(targets, { title: 'Switch account · running tasks are paused before switching' });
    if (!target) return;
    const assignments = target.id ? state.jobs.find(j => j.id === target.id)!.roles : state.roles;
    const job=target.id?state.jobs.find(j=>j.id===target.id):undefined;
    const availableRoles=job?(job.flow??fullFlow).filter(r=>!job.steps.some(s=>s.role===r)||job.steps.some(s=>s.role===r&&s.status!=='done')):state.flow??fullFlow;
    const role = await vscode.window.showQuickPick(availableRoles.map(r => ({ label: r, description: assignments[r] })), { title: 'Select remaining role to change' });
    if (!role) return;
    const id = preferredProfile??await pickProfile(); if (!id) return;
    if(!profiles().some(p=>p.id===id))throw new Error('Choose an existing account profile.');
    if(job){
      if(job.status==='running') {state.queuePaused=true;engine.pause();await save();await draining;}
      assignTaskProfile(job,role.label as Role,id,profiles());
    }else assignments[role.label as Role] = id;
    await save(); changed();
    void vscode.window.showInformationMessage(`RelayCrew: ${role.label} → ${id}. ${job?'Pinned for this task; queue remains paused if it was running.':'Applies to future tasks; rotation policy still applies.'}`);
  });
  command('aiTeam.profiles', () => vscode.commands.executeCommand('workbench.action.openSettings', '@id:aiTeam.profiles'));
  command('aiTeam.settings', () => vscode.commands.executeCommand('workbench.action.openSettings', '@ext:local-ai-team.ai-team-workbench'));
  command('aiTeam.logs', () => output.show());
  command('aiTeam.secret', async () => {
    const id = await pickProfile(); if (!id) return;
    const p = profiles().find(x => x.id === id)!;
    const key = await vscode.window.showQuickPick(p.secretEnv ?? [], { title: 'Environment variable (configure secretEnv first)' });
    if (!key) return;
    const value = await vscode.window.showInputBox({ title: `Secret for ${id}: ${key}`, password: true, ignoreFocusOut: true });
    if (!value) return;
    await context.secrets.store(`aiTeam:${id}:${key}`, value);
    void vscode.window.showInformationMessage('RelayCrew: secret stored in VS Code SecretStorage.');
  });
  command('aiTeam.quota', async (selected?: string) => {
    const id = selected ?? await pickProfile(); if (!id) return;
    const value = await vscode.window.showInputBox({ title: `Quota used % · ${id} (manual snapshot)`, validateInput: s => s.trim() && Number.isFinite(Number(s)) && Number(s) >= 0 && Number(s) <= 100 ? undefined : 'Enter 0–100.' });
    if (value === undefined) return;
    state.quotas[id] = parseQuota({ usedPercent: Number(value), observedAt: new Date().toISOString(), source: 'manual' });
    await save(); changed();
  });
  command('aiTeam.report', async (id?: string) => {
    const chosen = id ?? (await vscode.window.showQuickPick(state.jobs.slice().reverse().map(j => ({ label: j.prompt.slice(0, 90), description: j.status, id: j.id }))))?.id;
    const job = state.jobs.find(j => j.id === chosen); if (!job) return;
    await persistReports();
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(join(storage, 'reports', `${job.id}.md`)));
  });
  command('aiTeam.cancel', async () => {
    const choice = await vscode.window.showQuickPick(state.jobs.filter(j => ['queued', 'running', 'waiting_owner', 'waiting_quota'].includes(j.status)).map(j => ({ label: j.prompt.slice(0, 90), description: j.status, id: j.id })), { title: 'Stop task (existing edits remain for review)' });
    if (!choice) return;
    engine.cancel(choice.id); await save();
  });
  command('aiTeam.schedule', async () => {
    const kind = await vscode.window.showQuickPick(['reminder', 'task'] as const, { title: 'Reminder or automatic team run' });
    if (!kind) return;
    if (kind === 'task') validateRoles();
    const prompt = await vscode.window.showInputBox({ title: kind === 'task' ? 'Task to run automatically' : 'Reminder text' });
    if (!prompt?.trim()) return;
    const mode = await vscode.window.showQuickPick(['once', 'recurring cron'] as const, { title: 'Schedule frequency' });
    if (!mode) return;
    const timezone = resolveTimezone(cfg().get('timezone', ''));
    let cron: string | undefined, nextAt: string;
    if (mode === 'once') {
      const input = await vscode.window.showInputBox({ title: 'Date/time with explicit UTC offset', placeHolder: '2026-10-17T09:00:00+07:00', validateInput: s => /(?:Z|[+-]\d\d:\d\d)$/.test(s) && Date.parse(s) > Date.now() ? undefined : 'Enter a future ISO date/time including Z or +07:00.' });
      if (!input) return;
      nextAt = new Date(input).toISOString();
    } else {
      cron = await vscode.window.showInputBox({ title: `Cron in ${timezone}`, placeHolder: '0 9 * * *  (daily at 09:00)', validateInput: s => { try { nextCron(s, timezone); return undefined; } catch { return 'Invalid cron expression or timezone.'; } } });
      if (!cron) return;
      nextAt = nextCron(cron, timezone);
    }
    const cwd = await pickCwd(); if (!cwd) return;
    state.schedules.push({ id: randomUUID(), title: prompt.slice(0, 80), kind: kind as 'reminder' | 'task', prompt: prompt.trim(), cwd, roles: { ...state.roles }, flow: [...state.flow!], overrides: structuredClone(state.overrides), cron, nextAt, timezone, enabled: true });
    await save(); changed();
    void vscode.window.showInformationMessage(`RelayCrew: saved for ${new Date(nextAt).toLocaleString('vi-VN', { timeZone: timezone })} (${timezone}). VS Code must stay open. Missed automatic runs are skipped after 60 seconds.`);
  });
  command('aiTeam.pauseSchedule', async (id?: string) => {
    const selected = id ?? (await vscode.window.showQuickPick(state.schedules.map(s => ({ label: s.title, id: s.id }))))?.id;
    const s = state.schedules.find(x => x.id === selected); if (!s) return;
    if (!s.enabled && s.cron) s.nextAt = nextCron(s.cron, s.timezone);
    if (!s.enabled && !s.cron && Date.parse(s.nextAt) <= Date.now()) throw new Error('One-time occurrence has passed. Create a new schedule.');
    s.enabled = !s.enabled; await save(); changed();
  });
  messaging = await MessagingHub.load(storage, context.globalStorageUri.fsPath, context.secrets, {
    changed, log: text => output.appendLine(`[Messaging] ${text}`),
    receive: async (message, connection, history, signal) => {
      if (!roots.some(r => r.uri.fsPath === connection.cwd)) throw new Error('Connected workspace is no longer open.');
      const command = chatCommand(message.text);
      if (command.kind === 'help') return 'RelayCrew · two-way chat\nSend a normal question or /ask text → agent replies read-only.\n/task requirements → run the selected team (local Allow Edits applies).\n/status · /tasks\n/reply TASK_ID answer → resume a task waiting for you.\n/cancel TASK_ID → stop a task.\n/resume TASK_ID → retry after inspecting partial edits and refreshing quota.\nVS Code and this workspace must stay open.';
      const jobs = state.jobs.filter(j => j.cwd === connection.cwd);
      if (command.kind === 'status' || command.kind === 'tasks') return `${roots.find(r => r.uri.fsPath === connection.cwd)?.name ?? 'Workspace'}\n` + (jobs.slice(-12).reverse().map(j => `${j.id.slice(0, 8)} · ${j.status}${j.ownerQuestion ? '\nQuestion: ' + j.ownerQuestion : ''}`).join('\n') || 'No tasks yet.') + '\n' + profiles().map(p => `${p.id}: ${quotaLabel(p.id)}`).join('\n');
      if (command.kind === 'task') {
        validateRoles();
        const id = createHash('sha256').update(`remote:${message.channel}:${message.id}`).digest('hex');
        let job = state.jobs.find(j => j.id === id);
        if (!job) { job = newJob(command.text, connection.cwd, state.roles, state.flow, state.overrides); job.id = id; state.jobs.push(job); await save(); changed(); start(); }
        return `Task ${job.id}\nStatus: ${job.status}\nTeam: ${Object.entries(job.roles).map(([r, p]) => `${r} → ${p}`).join(', ')}.\nI will report results or ask for clarification here.`;
      }
      if (command.kind === 'reply' || command.kind === 'cancel' || command.kind === 'resume') {
        const matches = jobs.filter(j => j.id.startsWith(command.id));
        if (matches.length !== 1) return 'Task ID not found or ambiguous. Use /tasks and the full ID.';
        const job = matches[0];
        if (command.kind === 'cancel') engine.cancel(job.id); else if (command.kind === 'resume') resume(job, false); else if (command.kind === 'reply') answerOwner(job, command.text);
        await save(); changed(); start(); return `Task ${job.id.slice(0, 8)}: ${job.status}.`;
      }
      if (command.kind !== 'ask') return 'Use /help.';
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
            notifications.push(`Reminder: ${s.prompt}`);
            await messaging?.broadcast(`reminder:${claim.occurrence}`, `Reminder: ${s.prompt}`);
          }
          else if (now.getTime() - Date.parse(s.nextAt) > 60_000) notifications.push(`Skipped missed automatic task: ${s.title}. Start a new task to run now.`);
          else if (!state.jobs.some(j => j.scheduleOccurrence === claim.occurrence)) {
            const job = newJob(s.prompt, s.cwd, s.roles, s.flow, s.overrides); job.scheduleOccurrence = claim.occurrence; state.jobs.push(job);
          }
        } catch (e) { s.enabled = false; notifications.push(`Schedule paused: ${s.title} (${String(e)})`); }
      }
      if (backlog.enabled) {
        const decision = backlogDecision(backlog, state.jobs, state.flow ?? fullFlow, role => choose(role, state.roles[role], false), state.quotas, cfg().get('quotaThreshold', 95), !!state.queuePaused);
        if (decision.action === 'stop') { backlog.enabled = false; notifications.push(decision.reason ?? 'Backlog stopped.'); }
        else if (decision.action === 'run') {
          const item = backlog.items.find(i => !i.jobId)!;
          const job = newJob(item.prompt, item.cwd, state.roles, state.flow, state.overrides); item.jobId = job.id;
          (backlog.sessionJobs ??= []).push(job.id); state.jobs.push(job); backlog.remaining--;
        }
      }
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
  context.subscriptions.push({ dispose: () => { clearInterval(timer); engine.stop(); } }, vscode.workspace.onDidChangeConfiguration(e => { if (e.affectsConfiguration('aiTeam')) changed(); }));
  shutdown = async () => {
    closing = true; clearInterval(timer); engine.stop();
    await messaging?.stop(); await tickInFlight; await draining; await writeQueue; await logQueue; await release();
    shutdown = undefined;
  };
  output.appendLine(`RelayCrew ready. State and reports: ${storage}`);
  await save(); changed(); await safeTick();
}

export async function deactivate(): Promise<void> { await shutdown?.(); }
