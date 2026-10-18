import {createHash,randomUUID} from 'node:crypto';
import {parseConsoleInput} from './console-input';
import {taskFolderScopes} from './task-folders';
import {taskDirection} from './directions';
import {acceptanceFromText} from './task-insights';
import {accountHealth,type AccountProbe} from './account-health';
import type {Profile,Quota,Role,RoleOverrides,Management} from './domain';

export interface RunReviewContext {
  profiles:Profile[];roles:Record<Role,string>;flow:Role[];overrides?:RoleOverrides;
  roots:string[];probes?:Record<string,AccountProbe>;quotas:Record<string,Quota>;
  allowEdits:boolean;isolateTasks:boolean;queuePaused:boolean;maxReviewRounds:number;
  maxWorkers:number;timeoutMinutes:number;threshold:number;management?:Management;
  auditors?:{profileId:string;name:string}[];routingMode?:string;autoSwitch?:boolean;
  promptHash?:string;workflowHash?:string;delegation?:unknown;
}
export interface ReviewRequest {text:unknown;mode?:unknown;requestId:unknown;cwd:unknown;folders?:unknown;acceptance?:unknown;direction?:unknown;[key:string]:unknown}
export function isTeamRequest(request:{text:unknown;mode?:unknown}):boolean {
  const parsed=parseConsoleInput(request.text);
  return parsed.kind==='task'&&!(request.mode==='chat'&&typeof request.text==='string'&&!request.text.trim().startsWith('/'));
}
export function reviewRun(request:ReviewRequest,context:RunReviewContext,now=Date.now()) {
  if(!isTeamRequest(request))throw new Error('Only a new team task needs a run review.');
  const parsed=parseConsoleInput(request.text);
  if(parsed.kind!=='task')throw new Error('Enter a team task.');
  const folders=request.folders!==undefined?taskFolderScopes(request.folders,context.roots):typeof request.cwd==='string'&&context.roots.includes(request.cwd)?[{path:request.cwd,permission:'auto' as const}]:undefined;
  if(!folders)throw new Error('Select an open workspace folder.');
  const direction=request.direction===undefined?undefined:taskDirection(request.direction);
  const branchBudget=request.autoBranches===undefined?0:request.autoBranches;
  if(!Number.isInteger(branchBudget)||Number(branchBudget)<0||Number(branchBudget)>3)throw new Error('Use a branch budget from zero to three.');
  const branchFolders=Number(branchBudget)>0?taskFolderScopes(request.branchScopes??folders,context.roots):[];
  if(Number(branchBudget)>0&&(!direction||(direction.branches??[]).length>Number(branchBudget)||(direction.branches??[]).some(b=>!branchFolders.some(f=>f.path===b.cwd))))throw new Error('Independent branches exceed the approved folders or branch budget.');
  const criteria=acceptanceFromText([direction?.done,typeof request.acceptance==='string'?request.acceptance:''].filter(Boolean).join('\n')).map(c=>c.text);
  const seats:{role:Role;name:string;profileId:string;ownPolicy?:boolean}[]=[];
  for(const role of context.flow){
    if(role==='lead')for(const id of context.management?.coordinatorIds??[])seats.push({role,name:context.management?.names?.[id]??'Coordinator',profileId:id,ownPolicy:true});
    seats.push({role,name:role,profileId:context.roles[role]});
    if(role==='auditor')for(const reviewer of context.auditors??[])seats.push({role,name:reviewer.name,profileId:reviewer.profileId,ownPolicy:true});
  }
  const team=seats.map(seat=>{
    const profile=context.profiles.find(p=>p.id===seat.profileId);
    if(!profile)throw new Error('Choose an existing account profile.');
    const health=accountHealth(profile,context.probes?.[profile.id],context.quotas[profile.id],context.threshold,now),override=seat.ownPolicy?undefined:context.overrides?.[seat.role];
    return {...seat,label:profile.label,provider:profile.provider,transport:profile.transport??'cli',model:override?.model??profile.model,modelPolicy:override?.modelPolicy??(override?.model?'custom':profile.modelPolicy??(profile.model?'custom':'flagship')),effort:override?.effort??profile.effort,health};
  });
  const warnings:string[]=[];
  if(context.flow.includes('worker'))warnings.push('Worker tasks are determined by the planner/auditor within the saved bounds.');
  if(!criteria.length)warnings.push('No Definition of Done yet. Add criteria so you can verify the result.');
  if(team.some(s=>!s.health.recent))warnings.push('Some account checks are missing or older than five minutes.');
  if(team.some(s=>s.health.quotaState==='Quota unknown'||s.health.quotaState==='Quota stale'))warnings.push('Unknown quota is not available capacity. Automatic fallback still requires a fresh reading.');
  if(team.some(s=>s.health.connection==='Login unverified'))warnings.push('Some CLI identities are unverified. A profile label does not prove a separate login.');
  if(context.routingMode!=='selected'||context.autoSwitch)warnings.push('Routing may choose another eligible account. Live records the account actually used.');
  if(context.queuePaused)warnings.push('Queue paused. Confirming creates a queued task; it will not run yet.');
  return {prompt:parsed.text,folders:folders.map(f=>({...f,effectivePermission:f.permission==='read-only'||!context.allowEdits?'read-only':f.permission})),criteria,team,warnings,
    blocked:team.some(s=>s.health.blocked),maxReviewRounds:context.maxReviewRounds,maxWorkers:context.maxWorkers,timeoutMinutes:context.timeoutMinutes,isolation:context.isolateTasks?'worktree':'shared',branchBudget,branchFolders,
    concurrency:'One task per workspace runner; Live tabs are observers.'};
}
const signature=(request:ReviewRequest,context:RunReviewContext)=>createHash('sha256').update(JSON.stringify({request:Object.fromEntries(Object.entries(request).filter(([k])=>!['action','reviewToken'].includes(k))),context:{...context,probes:undefined,quotas:undefined,queuePaused:undefined}})).digest('hex');
/** Bounded, host-owned review receipts. Never persisted into webview drafts. */
export class RunReviewGate {
  private receipts=new Map<string,{signature:string;until:number}>();
  issue(request:ReviewRequest,context:RunReviewContext,now=Date.now()):string {
    for(const [key,value] of this.receipts)if(value.until<now)this.receipts.delete(key);
    while(this.receipts.size>=20)this.receipts.delete(this.receipts.keys().next().value!);
    const token=randomUUID();this.receipts.set(token,{signature:signature(request,context),until:now+300000});return token;
  }
  verify(token:unknown,request:ReviewRequest,context:RunReviewContext,now=Date.now()):void {
    const receipt=typeof token==='string'?this.receipts.get(token):undefined;
    if(!receipt||receipt.until<now||receipt.signature!==signature(request,context))throw new Error('The task or configuration changed. Review the run again.');
    if(reviewRun(request,context,now).blocked)throw new Error('Resolve blocked accounts, then review the run again.');
  }
}
