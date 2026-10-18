import type {Job} from '../core/domain';
import {translator,type Language} from '../core/i18n';
import {escapeHtml as h} from './html';

/** Display the saved assignment. Navigation never retargets a running job. */
export function sessionScope(job:Job,language:Language):string {
 const t=translator(language),permission=job.simulation?t('Simulation · no file access'):job.readOnly||job.permission==='read-only'?t('Read-only'):job.permission==='full'?t('Full CLI permissions'):t('Team CLI policy');
 const folder=job.cwd.split(/[\\/]/).filter(Boolean).at(-1)??job.cwd;
 return `<details class="session-scope" data-detail="scope:${h(job.id)}"><summary>${h(t('Folders & permissions'))} · <strong>${h(folder)}</strong><span class="scope-permission">${h(permission)}</span></summary><dl><dt>${h(t('Assigned workspace'))}</dt><dd>${h(job.cwd)}</dd>${job.sourceCwd&&job.sourceCwd!==job.cwd?`<dt>${h(t('Original folder'))}</dt><dd>${h(job.sourceCwd)}</dd>`:''}${job.worktree?`<dt>${h(t('Worktree branch'))}</dt><dd>${h(job.worktree.branch)}</dd>`:''}<dt>${h(t('Execution policy'))}</dt><dd>${h(permission)}</dd></dl><p>${h(t('Folder and permissions belong to this task. Choose folders for a new task without changing this assignment.'))}</p><div>${!job.simulation?`<button type="button" data-session-scope="reveal" data-scope-job="${h(job.id)}">${h(t('Show folder in Explorer'))}</button>`:''}<button type="button" data-session-scope="prepare" data-scope-job="${h(job.id)}">${h(t('New task / folders'))}</button></div></details>`;
}

export const sessionScopeStyles=String.raw`
.session-scope{margin:10px 12px;padding:10px 12px;border:1px solid var(--rc-border);border-radius:8px;background:var(--rc-soft)}.session-scope summary{cursor:pointer;line-height:1.8;overflow-wrap:anywhere}.scope-permission{display:inline-block;margin-left:10px;padding:1px 8px;border:1px solid var(--rc-border);border-radius:12px;font-size:.82em}.session-scope dl{display:grid;grid-template-columns:minmax(100px,auto) minmax(0,1fr);gap:8px 14px;font-size:.9em}.session-scope dt{color:var(--rc-muted)}.session-scope dd{margin:0;overflow-wrap:anywhere;font-family:var(--vscode-editor-font-family)}.session-scope p{font-size:.85em;color:var(--rc-muted);line-height:1.6}.session-scope>div{display:flex;gap:8px;flex-wrap:wrap}@media(max-width:500px){.session-scope dl{grid-template-columns:1fr}.session-scope dd{margin-bottom:6px}}
`;
