import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { renderBoard } from '../src/ui/board';
import { flowEditor } from '../src/ui/flow-editor';
import { newJob } from '../src/core/engine';
import type { Profile } from '../src/core/domain';
const profiles:Profile[]=[
  {id:'codex-dev',label:'Codex · Dev account',provider:'codex',executable:'codex',model:'configured-dev-model',effort:'medium'},
  {id:'claude-review',label:'Claude · Reviewer',provider:'claude',executable:'claude',model:'configured-review-model',effort:'high'},
  {id:'gemini-worker',label:'Gemini · Worker',provider:'gemini',executable:'gemini',model:'configured-worker-model'}
];
const roles={builder:'codex-dev',auditor:'claude-review',worker:'gemini-worker',lead:'codex-dev'};
const job=newJob('Thêm kiểm tra retry khi API trả lỗi và ghi báo cáo cho owner','demo-workspace',roles);
job.status='running';job.steps=[
  {role:'builder',title:'Implement retry policy',prompt:'Implement bounded retries with tests.',profileId:'codex-dev',model:'configured-dev-model',effort:'medium',status:'done',response:'Đã thêm retry có giới hạn và kiểm tra timeout. Tests đã qua.'},
  {role:'auditor',title:'Audit / create issues',prompt:'Audit the implementation and return evidence.',profileId:'claude-review',model:'configured-review-model',status:'running',startedAt:new Date(Date.now()-82_000).toISOString(),phase:'cli',timeoutAt:new Date(Date.now()+25*60_000).toISOString()}
];
job.timeline=[{at:new Date().toISOString(),from:'owner',to:'Dev · Codex',kind:'task',text:job.prompt},{at:new Date().toISOString(),from:'Dev · Codex',to:'Audit · Claude',kind:'handoff',text:'Đã triển khai retry; kiểm tra giúp các nhánh timeout và rate limit.'},{at:new Date().toISOString(),from:'Audit · Claude',to:'orchestrator / observer',kind:'stream',text:'Đang xem xét giới hạn số lần thử và kiểm tra trường hợp HTTP 429.'}];
const theme=':root{--vscode-font-size:14px;--vscode-font-family:Segoe UI,Arial,sans-serif;--vscode-foreground:#e2e8f0;--vscode-editor-background:#10151e;--vscode-descriptionForeground:#94a3b8;--vscode-panel-border:#2a3545;--vscode-focusBorder:#4da3ff;--vscode-badge-background:#204a6e;--vscode-badge-foreground:#cce9ff;--vscode-input-background:#192331;--vscode-input-foreground:#e2e8f0;--vscode-button-background:#1673bd;--vscode-button-foreground:#ffffff;--vscode-button-secondaryBackground:#22344a;--vscode-button-secondaryForeground:#d8e9fc;--vscode-button-secondaryHoverBackground:#294763}';
async function main(){
const dir=resolve('docs/previews');await mkdir(dir,{recursive:true});
const fakeApi='({getState:()=>({}),setState:()=>{},postMessage:()=>{const x=document.getElementById("saved");if(x)x.textContent="Demo preview — mở extension để lưu setup thật.";}})';
const prepare=(html:string)=>html.replace('</style>',theme+'</style>').replace('acquireVsCodeApi()',fakeApi).replace('<h1>','<p class="muted">DEMO DATA · UI preview</p><h1>').replace(/[ \t]+$/gm,'');
await writeFile(join(dir,'flow.html'),prepare(flowEditor(profiles,['builder','auditor','worker','lead'],roles,{})));
await writeFile(join(dir,'board.html'),prepare(renderBoard([job],profiles,Object.fromEntries(profiles.map((p,i)=>[p.id,{usedPercent:[42,68,18][i],observedAt:new Date().toISOString(),source:'demo only'}])),{enabled:false,items:[],remaining:0,until:0},'Telegram: two-way · demo\nZalo: webhook · demo',{queuePaused:false,autoSwitch:true,resumeAfterQuota:true,resumeProviderLimited:false,allowEdits:true,routingMode:'selected',timeoutMinutes:30})));
console.log(dir);
}
void main().catch(error=>{console.error(error);process.exitCode=1;});
