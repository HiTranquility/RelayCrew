import {translator,type Language} from '../core/i18n';
import {escapeHtml as h} from './html';

export function sessionViewToolbar(language:Language):string {
 const tr=(s:string)=>h(translator(language)(s));
 return `<nav class="session-view-toolbar" aria-label="${tr('Live sections')}"><span>${tr('Show in Live')}</span>${[['conversation','Conversation'],['agents','Agents & flow'],['files','Changed files'],['activity','Technical activity']].map(([id,label])=>`<button type="button" data-session-view="${id}" aria-pressed="true">${tr(label)}</button>`).join('')}<button type="button" class="text-button" data-session-view="all">${tr('Show all')}</button><button type="button" class="text-button" data-session-view="compact">${tr('Minimize content')}</button></nav><p class="session-view-hint">${tr('Choose a section to show or hide. Views can be closed while the task keeps running.')}</p>`;
}

/** Shared by the board and the detached Live tab; stores visibility only. */
export const sessionViewsClient=String.raw`
var sessionViews=typeof saved.sessionViews==='object'&&saved.sessionViews&&!Array.isArray(saved.sessionViews)?saved.sessionViews:{};
function applySessionViews(){for(const panel of document.querySelectorAll('[data-session-panel]')){const state=sessionViews[panel.dataset.sessionPanel]||{};for(const part of panel.querySelectorAll('[data-session-part]'))part.hidden=state[part.dataset.sessionPart]===false;for(const button of panel.querySelectorAll('[data-session-view]'))if(!['all','compact'].includes(button.dataset.sessionView))button.setAttribute('aria-pressed',String(state[button.dataset.sessionView]!==false));}}
document.addEventListener('click',e=>{const button=e.target.closest('[data-session-view]');if(!button)return;const panel=button.closest('[data-session-panel]');if(!panel)return;const id=panel.dataset.sessionPanel,view=button.dataset.sessionView,state=sessionViews[id]||{};if(view==='all'||view==='compact'){for(const key of ['conversation','agents','files','activity'])state[key]=view==='all';}else state[view]=state[view]===false;sessionViews[id]=state;const ids=Object.keys(sessionViews);for(const old of ids.slice(0,Math.max(0,ids.length-100)))delete sessionViews[old];applySessionViews();persist();});
applySessionViews();
`;

export const sessionViewsStyles=String.raw`
.session-view-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin:12px 0 4px;padding:10px;border:1px solid var(--rc-border);border-radius:7px;background:var(--vscode-editor-background)}.session-view-toolbar>span{font-weight:600;margin-right:5px}.session-view-toolbar button{min-height:32px;padding:5px 10px;border-radius:5px}.session-view-toolbar button[aria-pressed=true]{border-color:var(--vscode-focusBorder);color:var(--vscode-textLink-foreground);background:var(--rc-soft)}.session-view-hint{font-size:.85em;color:var(--rc-muted);margin:5px 0 14px}.session-part{min-width:0}.session-part>header{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:12px 0 4px}.session-part>header h3{margin:0}.session-part>header button{min-width:30px;padding:3px 8px}.session-part[hidden]{display:none!important}.session-part-conversation{border-top:1px solid var(--rc-border);margin-top:16px}.session-part .team-conversation{max-height:55vh;min-height:140px}.session-part .console-activity{margin-top:8px}.console-session .execution-monitor{position:static}.session-part:focus-within{outline-color:var(--vscode-focusBorder)}
`;
