import * as vscode from 'vscode';
import type { MessagingHub } from '../adapters/messaging/messaging-hub';
import type { Channel, Connection } from '../adapters/messaging/messaging';
import { statusLabel, translator, type Language } from '../core/i18n';

export async function connectionWizard(hub: MessagingHub, language: Language = 'en'): Promise<void> {
  const t = translator(language);
  const action = await vscode.window.showQuickPick([
    { id: 'telegram', label: t('Connect / update Telegram') }, { id: 'zalo', label: t('Connect / update Zalo OA') },
    { id: 'test', label: t('Send test message') }, { id: 'disconnect', label: t('Disconnect channel') },
    { id: 'status', label: t('Connection status / deliveries') },
  ], { title: 'RelayCrew · ' + t('Messaging connections') });
  if (!action) return;
  if (action.id === 'status') {
    const text = '# ' + t('Messaging connections') + '\n\n' + hub.summary(language) + '\n\n## ' + t('Recent deliveries') + '\n\n'
      + hub.deliveries().slice(-40).reverse().map(d => `${d.channel} · ${statusLabel(d.status, language)} · ${t('Attempts')} ${d.attempts} · ${d.error ?? ''}`).join('\n\n');
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument({ language: 'markdown', content: text })); return;
  }
  if (action.id === 'disconnect' || action.id === 'test') {
    const channel = await vscode.window.showQuickPick(hub.connections().map(c => c.channel));
    if (!channel) return;
    if (action.id === 'disconnect') await hub.disconnect(channel); else await hub.test(channel, language);
    void vscode.window.showInformationMessage(t(action.id === 'disconnect' ? 'Channel disconnected; local credentials removed.' : 'Test queued. Check delivery status for the result.')); return;
  }
  const channel: Channel = action.id === 'telegram' ? 'telegram' : 'zalo';
  const previous = hub.connections().find(c => c.channel === channel);
  const token = await vscode.window.showInputBox({ title: t(channel === 'telegram' ? 'Telegram BotFather bot token' : 'Zalo OA access token'), password: true, ignoreFocusOut: true, prompt: t('Stored in VS Code SecretStorage. Do not paste tokens into agent chat.') });
  if (!token?.trim()) return;
  const recipient = await vscode.window.showInputBox({ title: t(channel === 'telegram' ? 'Telegram chat ID' : 'Zalo recipient UID (scoped to your OA)'), value: previous?.recipient, validateInput: s => /^-?\d+$/.test(s) ? undefined : t('Enter the numeric recipient ID.') });
  if (!recipient) return;
  const mode = await vscode.window.showQuickPick([
    { id: 'twoWay', label: t('Two-way chat + explicit task commands') }, { id: 'notify', label: t('Notifications only') },
  ], { title: t('Allow agent replies / remote tasks?'), placeHolder: t('Two-way: questions are read-only; /task may edit according to local Allow Edits.') });
  if (!mode) return;
  const folders = vscode.workspace.workspaceFolders;
  const folder = folders?.length === 1 ? folders[0] : await vscode.window.showWorkspaceFolderPick();
  if (!folder) return;
  const c: Connection = { channel, enabled: true, inbound: mode.id === 'twoWay', recipient, cwd: folder.uri.fsPath };
  let secret: string | undefined;
  if (channel === 'telegram' && c.inbound) {
    c.allowedUserId = await vscode.window.showInputBox({ title: t('Your Telegram user ID (allowed sender)'), value: previous?.allowedUserId, prompt: t('Use a dedicated bot for this workspace. Sender and chat IDs are both checked.'), validateInput: s => /^\d+$/.test(s) ? undefined : t('Enter your numeric user ID.') });
    if (!c.allowedUserId) return;
  }
  if (channel === 'zalo' && c.inbound) {
    c.appId = await vscode.window.showInputBox({ title: t('Zalo App ID'), value: previous?.appId, validateInput: s => /^\d+$/.test(s) ? undefined : t('Numeric App ID required.') });
    if (!c.appId) return;
    c.oaId = await vscode.window.showInputBox({ title: t('Zalo Official Account ID'), value: previous?.oaId, validateInput: s => /^\d+$/.test(s) ? undefined : t('Numeric OA ID required.') });
    if (!c.oaId) return;
    secret = await vscode.window.showInputBox({ title: t('Zalo OA webhook secret key'), password: true, ignoreFocusOut: true });
    if (!secret) return;
    const port = await vscode.window.showInputBox({ title: t('Local Zalo webhook port'), value: String(previous?.port ?? 47731), prompt: t('Forward your public HTTPS webhook to http://127.0.0.1:PORT/zalo/webhook'), validateInput: s => Number.isInteger(Number(s)) && Number(s) >= 1024 && Number(s) <= 65535 ? undefined : t('Port must be 1024–65535.') });
    if (!port) return;
    c.port = Number(port);
  }
  await hub.configure(c, token.trim(), secret);
  void vscode.window.showInformationMessage(channel === 'zalo' && c.inbound
    ? t('Zalo configured. Forward HTTPS to 127.0.0.1:{0}/zalo/webhook and register it in Zalo Developer. Use Send Test Message to check outbound permission.', c.port)
    : t('Messaging configured. Use Send Test Message to verify delivery.'));
}
