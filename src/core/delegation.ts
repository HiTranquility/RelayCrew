import type {Job,Profile,RoleOverrides} from './domain';
import {defaultPromptTemplates,snapshotPromptTemplates,type PromptTemplates} from './prompt-templates';

export interface DelegationPolicy {workflow:'delivery'|'plan-execute';mode:'adaptive'|'fixed';minWorkers:number;maxWorkers:number}
export const defaultDelegation:DelegationPolicy={workflow:'delivery',mode:'adaptive',minWorkers:0,maxWorkers:4};
export function delegationPolicy(raw:unknown,cap=20):DelegationPolicy{
 const v=raw as Partial<DelegationPolicy>|undefined;if(v===undefined)return {...defaultDelegation,maxWorkers:Math.min(4,cap)};
 if(!v||typeof v!=='object'||Array.isArray(v)||!['delivery','plan-execute'].includes(v.workflow!)||!['adaptive','fixed'].includes(v.mode!)||!Number.isInteger(v.minWorkers)||!Number.isInteger(v.maxWorkers)||v.minWorkers!<0||v.maxWorkers!<v.minWorkers!||v.maxWorkers!>cap||v.mode==='fixed'&&v.minWorkers!==v.maxWorkers)throw new Error('Choose adaptive worker bounds or an exact fixed count within the global child-task limit.');
 return {workflow:v.workflow!,mode:v.mode!,minWorkers:v.minWorkers!,maxWorkers:v.maxWorkers!};
}
export function workerBounds(job:Job,cap:number){const policy=job.delegation?delegationPolicy(job.delegation):undefined,max=Math.min(policy?.maxWorkers??cap,cap);if((policy?.minWorkers??0)>max)throw new Error('Worker minimum exceeds the global child-task limit.');return {min:policy?.minWorkers??0,max};}
export function planningPrompt(job:Job,cap:number):string{
 const {min,max}=workerBounds(job,cap);return `Act as the planner. Read the dispatcher's brief and inspect only the code needed to plan the owner's task. Do not edit files. The workbench will dispatch your tasks to the configured executor account ${job.roles.worker} in sequence, then send evidence to the manager. Return ONLY JSON {"summary":"public plan and delegation rationale","issues":[],"tasks":[{"title":"bounded task","instructions":"scope, allowed actions, expected evidence and acceptance criteria"}]}. Plan ${min===max?'exactly '+max:'between '+min+' and '+max} worker tasks. Do not invent bugs or pad tasks. Ask the owner using needs_owner if a meaningful plan cannot fit these bounds. Do not spawn provider-native subagents or call another AI CLI; the workbench alone dispatches workers. Each worker must stay within the owner's permissions.`;
}
export function delegationInstructions(job:Job):string{
 if(!job.delegation)return '';
 const p=job.delegation;return `Workbench delegation policy: ${JSON.stringify(p)}. Worker steps run sequentially, one level deep; no recursive or provider-native subagents. ${p.mode==='fixed'?'The configured worker count is exact.':'The planner/auditor chooses the worker count within the configured bounds.'} Supporting coordinator steps are separately listed in the team and cannot spawn workers. Max planned CLI calls for a successful single attempt: ${3+p.maxWorkers+(job.auditors?.length??0)+(job.management?.coordinatorIds.length??0)} (dispatcher/dev + planner/audit + workers + coordinators + manager); retries remain subject to the existing retry and quota limits.`;
}
export function applyRoleOverride(profile:Profile,override:RoleOverrides[keyof RoleOverrides]):Profile{
 const policy=override?.modelPolicy??(override?.model?'custom':undefined);return {...profile,...(policy?{modelPolicy:policy,model:policy==='custom'?override?.model:undefined}:{}),...(override?.effort?{effort:override.effort}:{})};
}
export function jobPromptTemplates(raw:PromptTemplates|undefined,policy?:DelegationPolicy){
 const templates=structuredClone(raw??defaultPromptTemplates);if(policy?.workflow==='plan-execute'){
  const replacements={builder:{name:'Dispatcher',input:'Prepare a concise delegation brief for {{task}}. Inspect relevant guidance and identify the scope and acceptance criteria. Do not implement or edit files.',output:'Give the planner clear scope, constraints and expected evidence.'},auditor:{name:'Planner',input:'Plan bounded executor tasks for {{task}} using the dispatcher brief. Do not edit files or invent findings.',output:'Use the required JSON task-list contract and the configured worker bounds.'},worker:{name:'Executor',input:'Execute this assigned bounded task: {{assignment}}. Respect the owner scope and edit permissions.',output:'Report concrete evidence, file paths, validation and blockers for the manager.'},lead:{name:'Manager',input:'Review the dispatch, plan and executor evidence for {{task}}. Do not edit files.',output:'Return the required decision JSON with evidence, limits and remaining risks.'}};
  for(const role of ['builder','auditor','worker','lead'] as const){const previous=templates.roles[role],base=defaultPromptTemplates.roles[role];templates.roles[role]={...previous,...(previous.input===base.input?{input:replacements[role].input}:{}),...(previous.output===base.output?{output:replacements[role].output}:{}),name:previous.name||replacements[role].name};}
 }return snapshotPromptTemplates(templates);
}
