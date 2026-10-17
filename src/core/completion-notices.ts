import type {Job} from './domain';

export interface CompletionNotice {id:string;jobId:string;kind:'step'|'flow';stepIndex?:number;at:string;read:boolean}
export interface CompletionSnapshot {seen:string[];items:CompletionNotice[]}
export function completionCandidates(jobs:Job[]):CompletionNotice[]{
 const items:CompletionNotice[]=[];
 for(const job of jobs){if(job.simulation)continue;
  job.steps.forEach((step,index)=>{if(step.status==='done'&&!(job.status==='failed'&&index===job.steps.length-1))items.push({id:`step:${job.id}:${index}:${step.attempts??0}:${step.finishedAt??step.startedAt??''}`,jobId:job.id,kind:'step',stepIndex:index,at:step.finishedAt??job.createdAt,read:false});});
  if(job.status==='completed')items.push({id:`flow:${job.id}`,jobId:job.id,kind:'flow',at:job.steps.slice().reverse().find(s=>s.finishedAt)?.finishedAt??job.createdAt,read:false});
 }
 return items;
}
export class CompletionNotices {
 private seen:Set<string>;readonly items:CompletionNotice[];
 constructor(jobs:Job[],stored?:Partial<CompletionSnapshot>){
  this.seen=new Set(Array.isArray(stored?.seen)?stored.seen.filter(s=>typeof s==='string').slice(-3000):[]);
  this.items=Array.isArray(stored?.items)?stored.items.filter(n=>n&&typeof n.id==='string'&&typeof n.jobId==='string'&&['step','flow'].includes(n.kind)&&typeof n.at==='string'&&(n.kind==='flow'||Number.isInteger(n.stepIndex)&&n.stepIndex!>=0)).slice(-100):completionCandidates(jobs).slice(-100).map(n=>({...n,read:true}));
  for(const n of completionCandidates(jobs))this.seen.add(n.id); // Baseline: never replay history on activation.
 }
 collect(jobs:Job[]):CompletionNotice[]{const added=completionCandidates(jobs).filter(n=>!this.seen.has(n.id));for(const n of added){this.seen.add(n.id);this.items.push(n);}this.items.splice(0,Math.max(0,this.items.length-100));return added;}
 markRead():void{for(const item of this.items)item.read=true;}
 snapshot():CompletionSnapshot{return {seen:[...this.seen].slice(-3000),items:this.items};}
}
