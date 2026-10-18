import type {Job,Step} from './domain';

export interface NativeAgentTool {id:string;command:string;status:string;cwd?:string}
export interface NativeAgent {
 id:string;parentId?:string;stepIndex:number;profileId:string;name:string;
 status:'running'|'waiting_owner'|'done'|'failed'|'interrupted';assignment:string;response?:string;progress?:string;tools?:NativeAgentTool[];
 model?:string;effort?:string;startedAt:string;updatedAt:string;
}
export interface NativeAgentEvent {tool:string;sender:string;receivers:string[];prompt?:string;model?:string;effort?:string;states:Record<string,{status:string;message?:string;name?:string;progress?:string;tools?:NativeAgentTool[]}>}
const bounded=(v:unknown,n:number)=>typeof v==='string'?v.slice(0,n):undefined;

/** Count unique reported children across both live and history sources. */
export function withinNativeChildBudget(text:string,seen:Set<string>,limit:number):boolean {
 let event:any;try{event=JSON.parse(text);}catch{return true;}
 if(!event||!Array.isArray(event.receivers)||!event.states||typeof event.states!=='object')return true;
 for(const id of [...event.receivers,...Object.keys(event.states)])if(typeof id==='string'&&id&&id.length<=160&&id!==event.sender)seen.add(id);
 return seen.size<=limit;
}

// Read public collaboration items only. Reasoning and provider-private content
// never enter the observer model. Support the exec and app-server spellings.
export function nativeAgentEvent(event:any):{kind:string;text:string}|undefined {
 const item=event?.item??event?.params?.item;
 if(!item||!['collab_tool_call','collabAgentToolCall'].includes(item.type))return;
 const tool=bounded(item.tool,60);if(!tool)return;
 const states:NativeAgentEvent['states']={};
 for(const [id,raw]of Object.entries(item.agents_states??item.agentsStates??{}).slice(0,12)){
  if(!raw||typeof raw!=='object')continue;const state=raw as any;
  states[id.slice(0,160)]={status:bounded(state.status,60)??'unknown',message:bounded(state.message??state.lastMessage,6000)};
 }
 const receivers=item.receiver_thread_ids??item.receiverThreadIds??[];
 return {kind:'native_agent',text:JSON.stringify({tool,sender:bounded(item.sender_thread_id??item.senderThreadId,160)??'',receivers:Array.isArray(receivers)?receivers.filter((id:unknown)=>typeof id==='string').slice(0,12).map((id:string)=>id.slice(0,160)):[],prompt:bounded(item.prompt,6000),model:bounded(item.model,200),effort:bounded(item.reasoning_effort??item.reasoningEffort,40),states} satisfies NativeAgentEvent)};
}

export function recordNativeAgents(job:Job,step:Step,text:string,at=new Date().toISOString()):boolean {
 let event:NativeAgentEvent;try{event=JSON.parse(text);}catch{return false;}
 if(!event||typeof event.tool!=='string'||!Array.isArray(event.receivers)||!event.states||typeof event.states!=='object')return false;
 const agents=job.nativeAgentRuns??=[],configured=job.nativeAgents?.maxAgents,cap=job.readOnly&&Number.isInteger(configured)&&configured!>=1&&configured!<=4?configured!:12;let changed=false;
 for(const id of new Set([...event.receivers,...Object.keys(event.states)])){
  if(typeof id!=='string'||!id||id.length>160)continue;
  let agent=agents.find(a=>a.id===id);
  if(!agent){if(!/spawn|send|wait|resume/i.test(event.tool)||agents.length>=cap)continue;agent={id,parentId:event.sender,stepIndex:job.steps.indexOf(step),profileId:step.profileId??job.roles[step.role],name:'Subagent '+(agents.length+1),status:'running',assignment:'',startedAt:at,updatedAt:at};agents.push(agent);}
  if(event.prompt){agent.assignment=event.prompt.slice(0,6000);}
  if(event.model)agent.model=event.model;if(event.effort)agent.effort=event.effort;
  const state=event.states[id];
  if(typeof state?.name==='string'&&state.name.trim())agent.name=state.name.slice(0,80);
  if(typeof state?.progress==='string')agent.progress=state.progress.slice(0,6000);
  if(Array.isArray(state?.tools))agent.tools=state.tools.filter(t=>t&&typeof t.id==='string'&&typeof t.command==='string'&&typeof t.status==='string').slice(-5).map(t=>({id:t.id.slice(0,160),command:t.command.slice(0,3000),status:t.status.slice(0,40),...(typeof t.cwd==='string'?{cwd:t.cwd.slice(0,1500)}:{})}));
  if(state?.message)agent.response=state.message.slice(0,6000);
  if(state){const status=state.status.toLowerCase();agent.status=/completed|done/.test(status)?'done':/waiting_owner|awaiting_input/.test(status)?'waiting_owner':/error|failed|not_?found/.test(status)?'failed':/shutdown|closed|interrupted/.test(status)?agent.status==='done'?'done':'interrupted':'running';}
  agent.updatedAt=at;changed=true;
 }
 return changed;
}

export function nativeAgentLimit(job:Job,step:Step):number|undefined {
 const n=job.nativeAgents?.maxAgents;
 return job.readOnly&&step.role==='builder'&&Number.isInteger(n)&&n!>=1&&n!<=4?n:undefined;
}

export function nativeAgentInstructions(job:Job,step:Step):string {
 const n=nativeAgentLimit(job,step);if(!n)return 'Do not spawn additional agents. The workbench handles delegation.';
 return `The owner explicitly authorizes native Codex subagents for this read-only dispatcher. Spawn exactly ${n} useful independent subagents with spawn_agent, each with a distinct bounded scope. Start them before doing the investigation yourself. Use only native collaboration tools; never start another AI CLI or external service. Children must remain read-only, must not spawn more agents, and must not publish or message others. In each assignment give a short descriptive first line, scope, evidence and acceptance criteria. Wait for every child, examine their reports, then synthesize the dispatch brief. If collaboration tools are unavailable, explicitly report the blocker; do not pretend children ran. The concurrency limit is ${n}; do not replace closed agents or create more than ${n} children in total. Publish short Vietnamese progress: who receives what and what returned. No private reasoning.`;
}
