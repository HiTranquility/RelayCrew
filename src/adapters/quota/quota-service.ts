import { open } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { fresh, parseQuota } from '../../core/domain';
import type { Job, Profile, Quota } from '../../core/domain';

/** Implementations normalize quota data; only the routing policy can choose an account. */
export interface QuotaSource { readonly id:string; supports(profile:Profile):boolean; read(profile:Profile):Promise<Quota|undefined> }
export class FileQuotaSource implements QuotaSource {
  readonly id='file';
  supports(p:Profile):boolean{return !!p.quotaFile;}
  async read(p:Profile):Promise<Quota|undefined>{
    if(!p.quotaFile||!isAbsolute(p.quotaFile))throw new Error('Quota file must be an absolute local path.');
    const handle=await open(p.quotaFile,'r');
    try{
      const info=await handle.stat();if(!info.isFile()||info.size>32_000)throw new Error('Quota file must be a regular JSON file no larger than 32 KB.');
      const buffer=Buffer.alloc(32_001);const {bytesRead}=await handle.read(buffer,0,buffer.length,0);
      if(bytesRead>32_000)throw new Error('Quota file too large.');
      return parseQuota(JSON.parse(buffer.subarray(0,bytesRead).toString('utf8')));
    }finally{await handle.close();}
  }
}
export interface QuotaSourceError { profileId:string; source:string; message:string }
export class QuotaService {
  constructor(private sources:QuotaSource[]=[new FileQuotaSource()]){}
  async refresh(profiles:Profile[],snapshots:Record<string,Quota>):Promise<QuotaSourceError[]>{
    const errors:QuotaSourceError[]=[];
    await Promise.all(profiles.map(async p=>{
      const source=this.sources.find(s=>s.supports(p));if(!source)return;
      try{const q=await source.read(p);if(q)snapshots[p.id]=parseQuota(q);else delete snapshots[p.id];}
      catch{delete snapshots[p.id];errors.push({profileId:p.id,source:source.id,message:'Quota source unavailable or invalid; account usage is unknown.'});}
    }));
    return errors;
  }
}
export function quotaSummary(q:Quota|undefined,now=Date.now()):string{
  if(!q)return 'quota unknown';if(!fresh(q,now))return 'stale / reset · refresh required';
  const windows=q.windows?.map(w=>`${w.label}: ${w.usedPercent}%`).join(' · ');
  return `${q.usedPercent}% used${windows?' · '+windows:''} · ${q.source}`;
}
export function usageStatus(profiles:Profile[],jobs:Job[],quotas:Record<string,Quota>,threshold:number,now=Date.now()):{text:string;tooltip:string;warning:boolean}{
  const step=jobs.find(j=>j.status==='running')?.steps.find(s=>s.status==='running');
  const active=step?.profileId,profile=profiles.find(p=>p.id===active),snapshot=active?quotas[active]:undefined;
  const current=profiles.map(p=>quotas[p.id]).filter(q=>fresh(q,now));
  const unknown=profiles.length-current.length;
  const text=active?`$(pulse) ${profile?.label??active}: ${fresh(snapshot,now)?snapshot.usedPercent+'%':'unknown'}`
    :`$(dashboard) Quota: ${current.length?Math.max(...current.map(q=>q.usedPercent))+'% max':'unknown'}${unknown?' · '+unknown+' unknown':''}`;
  const tooltip=profiles.map(p=>`${p.label} [${p.id}] · ${p.model||'CLI default'}\n${quotaSummary(quotas[p.id],now)}\nReset: ${quotas[p.id]?.resetsAt??'unknown'}${quotas[p.id]?.windows?.map(w=>`\n${w.label} reset: ${w.resetsAt??'unknown'}`).join('')??''}`).join('\n\n')+'\n\nClick to inspect quota or switch the account assigned to a task.';
  return{text,tooltip,warning:current.some(q=>q.usedPercent>=threshold)};
}
