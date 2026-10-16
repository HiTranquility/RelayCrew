import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { renderBoard } from '../src/ui/board';
import { flowEditor } from '../src/ui/flow-editor';
import { newJob } from '../src/core/engine';
import { emptyDailyPlan, startDailyPlan, syncDecisions } from '../src/core/daily-plan';
import type { Profile } from '../src/core/domain';

const profiles:Profile[]=[
  {id:'codex-dev',label:'Codex · Dev account',provider:'codex',executable:'codex',model:'configured-dev-model',effort:'medium'},
  {id:'claude-manager',label:'Claude · Primary manager',provider:'claude',executable:'claude',model:'configured-manager-model',effort:'high'},
  {id:'claude-support',label:'Claude · Supporting coordinator',provider:'claude',executable:'claude',model:'configured-review-model',effort:'medium'},
  {id:'gemini-worker',label:'Gemini · Excluded from daily plan',provider:'gemini',executable:'gemini',model:'configured-worker-model'}
];
const roles={builder:'codex-dev',auditor:'claude-support',worker:'gemini-worker',lead:'claude-manager'};
const management={primaryProfileId:'claude-manager',coordinatorIds:['claude-support']};
const job=newJob('Add bounded API retries and report the result to the owner','/demo/relay-app',roles,undefined,{},management);
job.status='running';job.steps=[
  {role:'builder',title:'Implement',prompt:'Implement bounded retries with tests.',profileId:'codex-dev',model:'configured-dev-model',effort:'medium',status:'done',response:'Added bounded retries and timeout coverage. Tests passed.'},
  {role:'auditor',title:'Audit / create issues',prompt:'Audit the implementation and return evidence.',profileId:'claude-support',model:'configured-review-model',status:'running',startedAt:new Date(Date.now()-82_000).toISOString(),phase:'cli',timeoutAt:new Date(Date.now()+25*60_000).toISOString()},
  {role:'lead',coordinatorProfileId:'claude-support',title:'Coordinator report',prompt:'Report findings to the primary manager.',status:'pending'},
  {role:'lead',title:'Tech lead decision',prompt:'Review the evidence and decide.',status:'pending'}
];
job.sourceCwd='/demo/relay-app';job.cwd='/demo/worktrees/api-retries';job.isolationMode='worktree';
job.worktree={path:job.cwd,repository:job.sourceCwd,branch:'relaycrew/task-demo-api-retries',baseCommit:'demo-commit'};
job.timeline=[{at:new Date().toISOString(),from:'owner',to:'Dev · Codex',kind:'task',text:job.prompt},{at:new Date().toISOString(),from:'Dev · Codex',to:'Audit · Claude',kind:'handoff',text:'Retry implementation is ready. Please check timeout and rate-limit cases.'},{at:new Date().toISOString(),from:'Audit · Claude',to:'orchestrator / observer',kind:'stream',text:'Reviewing the attempt budget and HTTP 429 coverage.'}];
const daily=emptyDailyPlan();startDailyPlan(daily,'/demo/relay-app','Asia/Bangkok',profiles.slice(0,3).map(p=>p.id),12,95);daily.accounts['gemini-worker']=false;daily.enabled=false;
const blocked=newJob('Choose a database migration strategy','/demo/relay-app',roles,undefined,{},management);blocked.status='waiting_owner';blocked.ownerQuestion='Should the migration preserve the existing API? Option A is compatible; option B changes the API. Recommendation: A.';blocked.steps[0].status='waiting_owner';blocked.steps[0].profileId='codex-dev';blocked.dailyItemId='demo-decision';
daily.items.push({id:'demo-decision',day:daily.day,profileId:'codex-dev',category:'task',prompt:'Choose a database migration strategy',jobId:blocked.id});syncDecisions(daily,[blocked]);
const theme=':root{--vscode-font-size:13px;--vscode-editor-font-size:12px;--vscode-font-family:Segoe UI,Arial,sans-serif;--vscode-editor-font-family:Consolas,monospace;--vscode-foreground:#cccccc;--vscode-editor-background:#1f1f1f;--vscode-descriptionForeground:#9d9d9d;--vscode-panel-border:#3c3c3c;--vscode-focusBorder:#007fd4;--vscode-badge-background:#313131;--vscode-badge-foreground:#cccccc;--vscode-input-background:#313131;--vscode-input-foreground:#cccccc;--vscode-input-border:#3c3c3c;--vscode-button-background:#0078d4;--vscode-button-foreground:#ffffff;--vscode-button-hoverBackground:#026ec1;--vscode-button-secondaryBackground:#313131;--vscode-button-secondaryForeground:#cccccc;--vscode-button-secondaryHoverBackground:#3c3c3c;--vscode-editorGroupHeader-tabsBackground:#181818;--vscode-tab-activeBackground:#1f1f1f;--vscode-tab-activeForeground:#ffffff;--vscode-tab-inactiveForeground:#9d9d9d;--vscode-tab-activeBorderTop:#0078d4;--vscode-list-hoverBackground:#2b2d2e;--vscode-checkbox-background:#0078d4}';
async function main(){
  const dir=resolve('docs/previews');await mkdir(dir,{recursive:true});
  const fakeApi='({getState:()=>JSON.parse(sessionStorage.getItem("relaycrew-preview")||"{}"),setState:s=>sessionStorage.setItem("relaycrew-preview",JSON.stringify(s)),postMessage:m=>{(window.__messages||=[]).push(m);}})';
  const prepare=(html:string)=>html.replace('</style>',theme+'</style>').replace('acquireVsCodeApi()',fakeApi).replace('<body>','<body><div style="padding:6px 20px;font-size:11px;color:var(--vscode-descriptionForeground);border-bottom:1px solid var(--vscode-panel-border)">DEMO DATA · UI preview · No agents, accounts or deliveries run here.</div>').replace(/[ \t]+$/gm,'');
  for(const language of ['en','vi'] as const){
    const suffix=language==='en'?'':'.vi';
    await writeFile(join(dir,`flow${suffix}.html`),prepare(flowEditor(profiles,['builder','auditor','worker','lead'],roles,{},language,management)));
    await writeFile(join(dir,`board${suffix}.html`),prepare(renderBoard([job,blocked],profiles,Object.fromEntries(profiles.map((p,i)=>[p.id,{usedPercent:[42,68,35,18][i],observedAt:new Date().toISOString(),source:'demo only'}])),{enabled:false,items:[],remaining:0,until:0},'Telegram: two-way · demo\nZalo: webhook · demo',{queuePaused:false,autoSwitch:true,resumeAfterQuota:true,resumeProviderLimited:false,allowEdits:false,routingMode:'selected',timeoutMinutes:30,language,languagePreference:language,roles,management,dailyPlan:daily,projectRoots:[{name:'Relay App',path:'/demo/relay-app'},{name:'Design System',path:'/demo/design-system'}],flow:['builder','auditor','worker','lead']})));
  }
  for(const language of ['en','vi'] as const)await writeFile(join(dir,language==='en'?'welcome.html':'welcome.vi.html'),prepare(renderBoard([],profiles,{}, {enabled:false,items:[],remaining:0,until:0},'No channels connected',{queuePaused:false,autoSwitch:false,resumeAfterQuota:false,resumeProviderLimited:false,allowEdits:false,routingMode:'selected',timeoutMinutes:30,language,roles,management,projectRoots:[{name:'Relay App',path:'/demo/relay-app'}]})));
  console.log(dir);
}
void main().catch(error=>{console.error(error);process.exitCode=1;});
