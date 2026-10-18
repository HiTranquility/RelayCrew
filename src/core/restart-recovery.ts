import type {Job} from './domain';

/** A crash never authorizes replay of a paid call or of partially edited files. */
export function recoverInterruptedJobs(jobs:Job[],fromBackup=false,now=new Date().toISOString()):boolean {
  let interrupted=false;
  for(const job of jobs) {
    if(job.status!=='running'&&!(fromBackup&&job.status==='queued'))continue;
    interrupted=true;job.status='interrupted';
    job.error='Extension host stopped. Inspect repository changes before starting a new task.';
    job.restartRecovery={at:now,fromBackup,stepIndex:job.steps.findIndex(s=>s.status==='running')};
    for(const step of job.steps)if(step.status==='running'){step.status='failed';step.error=job.error;}
    for(const agent of job.nativeAgentRuns??[])if(agent.status==='running'){agent.status='interrupted';agent.updatedAt=now;}
    (job.timeline??=[]).push({at:now,from:'recovery controller',to:'owner',kind:'recovery',text:'Host restarted. Completed steps, review budgets and existing files are preserved. Queue paused; inspect changes before an explicit retry.'});
  }
  return interrupted||fromBackup;
}

export function retryInterruptedJob(job:Job,inspected:unknown,now=new Date().toISOString()):void {
  if(job.status!=='interrupted'||inspected!==true)throw new Error('Inspect existing file changes and confirm before retrying an interrupted task.');
  if(job.reviewStop)throw new Error('The saved review limit was reached. Retrying cannot reset that budget.');
  const step=job.steps.find(s=>s.status!=='done');
  if(!step||job.steps.some(s=>s.status==='running'))throw new Error('No interrupted step is available to retry.');
  if((step.limitRetries??0)>=3)throw new Error('Provider limit retry budget exhausted for this step.');
  step.status='pending';job.status='queued';job.error=undefined;
  if(job.restartRecovery)job.restartRecovery.reviewedAt=now;
  (job.timeline??=[]).push({at:now,from:'owner',to:'orchestrator',kind:'recovery',text:'Owner confirmed inspection of existing changes. Retry only unfinished work with unchanged permissions, review and provider-limit budgets.'});
}
