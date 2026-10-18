import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {validateProfiles,type Profile} from './domain';

export function addEmailAccounts(provider:unknown,raw:unknown,profiles:Profile[],accountRoot:string):Profile[] {
 if(!['codex','claude','antigravity'].includes(provider as string)||typeof raw!=='string'||raw.length>4000)throw new Error('Choose a supported provider and up to 10 account emails.');
 const emails=[...new Set(raw.split(/[\s,;]+/).map(s=>s.trim().toLowerCase()).filter(Boolean))];
 if(!emails.length||emails.length>10||emails.some(s=>s.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(s)))throw new Error('Choose a supported provider and up to 10 account emails.');
 const next=structuredClone(profiles),source=profiles.find(p=>p.provider===provider&&(p.transport??'cli')==='cli');
 for(const [index,email]of emails.entries()){
  // Reuse the existing shared Antigravity slot, preserving its task-role ID.
  let p=next.find(p=>p.provider===provider&&p.accountEmail?.toLowerCase()===email);
  if(!p&&provider==='antigravity'&&index===0)p=next.find(p=>p.provider===provider&&!p.accountEmail&&(p.transport??'cli')==='cli');
  if(!p){const id='account-'+randomUUID();p={id,label:'',provider:provider as Profile['provider'],executable:source?.executable??(provider==='antigravity'?'agy':String(provider)),modelPolicy:provider==='antigravity'?'cli':'flagship',fallbackEligible:true};
   if(provider==='codex'||provider==='claude')p.env={[provider==='codex'?'CODEX_HOME':'CLAUDE_CONFIG_DIR']:join(accountRoot,id)};
   next.push(p);
  }
  p.accountEmail=email;p.label=(provider==='codex'?'Codex':provider==='claude'?'Claude':'Antigravity')+' · '+email;p.preferred=index===0;
 }
 const primary=next.find(p=>p.provider===provider&&p.accountEmail===emails[0])!;
 for(const p of next)if(p.provider===provider&&(p.transport??'cli')==='cli')p.preferred=p.id===primary.id;
 return validateProfiles(next);
}
