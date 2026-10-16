import * as vscode from 'vscode';
import { randomUUID } from 'node:crypto';
import { isAbsolute } from 'node:path';
import { validateProfiles, type Profile, type Provider } from '../core/domain';
import { translator, type Language } from '../core/i18n';

/** Native VS Code inputs keep profile setup accessible without exposing env/secrets in webviews. */
export async function editProfiles(language: Language, lockedIds: Set<string>, selectedId?: string): Promise<void> {
  const t = translator(language), configuration = vscode.workspace.getConfiguration('aiTeam');
  const profiles = validateProfiles(configuration.get('profiles'));
  const action = selectedId ? { id: 'edit', profile: selectedId } : await vscode.window.showQuickPick([
    { id: 'add', label: t('Add account profile') }, ...profiles.map(profile => ({ id: 'edit', label: profile.label, description: `${profile.id} · ${profile.provider} · ${profile.model || t('CLI default')}`, profile: profile.id })),
    { id: 'advanced', label: t('Advanced profile settings (environment / secrets)') },
  ], { title: 'RelayCrew · ' + t('Configure profiles') });
  if (!action) return;
  if (action.id === 'advanced') { await vscode.commands.executeCommand('workbench.action.openSettings', '@id:aiTeam.profiles'); return; }
  const previous = 'profile' in action ? profiles.find(profile => profile.id === action.profile) : undefined;
  if (action.id === 'edit' && !previous) return;
  if (previous) {
    const operation = await vscode.window.showQuickPick([{ id: 'edit', label: t('Edit account profile') }, { id: 'environment', label: t('Environment variables / account isolation') }, { id: 'secretNames', label: t('Configure secret variable names') }, { id: 'secret', label: t('Store profile secret') }, { id: 'delete', label: t('Delete account profile') }], { title: previous.label });
    if (!operation) return;
    if (operation.id === 'secret') { await vscode.commands.executeCommand('aiTeam.secret', previous.id); return; }
    if (operation.id === 'secretNames') {
      const value=await vscode.window.showInputBox({title:t('Secret variable names (comma separated)'),value:(previous.secretEnv??[]).join(', '),prompt:t('Names only. Use Store Profile Secret for values; credentials stay in SecretStorage.'),validateInput:value=>value.split(',').filter(name=>name.trim()).every(name=>/^[A-Za-z_][A-Za-z0-9_]*$/.test(name.trim()))?undefined:t('Enter valid environment variable names.')});
      if(value===undefined)return;const secretEnv=[...new Set(value.split(',').map(name=>name.trim()).filter(Boolean))];
      await configuration.update('profiles',profiles.map(profile=>profile.id===previous.id?{...profile,secretEnv}:profile),vscode.ConfigurationTarget.Global);return;
    }
    if (operation.id === 'environment') {
      const env={...previous.env};
      const selected=await vscode.window.showQuickPick([{id:'',label:t('Add environment variable')},...Object.keys(env).map(key=>({id:key,label:key}))],{title:t('Environment variables / account isolation')});if(!selected)return;
      const key=selected.id||await vscode.window.showInputBox({title:t('Environment variable name'),validateInput:key=>/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)?undefined:t('Enter valid environment variable names.')});if(!key)return;
      const action=selected.id?await vscode.window.showQuickPick([{id:'edit',label:t('Edit variable')},{id:'remove',label:t('Remove variable')}],{title:key}):{id:'edit'};if(!action)return;
      if(action.id==='remove')delete env[key];else{
        const value=await vscode.window.showInputBox({title:key,value:env[key],password:true,ignoreFocusOut:true,prompt:t('Use paths/options here. For tokens, configure secret variable names and store their values in SecretStorage.')});if(value===undefined)return;env[key]=value;
      }
      await configuration.update('profiles',validateProfiles(profiles.map(profile=>profile.id===previous.id?{...profile,env}:profile)),vscode.ConfigurationTarget.Global);return;
    }
    if (operation.id === 'delete') {
      if (lockedIds.has(previous.id)) throw new Error(t('Reassign this account in the team flow and unfinished tasks before deleting it.'));
      await configuration.update('profiles', profiles.filter(profile => profile.id !== previous.id), vscode.ConfigurationTarget.Global); return;
    }
  }
  const provider = previous?.provider ?? (await vscode.window.showQuickPick(['codex', 'claude', 'gemini'] as Provider[], { title: t('Provider') }));
  if (!provider || !['codex','claude','gemini'].includes(provider)) return;
  const input = async (title: string, value = '', allowEmpty = false) => vscode.window.showInputBox({ title: t(title), value, ignoreFocusOut: true, validateInput: value => /[\r\n\0]/.test(value) || !allowEmpty && !value.trim() ? t('Enter a value on one line.') : undefined });
  const label = await input('Account label', previous?.label ?? `${provider} · account`); if (label === undefined) return;
  const executable = await input('CLI executable or absolute path', previous?.executable ?? provider); if (executable === undefined) return;
  const model = await input('Model ID (empty uses CLI default)', previous?.model, true); if (model === undefined) return;
  const effort = await input('Reasoning effort (empty uses CLI default)', previous?.effort, true); if (effort === undefined) return;
  const quotaFile = await vscode.window.showInputBox({ title: t('Quota JSON file (optional absolute path)'), value: previous?.quotaFile, ignoreFocusOut: true, validateInput: value => value.trim() && !isAbsolute(value.trim()) ? t('Use an absolute path or leave empty.') : undefined });
  if (quotaFile === undefined) return;
  const profile: Profile = { ...previous, id: previous?.id ?? `${provider}-${randomUUID().slice(0, 8)}`, label: label.trim(), provider: provider as Provider, executable: executable.trim(), model: model.trim() || undefined, effort: effort.trim() || undefined, quotaFile: quotaFile.trim() || undefined };
  const next = previous ? profiles.map(candidate => candidate.id === previous.id ? profile : candidate) : [...profiles, profile];
  await configuration.update('profiles', validateProfiles(next), vscode.ConfigurationTarget.Global);
  void vscode.window.showInformationMessage(t('Account profile saved. Authenticate the CLI separately; tokens belong in SecretStorage.'));
}
