import {randomUUID} from 'node:crypto';
import type {Job} from './domain';
import {publicSummary} from './task-insights';
export function attachBranch(child:Job,parent:Job,jobs:Job[],origin:'manual'|'direction'='manual'):void{
 let node:Job|undefined=parent,depth=1;const seen=new Set([child.id]);while(node){if(seen.has(node.id))throw new Error('Session branch cycle rejected.');seen.add(node.id);if(node.parentSessionId)depth++;node=node.parentSessionId?jobs.find(j=>j.id===node!.parentSessionId):undefined;}
 if(depth>3||jobs.filter(j=>j.parentSessionId===parent.id).length>=8)throw new Error('Session branches are limited to three levels and eight children per session.');
 child.parentSessionId=parent.id;child.branchOrigin=origin;child.branchContext={prompt:parent.prompt.slice(0,2000),status:parent.status,question:parent.ownerQuestion?.slice(0,2000),summary:publicSummary(parent.steps.slice().reverse().find(s=>s.response)?.response).slice(0,3000)};
}
export function queueDirectionBranches(parent:Job,jobs:Job[]):Job[]{
 const policy=parent.sessionBranching;if(!policy||parent.status!=='completed'||parent.kind==='chat'||parent.simulation||parent.dailyItemId||policy.createdIds?.length)return [];
 const plans=parent.direction?.branches??[];if(!plans.length)return [];
 if(jobs.filter(j=>j.parentSessionId===parent.id).length+plans.length>8||parent.parentSessionId||plans.length>policy.maxBranches||plans.some(b=>!policy.scopes.some(s=>s.path===b.cwd)))throw new Error('Independent branches exceed the approved folders or branch budget.');
 const created=plans.map(branch=>{const scope=policy.scopes.find(s=>s.path===branch.cwd)!;const child:Job={id:randomUUID(),prompt:branch.title+'\n\n'+branch.prompt,cwd:branch.cwd,createdAt:new Date().toISOString(),status:'queued',roles:structuredClone(parent.roles),flow:parent.flow?[...parent.flow]:undefined,overrides:structuredClone(parent.overrides??{}),steps:[{role:'builder',title:'Implement',prompt:branch.prompt,status:'pending'}],management:parent.management?structuredClone(parent.management):undefined,profilePins:parent.profilePins?structuredClone(parent.profilePins):undefined,delegation:parent.delegation?structuredClone(parent.delegation):undefined,auditors:parent.auditors?structuredClone(parent.auditors):undefined,promptTemplates:parent.promptTemplates?structuredClone(parent.promptTemplates):undefined,workflow:parent.workflow?structuredClone(parent.workflow):undefined,readOnly:!!parent.readOnly||scope.permission==='read-only',permission:parent.readOnly?'read-only':scope.permission,isolationMode:parent.isolationMode,openInCodex:parent.openInCodex};attachBranch(child,parent,jobs,'direction');return child;});
 jobs.push(...created);policy.createdIds=created.map(j=>j.id);return created;
}
