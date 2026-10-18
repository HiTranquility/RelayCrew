import type {Job} from './domain';

const publicKinds=new Set(['assignment','response','stream','assistant','tool','error','status','handoff','question','owner_reply','owner_decision','account_switch','recovery','model_selection']);
/** Portable public evidence only; never serialize workspace state or account configuration. */
export function exportSession(job:Job,at=new Date().toISOString()) {
  return {format:'relaycrew-session',version:1,exportedAt:at,session:{
    id:job.id,prompt:job.prompt,status:job.status,createdAt:job.createdAt,cwd:job.cwd,sourceCwd:job.sourceCwd,
    parentSessionId:job.parentSessionId,flow:job.flow,roles:job.roles,permission:job.permission,readOnly:job.readOnly,
    reviewPolicy:job.reviewPolicy,reviewStop:job.reviewStop,restartRecovery:job.restartRecovery,acceptance:job.acceptance,
    steps:job.steps.map(s=>({role:s.role,title:s.title,profileId:s.profileId,model:s.model,modelSource:s.modelSource,effort:s.effort,status:s.status,request:s.request??s.prompt,response:s.response,error:s.error,attempts:s.attempts,limitRetries:s.limitRetries,startedAt:s.startedAt,finishedAt:s.finishedAt})),
    timeline:(job.timeline??[]).filter(e=>publicKinds.has(e.kind)).map(e=>({at:e.at,from:e.from,to:e.to,kind:e.kind,text:e.text,stepIndex:e.stepIndex,profileId:e.profileId,provider:e.provider})),
    fileTracking:job.fileTracking,fileChanges:(job.fileChanges??[]).map(f=>({path:f.path,previousPath:f.previousPath,kind:f.kind,at:f.at,stepIndex:f.stepIndex,reverted:f.reverted})),
    children:(job.nativeAgentRuns??[]).map(a=>({id:a.id,parentId:a.parentId,name:a.name,status:a.status,stepIndex:a.stepIndex,profileId:a.profileId,model:a.model,effort:a.effort,assignment:a.assignment,progress:a.progress,response:a.response,tools:a.tools?.map(t=>({id:t.id,command:t.command,status:t.status,cwd:t.cwd})),startedAt:a.startedAt,updatedAt:a.updatedAt})),
    recoveryHistory:job.recoveryHistory,error:job.error
  }};
}
export function sessionEvidenceMarkdown(job:Job):string {
  const evidence=exportSession(job).session;
  return '\n## Observed workspace changes\n\nTracking: '+(evidence.fileTracking??'not started')+'; concurrent user edits may also appear.\n\n'+(evidence.fileChanges.map(f=>`- ${f.reverted?'Reverted · ':''}${f.kind}: ${f.path} (step ${f.stepIndex+1})`).join('\n')||'No file changes recorded.')+
    '\n\n## Recorded native children\n\n'+(evidence.children.map(a=>`### ${a.name} · ${a.status}\n\nID: ${a.id}; parent: ${a.parentId??'unknown'}; step: ${a.stepIndex+1}\n\n${a.assignment}\n\n${a.progress??''}\n\n${a.response??''}\n\n${(a.tools??[]).map(t=>`${t.status}: ${t.command}`).join('\n\n')}`).join('\n\n')||'No native children recorded.')+'\n';
}
