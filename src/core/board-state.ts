import {normalizeLayout} from './layout';
const keys=new Set(['tab','pageRequest','scroll','drafts','taskFilter','taskQuery','taskExclude','taskPage','taskPageSize','accountDraft','scheduleDraft','planningDrafts','scheduleView','teamDraft','routingDraft','workflowDraft','assignmentDraft','quotaDraft','trialDraft','templatesDraft','consoleView','mapCanvas','mapEditor','headerParts','mapPercent','mapSelection','consoleSelected','consoleNew','consoleHideSessions','consoleHideComposer','consoleDraft','consoleCriteria','consoleMode','consoleProfile','consoleSendKey','consoleCwd','consoleFolders','directionDraft','branchDraft','maintenanceDraft','quotaWatch','consoleFollow','consoleRequest','consoleReplyVersion','consoleAttachments','layout','panelFloating','panelMinimized','searchFocus','details','scopedFilters','backlogDraft']);
export function safeBoardState(raw:unknown):Record<string,unknown>{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return {};try{if(JSON.stringify(raw).length>768000)return {};}catch{return {};}
 const clean=(v:unknown,depth=0):unknown=>{
  if(depth>12)return undefined;if(typeof v==='string')return v.slice(0,65536);if(typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v)||v===null)return v;
  if(Array.isArray(v))return v.slice(0,1000).map(x=>clean(x,depth+1));if(v&&typeof v==='object'){const result:Record<string,unknown>={};for(const[k,value]of Object.entries(v))if(!/^(?:__proto__|constructor|prototype|token|password|apiKey|webhookSecret|secretValue|secretEnv|env|authorization)$/i.test(k))result[k]=clean(value,depth+1);return result;}return undefined;
 };
 const result:Record<string,unknown>={};for(const[k,v]of Object.entries(raw))if(keys.has(k))result[k]=k==='layout'?normalizeLayout(v):clean(v);return result;
}
