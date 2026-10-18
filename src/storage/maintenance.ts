import {lstat,readdir,realpath,unlink} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {randomUUID} from 'node:crypto';

export interface RetentionOptions {keepBackups:number;orphanDays:number}
interface Entry {path:string;category:string;bytes:number;modified:number}
export interface StoragePreview {token:string;options:RetentionOptions;entries:Entry[];totalBytes:number;reclaimBytes:number;expiresAt:number}
interface References {attachments:Set<string>;jobs:Set<string>}
const uuid='[a-f0-9-]{36}', backupPattern=/^\d+-[a-f0-9-]+\.json$/;
const samePath=(a:string,b:string)=>process.platform==='win32'?resolve(a).toLowerCase()===resolve(b).toLowerCase():resolve(a)===resolve(b);

/** Retention is confined to disposable files in this workspace's extension storage. */
export class StorageMaintenance {
  private plans=new Map<string,StoragePreview>();
  constructor(private root:string) {this.root=resolve(root);}
  private async files(folder:string):Promise<Entry[]> {
    const directory=join(this.root,folder);
    try {
      const info=await lstat(directory);
      if(info.isSymbolicLink()||!info.isDirectory()||!samePath(await realpath(directory),directory))return [];
      const entries:Entry[]=[];
      for(const name of await readdir(directory)){
        const file=join(directory,name),metadata=await lstat(file);
        if(metadata.isFile()&&!metadata.isSymbolicLink())entries.push({path:folder?folder+'/'+name:name,category:folder||'temporary state',bytes:metadata.size,modified:metadata.mtimeMs});
      }
      return entries;
    }catch(error:any){if(error.code==='ENOENT')return [];throw error;}
  }
  async preview(options:RetentionOptions,refs:References,now=Date.now()):Promise<StoragePreview> {
    if(!Number.isInteger(options.keepBackups)||options.keepBackups<5||options.keepBackups>50||!Number.isInteger(options.orphanDays)||options.orphanDays<7||options.orphanDays>365)throw new Error('Keep 5–50 state backups and use an orphan age of 7–365 days.');
    // Windows TEMP can use an 8.3 alias (RUNNER~1). Canonicalize the trusted
    // storage root first, then continue rejecting linked child directories.
    this.root=resolve(await realpath(this.root));
    const [backups,attachments,reports,temporary]=await Promise.all([this.files('state.json.backups'),this.files('attachments'),this.files('reports'),this.files('')]);
    const cutoff=now-options.orphanDays*86400000;
    const oldBackups=backups.filter(e=>backupPattern.test(e.path.split('/').at(-1)!)).sort((a,b)=>b.path.localeCompare(a.path)).slice(options.keepBackups).filter(e=>e.modified<cutoff);
    const attachmentGroups=new Map<string,Entry[]>();
    for(const entry of attachments){const match=entry.path.match(new RegExp('^attachments/('+uuid+')\\.(data|json)$'));if(match&&!refs.attachments.has(match[1]))attachmentGroups.set(match[1],[...(attachmentGroups.get(match[1])??[]),entry]);}
    const orphaned=[...attachmentGroups.values()].filter(group=>group.every(e=>e.modified<cutoff)).flat();
    const orphanReports=reports.filter(e=>{const match=e.path.match(new RegExp('^reports/('+uuid+')\\.md$'));return match&&!refs.jobs.has(match[1])&&e.modified<cutoff;});
    const temp=temporary.filter(e=>new RegExp('^state\\.json\\.'+uuid+'\\.tmp$').test(e.path)&&e.modified<now-86400000);
    const entries=[...oldBackups,...orphaned,...orphanReports,...temp];
    const plan={token:randomUUID(),options:{...options},entries,totalBytes:[...backups,...attachments,...reports,...temporary.filter(e=>e.path==='state.json')].reduce((n,e)=>n+e.bytes,0),reclaimBytes:entries.reduce((n,e)=>n+e.bytes,0),expiresAt:now+300000};
    for(const [key,value] of this.plans)if(value.expiresAt<now)this.plans.delete(key);
    while(this.plans.size>=5)this.plans.delete(this.plans.keys().next().value!);
    this.plans.set(plan.token,plan);return plan;
  }
  async apply(token:unknown,refs:References,queuePaused:boolean,running:boolean,now=Date.now()) {
    if(!queuePaused||running)throw new Error('Pause the queue and wait for the active CLI to stop before cleaning saved data.');
    const plan=typeof token==='string'?this.plans.get(token):undefined;
    if(!plan||plan.expiresAt<now)throw new Error('Storage preview expired. Preview cleanup again.');
    this.plans.delete(plan.token);
    const current=await this.preview(plan.options,refs,now),eligible=new Map(current.entries.map(e=>[e.path,e]));
    let removed=0,bytes=0,skipped=0;
    for(const entry of plan.entries){
      const latest=eligible.get(entry.path);
      if(!latest||latest.bytes!==entry.bytes||latest.modified!==entry.modified){skipped++;continue;}
      const file=resolve(this.root,entry.path);
      if(!file.startsWith(this.root+'/')&&!file.startsWith(this.root+'\\'))throw new Error('Invalid retention path.');
      if(!samePath(await realpath(dirname(file)),dirname(file)))throw new Error('Linked storage directory is protected.');
      try{const metadata=await lstat(file);if(!metadata.isFile()||metadata.isSymbolicLink()||metadata.size!==entry.bytes||metadata.mtimeMs!==entry.modified){skipped++;continue;}await unlink(file);removed++;bytes+=entry.bytes;}
      catch(error:any){if(error.code==='ENOENT'){skipped++;continue;}throw error;}
    }
    return {removed,bytes,skipped};
  }
}
