import {test} from 'node:test';
import assert from 'node:assert/strict';
import {safeBoardState} from '../src/core/board-state';
import {secretEvents} from '../src/core/stream-redaction';
test('persisted board state allowlists features and strips credential fields recursively',()=>{
 const result=safeBoardState({tab:'accounts',consoleDraft:'owner draft',password:'SECRET',connection:{token:'SECRET'},accountDraft:{label:'Account',env:{TOKEN:'SECRET'},secretEnv:['TOKEN'],password:'SECRET'},planningDrafts:{x:{token:'SECRET',prompt:'Keep request'}},layout:{sidebarWidth:900,token:'SECRET'}});
 assert.ok(!JSON.stringify(result).includes('SECRET'));assert.equal((result.accountDraft as any).label,'Account');assert.equal((result.planningDrafts as any).x.prompt,'Keep request');assert.equal((result.layout as any).sidebarWidth,420);assert.deepEqual(safeBoardState([]),{});
});
test('CLI public events redact secrets split across arbitrary token boundaries',()=>{
 const secret='MY_PRIVATE_TOKEN_123456';for(let split=1;split<secret.length;split++){
  const events:{kind:string;text:string}[]=[],stream=secretEvents([secret],e=>events.push(e));stream.write({kind:'assistant',text:'hello '+secret.slice(0,split)});stream.write({kind:'assistant',text:secret.slice(split)+' done'});stream.finish();const text=events.map(e=>e.text).join('');assert.equal(text,'hello [REDACTED] done');assert.ok(!JSON.stringify(events).includes(secret));
 }
 const events:string[]=[],stream=secretEvents(['sensitive'],e=>events.push(e.text));stream.write({kind:'assistant',text:'sensi'});stream.finish();assert.equal(events.join(''),'[REDACTED]');
});
