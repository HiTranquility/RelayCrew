import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import { MessagingHub } from '../src/adapters/messaging/messaging-hub';

async function unusedPort(): Promise<number> {
  const server=createServer();await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=(server.address() as any).port;await new Promise<void>(resolve=>server.close(()=>resolve()));return port;
}
async function eventually(predicate:()=>boolean|Promise<boolean>):Promise<void>{
  const end=Date.now()+5000;while(Date.now()<end){if(await predicate())return;await new Promise(resolve=>setTimeout(resolve,20));}throw new Error('Timed out waiting for test state.');
}
test('signed Zalo webhook persists request, responds through same channel once, and stores no credentials', async () => {
  const dir=await mkdtemp(join(tmpdir(),'team-hub-')),port=await unusedPort();
  const secrets=new Map<string,string>();const store={get:async(k:string)=>secrets.get(k),store:async(k:string,v:string)=>{secrets.set(k,v);},delete:async(k:string)=>{secrets.delete(k);}};
  const original=globalThis.fetch;let calls=0,sends=0;
  globalThis.fetch=async (url,init)=>{
    if(String(url).startsWith('http://127.0.0.1'))return original(url,init);
    assert.equal(String(url),'https://openapi.zalo.me/v3.0/oa/message/cs');sends++;return new Response('{"error":0,"data":{}}');
  };
  const hub=await MessagingHub.load(dir,dir,store,{changed:()=>{},log:()=>{},receive:async msg=>{calls++;return 'trả lời: '+msg.text;}});
  try{
    await hub.configure({channel:'zalo',enabled:true,inbound:true,recipient:'300',cwd:'.',appId:'100',oaId:'200',port},'TOKEN_THAT_MUST_NOT_BE_IN_STATE','WEBHOOK_SECRET');
    const timestamp=String(Date.now());const raw=JSON.stringify({app_id:'100',recipient:{id:'200'},sender:{id:'300'},event_name:'user_send_text',timestamp,message:{msg_id:'same-message',text:'hỏi ai?'}});
    const signature='mac='+createHash('sha256').update(`100${raw}${timestamp}WEBHOOK_SECRET`).digest('hex');
    const send=()=>fetch(`http://127.0.0.1:${port}/zalo/webhook`,{method:'POST',headers:{'x-zevent-signature':signature},body:raw});
    assert.deepEqual((await Promise.all([send(),send()])).map(r=>r.status),[200,200]);
    await eventually(()=>hub.deliveries().length>0);assert.equal(calls,1);
    await hub.test('zalo');assert.equal(sends,2);assert.ok(hub.deliveries().every(d=>d.status==='sent'));
    const state=await readFile(join(dir,'messaging.json'),'utf8');assert.ok(!state.includes('TOKEN_THAT_MUST_NOT_BE_IN_STATE'));assert.ok(!state.includes('WEBHOOK_SECRET'));
    assert.match(hub.chatTranscript(),/trả lời: hỏi ai/);
    const forged=await fetch(`http://127.0.0.1:${port}/zalo/webhook`,{method:'POST',body:raw});assert.equal(forged.status,403);
    await hub.configure({channel:'zalo',enabled:true,inbound:true,recipient:'300',cwd:'.',appId:'100',oaId:'200',port},'','');
    assert.match(hub.chatTranscript(),/trả lời: hỏi ai/,'Editing transport settings preserves the same conversation identity');
    assert.ok([...secrets.values()].includes('TOKEN_THAT_MUST_NOT_BE_IN_STATE'));
    assert.ok([...secrets.values()].includes('WEBHOOK_SECRET'));
    await hub.disconnect('zalo');assert.equal(secrets.size,0);
  }finally{await hub.stop();globalThis.fetch=original;await rm(dir,{recursive:true,force:true});}
});
test('host recovery does not resend uncertain messages or re-execute active commands', async()=>{
  const dir=await mkdtemp(join(tmpdir(),'team-recovery-'));
  await writeFile(join(dir,'messaging.json'),JSON.stringify({version:1,connections:[],history:{},offset:5,inbox:[{id:'tg:1',status:'running'}],outbox:[{id:'x',status:'sending'}]}));
  const hub=await MessagingHub.load(dir,dir,{get:async()=>undefined,store:async()=>{},delete:async()=>{}},{receive:async()=>{throw new Error('must not run');},changed:()=>{},log:()=>{}});
  try{assert.equal(hub.deliveries()[0].status,'uncertain');const s=JSON.parse(await readFile(join(dir,'messaging.json'),'utf8'));assert.equal(s.inbox[0].status,'failed');}finally{await hub.stop();await rm(dir,{recursive:true,force:true});}
});
