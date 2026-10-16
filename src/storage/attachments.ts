import {documentText} from './document-text';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface Attachment { id:string; name:string; mime:'text/plain'|'image/png'|'image/jpeg'|'image/webp'|'image/gif'|'application/pdf'; bytes:number; sha256:string }
export interface AttachmentContent extends Attachment { data:Buffer }
export const attachmentLimits={count:8,image:4*1024*1024,text:256*1024,total:16*1024*1024,cache:256*1024*1024};
const hash=(data:Buffer)=>createHash('sha256').update(data).digest('hex');
const validId=(id:unknown):id is string=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id);
export function attachmentContent(name:unknown,data:Buffer):Omit<AttachmentContent,'id'> {
  if(typeof name!=='string'||!name.trim()||name.length>180||/[\\/\x00-\x1f]/.test(name))throw new Error('Invalid attachment name.');
  let mime:Attachment['mime'];
  if(data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))mime='image/png';
  else if(data.length>=3&&data[0]===255&&data[1]===216&&data[2]===255)mime='image/jpeg';
  else if(data.subarray(0,4).toString()==='RIFF'&&data.subarray(8,12).toString()==='WEBP')mime='image/webp';
  else if(['GIF87a','GIF89a'].includes(data.subarray(0,6).toString()))mime='image/gif';
  else if(data.subarray(0,5).toString()==='%PDF-')mime='application/pdf';
  else {
    if(/\.(png|jpe?g|gif|webp|pdf|zip|exe)$/i.test(name))throw new Error('Supported attachments: UTF-8 text/code, PNG, JPEG, WebP, GIF, PDF; import DOCX/ODT for extracted text.');
    try {const text=new TextDecoder('utf-8',{fatal:true}).decode(data);if(/[\x00-\x08\x0e-\x1f]/.test(text))throw new Error();}
    catch {throw new Error('Supported attachments: UTF-8 text/code, PNG, JPEG, WebP, GIF, PDF; import DOCX/ODT for extracted text.');}
    mime='text/plain';
  }
  if(!data.length||data.length>(mime==='text/plain'?attachmentLimits.text:attachmentLimits.image))throw new Error('Attachment too large: text 256 KB, image 4 MB.');
  return {name,mime,bytes:data.length,sha256:hash(data),data};
}
// Snapshots live in workspace extension storage, outside the repository. No original paths are accepted from the webview.
export class AttachmentStore {
  private queue:Promise<unknown>=Promise.resolve();
  constructor(readonly directory:string){}
  add(name:unknown,data:Buffer):Promise<Attachment>{
    const operation=this.queue.then(async()=>{
      const extracted=typeof name==='string'?documentText(name,data):undefined;if(extracted){name=extracted.name;data=extracted.data;}
      const content=attachmentContent(name,data);await mkdir(this.directory,{recursive:true});
      let bytes=0;for(const file of await readdir(this.directory))if(file.endsWith('.data'))bytes+=(await stat(join(this.directory,file))).size;
      if(bytes+data.length>attachmentLimits.cache)throw new Error('Attachment cache is full (256 MB). Open saved data to manage snapshots.');
      const {data:payload,...metadata}={...content,id:randomUUID()};
      await writeFile(join(this.directory,metadata.id+'.data'),payload,{flag:'wx',mode:0o600});
      await writeFile(join(this.directory,metadata.id+'.json'),JSON.stringify(metadata),{flag:'wx',mode:0o600});return metadata;
    });this.queue=operation.catch(()=>{});return operation;
  }
  async resolve(ids:unknown):Promise<AttachmentContent[]>{
    if(ids===undefined)return [];
    if(!Array.isArray(ids)||ids.length>attachmentLimits.count||ids.some(id=>!validId(id))||new Set(ids).size!==ids.length)throw new Error('Choose up to 8 attachments (16 MB total).');
    const result:AttachmentContent[]=[];let total=0;
    for(const id of ids){
      const metadata=JSON.parse(await readFile(join(this.directory,id+'.json'),'utf8')) as Attachment;
      const info=await stat(join(this.directory,id+'.data'));
      if(info.size>attachmentLimits.image)throw new Error('Attachment snapshot changed or is missing. Reattach the file.');
      const data=await readFile(join(this.directory,id+'.data')),actual=attachmentContent(metadata.name,data);
      if(metadata.id!==id||actual.sha256!==metadata.sha256||actual.bytes!==metadata.bytes||actual.mime!==metadata.mime)throw new Error('Attachment snapshot changed or is missing. Reattach the file.');
      total+=data.length;if(total>attachmentLimits.total)throw new Error('Choose up to 8 attachments (16 MB total).');
      result.push({...metadata,data});
    }return result;
  }
  async metadata(ids:unknown):Promise<Attachment[]>{return (await this.resolve(ids)).map(({data,...metadata})=>metadata);}
}
