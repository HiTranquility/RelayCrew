import spawn from 'cross-spawn';
import { homedir } from 'node:os';
import type { Profile, Provider } from '../../core/domain';
import { findLocalCli,cliVersion } from './local-cli';

export interface CliStatus {models?:string[];installed:boolean;authenticated:'yes'|'no'|'unknown';executable?:string;version?:string;checkedAt:string;message:string}
export function installPlan(provider:Provider,platform=process.platform):{command:string;docs:string} {
  if(provider==='compatible')throw new Error('HTTP profiles use an endpoint and optional API key, not a CLI installer.');
  if(provider==='claude')return {command:platform==='win32'?'winget install --id Anthropic.ClaudeCode --exact':platform==='darwin'?'brew install --cask claude-code':'curl -fsSL https://claude.ai/install.sh | bash',docs:'https://code.claude.com/docs/en/setup'};
  return {command:(platform==='win32'?'npm.cmd':'npm')+' install -g '+(provider==='codex'?'@openai/codex':'@google/gemini-cli'),docs:provider==='codex'?'https://learn.chatgpt.com/docs/cli':'https://geminicli.com/docs/get-started/installation/'};
}
export function loginArguments(provider:Provider):string[]{if(provider==='compatible')throw new Error('Configure an API key in Accounts.');return provider==='codex'?['login']:provider==='claude'?['auth','login']:[];}
export function quotedCommand(executable:string,args:string[],platform=process.platform):string {
  const quote=(value:string)=>"'"+value.replace(/'/g,platform==='win32'?"''":"'\\''")+"'";
  return (platform==='win32'?'& ':'')+[executable,...args].map(quote).join(' ');
}
export async function authStatus(profile:Profile,env:Record<string,string>):Promise<'yes'|'no'|'unknown'>{
  if(profile.provider==='gemini')return 'unknown';
  return new Promise(resolve=>{const child=spawn(profile.executable,profile.provider==='codex'?['login','status']:['auth','status'],{cwd:homedir(),env:{...process.env,...profile.env,...env},windowsHide:true,stdio:['ignore','pipe','pipe']});let finished=false,output='';
    const finish=(status:'yes'|'no'|'unknown')=>{if(finished)return;finished=true;clearTimeout(timer);child.kill();resolve(status);};
    const timer=setTimeout(()=>finish('unknown'),8000);child.stdout?.on('data',chunk=>{output+=chunk.toString();if(output.length>16000)finish('unknown');});child.stderr?.resume();child.on('error',()=>finish('unknown'));child.on('close',code=>{if(profile.provider==='claude'){try{const value=JSON.parse(output);finish(value.loggedIn===true?'yes':value.loggedIn===false?'no':'unknown');}catch{finish('unknown');}}else finish(code===0?'yes':code===1?'no':'unknown');});
  });
}
export async function inspectCli(profile:Profile,env:Record<string,string>):Promise<CliStatus>{
  const checkedAt=new Date().toISOString(),executable=await findLocalCli(profile.provider,profile.executable);
  if(!executable)return {installed:false,authenticated:'unknown',checkedAt,message:'CLI not installed. Use Install CLI, then check again.'};
  try{const version=await cliVersion(executable),authenticated=await authStatus({...profile,executable},env);return {installed:true,authenticated,executable,version,checkedAt,message:authenticated==='yes'?'CLI is installed and signed in.':authenticated==='no'?'CLI is installed. Sign in to continue.':'CLI is installed. Complete login, then run a read-only trial.'};}catch{return {installed:true,authenticated:'unknown',executable,checkedAt,message:'CLI check failed. Verify installation and executable path.'};}
}
