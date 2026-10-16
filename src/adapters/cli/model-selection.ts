import spawn from 'cross-spawn';
import { createInterface } from 'node:readline';
import { profileModelPolicy, type Profile } from '../../core/domain';

export interface CatalogModel { model:string; displayName:string; isDefault:boolean; supportedReasoningEfforts?:{reasoningEffort:string}[] }
export function recommendedModel(raw:unknown):CatalogModel|undefined {
  const values=(raw as any)?.data;if(!Array.isArray(values))return;
  const model=values.find((m:any)=>m?.isDefault===true&&m.hidden!==true&&typeof m.model==='string'&&m.model.length<=200&&!/[\r\n\0]/.test(m.model));
  return model?{model:model.model,displayName:typeof model.displayName==='string'?model.displayName:model.model,isDefault:true,supportedReasoningEfforts:Array.isArray(model.supportedReasoningEfforts)?model.supportedReasoningEfforts:undefined}:undefined;
}
export async function codexModels(profile:Profile,env:Record<string,string>,signal:AbortSignal):Promise<unknown> {
  if(signal.aborted)throw new Error('Cancelled.');
  return new Promise((resolve,reject)=>{
    const child=spawn(profile.executable,['app-server'],{windowsHide:true,env:{...process.env,...profile.env,...env},stdio:['pipe','pipe','pipe']});
    const lines=createInterface({input:child.stdout!});let settled=false,total=0;
    const finish=(error?:Error,result?:unknown)=>{if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',abort);lines.close();child.stdin?.end();child.kill();if(error)reject(error);else resolve(result);};
    const abort=()=>finish(new Error('Cancelled.'));const timer=setTimeout(()=>finish(new Error('Model catalog unavailable. Using CLI default.')),8000);
    signal.addEventListener('abort',abort,{once:true});child.stderr?.resume();child.stdin?.on('error',()=>finish(new Error('Model catalog unavailable. Using CLI default.')));
    const send=(value:unknown)=>child.stdin?.write(JSON.stringify(value)+'\n');
    lines.on('line',line=>{total+=line.length;if(total>2_000_000){finish(new Error('Model catalog unavailable. Using CLI default.'));return;}try{const message=JSON.parse(line);if(message.id===1){if(message.error){finish(new Error('Model catalog unavailable. Using CLI default.'));return;}send({method:'initialized',params:{}});send({id:2,method:'model/list',params:{limit:100,includeHidden:false}});}if(message.id===2){if(message.error)finish(new Error('Model catalog unavailable. Using CLI default.'));else finish(undefined,message.result);}}catch{/* Ignore non-protocol startup diagnostics. */}});
    child.on('error',()=>finish(new Error('Model catalog unavailable. Using CLI default.')));child.on('exit',()=>finish(new Error('Model catalog unavailable. Using CLI default.')));
    send({id:1,method:'initialize',params:{clientInfo:{name:'relaycrew',title:'RelayCrew',version:'0.7.0'}}});
  });
}
export async function resolveModel(profile:Profile,env:Record<string,string>,signal:AbortSignal,load=codexModels):Promise<{profile:Profile;source:'custom'|'alias'|'catalog'|'cli-default';note:string}> {
  const policy=profileModelPolicy(profile);
  if(policy==='custom'&&profile.model)return {profile,source:'custom',note:'Optional custom model override'};
  if(policy==='cli')return {profile:{...profile,model:undefined},source:'cli-default',note:'CLI default'};
  if(profile.provider!=='codex')return {profile:{...profile,model:profile.provider==='claude'?'best':'pro'},source:'alias',note:'Provider flagship alias; exact model depends on CLI/account availability'};
  try{const model=recommendedModel(await load(profile,env,signal));if(model)return {profile:{...profile,model:model.model},source:'catalog',note:'Current model recommended by this CLI catalog'};}catch(error){if(signal.aborted)throw error;}
  return {profile:{...profile,model:undefined},source:'cli-default',note:'Model catalog unavailable. Using CLI default.'};
}
