import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { api, chatCommand, chunks, deliver, deliveryFailure, MessagingError, telegramIncoming, zaloIncoming } from '../src/adapters/messaging/messaging';
import type { Connection, Delivery } from '../src/adapters/messaging/messaging';
const now = Date.now();
const tg: Connection = { channel:'telegram', enabled:true, inbound:true, recipient:'123', allowedUserId:'456', cwd:'.' };
const za: Connection = { channel:'zalo', enabled:true, inbound:true, recipient:'300', appId:'100', oaId:'200', port:47731, cwd:'.' };
test('Telegram accepts only configured chat and user, fresh original messages', () => {
  const update = { update_id:1, message:{ chat:{id:123}, from:{id:456,is_bot:false}, date:Math.floor(now/1000), text:'xin chào' } };
  assert.equal(telegramIncoming(update,tg,now)?.text,'xin chào');
  assert.equal(telegramIncoming({...update,message:{...update.message,from:{id:999}}},tg,now),undefined);
  assert.equal(telegramIncoming({...update,message:{...update.message,forward_origin:{type:'user'}}},tg,now),undefined);
  assert.equal(telegramIncoming(update,tg,now+130_000),undefined);
  assert.equal(telegramIncoming(update,{...tg,inbound:false},now),undefined);
});
test('Zalo validates raw-body signature, app, OA, owner and timestamp', () => {
  const raw = JSON.stringify({ app_id:'100', recipient:{id:'200'}, sender:{id:'300'}, event_name:'user_send_text', timestamp:String(now), message:{msg_id:'id1',text:'câu hỏi'} });
  const signature = 'mac='+createHash('sha256').update(`100${raw}${now}secret`).digest('hex');
  assert.equal(zaloIncoming(raw,signature,za,'secret',now)?.text,'câu hỏi');
  assert.equal(zaloIncoming(raw+' ',signature,za,'secret',now),undefined);
  assert.equal(zaloIncoming(raw,signature,{...za,oaId:'999'},'secret',now),undefined);
  assert.equal(zaloIncoming(raw,signature,za,'secret',now+300_001),undefined);
  assert.equal(zaloIncoming(raw,'mac='+'é'.repeat(64),za,'secret',now),undefined);
});
test('normal text is read-only chat; writes and owner replies need explicit commands', () => {
  assert.deepEqual(chatCommand('Sửa tính năng này được không?'),{kind:'ask',text:'Sửa tính năng này được không?'});
  assert.deepEqual(chatCommand('/task build x'),{kind:'task',text:'build x'});
  assert.deepEqual(chatCommand('/reply abcdef yes'),{kind:'reply',id:'abcdef',text:'yes'});
  assert.deepEqual(chatCommand('/cancel@mybot abcdef'),{kind:'cancel',id:'abcdef'});
  assert.deepEqual(chatCommand('/resume abcdef'),{kind:'resume',id:'abcdef'});
  assert.throws(()=>chatCommand('/run-shell rm something'));
});
test('API transport uses fixed official hosts and never leaks token-bearing network errors', async () => {
  const calls: {url:string;init:RequestInit}[]=[];
  const fake = async (url:string,init:RequestInit) => {calls.push({url,init});return new Response(JSON.stringify({ok:true,result:{id:1}}));};
  const d: Delivery={id:'x',channel:'telegram',recipient:'123',text:'hello',status:'sending',attempts:1,nextAt:0};
  await deliver(d,'123:FAKE',undefined,fake);
  assert.equal(calls[0].url,'https://api.telegram.org/bot123:FAKE/sendMessage');
  assert.equal(calls[0].init.redirect,'error');
  assert.deepEqual(JSON.parse(String(calls[0].init.body)),{chat_id:'123',text:'hello'});
  await assert.rejects(api('telegram','123:SECRET','sendMessage',{},undefined,async()=>{throw new Error('https://api.telegram.org/bot123:SECRET');}), e=>e instanceof MessagingError&&!e.message.includes('SECRET')&&e.ambiguous);
  await assert.rejects(api('telegram','token/evil','sendMessage',{},undefined,fake),/Invalid/);
  let zaloHeaders: any;
  await deliver({...d,channel:'zalo'},'ZALO/SAFE+TOKEN',undefined,async(_url,init)=>{zaloHeaders=init.headers;return new Response('{"error":0,"data":{}}');});
  assert.equal(zaloHeaders.access_token,'ZALO/SAFE+TOKEN');
});
test('delivery retries only explicit throttling; ambiguous sends do not auto-repeat', () => {
  const d:Delivery={id:'x',channel:'telegram',recipient:'1',text:'x',status:'sending',attempts:1,nextAt:0};
  deliveryFailure(d,new MessagingError('limit',false,10),1000); assert.equal(d.status,'pending');assert.equal(d.nextAt,11000);
  deliveryFailure(d,new MessagingError('network',true),1000);assert.equal(d.status,'uncertain');
  deliveryFailure(d,new MessagingError('denied'),1000);assert.equal(d.status,'failed');
  assert.deepEqual(chunks('😃'.repeat(5),2),['😃😃','😃😃','😃']);
});
