import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { executeHttp, listModels, resolveHttpModel } from '../src/adapters/http/compatible';
import { prepareProfile, execute } from '../src/adapters/runtime';
import { validateProfiles, validateEndpoint, ProviderLimit, routeProfile, type Profile } from '../src/core/domain';
import { accountFromForm } from '../src/core/account';
import { Engine, newJob } from '../src/core/engine';

async function server(handler:(request:IncomingMessage,response:ServerResponse)=>void|Promise<void>){
  const app=createServer((req,res)=>{void Promise.resolve(handler(req,res)).catch(()=>{res.writeHead(500);res.end();});});await new Promise<void>(resolve=>app.listen(0,'127.0.0.1',resolve));
  const profile:Profile={id:'local',label:'Local test',provider:'compatible',transport:'http',hosting:'local',endpoint:`http://127.0.0.1:${(app.address() as AddressInfo).port}/v1`,executable:'http'};
  return {profile,close:async()=>{app.closeAllConnections();await new Promise<void>(resolve=>app.close(()=>resolve()));}};
}
const options=(profile:Profile)=>({profile:{...profile,model:'local-model'},prompt:'Xin chào',cwd:'/not-sent',edits:false,signal:new AbortController().signal,timeoutMs:1000,secretValues:{},log:()=>{}});

test('local/cloud profiles preserve old CLI settings, validate endpoints and never silently cross inference locations',()=>{
  const cli:Profile={id:'a',label:'CLI',provider:'codex',executable:'codex'};assert.equal(validateProfiles([cli])[0],cli);
  const api=accountFromForm({id:'api',label:'Ollama',provider:'compatible',hosting:'local',endpoint:'http://localhost:11434/v1',modelPolicy:'flagship'},[]);assert.equal(api.transport,'http');assert.equal(api.executable,'http');assert.equal(api.model,undefined);
  for(const endpoint of ['http://example.com/v1','https://user:pass@example.com/v1','https://example.com/v1?key=secret','file:///etc','http://localhost:11434/v1\n'])assert.throws(()=>validateEndpoint(endpoint,'cloud'));
  assert.throws(()=>validateEndpoint('https://example.com/v1','local'));assert.equal(validateEndpoint('https://example.com/v1/','cloud'),'https://example.com/v1');
  assert.throws(()=>validateProfiles([{...cli,hosting:'local'}]));
  const now=Date.now(),q=(usedPercent:number)=>({usedPercent,observedAt:new Date(now).toISOString(),source:'fixture'});
  assert.throws(()=>routeProfile('local',[{...api,id:'local'}, {...api,id:'cloud',hosting:'cloud',endpoint:'https://example.com/v1'}],{local:q(100),cloud:q(1)},true,95,now));
});

test('real HTTP model discovery uses only configured endpoint and explicit API key; ambiguous auto selection asks the owner',async t=>{
  const seen:string[]=[];let models=['local-model'];
  const s=await server((req,res)=>{seen.push(req.url!);assert.equal(req.headers.authorization,'Bearer api-secret');res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:models.map(id=>({id}))}));});t.after(s.close);
  assert.deepEqual(await listModels(s.profile,{RELAYCREW_API_KEY:'api-secret'}),['local-model']);
  assert.equal((await prepareProfile(s.profile,{RELAYCREW_API_KEY:'api-secret'},new AbortController().signal)).profile.model,'local-model');
  models=['small','large'];await assert.rejects(resolveHttpModel(s.profile,{RELAYCREW_API_KEY:'api-secret'}),/exactly one/);
  assert.equal((await resolveHttpModel({...s.profile,model:'chosen'},{})).model,'chosen');assert.ok(seen.every(path=>path==='/v1/models'));
});

