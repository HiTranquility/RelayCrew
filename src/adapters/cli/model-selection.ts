import {codexRead} from './codex-rpc';
import { profileModelPolicy, type Profile } from '../../core/domain';

export interface CatalogModel { model:string; displayName:string; isDefault:boolean; supportedReasoningEfforts?:{reasoningEffort:string}[] }
export function recommendedModel(raw:unknown):CatalogModel|undefined {
  const values=(raw as any)?.data;if(!Array.isArray(values))return;
  const model=values.find((m:any)=>m?.isDefault===true&&m.hidden!==true&&typeof m.model==='string'&&m.model.length<=200&&!/[\r\n\0]/.test(m.model));
  return model?{model:model.model,displayName:typeof model.displayName==='string'?model.displayName:model.model,isDefault:true,supportedReasoningEfforts:Array.isArray(model.supportedReasoningEfforts)?model.supportedReasoningEfforts:undefined}:undefined;
}
export async function codexModels(profile:Profile,env:Record<string,string>,signal:AbortSignal):Promise<unknown> {
  return (await codexRead(profile,env,[{method:'model/list',params:{limit:100,includeHidden:false}}],signal))[0];
}

export async function resolveModel(profile:Profile,env:Record<string,string>,signal:AbortSignal,load=codexModels):Promise<{profile:Profile;source:'custom'|'alias'|'catalog'|'cli-default';note:string}> {
  const policy=profileModelPolicy(profile);
  if(policy==='custom'&&profile.model)return {profile,source:'custom',note:'Optional custom model override'};
  if(policy==='cli')return {profile:{...profile,model:undefined},source:'cli-default',note:'CLI default'};
  if(profile.provider==='antigravity')return {profile:{...profile,model:undefined},source:'cli-default',note:'Antigravity CLI native model selection'};
  if(profile.provider!=='codex')return {profile:{...profile,model:profile.provider==='claude'?'best':'pro'},source:'alias',note:'Provider flagship alias; exact model depends on CLI/account availability'};
  try{const model=recommendedModel(await load(profile,env,signal));if(model)return {profile:{...profile,model:model.model},source:'catalog',note:'Current model recommended by this CLI catalog'};}catch(error){if(signal.aborted)throw error;}
  return {profile:{...profile,model:undefined},source:'cli-default',note:'Model catalog unavailable. Using CLI default.'};
}
