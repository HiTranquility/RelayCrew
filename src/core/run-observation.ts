import type {Job,Step} from './domain';

export function effectiveStepStatus(job:Job,step:Step):string {
  if(step.status==='done')return 'done';
  if(job.status==='waiting_quota'&&step===job.steps.find(s=>s.status!=='done'))return 'waiting_quota';
  if(['interrupted','cancelled'].includes(job.status))return job.status;
  return step.status;
}
export function observeRun(job:Job) {
  const active=job.steps.find(s=>s.status==='running'),unfinished=job.steps.find(s=>s.status!=='done');
  const step=active??unfinished,stepIndex=step?job.steps.indexOf(step):-1;
  const events=(job.timeline??[]).filter(e=>['assignment','stream','assistant','tool','response','handoff','question','error','account_switch','recovery','native_agent'].includes(e.kind));
  const currentEvents=active?events.filter(e=>e.at>=(active.startedAt??'')&&(!active.profileId||e.from===active.role+':'+active.profileId||e.to===active.role+':'+active.profileId)):[];
  const latest=currentEvents.at(-1)??events.at(-1),tool=currentEvents.filter(e=>e.kind==='tool').at(-1);
  const children=(job.nativeAgentRuns??[]).filter(a=>a.status==='running'&&job.steps[a.stepIndex]?.status==='running');
  const next=job.status==='waiting_owner'?'Your reply is needed':job.status==='waiting_quota'?'Refresh quota or choose a ready backup':job.status==='queued'?'Waiting for queue capacity':job.status==='interrupted'?'Inspect existing changes before retrying':job.status==='needs_attention'?'Review the remaining findings':job.status==='completed'?'Verify the result against your Definition of Done':job.status==='running'?'Waiting for the current agent report':job.status==='failed'?'Inspect the error and existing changes':'No further work is queued';
  const latestAt=[latest?.at,...children.map(c=>c.updatedAt)].filter((v):v is string=>!!v).sort().at(-1);
  return {status:job.status,stepIndex,step,active,children:children.length,latestAt,tool:tool?.text,toolAt:tool?.at,next,changedFiles:(job.fileChanges??[]).filter(f=>!f.reverted).length,tracking:job.fileTracking??'not-started',folder:job.cwd,attempts:step?.attempts??0,retries:step?.limitRetries??0};
}
