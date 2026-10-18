import type {Profile} from './domain';
import {homedir} from 'node:os';
import {resolve,join} from 'node:path';

/** Labels and emails never select credentials. Compare the actual login store. */
export function loginBinding(p:Profile):string {
 if(p.transport==='http'||p.secretEnv?.includes('GEMINI_API_KEY'))return p.provider+':secret-profile:'+p.id;
 if(p.provider==='antigravity'||p.provider==='gemini')return p.provider+':shared-cli-login';
 const path=p.provider==='codex'?p.env?.CODEX_HOME??join(homedir(),'.codex'):p.env?.CLAUDE_CONFIG_DIR??join(homedir(),'.claude');
 return p.provider+':'+(process.platform==='win32'?resolve(path).toLowerCase():resolve(path));
}
export function independentLogin(a:Profile,b:Profile):boolean{return !(a.provider===b.provider&&a.accountEmail&&b.accountEmail&&a.accountEmail.toLowerCase()===b.accountEmail.toLowerCase())&&loginBinding(a)!==loginBinding(b);}
export function allowsFallback(a:Profile,b:Profile):boolean{return b.fallbackEligible!==false&&independentLogin(a,b);}

export function preferenceGroup(profile:Profile):string{return [profile.provider,profile.transport??'cli',profile.hosting??'cloud'].join('-');}
export function preferAccount(profiles:Profile[],id:string,enabled:boolean):Profile[]{
 const selected=profiles.find(p=>p.id===id);if(!selected||typeof enabled!=='boolean')throw new Error('Choose an existing account profile.');
 return profiles.map(p=>p.id===id?{...p,preferred:enabled}:enabled&&preferenceGroup(p)===preferenceGroup(selected)?{...p,preferred:false}:p);
}
export function accountDisplayNames(profiles:Profile[]):Profile[]{
 const counters=new Map<string,number>();return profiles.map(original=>{const p=original.accountEmail&&!original.label.includes(original.accountEmail)?{...original,label:original.label+' · '+original.accountEmail}:original;const group=preferenceGroup(p),index=(counters.get(group)??0)+1;counters.set(group,index);const provider=p.provider==='codex'?'Codex':p.provider==='claude'?'Claude':p.provider==='antigravity'?'Antigravity':p.provider==='gemini'?'Gemini':'';return provider&&p.label===provider+' · Main'?{...p,label:provider+' · Account '+index}:p;});
}
