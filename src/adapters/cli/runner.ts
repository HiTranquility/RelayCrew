import spawn from 'cross-spawn';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { ProviderLimit } from '../../core/domain';
import type { Profile } from '../../core/domain';

export interface Invocation { args: string[]; stdin: string }
export function invocation(p: Profile, prompt: string, edits: boolean, output: string): Invocation {
  let args: string[];
  if (p.provider === 'codex') {
    args = ['exec', '--json', '--color', 'never', '--sandbox', edits ? 'workspace-write' : 'read-only', '--output-last-message', output];
    if (p.model) args.push('--model', p.model);
    if (p.effort) args.push('-c', `model_reasoning_effort=${JSON.stringify(p.effort)}`);
    args.push('-');
  } else if (p.provider === 'claude') {
    args = ['--print', '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--permission-mode', edits ? 'acceptEdits' : 'plan'];
    if (p.model) args.push('--model', p.model);
    if (p.effort) args.push('--effort', p.effort);
  } else {
    args = ['--prompt', 'Follow the task supplied on standard input.', '--output-format', 'stream-json', '--approval-mode', edits ? 'auto_edit' : 'plan'];
    if (p.model) args.push('--model', p.model);
  }
  return { args, stdin: prompt };
}

export function redact(text: string, secrets: string[]): string {
  return secrets.filter(Boolean).reduce((s, value) => s.split(value).join('[REDACTED]'), text);
}
export function decodeResponse(provider: Profile['provider'], stdout: string): string {
  if (provider === 'codex') return stdout;
  const events = jsonEvents(stdout);
  if (providerLimited(stdout)) throw new ProviderLimit('Provider rate/usage limit reached. Refresh account quota before resuming this step; existing edits may be partial.');
  const result = events.slice().reverse().find(e => e.type === 'result') ?? events.at(-1);
  if (!result || result.is_error || result.error || result.status === 'error' || events.some(e => e.type === 'error')) throw new Error('Provider returned an error. See sanitized run log.');
  const response = provider === 'claude' ? result.result : result.response ?? events.filter(e => e.type === 'message' && e.role === 'assistant').map(e => e.content ?? '').join('');
  if (typeof response !== 'string' || !response.trim()) throw new Error('Provider returned no final response.');
  return response;
}
function jsonEvents(stdout: string): any[] {
  try { return [JSON.parse(stdout)]; } catch { return stdout.split(/\r?\n/).filter(Boolean).flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } }); }
}
export function providerLimited(stdout: string): boolean {
  return jsonEvents(stdout).some(e => {
    const error = e.error ?? (e.is_error ? { message: e.result } : undefined);
    return error && (Number(error.code) === 429 || ['RESOURCE_EXHAUSTED', 'rate_limit_error', 'usage_limit_reached'].includes(error.type ?? error.status)
      || /(?:you(?:'ve| have) hit your usage limit|rate.?limit exceeded|quota (?:has been )?exhausted|usage limit (?:has been )?reached)/i.test(error.message ?? ''));
  });
}
export function liveEvent(e: any): { kind: string; text: string } | undefined {
  if (e.type === 'stream_event' && e.event?.delta?.type === 'text_delta') return { kind: 'assistant', text: String(e.event.delta.text) };
  if (e.type === 'message' && e.role === 'assistant' && typeof e.content === 'string') return { kind: 'assistant', text: e.content };
  if (e.type === 'assistant' && Array.isArray(e.message?.content)) {
    const text = e.message.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('');
    if (text) return { kind: 'assistant', text };
  }
  if (['item.started', 'item.completed'].includes(e.type)) {
    if (e.item?.type === 'agent_message') return { kind: 'assistant', text: String(e.item.text ?? '') };
    if (e.item?.type === 'command_execution') return { kind: 'tool', text: `${e.type}: ${e.item.command ?? 'command'}` };
  }
  if (e.type === 'tool_use') return { kind: 'tool', text: String(e.tool_name ?? e.name ?? 'tool') };
  return;
}

export interface ExecuteOptions {
  profile: Profile; prompt: string; cwd: string; edits: boolean; signal: AbortSignal;
  timeoutMs: number; secretValues: Record<string, string>; log: (s: string) => void;
  onEvent?: (event: { kind: string; text: string }) => void;
}

async function stopTree(pid: number): Promise<void> {
  if (process.platform === 'win32') {
    await new Promise<void>(resolve => execFile('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }, () => resolve()));
  } else {
    try { process.kill(-pid, 'SIGKILL'); } catch { /* process already exited */ }
  }
}

export async function execute(o: ExecuteOptions): Promise<string> {
  if (o.signal.aborted) throw new Error('Cancelled.');
  const temp = await mkdtemp(join(tmpdir(), 'ai-team-'));
  const output = join(temp, 'final.txt');
  const command = invocation(o.profile, o.prompt, o.edits, output);
  const secretList = Object.values(o.secretValues);
  const clean = (s: string) => redact(s, secretList);
  try {
    const stdout = await new Promise<string>((resolve, reject) => {
      const child = spawn(o.profile.executable, command.args, {
        cwd: o.cwd, env: { ...process.env, ...o.profile.env, ...o.secretValues },
        windowsHide: true, detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe']
      });
      let out = '', err = '', stopReason = '', stopping: Promise<void> | undefined;
      let pendingLine = '';
      const outDecoder = new StringDecoder('utf8'), errDecoder = new StringDecoder('utf8');
      const eventLine = (line: string) => {
        try {
          const event = liveEvent(JSON.parse(line));
          if (event?.text) o.onEvent?.({ kind: event.kind, text: clean(event.text).slice(0, 3000) });
        } catch { /* non-JSON diagnostic line remains in sanitized final log */ }
      };
      const stop = (reason: string) => {
        stopReason ||= reason;
        stopping ??= child.pid ? stopTree(child.pid) : Promise.resolve();
      };
      const abort = () => stop('Cancelled.');
      o.signal.addEventListener('abort', abort, { once: true });
      if (o.signal.aborted) abort();
      const timeout = setTimeout(() => stop('CLI timed out. Check permissions or authentication before creating a new task.'), o.timeoutMs);
      const collect = (chunk: Buffer, target: 'out' | 'err') => {
        if (target === 'out') {
          const text = outDecoder.write(chunk); out += text; pendingLine += text;
          let index: number;
          while ((index = pendingLine.indexOf('\n')) >= 0) { eventLine(pendingLine.slice(0, index)); pendingLine = pendingLine.slice(index + 1); }
        } else err += errDecoder.write(chunk);
        if (out.length + err.length > 2_000_000) stop('CLI output exceeded 2 MB.');
      };
      child.stdout?.on('data', c => collect(c, 'out'));
      child.stderr?.on('data', c => collect(c, 'err'));
      child.stdin?.on('error', () => { /* early provider exit is reported by close */ });
      child.stdin?.end(command.stdin);
      const cleanup = () => { clearTimeout(timeout); o.signal.removeEventListener('abort', abort); };
      child.on('error', e => { cleanup(); reject(new Error(clean(e.message))); });
      child.on('close', async code => {
        cleanup();
        await stopping;
        out += outDecoder.end(); err += errDecoder.end();
        if (pendingLine) eventLine(pendingLine);
        // Redact complete buffers, so a secret split across output chunks is still masked.
        o.log(clean(`\n[${o.profile.id}] exit=${code}\n${out.slice(0, 2_000_000)}\n${err.slice(0, 100_000)}\n`));
        if (stopReason) reject(new Error(stopReason));
        else if (providerLimited(out)) reject(new ProviderLimit('Provider rate/usage limit reached. Existing edits may be partial; refresh quota before resuming.'));
        else if (code !== 0) reject(new Error(`CLI exited with code ${code}. See AI Team logs; no automatic retry was made.`));
        else resolve(out);
      });
    });
    let response: string;
    if (o.profile.provider === 'codex') {
      const events = stdout.split(/\r?\n/).filter(Boolean).map(line => { try { return JSON.parse(line); } catch { return {}; } });
      if (events.some(e => e.type === 'turn.failed' || e.type === 'error')) throw new Error('Codex reported a failed turn. See logs.');
      response = await readFile(output, 'utf8');
    } else response = decodeResponse(o.profile.provider, stdout);
    if (!response.trim()) throw new Error('CLI produced an empty response.');
    return clean(response);
  } finally { await rm(temp, { recursive: true, force: true }); }
}
