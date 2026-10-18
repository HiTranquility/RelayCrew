import type {Profile} from '../../core/domain';
import type {NativeAgentTool} from '../../core/native-agents';
import {codexRead} from './codex-rpc';

export interface ChildActivity {id:string;name:string;status:string;model?:string;effort?:string}
const short=(raw:unknown,limit:number)=>typeof raw==='string'?raw.slice(0,limit):undefined;
/** Allowlist public lifecycle records; never return reasoning/history wholesale. */
export function codexChildActivities(raw:unknown,limit:number):ChildActivity[]{
 const thread=(raw as any)?.thread,children=new Map<string,ChildActivity>();
 for(const turn of Array.isArray(thread?.turns)?thread.turns:[])for(const item of Array.isArray(turn.items)?turn.items:[]){
  if(item.type!=='subAgentActivity'||!['started','completed','failed','interrupted'].includes(item.kind))continue;
  const id=typeof item.agentThreadId==='string'&&item.agentThreadId.length<=160?item.agentThreadId:undefined;if(!id||id===thread.id||!children.has(id)&&children.size>=limit)continue;
  const prior=children.get(id),model=short(item.model,200)??prior?.model,effort=short(item.reasoningEffort,40)??prior?.effort;
  children.set(id,{id,name:short(short(item.agentPath,300)?.split('/').filter(Boolean).at(-1),80)??prior?.name??'Subagent '+(children.size+1),status:item.kind==='started'?'running':item.kind==='completed'?'completed':item.kind,...(model?{model}:{}),...(effort?{effort}:{})});
 }
 return [...children.values()];
}

export function codexChildPublicText(raw:unknown):{assignment?:string;response?:string;progress?:string;tools?:NativeAgentTool[]}{
 const turns=(raw as any)?.thread?.turns,items=(Array.isArray(turns)?turns:[]).flatMap((t:any)=>Array.isArray(t.items)?t.items:[]);
 const message=items.find((i:any)=>i.type==='userMessage'),content=Array.isArray(message?.content)?message.content:[];
 const assignment=short(content.filter((c:any)=>c.type==='text'&&typeof c.text==='string').map((c:any)=>c.text).join('\n'),6000);
 const messages=items.filter((i:any)=>i.type==='agentMessage'&&typeof i.text==='string'),complete=Array.isArray(turns)&&turns.at(-1)?.status==='completed',final=messages.filter((i:any)=>i.phase==='final_answer').at(-1)??(complete?messages.at(-1):undefined);
 const response=short(final?.text,6000),progress=short(messages.filter((i:any)=>i!==final).slice(-4).map((i:any)=>i.text).join('\n\n').slice(-6000),6000);
 const tools=items.filter((i:any)=>i.type==='commandExecution'&&typeof i.id==='string'&&typeof i.command==='string').slice(-5).map((i:any)=>({id:i.id.slice(0,160),command:i.command.slice(0,3000),status:short(i.status,40)??'unknown',...(typeof i.cwd==='string'?{cwd:i.cwd.slice(0,1500)}:{})}));
 return {...(assignment?{assignment}:{}),...(response?{response}:{}),...(progress?{progress}:{}),...(tools.length?{tools}:{})};
}

/** Observe only IDs reported by the authorized exec session; no resume/turn calls. */
export class CodexChildObserver {
 private parent='';private timer?:ReturnType<typeof setInterval>;private pending?:Promise<void>;private closed=false;
 private emitted=new Map<string,string>();private loaded=new Map<string,string>();private publicEmitted=new Map<string,string>();
 constructor(private profile:Profile,private limit:number,private signal:AbortSignal,private emit:(event:{kind:string;text:string})=>void,private read=codexRead){}
 start(id:unknown){if(this.parent||typeof id!=='string'||!id||id.length>160||this.closed)return;this.parent=id;this.timer=setInterval(()=>void this.poll(),5000);this.timer.unref();void this.poll();}
 async poll(){if(this.closed||this.signal.aborted||!this.parent)return;if(this.pending)return this.pending;
  this.pending=this.inspect().catch(()=>{/* an incomplete local history is retried; never infer children */}).finally(()=>{this.pending=undefined;});return this.pending;
 }
 private async inspect(){
  const [parent]=await this.read(this.profile,{},[{method:'thread/read',params:{threadId:this.parent,includeTurns:true}}],this.signal);
  if(this.signal.aborted)return;const children=codexChildActivities(parent,this.limit+1);
  if(children.length>this.limit){this.emit({kind:'native_agent_limit',text:'Native Codex child count exceeded the configured limit ('+this.limit+').'});return;}
  for(const child of children){
   const text=JSON.stringify({tool:'spawn_agent',sender:this.parent,receivers:[child.id],model:child.model,effort:child.effort,states:{[child.id]:{status:child.status,name:child.name}}});
   if(this.emitted.get(child.id)!==text){this.emitted.set(child.id,text);this.emit({kind:'native_agent',text});}
   if(this.loaded.get(child.id)===child.status&&child.status!=='running')continue;
   try{
    const [raw]=await this.read(this.profile,{},[{method:'thread/read',params:{threadId:child.id,includeTurns:true}}],this.signal),publicText=codexChildPublicText(raw);
    const text=JSON.stringify({tool:'wait',sender:this.parent,receivers:[child.id],model:child.model,effort:child.effort,prompt:publicText.assignment,states:{[child.id]:{status:child.status,name:child.name,message:publicText.response,progress:publicText.progress,tools:publicText.tools}}});
    if(this.publicEmitted.get(child.id)!==text){this.publicEmitted.set(child.id,text);this.emit({kind:'native_agent',text});}
    if(child.status!=='completed'||publicText.response)this.loaded.set(child.id,child.status);
   }catch{/* retain the confirmed lifecycle even when child text is unavailable */}
  }
 }
 async finish(){if(this.timer)clearInterval(this.timer);this.closed=true;await this.pending;if(this.parent&&!this.signal.aborted)await this.inspect().catch(()=>{});}
}
