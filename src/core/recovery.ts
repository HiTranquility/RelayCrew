import {assignTaskProfile,fresh,profileModelPolicy,type Job,type Profile,type Quota,type Role} from './domain';
import {independentLogin} from './account-identity';

export interface RecoveryPolicy {autoSwitch:boolean;resumeAfterQuota:boolean;resumeProviderLimited:boolean;threshold:number;pools?:Partial<Record<Role,string[]>>}
export interface RecoveryCandidate {profile:Profile;eligible:boolean;reason:string}
export interface RecoveryPlan {stepIndex:number;current?:Profile;candidates:RecoveryCandidate[];next?:Profile;action:string;retryAllowed:boolean}
export function recoveryPlan(job:Job,profiles:Profile[],quotas:Record<string,Quota>,policy:RecoveryPolicy,now=Date.now()):RecoveryPlan {
 const stepIndex=job.steps.findIndex(s=>s.status!=='done'),step=job.steps[stepIndex];
 const id=job.blockedProfileId??step?.profileId??(step?job.roles[step.role]:undefined),current=profiles.find(p=>p.id===id),pool=step?policy.pools?.[step.role]:undefined;
 const retryAllowed=!job.limitDetectedAt||policy.resumeProviderLimited;
 const candidates:RecoveryCandidate[]=!current||!step?[]:profiles.filter(p=>p.id!==current.id&&p.provider===current.provider).map(profile=>{
  const used=(job.recoveryHistory??[]).some(h=>h.stepIndex===stepIndex&&(h.from===profile.id||h.to===profile.id));
  const q=quotas[profile.id],override=job.overrides?.[step.role];
  const policyOf=(p:Profile)=>override?.modelPolicy??(override?.model?'custom':profileModelPolicy(p));
  const modelOf=(p:Profile)=>policyOf(p)==='custom'?(override?.model??p.model):undefined;
  const reason=profile.fallbackEligible===false?'Excluded from automatic fallback'
   :pool?.length&&!pool.includes(profile.id)?'Outside the role account pool'
   :!independentLogin(current,profile)?'Shared CLI login: sign in as this account manually'
   :!['builder','worker'].includes(step.role)||step.reviewProfileId||step.coordinatorProfileId||job.dailyItemId?'Review, manager and daily assignments require an explicit account switch'
   :(profile.transport??'cli')!==(current.transport??'cli')||(profile.hosting??'cloud')!==(current.hosting??'cloud')||profile.endpoint!==current.endpoint?'Different connection or hosting'
   :policyOf(profile)!==policyOf(current)||modelOf(profile)!==modelOf(current)||(override?.effort??profile.effort)!==(override?.effort??current.effort)?'Different model or reasoning policy'
   :used?'Already attempted for this step'
   :!fresh(q,now)?'Quota unknown or stale: refresh first'
   :q.remainingTokens===0||q.usedPercent>=Math.min(policy.threshold,profile.quotaCeiling??100)?'Account at its usage ceiling'
   :(step.limitRetries??0)>=3?'Retry budget exhausted'
   :!retryAllowed?'Enable retry of provider-limited steps first':'Ready for the unfinished step';
  return {profile,eligible:reason==='Ready for the unfinished step',reason};
 });
 candidates.sort((a,b)=>Number(b.eligible)-Number(a.eligible)||(pool?.length?pool.indexOf(a.profile.id)-pool.indexOf(b.profile.id):Number(!!b.profile.preferred)-Number(!!a.profile.preferred)));
 const next=candidates.find(c=>c.eligible)?.profile;
 return {stepIndex,current,candidates,next,retryAllowed,action:next?policy.autoSwitch?'Switch to the ready backup and retry only the unfinished step':'Backup ready; automatic fallback is off':policy.resumeAfterQuota?'Wait for a fresh available quota observation':'Waiting for your account switch or quota refresh'};
}
export function applyRecovery(job:Job,profiles:Profile[],quotas:Record<string,Quota>,policy:RecoveryPolicy,automatic=true,now=Date.now()):boolean {
 if(job.status!=='waiting_quota'||job.steps.some(s=>s.status==='running')||automatic&&!policy.autoSwitch)return false;
 const plan=recoveryPlan(job,profiles,quotas,policy,now);if(!plan.current||!plan.next)return false;
 const step=job.steps[plan.stepIndex],override=job.overrides?.[step.role];assignTaskProfile(job,step.role,plan.next.id,profiles);if(override)(job.overrides??={})[step.role]=override;
 // Preserve the owner's role model/effort settings when replacing credentials.
 const event=job.timeline!.at(-1)!;event.from=automatic?'recovery controller':'owner';event.text='Retry unfinished step with '+plan.next.label+'. Completed steps and existing files are preserved; no rollback or parallel copy is created.';
 (job.recoveryHistory??=[]).push({at:new Date(now).toISOString(),stepIndex:plan.stepIndex,from:plan.current.id,to:plan.next.id,reason:job.error??'Quota unavailable'});job.recoveryHistory=job.recoveryHistory.slice(-100);
 job.status='queued';job.error=undefined;return true;
}
