import {fullFlow,type Job,type Step} from './domain';
export interface ReviewPolicy {maxRounds:number}
export class ReviewBudgetReached extends Error {}
export function reviewPolicy(value:unknown=3):ReviewPolicy {
 if(typeof value!=='number'||!Number.isInteger(value)||value<1||value>10)throw new Error('Use one to ten code/review rounds.');
 return {maxRounds:value};
}
export function rechecksRepairs(job:Job,edits:boolean):boolean {
 return !!job.reviewPolicy&&edits&&!job.readOnly&&job.kind!=='chat'&&(job.flow??fullFlow).includes('worker');
}
export function assertCodeAttempt(job:Job,step:Step,edits:boolean):void {
 if(job.reviewPolicy&&edits&&!job.readOnly&&['builder','worker'].includes(step.role)&&(step.attempts??0)>=job.reviewPolicy.maxRounds)throw new ReviewBudgetReached('Code/review attempt limit reached. Inspect the recorded evidence and remaining findings before starting another task.');
}
