import type {StoragePreview} from '../storage/maintenance';
import {translator,type Language} from '../core/i18n';
import {escapeHtml as h} from './html';

export function storagePanel(language:Language):string {
  const tr=(s:string)=>h(translator(language)(s));
  return `<section id="setup-storage" class="config-section"><h2>${tr('Saved data & retention')}</h2><p>${tr('Preview disposable workspace data before cleanup. Account secrets, active sessions, source snapshots and repository files are protected.')}</p><form id="storage-form" class="form-grid"><label>${tr('Keep state backups')}<input name="keepBackups" type="number" min="5" max="50" value="20" required></label><label>${tr('Orphan age (days)')}<input name="orphanDays" type="number" min="7" max="365" value="30" required></label><button type="submit">${tr('Inspect and preview cleanup')}</button></form><div id="storage-result" role="status"></div><div class="setup-actions"><button type="button" data-action="backups">${tr('Open backup locations')}</button><button type="button" data-action="pauseQueue">${tr('Pause / resume queue')}</button></div></section>`;
}
export function storagePreviewMarkup(plan:StoragePreview,language:Language):string {
  const t=translator(language),tr=(s:string,...v:unknown[])=>h(t(s,...v));
  return `<p>${tr('Inspected state, reports and attachment data')}: <b>${(plan.totalBytes/1048576).toFixed(2)} MB</b> · ${tr('Eligible for cleanup')}: <b>${plan.entries.length} ${tr('files')} / ${(plan.reclaimBytes/1048576).toFixed(2)} MB</b></p><p>${tr('Referenced attachments and reports stay. At least five recent state backups stay. Nothing outside this workspace storage is deleted.')}</p>${plan.entries.length?`<details><summary>${tr('Review exact cleanup candidates')}</summary><ul>${plan.entries.slice(0,200).map(e=>`<li><code>${h(e.path)}</code> · ${e.bytes} B</li>`).join('')}</ul>${plan.entries.length>200?`<p>${tr('First 200 candidates shown; narrow the age window for a smaller selection.')}</p>`:''}</details><button type="button" class="danger" data-storage-apply="${h(plan.token)}">${tr('Confirm cleanup of the previewed files')}</button>`:`<p>${tr('Nothing eligible. Your referenced data remains intact.')}</p>`}`;
}
export const storageClient=String.raw`
let storagePending=false;
document.addEventListener('submit',e=>{if(e.target.id!=='storage-form')return;e.preventDefault();const form=e.target;if(storagePending||!form.reportValidity())return;storagePending=true;form.querySelector('button').disabled=true;document.getElementById('storage-result').textContent='…';vscode.postMessage({action:'storageInspect',keepBackups:Number(form.elements.keepBackups.value),orphanDays:Number(form.elements.orphanDays.value)});});
document.addEventListener('click',e=>{const b=e.target.closest('[data-storage-apply]');if(!b||storagePending)return;storagePending=true;b.disabled=true;vscode.postMessage({action:'storageCleanup',token:b.dataset.storageApply});});
window.addEventListener('message',e=>{if(e.data.type!=='storageResult')return;storagePending=false;const form=document.getElementById('storage-form'),result=document.getElementById('storage-result');form.querySelector('button').disabled=false;if(e.data.html)result.innerHTML=e.data.html;else result.textContent=e.data.message;});
`;
