import {test} from 'node:test';
import assert from 'node:assert/strict';
import {codexChildActivities,codexChildPublicText,CodexChildObserver} from '../src/adapters/cli/codex-children';
import {recordNativeAgents} from '../src/core/native-agents';
import {newJob} from '../src/core/engine';
import type {Profile} from '../src/core/domain';

const profile:Profile={id:'codex',label:'Native',provider:'codex',executable:'fake'};
const lifecycle=(kind:string,id='child-a')=>({type:'subAgentActivity',kind,agentThreadId:id,agentPath:'/root/panel_review',model:kind==='started'?'observed-model':null,reasoningEffort:kind==='started'?'medium':null});
test('native lifecycle metadata preserves identity/model and excludes reasoning, excess children and unknown events',()=>{
 const value={thread:{id:'parent',turns:[{items:[{type:'reasoning',content:'PRIVATE'},lifecycle('started'),lifecycle('completed'),lifecycle('started','child-b'),lifecycle('started','child-c'),lifecycle('unknown','x')]}]}};
 assert.deepEqual(codexChildActivities(value,2),[{id:'child-a',name:'panel_review',status:'completed',model:'observed-model',effort:'medium'},{id:'child-b',name:'panel_review',status:'running',model:'observed-model',effort:'medium'}]);
 assert.equal(JSON.stringify(codexChildActivities(value,2)).includes('PRIVATE'),false);
 assert.deepEqual(codexChildActivities({thread:{turns:[{items:[{...lifecycle('started'),agentThreadId:5,agentPath:4}]}]}},2),[]);
});

test('only public child assignments and answers leave the read-only history adapter',()=>{
 assert.deepEqual(codexChildPublicText({thread:{turns:[{items:[{type:'reasoning',summary:['DO NOT EXPOSE'],content:'PRIVATE'},{type:'commandExecution',id:'cmd-1',command:'rg src/demo.ts',cwd:'/repo',status:'completed',aggregatedOutput:'OMITTED_OUTPUT'},{type:'userMessage',content:[{type:'text',text:'Inspect panel scope'},{type:'image',url:'private'}]},{type:'agentMessage',text:'Earlier progress'},{type:'agentMessage',phase:'final_answer',text:'Evidence at source.ts:12'}]}]}}),{assignment:'Inspect panel scope',response:'Evidence at source.ts:12',progress:'Earlier progress',tools:[{id:'cmd-1',command:'rg src/demo.ts',cwd:'/repo',status:'completed'}]});
});

test('observer uses only thread/read on observed child IDs and records real parent/name/status with public evidence',async()=>{
 let phase='started';const calls:string[]=[],events:{kind:string;text:string}[]=[];
 const read:typeof import('../src/adapters/cli/codex-rpc').codexRead=async(_p,_env,requests)=>requests.map(r=>{assert.equal(r.method,'thread/read');const id=(r.params as any).threadId;calls.push(id);return id==='parent'?{thread:{id,turns:[{items:[lifecycle('started'),...(phase==='completed'?[lifecycle('completed')]:[])]}]}}:{thread:{turns:[{items:[{type:'userMessage',content:[{type:'text',text:'Inspect panel only'}]},{type:'agentMessage',phase:'final_answer',text:'Found public evidence'},{type:'reasoning',content:'SECRET'}]}]}};});
 const observer=new CodexChildObserver(profile,2,new AbortController().signal,e=>events.push(e),read);observer.start('parent');await observer.poll();phase='completed';await observer.finish();
 const job=newJob('demo','/repo',{builder:'codex',auditor:'claude',worker:'agy',lead:'codex'});job.steps[0].profileId='codex';for(const e of events)assert.equal(recordNativeAgents(job,job.steps[0],e.text),true);
 assert.ok(calls.every(id=>['parent','child-a'].includes(id)));assert.equal(job.nativeAgentRuns?.length,1);assert.equal(job.nativeAgentRuns![0].parentId,'parent');assert.equal(job.nativeAgentRuns![0].name,'panel_review');assert.equal(job.nativeAgentRuns![0].status,'done');assert.equal(job.nativeAgentRuns![0].response,'Found public evidence');assert.ok(!JSON.stringify(events).includes('SECRET'));
});

test('observer detects a native child budget overflow without reading extra child histories',async()=>{
 const ids:string[]=[],events:{kind:string;text:string}[]=[];const read:typeof import('../src/adapters/cli/codex-rpc').codexRead=async(_p,_env,requests)=>requests.map(r=>{ids.push((r.params as any).threadId);return {thread:{turns:[{items:[lifecycle('started','a'),lifecycle('started','b'),lifecycle('started','c')]}]}};});
 const observer=new CodexChildObserver(profile,2,new AbortController().signal,e=>events.push(e),read);observer.start('parent');await observer.poll();await observer.finish();assert.ok(events.some(e=>e.kind==='native_agent_limit'));assert.ok(ids.every(id=>id==='parent'));
});

test('public child progress refreshes while running and is not labelled as a final response',async()=>{
 let update=1;const events:{kind:string;text:string}[]=[];const read:typeof import('../src/adapters/cli/codex-rpc').codexRead=async(_p,_env,requests)=>requests.map(r=>(r.params as any).threadId==='parent'?{thread:{id:'parent',turns:[{items:[lifecycle('started')]}]}}:{thread:{turns:[{status:'inProgress',items:[{type:'agentMessage',text:'PUBLIC_PROGRESS_'+update},{type:'reasoning',content:'PRIVATE'}]}]}});
 const observer=new CodexChildObserver(profile,2,new AbortController().signal,e=>events.push(e),read);observer.start('parent');await observer.poll();update=2;await observer.poll();await observer.finish();const last=JSON.parse(events.at(-1)!.text).states['child-a'];assert.equal(last.progress,'PUBLIC_PROGRESS_2');assert.equal(last.message,undefined);assert.ok(!JSON.stringify(events).includes('PRIVATE'));
});
