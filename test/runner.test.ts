import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,dirname,resolve,basename } from 'node:path';
import { decodeResponse, execute, invocation, liveEvent, publicEventStream, providerLimited, redact } from '../src/adapters/cli/runner';
import type { Profile } from '../src/core/domain';
test('arguments preserve exact requested model and keep owner prompt on stdin', () => {
  const p: Profile = { id: 'x', label: 'X', executable: 'codex', provider: 'codex', model: 'custom-model & echo injected', effort: 'medium' };
  const c = invocation(p, 'user task $(example)', true, 'file');
  assert.ok(c.args.includes(p.model!)); assert.equal(c.stdin, 'user task $(example)');
  assert.ok(c.args.includes('workspace-write'));
  assert.ok(!c.args.some(a => a.includes('bypass')));
});
test('handles error envelopes even with successful process exit and redacts complete secrets', () => {
  assert.throws(() => decodeResponse('gemini', '{"error":{"message":"quota"}}'));
  assert.throws(() => decodeResponse('claude', '{"is_error":true,"result":"failed"}'));
  assert.equal(decodeResponse('claude', '{"result":"done"}'), 'done');
  assert.equal(redact('a token-secret b', ['token-secret']), 'a [REDACTED] b');
});
test('streaming adapters extract public answers and classify provider limits without exposing thinking',()=>{
  assert.equal(decodeResponse('claude','{"type":"assistant","message":{"content":[{"type":"text","text":"partial"}]}}\n{"type":"result","result":"final answer"}\n'),'final answer');
  assert.equal(decodeResponse('gemini','{"type":"message","role":"assistant","content":"xin "}\n{"type":"message","role":"assistant","content":"chào"}\n{"type":"result","status":"success"}\n'),'xin chào');
  assert.equal(liveEvent({type:'stream_event',event:{delta:{type:'thinking_delta',thinking:'private'}}}),undefined);
  assert.deepEqual(liveEvent({type:'stream_event',event:{delta:{type:'text_delta',text:'public'}}}),{kind:'assistant',text:'public'});
  assert.equal(providerLimited('{"type":"turn.failed","error":{"message":"You have hit your usage limit"}}'),true);
  assert.equal(providerLimited('{"error":{"code":429}}'),true);
  assert.equal(providerLimited('{"type":"rate_limit_event","rate_limit_info":{"status":"rejected","errorCode":"credits_required"}}'),true);
  assert.equal(providerLimited('{"type":"result","is_error":true,"api_error_status":429,"api_error_code":"credits_required","result":"out of usage credits"}'),true);
  assert.equal(providerLimited('{"type":"rate_limit_event","rate_limit_info":{"status":"allowed"}}'),false);
  assert.equal(providerLimited('{"response":"User mentioned quota exhausted in a normal answer"}'),false);
});

test('Claude partial streams and their final assistant snapshot are presented once, including across multiple messages',()=>{
  const stream=publicEventStream(),delta=(text:string)=>({type:'stream_event',event:{delta:{type:'text_delta',text}}}),full=(text:string)=>({type:'assistant',message:{content:[{type:'text',text}]}});
  assert.equal(stream(delta('Hello'))?.text,'Hello');assert.equal(stream(delta('!'))?.text,'!');assert.equal(stream(full('Hello!')),undefined);
  stream({type:'stream_event',event:{type:'message_start'}});assert.equal(stream(full('Second answer'))?.text,'Second answer');
  stream(delta('Partial'));assert.equal(stream(full('Partial remainder'))?.text,' remainder');
  assert.equal(stream({type:'stream_event',event:{delta:{type:'thinking_delta',thinking:'private'}}}),undefined);
});
test('real subprocess transport: stdin, model quoting, secret masking, timeout, cancellation', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ai-team-test-'));
  const script = join(dir, 'fake-cli.cjs');
  const launcher = join(dir, process.platform === 'win32' ? 'fake-cli.cmd' : 'fake-cli');
  await writeFile(script, `let input=''; process.stdin.on('data',x=>input+=x); process.stdin.on('end',()=>{ if(input==='overbudget'){for(let i=0;i<3;i++)console.log(JSON.stringify({type:'item.completed',item:{type:'collab_tool_call',tool:'spawn_agent',sender_thread_id:'root',receiver_thread_ids:['child-'+i],agents_states:{['child-'+i]:{status:'running'}}}}));setInterval(()=>{},1000);return;} if(input==='hang'){setInterval(()=>{},1000);return;} if(input==='inherited-pipes'){const child=require('node:child_process').spawn(process.execPath,['-e','setTimeout(()=>{},15000)'],{stdio:['ignore',1,2],windowsHide:true});child.unref();console.log(JSON.stringify({response:'finished with helper'}));return;} console.log(JSON.stringify({response:JSON.stringify({input,args:process.argv.slice(2),secret:process.env.TEST_SECRET})})); });`);
  if (process.platform === 'win32') await writeFile(launcher, `@echo off\r\n"${process.execPath}" "${script}" %*\r\n`);
  else { await writeFile(launcher, `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`); await chmod(launcher, 0o755); }
  try {
    let log = '';
    const base = { profile: { id: 'fake', label: 'Fake', provider: 'gemini' as const, executable: launcher, model: 'custom & echo INJECTION' }, cwd: dir, edits: true, secretValues: { TEST_SECRET: 'very-secret-value' }, log: (s: string) => { log += s; }, timeoutMs: 15000 };
    const response = JSON.parse(await execute({ ...base, prompt: 'owner text', signal: new AbortController().signal }));
    assert.equal(response.input, 'owner text'); assert.ok(response.args.includes(base.profile.model));
    assert.equal(response.secret, '[REDACTED]'); assert.ok(!log.includes('very-secret-value'));
    // Allow Windows process startup under parallel CI load; the helper outlives this bound.
    const started=Date.now();
    assert.equal(await execute({...base,prompt:'inherited-pipes',timeoutMs:10000,signal:new AbortController().signal}),'finished with helper');
    assert.ok(Date.now()-started<10000,'a completed CLI must not wait for an inherited pipe holder');
    await assert.rejects(execute({ ...base, prompt: 'hang', timeoutMs: 150, signal: new AbortController().signal }), /timed out/);
    const nativeEvents:{kind:string;text:string}[]=[];await assert.rejects(execute({...base,profile:{...base.profile,provider:'codex'},edits:false,nativeAgentLimit:2,prompt:'overbudget',onEvent:e=>nativeEvents.push(e),signal:new AbortController().signal}),/child budget exceeded/);assert.equal(nativeEvents.filter(e=>e.kind==='native_agent').length,2);assert.ok(nativeEvents.some(e=>e.kind==='error'));
    const controller = new AbortController();
    const pending = execute({ ...base, prompt: 'hang', signal: controller.signal });
    setTimeout(() => controller.abort(), 150);
    await assert.rejects(pending, /Cancelled/);
  } finally { if(dirname(resolve(dir))!==resolve(tmpdir())||!basename(dir).startsWith('ai-team-test-'))throw new Error('Unexpected test cleanup path.');await rm(dir, { recursive: true, force: true,maxRetries:6,retryDelay:50 }); }
});
