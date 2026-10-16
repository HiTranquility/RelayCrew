import * as vscode from 'vscode';
import type { MessagingHub } from '../adapters/messaging/messaging-hub';
import type { Channel, Connection } from '../adapters/messaging/messaging';

export async function connectionWizard(hub: MessagingHub): Promise<void> {
  const action = await vscode.window.showQuickPick(['Connect / update Telegram', 'Connect / update Zalo OA', 'Send test message', 'Disconnect channel', 'Connection status / deliveries'], { title: 'RelayCrew · Messaging connections' });
  if (!action) return;
  if (action === 'Connection status / deliveries') {
    const text = '# Messaging connections\n\n' + hub.summary() + '\n\n## Recent deliveries\n\n' + hub.deliveries().slice(-40).reverse().map(d => `${d.channel} · ${d.status} · attempts ${d.attempts} · ${d.error ?? ''}`).join('\n\n');
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument({ language: 'markdown', content: text })); return;
  }
  if (action === 'Disconnect channel' || action === 'Send test message') {
    const channel = await vscode.window.showQuickPick(hub.connections().map(c => c.channel));
    if (!channel) return;
    if (action === 'Disconnect channel') await hub.disconnect(channel); else await hub.test(channel);
    void vscode.window.showInformationMessage(action === 'Disconnect channel' ? 'Channel disconnected; local credentials removed.' : 'Test queued. Check delivery status for the result.'); return;
  }
  const channel: Channel = action.includes('Telegram') ? 'telegram' : 'zalo';
  const previous = hub.connections().find(c => c.channel === channel);
  const token = await vscode.window.showInputBox({ title: channel === 'telegram' ? 'Telegram BotFather bot token' : 'Zalo OA access token', password: true, ignoreFocusOut: true, prompt: 'Stored in VS Code SecretStorage. Do not paste tokens into agent chat.' });
  if (!token?.trim()) return;
  const recipient = await vscode.window.showInputBox({ title: channel === 'telegram' ? 'Telegram chat ID' : 'Zalo recipient UID (scoped to your OA)', value: previous?.recipient, validateInput: s => /^-?\d+$/.test(s) ? undefined : 'Enter the numeric recipient ID.' });
  if (!recipient) return;
  const mode = await vscode.window.showQuickPick(['Two-way chat + explicit task commands', 'Notifications only'], { title: 'Allow agent replies / remote tasks?', placeHolder: 'Two-way: questions are read-only; /task may edit according to local Allow Edits.' });
  if (!mode) return;
  const folders = vscode.workspace.workspaceFolders;
  const folder = folders?.length === 1 ? folders[0] : await vscode.window.showWorkspaceFolderPick();
  if (!folder) return;
  const c: Connection = { channel, enabled: true, inbound: mode.startsWith('Two-way'), recipient, cwd: folder.uri.fsPath };
  let secret: string | undefined;
  if (channel === 'telegram' && c.inbound) {
    c.allowedUserId = await vscode.window.showInputBox({ title: 'Your Telegram user ID (allowed sender)', value: previous?.allowedUserId, prompt: 'Use a dedicated bot for this workspace. Sender and chat IDs are both checked.', validateInput: s => /^\d+$/.test(s) ? undefined : 'Enter your numeric user ID.' });
    if (!c.allowedUserId) return;
  }
  if (channel === 'zalo' && c.inbound) {
    c.appId = await vscode.window.showInputBox({ title: 'Zalo App ID', value: previous?.appId, validateInput: s => /^\d+$/.test(s) ? undefined : 'Numeric App ID required.' });
    if (!c.appId) return;
    c.oaId = await vscode.window.showInputBox({ title: 'Zalo Official Account ID', value: previous?.oaId, validateInput: s => /^\d+$/.test(s) ? undefined : 'Numeric OA ID required.' });
    if (!c.oaId) return;
    secret = await vscode.window.showInputBox({ title: 'Zalo OA webhook secret key', password: true, ignoreFocusOut: true });
    if (!secret) return;
    const port = await vscode.window.showInputBox({ title: 'Local Zalo webhook port', value: String(previous?.port ?? 47731), prompt: 'Forward your public HTTPS webhook to http://127.0.0.1:PORT/zalo/webhook', validateInput: s => Number.isInteger(Number(s)) && Number(s) >= 1024 && Number(s) <= 65535 ? undefined : 'Port must be 1024–65535.' });
    if (!port) return;
    c.port = Number(port);
  }
  await hub.configure(c, token.trim(), secret);
  void vscode.window.showInformationMessage(channel === 'zalo' && c.inbound ? `Zalo configured. Forward HTTPS to 127.0.0.1:${c.port}/zalo/webhook and register it in Zalo Developer. Use Send test message to check outbound permission.` : 'Messaging configured. Use Send test message to verify delivery.');
}
