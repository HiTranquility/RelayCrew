import { QuotaWait, fresh, type Job, type Profile, type Quota } from './domain';
export interface DailyBudget {profileId:string;modelKey:string;ceiling:number;maxAgentRuns:number}
export function budgetModel(p:Profile):string{return p.modelPolicy==='cli'?'@cli':p.modelPolicy==='custom'||!p.modelPolicy&&p.model?p.model||'@automatic':'@automatic';}
export function validateDailyBudget(raw:unknown,profiles:Profile[]):DailyBudget{
 const v=raw as Record<string,unknown>;
 if(!v||!profiles.some(p=>p.id===v.profileId)||typeof v.modelKey!=='string'||!v.modelKey.trim()||v.modelKey.length>200||/[\r\n\0]/.test(v.modelKey))throw new Error('Choose an account and model policy for the budget.');
 const ceiling=Number(v.ceiling),maxAgentRuns=Number(v.maxAgentRuns);
 if(!Number.isFinite(ceiling)||ceiling<1||ceiling>100||!Number.isInteger(maxAgentRuns)||maxAgentRuns<1||maxAgentRuns>1000)throw new Error('Use a quota ceiling of 1–100 and an agent-run budget of 1–1000.');
 return {profileId:v.profileId as string,modelKey:v.modelKey.trim(),ceiling,maxAgentRuns};
}
export function budgetFor(budgets:DailyBudget[]|undefined,p:Profile):DailyBudget|undefined{return budgets?.find(b=>b.profileId===p.id&&b.modelKey===budgetModel(p))??budgets?.find(b=>b.profileId===p.id&&b.modelKey==='*');}
export function budgetRuns(jobs:Job[],profileId:string,modelKey:string,ids:Set<string>):number{
 return jobs.filter(j=>ids.has(j.id)).reduce((n,j)=>n+j.steps.reduce((n,s)=>n+(s.dailyAttempts?s.dailyAttempts.filter(a=>a.profileId===profileId&&(modelKey==='*'||a.modelKey===modelKey)).length:s.profileId===profileId&&(modelKey==='*'||s.dailyBudgetModel===modelKey)?s.attempts??(s.startedAt?1:0):0),0),0);
}
export function checkDailyBudget(budgets:DailyBudget[]|undefined,p:Profile,jobs:Job[],ids:Set<string>):void{
 const budget=budgetFor(budgets,p);if(budget&&budgetRuns(jobs,p.id,budget.modelKey,ids)>=budget.maxAgentRuns)throw new QuotaWait('Daily model agent-run budget reached.');
}
export function observedDelta(before:Quota|undefined,after:Quota|undefined):number|undefined{
 if(!fresh(before,Date.parse(before?.observedAt??''))||!fresh(after,Date.parse(after?.observedAt??''))||before.source!==after.source||before.resetsAt!==after.resetsAt||Date.parse(after.observedAt)<=Date.parse(before.observedAt)||after.usedPercent<before.usedPercent)return;
 return Math.round((after.usedPercent-before.usedPercent)*100)/100;
}
