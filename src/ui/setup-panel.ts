import { roleLabel, translator, type Language } from '../core/i18n';
import { numericSettings } from '../core/settings';
import type { BoardOptions } from './board';
import { escapeHtml as h } from './html';

export function renderSetupPanel(options: BoardOptions | undefined, language: Language): string {
  const t = translator(language), tr = (message: string) => h(t(message));
  const button = (action: string, message: string) => `<button data-action="${action}">${tr(message)}</button>`;
  return `<section><h2>${tr('Quick setup')}</h2><p class="muted">${tr('Configure the team without editing JSON. Profiles use native VS Code dialogs.')}</p>
    <div class="setup-actions">${button('profiles','Configure profiles')}${button('flow','Configure team flow')}${button('connections','Messaging connections')}${button('shortcuts','Keyboard shortcuts')}${button('settings','All VS Code settings')}</div>
    <p class="flow-summary">${(options?.flow??['builder','auditor','worker','lead']).map(role=>`<span class="badge">${h(role==='lead'?t('Primary manager'):roleLabel(role,language))}</span>`).join(' <span aria-hidden="true">→</span> ')}</p>
    <label class="setting-row"><span>${tr('Language')}</span><select data-language aria-label="${tr('Language')}">${[['auto',t('Follow VS Code')],['en','English'],['vi','Tiếng Việt']].map(([id,label])=>`<option value="${id}" ${(options?.languagePreference??'auto')===id?'selected':''}>${h(label)}</option>`).join('')}</select></label>
    <p class="muted">${tr('Runtime language changes immediately. Command Palette titles follow the VS Code display language.')}</p><label class="check-row"><input type="checkbox" data-setting="isolateTasks" ${options?.isolateTasks?'checked':''}>${tr('Create a separate Git worktree for each new task')}</label><p class="muted">${tr('Requires committed source changes. Task branches and folders are kept for review; nothing is merged automatically.')}</p><label class="check-row"><input type="checkbox" data-setting="openTasksInCodex" ${options?.openTasksInCodex?'checked':''}>${tr('Prepare a Codex desktop chat for each new task')}</label><p class="muted">${tr('Opens the task folder once when execution starts. You send prompts in Codex; RelayCrew continues its own CLI workflow.')}</p></section>
    <section><h2>${tr('Execution & quota')}</h2>${Object.entries(numericSettings).map(([key,rule])=>`<label class="setting-row" for="setting-${key}"><span>${tr(rule.label)}<small>${rule.min}–${rule.max}</small></span><input id="setting-${key}" data-number-setting="${key}" type="number" required min="${rule.min}" max="${rule.max}" step="${rule.integer?'1':'any'}" value="${h(options?.settings?.[key]??rule.default)}"></label>`).join('')}
    <label class="check-row"><input type="checkbox" data-setting="backupBeforeEdits" ${options?.backupBeforeEdits!==false?'checked':''}>${tr('Back up source before edits')}</label>
    <p>${button('routing','Configure rotation pool')}${button('backups','Backups')}</p><button class="primary" data-action="saveSettings">${tr('Apply settings')}</button><span id="settings-status" role="status" aria-live="polite"></span></section>`;
}
