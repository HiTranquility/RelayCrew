import { createHash, randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { api, chunks, deliver, deliveryFailure, MessagingError, telegramIncoming, zaloIncoming } from './messaging';
import type { Connection, Delivery, Incoming } from './messaging';
import { JsonStore } from '../../storage/json-store';
import { statusLabel, translator, type Language } from '../../core/i18n';

interface InboxItem extends Incoming { status: 'queued' | 'running' | 'done' | 'failed'; response?: string }
interface HubState {
  version: 1; connections: Connection[]; outbox: Delivery[]; inbox: InboxItem[]; offset?: number;
  history: Partial<Record<'telegram' | 'zalo', { user: string; assistant: string }[]>>;
}
export interface SecretStore { get(key: string): Thenable<string | undefined> | Promise<string | undefined>; store(key: string, value: string): Thenable<void> | Promise<void>; delete(key: string): Thenable<void> | Promise<void> }
interface HubHooks {
  receive: (message: Incoming, connection: Connection, history: { user: string; assistant: string }[], signal: AbortSignal) => Promise<string>;
  changed: () => void; log: (text: string) => void;
  language?: () => Language;
}
export class MessagingHub {
  private state: HubState = { version: 1, connections: [], outbox: [], inbox: [], history: {} };
  private writes = Promise.resolve();
  private controller = new AbortController();
  private timer?: NodeJS.Timeout;
  private server?: Server;
  private poll?: Promise<void>;
  private worker?: Promise<void>;
  private flushing?: Promise<void>;
  private botLock?: string;
  private transportStatus: Record<string, string> = {};
  private readonly key: string;
  private store: JsonStore<HubState>;
  private recovered=false;
  private constructor(dir: string, private globalDir: string, private secrets: SecretStore, private hooks: HubHooks) {
    this.key = 'aiTeam:messaging:' + createHash('sha256').update(dir.toLowerCase()).digest('hex').slice(0, 24);
    this.store = new JsonStore<HubState>(join(dir,'messaging.json'),(v: any): v is HubState => !!v && v.version===1 && Array.isArray(v.connections) && Array.isArray(v.inbox) && Array.isArray(v.outbox) && !!v.history, path=>{this.recovered=true;hooks.log(`Messaging state recovered from ${path}; pending commands/deliveries require inspection.`);});
  }
  static async load(dir: string, globalDir: string, secrets: SecretStore, hooks: HubHooks): Promise<MessagingHub> {
    const hub = new MessagingHub(dir, globalDir, secrets, hooks);
    {
      hub.state = await hub.store.load(hub.state);
      for (const d of hub.state.outbox) if (d.status === 'sending' || hub.recovered && d.status==='pending') { d.status = 'uncertain'; d.error = 'Host stopped or older backup recovered; not automatically resent.'; }
      for (const i of hub.state.inbox) if (i.status === 'running' || hub.recovered && i.status==='queued') { i.status = 'failed'; i.response = 'Host stopped or older backup recovered. Ask again after checking task status.'; }
    }
    await hub.save();
    return hub;
  }
  connections(): Connection[] { return structuredClone(this.state.connections); }
  summary(language: Language = 'en'): string {
    const t = translator(language);
    return this.state.connections.map(c => `${c.channel}: ${t(c.enabled ? c.inbound ? 'two-way' : 'notify' : 'off')} · ${this.transportStatus[c.channel] ?? statusLabel('idle', language)}`).join('\n') || t('No channels connected');
  }
  deliveries(): Delivery[] { return structuredClone(this.state.outbox); }
  chatTranscript(language: Language = 'en'): string {
    const t = translator(language);
    return this.state.inbox.slice(-30).map(i => `${i.receivedAt} · ${i.channel} · ${statusLabel(i.status, language)}\n${t('Owner {0} → agent', i.sender)}: ${i.text}\n${t('Agent → owner')}: ${i.response ?? t('(waiting)')}`).join('\n\n');
  }
  private secretKey(channel: string, kind = 'token'): string { return `${this.key}:${channel}:${kind}`; }
  private save(): Promise<void> {
    this.writes = this.store.save(this.state);
    return this.writes;
  }
  async configure(c: Connection, token: string, webhookSecret?: string): Promise<void> {
    if (!c.recipient || !/^\d+$/.test(c.allowedUserId ?? '0') || !/^-?\d+$/.test(c.recipient)) throw new Error('Recipient and allowed user must be numeric IDs.');
    if (c.channel === 'zalo' && c.inbound && (!/^\d+$/.test(c.appId ?? '') || !/^\d+$/.test(c.oaId ?? '') || !(webhookSecret||await this.secrets.get(this.secretKey(c.channel,'webhook'))) || !Number.isInteger(c.port) || c.port! < 1024 || c.port! > 65535)) throw new Error('Zalo two-way requires App ID, OA ID, webhook secret and port 1024–65535.');
    if (c.channel === 'telegram' && c.inbound && !c.allowedUserId) throw new Error('Telegram two-way requires the allowed sender user ID.');
    const previous=this.state.connections.find(v=>v.channel===c.channel),oldToken=await this.secrets.get(this.secretKey(c.channel));token=token||oldToken||'';
    const identityChanged=!previous||['recipient','allowedUserId','appId','oaId'].some(key=>(previous as any)[key]!== (c as any)[key])||token!==oldToken;
    if(!token)throw new Error('Enter a credential for the first connection.');
    if(c.channel==='zalo'&&c.inbound&&!webhookSecret)webhookSecret=await this.secrets.get(this.secretKey(c.channel,'webhook'));
    await this.stop();
    await this.secrets.store(this.secretKey(c.channel), token);
    if (webhookSecret) await this.secrets.store(this.secretKey(c.channel, 'webhook'), webhookSecret);
    const index = this.state.connections.findIndex(x => x.channel === c.channel);
    if (index >= 0) this.state.connections[index] = { ...c }; else this.state.connections.push({ ...c });
    // New identity must never inherit conversation context, polling cursor or queued deliveries.
    if(identityChanged){delete this.state.history[c.channel];
    if (c.channel === 'telegram') this.state.offset = undefined;
    for (const d of this.state.outbox) if (d.channel === c.channel && d.status === 'pending') { d.status = 'failed'; d.error = 'Connection changed; delivery cancelled.'; }
    for (const i of this.state.inbox) if (i.channel === c.channel && i.status === 'queued') i.status = 'failed';}
    await this.save(); await this.start();
  }
  async disconnect(channel: string): Promise<void> {
    await this.stop();
    this.state.connections = this.state.connections.filter(c => c.channel !== channel);
    delete this.state.history[channel as 'telegram' | 'zalo'];
    for (const d of this.state.outbox) if (d.channel === channel && d.status === 'pending') { d.status = 'failed'; d.error = 'Channel disconnected.'; }
    for (const i of this.state.inbox) if (i.channel === channel && i.status === 'queued') i.status = 'failed';
    await this.secrets.delete(this.secretKey(channel)); await this.secrets.delete(this.secretKey(channel, 'webhook'));
    await this.save(); await this.start();
  }
  async test(channel: string, language: Language = 'en'): Promise<void> {
    const t = translator(language);
    const c = this.state.connections.find(c => c.channel === channel && c.enabled);
    if (!c) throw new Error('Connect channel first.');
    await this.queue(`test:${randomUUID()}`, t('RelayCrew connected. {0}', t(c.inbound ? 'Two-way chat enabled. Send /help.' : 'Notifications enabled.')), c);
    await this.flush();
  }
  async broadcast(id: string, text: string): Promise<void> {
    for (const c of this.state.connections.filter(c => c.enabled)) await this.queue(id, text, c);
  }
  private async queue(id: string, text: string, c: Connection): Promise<void> {
    const bounded = text.length > 24_000 ? text.slice(0, 24_000) + '\n[Response shortened; inspect local report for more.]' : text;
    chunks(bounded, c.channel === 'zalo' ? 900 : 1800).forEach((part, index) => {
      const deliveryId = `${c.channel}:${id}:${index}`;
      if (!this.state.outbox.some(d => d.id === deliveryId)) this.state.outbox.push({ id: deliveryId, channel: c.channel, recipient: c.recipient, text: part, status: 'pending', attempts: 0, nextAt: Date.now() });
    });
    await this.save(); this.hooks.changed();
  }
  async accept(message: Incoming): Promise<void> {
    if (this.state.inbox.some(i => i.id === message.id)) return;
    if (this.state.inbox.filter(i => ['queued', 'running'].includes(i.status)).length >= 50) throw new Error('Inbox full.');
    this.state.inbox.push({ ...message, status: 'queued' });
    await this.save(); this.processInbox();
  }
  private processInbox(): void {
    if (this.worker || this.controller.signal.aborted) return;
    this.worker = (async () => {
      for (const item of this.state.inbox) {
        if (this.controller.signal.aborted) break;
        if (item.status !== 'queued') continue;
        const c = this.state.connections.find(c => c.channel === item.channel && c.enabled && c.inbound);
        if (!c) continue;
        item.status = 'running'; await this.save();
        try {
          const response = await this.hooks.receive(item, c, this.state.history[c.channel] ?? [], this.controller.signal);
          item.response = response; item.status = 'done';
          const history = this.state.history[c.channel] ??= [];
          history.push({ user: item.text.slice(0, 8000), assistant: response.slice(0, 8000) });
          this.state.history[c.channel] = history.slice(-8);
          await this.queue(`reply:${item.id}`, response, c);
        } catch {
          item.status = 'failed'; item.response = translator(this.hooks.language?.() ?? 'en')('Request could not be completed. Check RelayCrew logs locally. Use /status before retrying a task.');
          await this.queue(`reply:${item.id}`, item.response, c);
        }
        await this.save();
      }
    })().catch(() => this.hooks.log('Messaging inbox persistence failed. Check storage.')).finally(() => { this.worker = undefined; });
  }
  private async flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    this.flushing = (async () => {
      const blocked = new Set<string>();
      for (const d of this.state.outbox) {
        if (this.controller.signal.aborted) break;
        if (d.status !== 'pending') continue;
        const destination = `${d.channel}:${d.recipient}`;
        if (blocked.has(destination)) continue;
        if (d.nextAt > Date.now()) { blocked.add(destination); continue; }
        const group = d.id.slice(0, d.id.lastIndexOf(':')) + ':';
        if (this.state.outbox.some(previous => previous !== d && previous.id.startsWith(group) && ['failed','uncertain'].includes(previous.status))) {
          d.status = 'failed'; d.error = 'Another part of this message failed; remaining parts not sent.'; await this.save(); continue;
        }
        const c = this.state.connections.find(c => c.channel === d.channel && c.enabled && c.recipient === d.recipient);
        if (!c) continue;
        const token = await this.secrets.get(this.secretKey(c.channel));
        if (!token) { d.status = 'failed'; d.error = 'Missing channel credential. Reconnect.'; await this.save(); continue; }
        d.status = 'sending'; d.attempts++; await this.save();
        try { await deliver(d, token, this.controller.signal); d.status = 'sent'; this.transportStatus[c.channel] = 'sent'; }
        catch (e) { deliveryFailure(d, e); this.transportStatus[c.channel] = d.error ?? 'delivery failed'; this.hooks.log(d.error ?? 'Delivery failed.'); }
        await this.save(); this.hooks.changed();
        if (d.status !== 'sent') blocked.add(destination);
      }
    })().finally(() => { this.flushing = undefined; });
    return this.flushing;
  }
  async start(): Promise<void> {
    this.controller = new AbortController();
    this.transportStatus = {};
    const telegram = this.state.connections.find(c => c.channel === 'telegram' && c.enabled && c.inbound);
    if (telegram) this.poll = this.pollTelegram(telegram).catch(() => { this.transportStatus.telegram = 'polling stopped; reconnect and check bot webhook/other poller'; this.hooks.changed(); });
    const zalo = this.state.connections.find(c => c.channel === 'zalo' && c.enabled && c.inbound);
    if (zalo) await this.startWebhook(zalo);
    this.timer = setInterval(() => { void this.flush().catch(() => this.hooks.log('Messaging outbox storage error.')); this.processInbox(); }, 5000);
    this.processInbox(); this.hooks.changed();
  }
  private async pollTelegram(c: Connection): Promise<void> {
    const token = await this.secrets.get(this.secretKey('telegram'));
    if (!token) throw new Error('Missing bot token.');
    await mkdir(this.globalDir, { recursive: true });
    const lock = join(this.globalDir, `telegram-${createHash('sha256').update(token).digest('hex')}.lock`);
    try {
      const existing = Number(await readFile(lock, 'utf8'));
      try { process.kill(existing, 0); throw new Error('Bot already in use in another workspace.'); }
      catch (e: any) { if (e.code !== 'ESRCH') throw e; await unlink(lock); }
    } catch (e: any) { if (e.code !== 'ENOENT') throw e; }
    const f = await open(lock, 'wx'); await f.writeFile(String(process.pid)); await f.close(); this.botLock = lock;
    const info = await api('telegram', token, 'getWebhookInfo', {}, this.controller.signal);
    if (info.url) throw new Error('Bot has a webhook. Use a dedicated bot for this workspace.');
    this.transportStatus.telegram = 'receiving'; this.hooks.changed();
    let failures=0;
    while (!this.controller.signal.aborted) {
      try {
        const updates = await api('telegram', token, 'getUpdates', { offset: this.state.offset, timeout: 20, allowed_updates: ['message'], limit: 50 }, this.controller.signal);
        if (!Array.isArray(updates)) throw new Error('Invalid updates.');
        failures=0;
        if(this.transportStatus.telegram!=='receiving'){this.transportStatus.telegram='receiving';this.hooks.changed();}
        for (const u of updates) {
          const incoming = telegramIncoming(u, c);
          if (incoming) await this.accept(incoming);
          if (Number.isSafeInteger(u.update_id)) this.state.offset = Math.max(this.state.offset ?? 0, u.update_id + 1);
          await this.save();
        }
      } catch (e) {
        if (this.controller.signal.aborted) break;
        if(e instanceof MessagingError && (e.ambiguous || e.retryAfter)){
          const delay=Math.min(60_000,(e.retryAfter??Math.min(60,2**Math.min(++failures,6)))*1000);
          this.transportStatus.telegram=`reconnecting in ${delay/1000}s`;this.hooks.changed();
          await new Promise<void>(resolve=>{const abort=()=>{clearTimeout(timer);resolve();};const timer=setTimeout(()=>{this.controller.signal.removeEventListener('abort',abort);resolve();},delay);this.controller.signal.addEventListener('abort',abort,{once:true});if(this.controller.signal.aborted)abort();});
          continue;
        }
        // Auth/conflict errors stop visibly; never create a competing poller or remove a webhook.
        throw e;
      }
    }
  }
  private async startWebhook(c: Connection): Promise<void> {
    const secret = await this.secrets.get(this.secretKey('zalo', 'webhook'));
    if (!secret) { this.transportStatus.zalo = 'missing webhook secret'; return; }
    this.server = createServer(async (req, res) => {
      if (req.method !== 'POST' || req.url !== '/zalo/webhook') { res.writeHead(404).end(); return; }
      let size = 0; const data: Buffer[] = [];
      try {
        for await (const chunk of req) {
          size += chunk.length; if (size > 64_000) { res.writeHead(413).end(); return; } data.push(chunk);
        }
        const signature = req.headers['x-zevent-signature'];
        const message = zaloIncoming(Buffer.concat(data).toString('utf8'), typeof signature === 'string' ? signature : undefined, c, secret);
        if (!message) { res.writeHead(403).end(); return; }
        await this.accept(message); res.writeHead(200).end('ok');
      } catch { if (!res.headersSent) res.writeHead(503).end(); }
    });
    this.server.requestTimeout = 10_000; this.server.headersTimeout = 5000;
    await new Promise<void>(resolve => {
      this.server!.once('error', () => { this.transportStatus.zalo = 'webhook port unavailable'; this.hooks.changed(); resolve(); });
      this.server!.listen(c.port, '127.0.0.1', () => { this.transportStatus.zalo = `webhook local :${c.port} (HTTPS forwarding required)`; resolve(); });
    });
    this.hooks.changed();
  }
  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.controller.abort();
    if (this.server) { this.server.closeAllConnections(); await new Promise<void>(resolve => this.server!.close(() => resolve())); this.server = undefined; }
    await Promise.allSettled([this.poll, this.worker, this.flushing, this.writes]);
    if (this.botLock) { try { await unlink(this.botLock); } catch { /* closed */ } this.botLock = undefined; }
  }
}
