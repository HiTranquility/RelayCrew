import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nativeAgentEvent,recordNativeAgents,nativeAgentLimit,nativeAgentInstructions} from '../src/core/native-agents';
import {newJob,stepPrompt} from '../src/core/engine';
import {agentNodes,renderAgentMap} from '../src/ui/agent-map';
import {nativeAgentsPanel} from '../src/ui/native-agents';
import {mapDependencies} from '../src/ui/map-views';

const job=()=>{const j=newJob('Review three independent areas','/repo',{builder:'c',auditor:'a',worker:'g',lead:'c'});j.readOnly=true;j.nativeAgents={maxAgents:3};j.steps[0].profileId='c';j.steps[0].status='running';return j;};
test('native children require explicit read-only dispatcher policy, never inherit permission at other stages',()=>{
 const j=job();assert.equal(nativeAgentLimit(j,j.steps[0]),3);assert.match(stepPrompt(j,j.steps[0]),/Spawn exactly 3/);assert.match(nativeAgentInstructions(j,j.steps[0]),/Children must remain read-only/);
 assert.equal(nativeAgentLimit(j,{...j.steps[0],role:'lead'}),undefined);j.readOnly=false;assert.equal(nativeAgentLimit(j,j.steps[0]),undefined);j.readOnly=true;j.nativeAgents!.maxAgents=99;assert.equal(nativeAgentLimit(j,j.steps[0]),undefined);
});
test('public collaboration events create child nodes with their actual parent, assignment and completion evidence',()=>{
 const j=job(),step=j.steps[0];const event=nativeAgentEvent({type:'item.completed',item:{type:'collab_tool_call',tool:'spawn_agent',sender_thread_id:'root',receiver_thread_ids:['child-a','child-b'],prompt:'Inspect quota gates\nRead-only',agents_states:{'child-a':{status:'running'},'child-b':{status:'running'}},private_reasoning:'never show'}})!;
 assert.ok(event);assert.doesNotMatch(event.text,/never show/);assert.ok(recordNativeAgents(j,step,event.text));assert.equal(j.nativeAgentRuns!.length,2);
 const nodes=agentNodes(j),child=nodes.find(n=>n.key==='native:child-a')!;assert.equal(child.parentKey,'builder:primary:0');assert.equal(child.step?.prompt,'Inspect quota gates\nRead-only');assert.deepEqual(mapDependencies(nodes)[child.key],['builder:primary:0']);
 const done=nativeAgentEvent({item:{type:'collabAgentToolCall',tool:'wait',senderThreadId:'root',receiverThreadIds:['child-a'],agentsStates:{'child-a':{status:'completed',message:'Evidence src/core/engine.ts:82'}}}})!;
 recordNativeAgents(j,step,done.text);assert.equal(j.nativeAgentRuns![0].status,'done');assert.match(nativeAgentsPanel(j,'vi'),/Evidence src\/core\/engine.ts:82/);assert.match(renderAgentMap([j],[],'vi'),/data-map-node="native:child-a"/);
 recordNativeAgents(j,step,JSON.stringify({tool:'close_agent',sender:'root',receivers:['child-a'],states:{'child-a':{status:'shutdown'}}}));assert.equal(j.nativeAgentRuns![0].status,'done');
});
test('failed or unreported child completion is not presented as successful',()=>{
 const j=job();recordNativeAgents(j,j.steps[0],JSON.stringify({tool:'spawn_agent',sender:'root',receivers:['a'],states:{a:{status:'running'}}}));j.steps[0].status='done';assert.match(nativeAgentsPanel(j,'en'),/Final status not reported/);assert.equal(agentNodes(j).find(n=>n.native)?.status,'interrupted');
 assert.equal(nativeAgentEvent({type:'reasoning',text:'private'}),undefined);assert.equal(recordNativeAgents(j,j.steps[0],'broken'),false);
});

test('an explicitly reported child question remains waiting for the owner under its actual parent',()=>{
 const j=job(),step=j.steps[0];recordNativeAgents(j,step,JSON.stringify({tool:'wait',sender:'root',receivers:['child-question'],states:{'child-question':{status:'awaiting_input',message:'Choose the bounded scope.'}}}));step.status='waiting_owner';j.status='waiting_owner';const child=agentNodes(j).find(n=>n.native)!;assert.equal(child.status,'waiting_owner');assert.equal(child.parentKey,'builder:primary:0');assert.match(nativeAgentsPanel(j,'en'),/Waiting for your reply/);assert.doesNotMatch(nativeAgentsPanel(j,'en'),/Final status not reported/);
});
