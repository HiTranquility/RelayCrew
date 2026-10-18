import spawn from 'cross-spawn';
import {createInterface} from 'node:readline';
import {homedir} from 'node:os';
import type {Profile} from '../../core/domain';
import {version} from '../../../package.json';

/** A short-lived, read-only connection. Never starts a turn or changes authentication. */
export async function codexRead(profile:Profile,env:Record<string,string>,requests:{method:'model/list'|'account/read'|'account/rateLimits/read';params:unknown;optional?:boolean}[],signal=new AbortController().signal):Promise<unknown[]> {
 if(signal.aborted)throw new Error('Cancelled.');
 return new Promise((resolve,reject)=>{
  const child=spawn(profile.executable,['app-server'],{cwd:homedir(),windowsHide:true,env:{...process.env,...profile.env,...env},stdio:['pipe','pipe','pipe']});
  const lines=createInterface({input:child.stdout!});let settled=false,total=0,received=0;const results:unknown[]=[];
  const finish=(error?:Error)=>{if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',abort);lines.close();child.stdin?.end();child.kill();if(error)reject(error);else resolve(results);};
  const abort=()=>finish(new Error('Cancelled.')),unavailable=()=>finish(new Error('Codex read-only account service unavailable.'));
  const timer=setTimeout(unavailable,12000);signal.addEventListener('abort',abort,{once:true});
  child.stderr?.resume();child.stdin?.on('error',unavailable);child.on('error',unavailable);child.on('exit',unavailable);
  const send=(value:unknown)=>child.stdin?.write(JSON.stringify(value)+'\n');
  lines.on('line',line=>{
   total+=Buffer.byteLength(line);if(total>2_000_000){unavailable();return;}
   let message:any;try{message=JSON.parse(line);}catch{return;}
   if(message.id===1){if(message.error){unavailable();return;}send({method:'initialized',params:{}});if(!requests.length){finish();return;}requests.forEach((request,i)=>send({id:i+2,method:request.method,params:request.params}));}
   else if(Number.isInteger(message.id)&&message.id>=2&&message.id<requests.length+2&&!Object.hasOwn(results,message.id-2)){
    if(message.error&&!requests[message.id-2].optional){unavailable();return;}results[message.id-2]=message.error?undefined:message.result;if(++received===requests.length)finish();
   }
  });
  send({id:1,method:'initialize',params:{clientInfo:{name:'relaycrew',title:'RelayCrew',version}}});
 });
}
