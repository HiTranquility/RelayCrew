import {parseDecision,type AuditReviewer,type DecisionPolicy,type Job,type Profile,type Management} from './domain';
export interface ReviewVote {profileId:string;name:string;decision:'approved'|'changes_requested';summary:string}
export interface ReviewDecision {policy:Exclude<DecisionPolicy,'ask'>;votes:ReviewVote[];outcome:'approved'|'blocked'|'tie';ownerResolution?:'approved'|'changes_requested';resolvedAt?:string}
export function validateAuditors(raw:unknown,profiles:Profile[],primary:string):AuditReviewer[]{
 if(!Array.isArray(raw)||raw.length>4)throw new Error('Choose up to four additional auditors.');const ids=new Set([primary]);return raw.map(item=>{if(!item||typeof item!=='object'||Array.isArray(item)||Object.keys(item).some(k=>!['profileId','name'].includes(k))||!profiles.some(p=>p.id===item.profileId)||ids.has(item.profileId)||typeof item.name!=='string'||!item.name.trim()||item.name.length>80||/[\r\n\0]/.test(item.name))throw new Error('Use distinct auditor accounts and names up to 80 characters.');ids.add(item.profileId);return {profileId:item.profileId,name:item.name.trim()};});
}
export function decisionMakers(job:Job):string[]{return job.management?.deciderIds??[job.management?.primaryProfileId??job.roles.lead];}
export function decisionPolicy(job:Job):DecisionPolicy{return job.management?.decisionPolicy??(decisionMakers(job).length>1?'ask':'chair');}
export function needsDecisionPolicy(job:Job):boolean{return !job.simulation&&job.kind!=='chat'&&decisionMakers(job).length>1&&decisionPolicy(job)==='ask';}
export function chooseDecisionPolicy(job:Job,policy:unknown):void{
 if(!job.decisionPolicyPending||job.status!=='waiting_owner'||!['all','majority','chair'].includes(policy as string))throw new Error('Choose a decision policy for this waiting task.');
 job.management!.decisionPolicy=policy as DecisionPolicy;job.decisionPolicyPending=false;job.ownerQuestion=undefined;job.status='queued';(job.timeline??=[]).push({at:new Date().toISOString(),from:'owner',to:'manager team',kind:'owner_decision',text:'Decision policy: '+policy});
}
export function rememberDecisionPolicy(source:Job,management:Management|undefined,jobs:Job[]):void{
 const policy=source.management?.decisionPolicy;if(!policy||policy==='ask'||!source.management)return;
 const sameTeam=(candidate:Management|undefined)=>!!candidate&&candidate.primaryProfileId===source.management!.primaryProfileId&&JSON.stringify([...(candidate.deciderIds??[candidate.primaryProfileId])].sort())===JSON.stringify([...decisionMakers(source)].sort());
 if(sameTeam(management))management!.decisionPolicy=policy;
 if(!source.batch)return;
 for(const job of jobs){if(job===source||job.batch?.id!==source.batch.id||!sameTeam(job.management)||job.steps.some(step=>(step.attempts??0)>0))continue;if(job.status==='waiting_owner'&&job.decisionPolicyPending)chooseDecisionPolicy(job,policy);else if(job.status==='queued')job.management!.decisionPolicy=policy;}
}
export function aggregateDecision(job:Job):ReviewDecision{
 const ids=decisionMakers(job),votes=ids.map(id=>{const step=job.steps.find(s=>s.role==='lead'&&(s.coordinatorProfileId??s.profileId??job.roles.lead)===id&&s.status==='done');if(!step?.response)throw new Error('A decision maker has not returned a valid vote.');const value=parseDecision(step.response);return {profileId:id,name:job.management?.names?.[id]??step.reviewName??'Manager '+(ids.indexOf(id)+1),...value};}),policy=decisionPolicy(job);if(policy==='ask')throw new Error('Choose the manager decision policy before running.');
 const approved=votes.filter(v=>v.decision==='approved').length,chair=votes.find(v=>v.profileId===(job.management?.primaryProfileId??job.roles.lead))!;
 return {policy,votes,outcome:policy==='chair'?(chair.decision==='approved'?'approved':'blocked'):policy==='all'?(approved===votes.length?'approved':'blocked'):approved*2===votes.length?'tie':approved*2>votes.length?'approved':'blocked'};
}
export function resolveReviewDecision(job:Job,resolution:unknown):void{
 if(job.status!=='waiting_owner'||!job.reviewDecision||job.reviewDecision.outcome==='approved'||job.reviewDecision.ownerResolution||!['approved','changes_requested'].includes(resolution as string))throw new Error('This task is not waiting for a review resolution.');
 job.reviewDecision.ownerResolution=resolution as 'approved'|'changes_requested';job.reviewDecision.resolvedAt=new Date().toISOString();job.ownerQuestion=undefined;job.status=resolution==='approved'?'completed':'needs_attention';(job.timeline??=[]).push({at:new Date().toISOString(),from:'owner',to:'manager team',kind:'owner_decision',text:'Owner resolution: '+resolution+'. Original votes remain recorded.'});
}
