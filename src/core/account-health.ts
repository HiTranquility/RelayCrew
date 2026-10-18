import {fresh, type Profile, type Quota} from './domain';

/** Public probe metadata only. No credentials belong in a readiness result. */
export interface AccountProbe {
  installed:boolean;
  authenticated:'yes'|'no'|'unknown';
  checkedAt:string;
  identity?:{email?:string};
}
export function accountHealth(profile:Profile, probe:AccountProbe|undefined, quota:Quota|undefined, threshold=95, now=Date.now()) {
  const recent=!!probe&&Number.isFinite(Date.parse(probe.checkedAt))&&now-Date.parse(probe.checkedAt)>=-60000&&now-Date.parse(probe.checkedAt)<=300000;
  const mismatch=!!profile.accountEmail&&!!probe?.identity?.email&&profile.accountEmail.toLowerCase()!==probe.identity.email.toLowerCase();
  const installation=profile.transport==='http'?!probe?'Endpoint not checked':probe.installed?'Endpoint reachable':'Endpoint unreachable':!probe?'Not checked':probe.installed?'Installed':'Not installed';
  const connection=!recent?'Connection check required':!probe?.installed?'Connection unavailable':profile.transport==='http'?'API endpoint checked':probe.authenticated==='yes'?'Signed in':probe.authenticated==='no'?'Sign-in required':'Login unverified';
  const ceiling=Math.min(threshold,profile.quotaCeiling??100);
  const quotaFresh=fresh(quota,now), exhausted=quotaFresh&&(quota!.usedPercent>=ceiling||quota!.remainingTokens===0);
  const quotaState=!quota?'Quota unknown':!quotaFresh?'Quota stale':exhausted?'Usage ceiling reached':'Fresh quota reading';
  const blocked=mismatch||!!probe&&!probe.installed||recent&&probe?.authenticated==='no'||exhausted;
  return {installation,connection,quotaState,recent,mismatch,blocked,ceiling,checkedAt:probe?.checkedAt,quotaObservedAt:quota?.observedAt,usedPercent:quotaFresh?quota!.usedPercent:undefined,
    reason:mismatch?'Signed-in email differs from this profile':exhausted?'Usage ceiling reached':probe&&!probe.installed?'Install this connection first':recent&&probe?.authenticated==='no'?'Sign in before running':undefined};
}
