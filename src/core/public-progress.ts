import type {Job,Profile,Step} from './domain';

const publicKinds=new Set(['assistant','stream','tool','error','status']);
/** Adapter-neutral, public-only progress boundary. Credentials are redacted by adapters. */
export function recordPublicProgress(job:Job,step:Step,profile:Profile,event:{kind:string;text:string},at=new Date().toISOString()):boolean {
  if(!publicKinds.has(event.kind)||typeof event.text!=='string'||!event.text)return false;
  const timeline=job.timeline??=[],stepIndex=job.steps.indexOf(step),from=step.role+':'+profile.id;
  const kind=event.kind==='assistant'?'stream':event.kind,text=event.text.slice(0,6000),last=timeline.at(-1);
  if(kind==='stream'&&last?.kind==='stream'&&last.from===from&&last.stepIndex===stepIndex&&last.text.length+text.length<=6000){last.text+=text;last.at=at;}
  else timeline.push({at,from,to:'orchestrator / observer',kind,text,stepIndex,profileId:profile.id,provider:profile.provider});
  if(timeline.length>300)timeline.splice(0,timeline.length-300);
  return true;
}
