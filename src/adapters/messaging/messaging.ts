import { createHash, timingSafeEqual } from 'node:crypto';

export type Channel = 'telegram' | 'zalo';
export interface Connection {
  channel: Channel; enabled: boolean; inbound: boolean; recipient: string; cwd: string;
  allowedUserId?: string; appId?: string; oaId?: string; port?: number;
}
export interface Incoming { id: string; channel: Channel; sender: string; text: string; receivedAt: string }
export interface Delivery {
  id: string; channel: Channel; recipient: string; text: string;
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'uncertain'; attempts: number; nextAt: number; error?: string;
}
export class MessagingError extends Error {
  constructor(message: string, readonly ambiguous = false, readonly retryAfter?: number) { super(message); }
}
export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export async function api(channel: Channel, token: string, method: string, body: object, signal?: AbortSignal, fetcher: Fetch = fetch): Promise<any> {
  if (!token || (channel === 'telegram' ? /[\s/\\?#]/.test(token) : /[\r\n]/.test(token))) throw new MessagingError('Invalid channel credential. Reconnect the channel.');
  const url = channel === 'telegram' ? `https://api.telegram.org/bot${token}/${method}` : 'https://openapi.zalo.me/v3.0/oa/message/cs';
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(abort, method === 'getUpdates' ? 30_000 : 15_000);
  try {
    const response = await fetcher(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(channel === 'zalo' ? { access_token: token } : {}) }, body: JSON.stringify(body), signal: controller.signal, redirect: 'error' });
    let data: any;
    try { data = await response.json(); } catch { throw new MessagingError(`${channel}: invalid API response (HTTP ${response.status}).`, true); }
    if (response.status === 429 || (channel === 'telegram' && data.error_code === 429)) {
      const seconds = Number(data.parameters?.retry_after ?? response.headers.get('retry-after') ?? 30);
      throw new MessagingError(`${channel}: rate limited.`, false, Math.min(3600, Math.max(1, Number.isFinite(seconds) ? seconds : 30)));
    }
    if (!response.ok) throw new MessagingError(`${channel}: HTTP ${response.status}.`, response.status >= 500);
    if (channel === 'telegram' ? data.ok !== true : data.error !== 0) {
      const code = Number(channel === 'telegram' ? data.error_code : data.error);
      throw new MessagingError(`${channel}: API rejected request (code ${Number.isFinite(code) ? code : 'unknown'}). Check token, recipient and channel permissions.`);
    }
    return channel === 'telegram' ? data.result : data.data;
  } catch (e) {
    if (e instanceof MessagingError) throw e;
    // Fetch errors can contain credential-bearing URLs. Never propagate them.
    throw new MessagingError(`${channel}: network interrupted; delivery outcome unknown.`, true);
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
export function chunks(text: string, limit = 1800): string[] {
  const chars = Array.from(text);
  const parts: string[] = [];
  for (let i = 0; i < chars.length; i += limit) parts.push(chars.slice(i, i + limit).join(''));
  return parts.length ? parts : ['(empty response)'];
}
export async function deliver(d: Delivery, token: string, signal?: AbortSignal, fetcher?: Fetch): Promise<void> {
  const body = d.channel === 'telegram' ? { chat_id: d.recipient, text: d.text }
    : { recipient: { user_id: d.recipient }, message: { text: d.text } };
  await api(d.channel, token, 'sendMessage', body, signal, fetcher);
}
export function telegramIncoming(update: any, c: Connection, now = Date.now()): Incoming | undefined {
  const m = update?.message;
  if (!c.enabled || !c.inbound || !m || !Number.isSafeInteger(update.update_id) || !Number.isSafeInteger(m.from?.id)
    || String(m.chat?.id) !== c.recipient || String(m.from.id) !== c.allowedUserId || m.from.is_bot
    || m.forward_origin || m.forward_date || m.via_bot || typeof m.text !== 'string' || m.text.length > 8000
    || !Number.isFinite(m.date) || Math.abs(now - m.date * 1000) > 120_000) return;
  return { id: `tg:${update.update_id}`, channel: 'telegram', sender: String(m.from.id), text: m.text, receivedAt: new Date(now).toISOString() };
}
export function zaloIncoming(raw: string, signature: string | undefined, c: Connection, secret: string, now = Date.now()): Incoming | undefined {
  if (!c.enabled || !c.inbound || !secret || !signature || !/^mac=[a-f0-9]{64}$/.test(signature) || raw.length > 64_000) return;
  let data: any;
  try { data = JSON.parse(raw); } catch { return; }
  if (String(data.app_id) !== c.appId || String(data.recipient?.id) !== c.oaId || String(data.sender?.id) !== c.recipient
    || data.event_name !== 'user_send_text' || typeof data.message?.text !== 'string' || data.message.text.length > 8000
    || typeof data.message.msg_id !== 'string' || !data.message.msg_id || !/^\d{13}$/.test(String(data.timestamp))
    || Math.abs(now - Number(data.timestamp)) > 300_000) return;
  const expected = 'mac=' + createHash('sha256').update(`${c.appId}${raw}${data.timestamp}${secret}`, 'utf8').digest('hex');
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return;
  return { id: `za:${data.message.msg_id}`, channel: 'zalo', sender: c.recipient, text: data.message.text, receivedAt: new Date(now).toISOString() };
}
export type ChatCommand = { kind: 'ask' | 'task'; text: string } | { kind: 'reply'; id: string; text: string } | { kind: 'cancel'; id: string } | { kind: 'resume'; id: string } | { kind: 'status' | 'tasks' | 'help' };
export function chatCommand(text: string): ChatCommand {
  const match = text.trim().match(/^\/(\w+)(?:@[\w]+)?(?:\s+([\s\S]*))?$/);
  if (!match) {
    if (text.trim().startsWith('/')) throw new Error('Use /help to see supported commands.');
    return { kind: 'ask', text: text.trim() };
  }
  const [, name, args = ''] = match;
  if (['status', 'tasks', 'help', 'start'].includes(name)) return { kind: name === 'start' ? 'help' : name as 'status' | 'tasks' | 'help' };
  if (['ask', 'task'].includes(name) && args.trim()) return { kind: name as 'ask' | 'task', text: args.trim() };
  if (['cancel','resume'].includes(name) && /^[a-f0-9-]{6,64}$/.test(args.trim())) return { kind: name as 'cancel' | 'resume', id: args.trim() };
  const reply = args.match(/^([a-f0-9-]{6,64})\s+([\s\S]+)$/);
  if (name === 'reply' && reply) return { kind: 'reply', id: reply[1], text: reply[2].trim() };
  throw new Error('Use /help to see supported commands.');
}
export function deliveryFailure(d: Delivery, error: unknown, now = Date.now()): void {
  const e = error instanceof MessagingError ? error : new MessagingError('Delivery failed; outcome unknown.', true);
  d.error = e.message;
  if (e.retryAfter && d.attempts < 4) { d.status = 'pending'; d.nextAt = now + e.retryAfter * 1000; }
  else d.status = e.ambiguous ? 'uncertain' : 'failed';
}
