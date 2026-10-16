import { test } from 'node:test';
import assert from 'node:assert/strict';
import { antigravityReadOnly,readOnlyDenyRules } from '../src/adapters/cli/antigravity';
import { invocation,decodeResponse,liveEvent } from '../src/adapters/cli/runner';
test('Antigravity has its own stdin and event protocol and rejects incomplete terminal results',()=>{
 const command=invocation({id:'agy',label:'AGY',provider:'antigravity',executable:'agy'},'Owner "task"',false,'unused');
 assert.equal(JSON.parse(command.stdin).message.content,'Owner "task"');assert.ok(command.args.includes('--sandbox'));assert.ok(!command.args.includes('--approval-mode'));
 assert.equal(decodeResponse('antigravity',JSON.stringify({event:'result',result:{status:'SUCCESS',response:'ready'}})),'ready');
 for(const status of ['ERROR','WAITING','RUNNING','CANCELED'])assert.throws(()=>decodeResponse('antigravity',JSON.stringify({event:'result',result:{status,response:'partial'}})));
 assert.deepEqual(liveEvent({event:'step_update',step_update:{step_type:'tool',tool_name:'read_file',state:'ACTIVE'}}),{kind:'tool',text:'read_file · ACTIVE'});
});
test('read-only guard requires every native deny category and never infers safety from a label',()=>{
 assert.equal(antigravityReadOnly({permissions:{deny:readOnlyDenyRules}}),true);
 for(const rule of readOnlyDenyRules)assert.equal(antigravityReadOnly({permissions:{deny:readOnlyDenyRules.filter(r=>r!==rule)}}),false);
 assert.equal(antigravityReadOnly({toolPermission:'strict'}),false);
});
