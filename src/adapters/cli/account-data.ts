import spawn from 'cross-spawn';
import {homedir} from 'node:os';
import {createHash} from 'node:crypto';
import {loginBinding} from '../../core/account-identity';
import type {Profile,Quota} from '../../core/domain';
import {codexRead} from './codex-rpc';

export interface AccountIdentity {email?:string;plan?:string;method?:string}
export interface UsageWindow {id:string;group:string;label:string;remainingPercent?:number;disabled?:boolean;resetsAt?:string}
export interface AccountUsage {source:string;scope:'account'|'shared-cli';observedAt:string;windows:UsageWindow[]}
export interface AccountData {authenticated:'yes'|'no'|'unknown';identity?:AccountIdentity;usage?:AccountUsage;quota?:Quota}
const clean=(value:unknown,max=200)=>typeof value==='string'&&value.length<=max&&!/[\r\n\0]/.test(value)?value:undefined;
const percent=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100;
const reset=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)&&value>0&&value<8.64e12?new Date(value*1000).toISOString():undefined;
export function parseClaudeAuth(raw:unknown):AccountData {
 const value=raw as any;return {authenticated:value?.loggedIn===true?'yes':value?.loggedIn===false?'no':'unknown',...(value?.loggedIn===true?{identity:{email:clean(value.email,254),plan:clean(value.subscriptionType),method:clean(value.authMethod)}}:{})};
}
export function parseCodexAccount(accountResponse:unknown,limitsResponse:unknown,observedAt=new Date().toISOString()):AccountData {
 const account=(accountResponse as any)?.account,limits=limitsResponse as any;
 const identity:AccountIdentity|undefined=account&&typeof account==='object'?{email:clean(account.email,254),plan:clean(account.planType),method:clean(account.type)}:undefined;
 const buckets:Record<string,any>=limits?.rateLimitsByLimitId&&typeof limits.rateLimitsByLimitId==='object'&&!Array.isArray(limits.rateLimitsByLimitId)?limits.rateLimitsByLimitId:{};
 const entries=Object.entries(buckets).slice(0,30);if(!entries.length&&limits?.rateLimits)entries.push([clean(limits.rateLimits.limitId)??'codex',limits.rateLimits]);
 const windows:UsageWindow[]=[];
 for(const [id,bucket] of entries){if(!clean(id)||!bucket)continue;for(const key of ['primary','secondary'] as const){const w=bucket[key];if(!percent(w?.usedPercent))continue;const minutes=w.windowDurationMins;
  windows.push({id:id+':'+key,group:clean(bucket.limitName)??id,label:typeof minutes==='number'&&minutes>0&&minutes<1_000_000?minutes%1440===0?`${minutes/1440}d`:minutes%60===0?`${minutes/60}h`:`${minutes}m`:key,remainingPercent:100-w.usedPercent,resetsAt:reset(w.resetsAt)});
 }}
 const selected=windows.filter(w=>w.id.startsWith('codex:'));
 const quota:Quota|undefined=selected.length?{usedPercent:Math.max(...selected.map(w=>100-w.remainingPercent!)),observedAt,source:'Codex account/rateLimits/read',windows:selected.map(w=>({id:w.id,label:w.label,usedPercent:100-w.remainingPercent!,resetsAt:w.resetsAt}))}:undefined;
 return {authenticated:account?'yes':account===null?'no':'unknown',identity,usage:windows.length?{source:'Codex account/rateLimits/read',scope:'account',observedAt,windows}:undefined,quota};
}
export function parseAntigravityUsage(output:string,observedAt=new Date().toISOString()):AccountUsage|undefined {
 const windows:UsageWindow[]=[];
 for(const line of output.split(/\r?\n/).slice(0,200)){
  const [group,label,value,date]=line.split('\t');if(!clean(group)||!clean(label)||!value)continue;
  const disabled=value.trim()==='disabled',match=value.trim().match(/^(\d+(?:\.\d+)?)%$/),remaining=match?Number(match[1]):undefined;
  if(!disabled&&!percent(remaining))continue;
  const time=date&&/^\d{4}-\d\d-\d\dT/.test(date)?Date.parse(date):NaN;
  windows.push({id:'agy:'+windows.length,group,label,remainingPercent:disabled?undefined:remaining,disabled,resetsAt:Number.isFinite(time)?new Date(time).toISOString():undefined});
 }
 return windows.length?{source:'Antigravity /usage',scope:'shared-cli',observedAt,windows}:undefined;
}
/** Discard any unrequested output, including stderr diagnostics and provider credentials. */
export async function readNativeText(profile:Profile,env:Record<string,string>,args:string[],timeout=10000):Promise<string> {
 return new Promise((resolve,reject)=>{
  const child=spawn(profile.executable,args,{cwd:homedir(),env:{...process.env,...profile.env,...env},windowsHide:true,stdio:['ignore','pipe','pipe']});let output='',settled=false;
  const finish=(ok:boolean)=>{if(settled)return;settled=true;clearTimeout(timer);child.kill();ok?resolve(output):reject(new Error('Native account data unavailable.'));};
  const timer=setTimeout(()=>finish(false),timeout);child.stderr?.resume();child.stdout?.on('data',chunk=>{output+=chunk.toString();if(Buffer.byteLength(output)>128000)finish(false);});child.on('error',()=>finish(false));child.on('close',code=>finish(code===0));
 });
}
const sharedUsage=new Map<string,{until:number;pending:Promise<AccountData>}>();
export async function readAccountData(profile:Profile,env:Record<string,string>):Promise<AccountData> {
 if(profile.provider==='codex'){const [account,limits]=await codexRead(profile,env,[{method:'account/read',params:{refreshToken:false}},{method:'account/rateLimits/read',params:{excludeResetCreditDetails:true},optional:true}]);return parseCodexAccount(account,limits);}
 if(profile.provider==='claude')return parseClaudeAuth(JSON.parse(await readNativeText(profile,env,['auth','status'])));
 if(profile.provider==='antigravity'){
  const key=loginBinding(profile)+':'+profile.executable+':'+createHash('sha256').update(JSON.stringify({...profile.env,...env})).digest('hex'),cached=sharedUsage.get(key);
  if(cached&&cached.until>Date.now())return cached.pending;
  const pending=readNativeText(profile,env,['--print','/usage','--print-timeout','20s'],25000).then(text=>{const usage=parseAntigravityUsage(text);if(!usage)throw new Error('Native usage data unavailable.');return {authenticated:'unknown' as const,usage};});
  sharedUsage.set(key,{until:Date.now()+30000,pending});if(sharedUsage.size>100)sharedUsage.delete(sharedUsage.keys().next().value!);
  try{return await pending;}catch(error){sharedUsage.delete(key);throw error;}
 }
 return {authenticated:'unknown'};
}
export function identityMatches(profile:Profile,data:AccountData):boolean {
 return !profile.accountEmail||!!data.identity?.email&&profile.accountEmail.toLowerCase()===data.identity.email.toLowerCase();
}
