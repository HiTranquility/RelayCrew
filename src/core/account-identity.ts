import type {Profile} from './domain';

export function preferenceGroup(profile:Profile):string{return [profile.provider,profile.transport??'cli',profile.hosting??'cloud'].join('-');}
export function preferAccount(profiles:Profile[],id:string,enabled:boolean):Profile[]{
 const selected=profiles.find(p=>p.id===id);if(!selected||typeof enabled!=='boolean')throw new Error('Choose an existing account profile.');
 return profiles.map(p=>p.id===id?{...p,preferred:enabled}:enabled&&preferenceGroup(p)===preferenceGroup(selected)?{...p,preferred:false}:p);
}
export function accountDisplayNames(profiles:Profile[]):Profile[]{
 const counters=new Map<string,number>();return profiles.map(p=>{const group=preferenceGroup(p),index=(counters.get(group)??0)+1;counters.set(group,index);const provider=p.provider==='codex'?'Codex':p.provider==='claude'?'Claude':p.provider==='antigravity'?'Antigravity':p.provider==='gemini'?'Gemini':'';return provider&&p.label===provider+' · Main'?{...p,label:provider+' · Account '+index}:p;});
}
