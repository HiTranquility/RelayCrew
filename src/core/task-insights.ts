import { randomUUID } from 'node:crypto';
import type { Job } from './domain';

export function acceptanceFromText(value:unknown):NonNullable<Job['acceptance']> {
  if(value===undefined||value==='')return [];
  if(typeof value!=='string'||value.length>6000)throw new Error('Definition of Done must fit 6000 characters.');
  const lines=value.split(/\r?\n/).map(s=>s.replace(/^\s*(?:[-*]\s*(?:\[[ xX]\]\s*)?|\d+[.)]\s*)/,'').trim()).filter(Boolean);
  if(lines.length>30||lines.some(s=>s.length>500))throw new Error('Use up to 30 criteria, at most 500 characters each.');
  return lines.map(text=>({id:randomUUID(),text,checked:false}));
}
// A running step has no measurable partial completion. Reserve progress for
// recorded, finished phases, including phases that have not been created yet.
export function taskProgress(job:Job):{done:number;total:number;percent:number;active:number;accounts:number;criteriaDone:number;criteriaTotal:number} {
  const done=job.steps.filter(s=>s.status==='done').length;
  const expected=job.kind==='chat'?1:2+(job.audit?(job.flow??[]).includes('worker')?job.audit.tasks.length:0:0)+(job.management?.coordinatorIds.length??0)+1;
  const total=Math.max(expected,job.steps.length);
  return {done,total,percent:Math.min(job.status==='completed'?100:99,Math.floor(done/total*100)),active:job.steps.filter(s=>s.status==='running').length,accounts:new Set([...(job.kind==='chat'?[job.profilePins?.builder??job.roles.builder]:(job.flow??['builder','auditor','worker','lead']).map(role=>job.roles[role])),...(job.management?.coordinatorIds??[]),...job.steps.flatMap(s=>s.profileId?[s.profileId]:[])]).size,criteriaDone:job.acceptance?.filter(c=>c.checked).length??0,criteriaTotal:job.acceptance?.length??0};
}
export function publicSummary(raw:string|undefined):string {
  if(!raw)return '';
  try{const value=JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));return typeof value.question==='string'?value.question:typeof value.summary==='string'?value.summary:raw;}catch{return raw;}
}
export function conversationEvents(job:Job) {
  const events=(job.timeline??[]).filter(e=>['assignment','response','owner_reply','account_switch','handoff'].includes(e.kind));
  // Current public output stays visible while its response is in flight.
  const running=job.steps.find(s=>s.status==='running');
  if(running){const from=`${running.role}:${running.profileId}`,streams=(job.timeline??[]).filter(e=>e.kind==='stream'&&e.from===from&&e.at>=(running.startedAt??''));if(streams.length)events.push({...streams.at(-1)!,text:streams.map(e=>e.text).join('').slice(-12000)});}
  return events.slice(-40);
}
