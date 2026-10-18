import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formatPublicText} from '../src/ui/response-format';
import {renderResponse} from '../src/ui/task-workbench';
import {agentPublicActivity} from '../src/ui/execution-trace';
import {newJob} from '../src/core/engine';

test('fenced code keeps whitespace and renders inert highlighted source with copy and line numbers',()=>{
 const html=formatPublicText('## Result\n\n```ts src/demo.ts\nconst text = "<img src=x onerror=run()>";\n  return text;\n```');
 const table=formatPublicText('| File | Status |\n| --- | --- |\n| `src/demo.ts` | <script>bad</script> |');assert.match(table,/response-table/);assert.ok(!table.includes('<script>'));
 assert.match(html,/data-code-complete="true"/);assert.match(html,/src\/demo.ts/);assert.match(html,/code-token-keyword/);assert.match(html,/data-code-source>  <span/);assert.equal((html.match(/class="code-row"/g)??[]).length,2);assert.ok(!html.includes('<img'));assert.match(html,/&lt;img/);
});

test('partial code fences and structured summaries remain readable without exposing raw result envelopes',()=>{
 assert.match(formatPublicText('```js\nlet x = 1;'),/data-code-complete="false"/);
 const longCode=renderResponse('```ts\n'+Array.from({length:120},(_,i)=>'const line'+i+' = '+i+';').join('\n')+'\n```','en');assert.match(longCode,/line119/);assert.ok(!longCode.includes('response-full-report'));assert.doesNotThrow(()=>renderResponse('{"summary":"x","issues":[null]}','en'));
 const html=renderResponse('```json\n{"decision":"approved","summary":"## Kết quả\\nĐã kiểm.","issues":[{"title":"Check","body":"Evidence `src/demo.ts:3`"}]}\n```','vi');
 assert.match(html,/Đã duyệt/);assert.match(html,/<h4>Kết quả<\/h4>/);assert.match(html,/<code>src\/demo.ts:3<\/code>/);assert.ok(!html.includes('&quot;summary&quot;'));
});

test('agent detail filters private reasoning and other agents while showing actual workspace/tools and referenced files',()=>{
 const job=newJob('check','/repo',{builder:'c',auditor:'a',worker:'g',lead:'c'});job.steps[0].status='running';job.steps[0].profileId='c';job.steps[0].startedAt='2026-10-18T00:00:00Z';job.timeline=[{at:'2026-10-18T00:00:01Z',from:'builder:c',to:'observer',kind:'tool',text:'item.started: rg src/core/engine.ts'},{at:'2026-10-18T00:00:02Z',from:'builder:c',to:'observer',kind:'reasoning',text:'PRIVATE_REASONING'},{at:'2026-10-18T00:00:02Z',from:'auditor:a',to:'observer',kind:'tool',text:'OTHER_AGENT'},{at:'2026-10-18T00:00:03Z',from:'builder:c',to:'observer',kind:'assistant',text:'Inspecting public code.'}];
 const html=agentPublicActivity(job,{key:'builder:primary:0',role:'builder',profileId:'c',status:'running',step:job.steps[0],coordinator:false},'en');assert.match(html,/src\/core\/engine.ts/);assert.match(html,/Inspecting public code/);assert.match(html,/Execution folder/);assert.ok(!html.includes('PRIVATE_REASONING'));assert.ok(!html.includes('OTHER_AGENT'));job.timeline=[{at:'2026-10-18T00:00:03Z',from:'builder:c',to:'observer',kind:'assistant',text:'{"summary":"partial'}];const partial=agentPublicActivity(job,{key:'builder:primary:0',role:'builder',profileId:'c',status:'running',step:job.steps[0],coordinator:false},'en');assert.match(partial,/Receiving a structured result/);assert.ok(!partial.includes('&quot;summary&quot;'));
});
