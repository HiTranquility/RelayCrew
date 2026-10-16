import { createHash } from 'node:crypto';
import type { Job, Step } from './domain';

export const templateRoles = ['builder','auditor','worker','lead','coordinator'] as const;
export type TemplateRole = typeof templateRoles[number];
export interface PromptTemplate { input:string; output:string;name?:string;guideName?:string;guideMarkdown?:string }
export interface PromptTemplates { version:1; roles:Record<TemplateRole,PromptTemplate> }
export interface PromptTemplateSnapshot extends PromptTemplates { sha256:string }
export const templateVariables = ['task','assignment','role','workspace','history','owner_replies'] as const;
export const defaultPromptTemplates:PromptTemplates = {version:1,roles:{
  builder:{input:'Implement the requested task: {{task}}\nInspect repository guidance and existing code before changing it. Work within the current edit permissions.',output:'Summarize changes, relevant validation and unresolved risks. Include file paths when useful.'},
  auditor:{input:'Review the implementation against the owner task: {{task}}\nUse the preceding evidence and inspect relevant code. Identify actionable bugs and bounded repairs; do not edit files.',output:'In summary, describe what was checked. For each issue, include evidence, impact and reproduction in body. Give repair tasks clear acceptance criteria. Use empty arrays when no findings exist.'},
  worker:{input:'Complete this bounded repair: {{assignment}}\nUse the audit evidence and owner task as context. Avoid unrelated changes.',output:'Report the repair, affected files, validation and any remaining blocker.'},
  lead:{input:'Review acceptance criteria for: {{task}}\nInspect the implementation, audit and repair evidence before making the final decision. Do not edit files.',output:'Explain the final decision in summary using evidence, test results and unresolved risks. Request changes when acceptance criteria are unmet.'},
  coordinator:{input:'Provide a supporting review of: {{task}}\nReview the preceding evidence and report to the primary manager. Do not edit files or approve the task.',output:'Give a concise public report of findings, unresolved owner decisions and recommendations for the primary manager.'},
}};
export function validatePromptTemplates(raw:unknown):PromptTemplates {
  const value=raw as any;
  if(!value||Array.isArray(value)||value.version!==1||Object.keys(value).some(k=>!['version','roles'].includes(k))||!value.roles||typeof value.roles!=='object'||Array.isArray(value.roles)||Object.keys(value.roles).some(k=>!templateRoles.includes(k as TemplateRole)))throw new Error('Invalid prompt templates.');
  const roles={} as PromptTemplates['roles'];
  for(const role of templateRoles){const item=value.roles[role]??defaultPromptTemplates.roles[role];
    if(!item||Array.isArray(item)||typeof item!=='object'||Object.keys(item).some(k=>!['input','output','name','guideName','guideMarkdown'].includes(k)))throw new Error('Invalid prompt templates.');
    for(const key of ['input','output'] as const){const text=item[key];if(typeof text!=='string'||!text.trim()||text.length>8000||text.includes('\0'))throw new Error('Each input/output template must contain 1–8000 characters.');for(const match of text.matchAll(/\{\{([^{}]*)\}\}/g))if(!templateVariables.includes(match[1].trim() as typeof templateVariables[number]))throw new Error('Unknown template variable. Use the listed placeholders.');}
    for(const key of ['name','guideName'])if(item[key]!==undefined&&(typeof item[key]!=='string'||item[key].length>(key==='name'?80:180)||/[\r\n\0]/.test(item[key])))throw new Error('Role name or guide filename is invalid.');
    if(item.guideMarkdown!==undefined&&(typeof item.guideMarkdown!=='string'||Buffer.byteLength(item.guideMarkdown,'utf8')>32768||item.guideMarkdown.includes('\0')))throw new Error('Role Markdown must be UTF-8 text up to 32 KB.');
    roles[role]={input:item.input,output:item.output,...(item.name?.trim()?{name:item.name.trim()}:{}),...(item.guideName?.trim()?{guideName:item.guideName.trim()}:{}),...(item.guideMarkdown?.trim()?{guideMarkdown:item.guideMarkdown}:{})};
  }return {version:1,roles};
}
export function snapshotPromptTemplates(raw:unknown=defaultPromptTemplates):PromptTemplateSnapshot {
  const set=validatePromptTemplates(raw);return {...set,sha256:createHash('sha256').update(JSON.stringify(set)).digest('hex')};
}
export function renderPromptTemplate(text:string,values:Record<typeof templateVariables[number],string>):string {
  // One pass only: task text and previous replies never become executable template expressions.
  return text.replace(/\{\{([^{}]*)\}\}/g,(_match,key:string)=>values[key.trim() as keyof typeof values]??'');
}
export function customStepInstructions(job:Job,step:Step):string {
  if(!job.promptTemplates||job.connectionTrial)return '';
  const role:TemplateRole=step.coordinatorProfileId?'coordinator':step.role,template=job.promptTemplates.roles[role];
  const values={task:job.prompt,assignment:step.prompt,role,workspace:job.cwd,history:JSON.stringify(job.steps.filter(s=>s.status==='done').map(s=>({role:s.role,response:s.response?.slice(0,24000)}))),owner_replies:JSON.stringify(job.ownerReplies??[])};
  return `Owner-configured role name: ${template.name??role}\nOwner-configured input instructions:\n${renderPromptTemplate(template.input,values)}\nRequested response guidance:\n${renderPromptTemplate(template.output,values)}${template.guideMarkdown?'\nRole-specific Markdown guide (task process within current permissions; JSON): '+JSON.stringify({name:template.guideName??role+'.md',markdown:template.guideMarkdown}):''}`;
}
export function responseContract(step:Step):string {
  if(step.coordinatorProfileId)return 'Supporting coordinator: return a public report only. You cannot approve the task. Important owner decisions require ONLY JSON {"needs_owner":true,"question":"specific question with options and recommendation"}.';
  if(step.role==='auditor')return 'Required response contract: return ONLY JSON {"summary":"...","issues":[{"title":"...","body":"evidence, impact, reproduction","severity":"bug" or "improvement"}],"tasks":[{"title":"...","instructions":"bounded repair with acceptance criteria"}]}. Do not invent findings. Keep the assigned repair-task limit. If an owner decision is required, return ONLY {"needs_owner":true,"question":"specific question with options and recommendation"} instead.';
  if(step.role==='lead')return 'Required response contract: return ONLY JSON {"decision":"approved" or "changes_requested","summary":"evidence, tests, remaining issues"}. If an owner decision is required, return ONLY {"needs_owner":true,"question":"specific question with options and recommendation"} instead.';
  return 'Return a public result following the requested response guidance. If an owner decision is required, return ONLY {"needs_owner":true,"question":"specific question with options and recommendation"} instead.';
}