test('real SSE transport preserves UTF-8 across chunks, streams public text, masks split secrets and sends only explicit attachments',async t=>{
  let body:any;const s=await server(async(req,res)=>{let text='';for await(const chunk of req)text+=chunk;body=JSON.parse(text);assert.equal(req.url,'/v1/chat/completions');assert.equal(req.headers.authorization,'Bearer private-key');res.setHeader('Content-Type','text/event-stream');
    const wire=Buffer.from(['Xin chào! ','private-','key'].map(content=>'data: '+JSON.stringify({choices:[{delta:{content}}]})+'\r\n\r\n').join('')+'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\r\n\r\ndata: [DONE]\r\n\r\n');
    for(let i=0;i<wire.length;i+=7){res.write(wire.subarray(i,i+7));await new Promise(resolve=>setImmediate(resolve));}res.end();});t.after(s.close);
  const events:string[]=[],result=await execute({...options(s.profile),secretValues:{RELAYCREW_API_KEY:'private-key'},attachments:[{id:'x',name:'role.md',mime:'text/plain',bytes:7,sha256:'fixture',data:Buffer.from('Review!')}],onEvent:e=>events.push(e.text)});
  assert.equal(result,'Xin chào! [REDACTED]');assert.equal(events.join(''),result);assert.equal(body.model,'local-model');assert.equal(body.stream,true);assert.match(body.messages[0].content,/NO repository/);assert.match(body.messages[1].content[1].text,/role.md/);assert.ok(!JSON.stringify(body).includes('private-key'));assert.equal(body.tools,undefined);
});

test('HTTP rejects edits before sending, classifies quota limits and never follows redirects with credentials',async t=>{
  let calls=0;const s=await server((req,res)=>{calls++;res.writeHead(req.url?.includes('models')?302:429,{Location:'/secret-target'});res.end('secret server body');});t.after(s.close);
  await assert.rejects(executeHttp({...options(s.profile),edits:true}),/read-only/);assert.equal(calls,0);
  await assert.rejects(executeHttp(options(s.profile)),ProviderLimit);await assert.rejects(listModels(s.profile,{RELAYCREW_API_KEY:'key'}));assert.equal(calls,2);
});

test('HTTP cancellation, interrupted streams and unsupported tool calls cannot produce a successful task',async t=>{
  let mode='cut';const s=await server((_req,res)=>{res.setHeader('Content-Type','text/event-stream');if(mode==='hang')return;if(mode==='tool')res.end('data: {"choices":[{"delta":{"tool_calls":[{}]}}]}\n\n');else res.end('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n');});t.after(s.close);
  await assert.rejects(executeHttp(options(s.profile)),/before completion/);mode='tool';await assert.rejects(executeHttp(options(s.profile)),/tool calls/);mode='hang';const controller=new AbortController();const work=executeHttp({...options(s.profile),signal:controller.signal});controller.abort();await assert.rejects(work);
});

test('real HTTP engine chat completes once, records transport/location and quota errors wait instead of falsely completing',async t=>{
  let limited=false,calls=0;const s=await server((_req,res)=>{calls++;if(limited){res.writeHead(429);res.end();return;}res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:'Hello!'}}]}));});t.after(s.close);
  const p={...s.profile,model:'local-model'},roles={builder:p.id,auditor:p.id,worker:p.id,lead:p.id},job=newJob('hello','/not-sent',roles);job.kind='chat';job.readOnly=true;
  const hooks={profiles:()=>[p],quotas:()=>({}),settings:()=>({autoSwitch:false,threshold:95,maxTasks:0,edits:false}),save:async()=>{},changed:()=>{},run:async(profile:Profile,step:any,_job:any,edits:boolean,signal:AbortSignal)=>execute({...options(profile),prompt:step.request,edits,signal})};
  await new Engine([job],hooks).drain();assert.equal(job.status,'completed');assert.equal(calls,1);assert.equal(job.steps.length,1);assert.equal(job.steps[0].transport,'http');assert.equal(job.steps[0].hosting,'local');
  limited=true;const blocked=newJob('hello','/not-sent',roles);blocked.kind='chat';await new Engine([blocked],hooks).drain();assert.equal(blocked.status,'waiting_quota');assert.equal(blocked.steps[0].limitRetries,1);
});
