import {test} from 'node:test';
import assert from 'node:assert/strict';
import {layoutAgents,agentWire} from '../src/ui/agent-layout';
import {agentCanvasClient} from '../src/ui/agent-canvas';
import {canvasPreferences} from '../src/core/canvas-state';

test('horizontal and vertical layouts respect child ownership and execution dependencies without overlap',()=>{
 const nodes=[{key:'dispatch',height:150},{key:'child1',parent:'dispatch',height:180},{key:'child2',parent:'dispatch',height:220},{key:'planner',depends:['dispatch','child1','child2'],height:150},{key:'executor1',parent:'planner',height:150},{key:'executor2',parent:'planner',depends:['executor1'],height:190},{key:'manager',depends:['executor2'],height:150}];
 for(const direction of ['horizontal','vertical'] as const){
  const result=layoutAgents(nodes,false,direction),axis=direction==='horizontal'?'x':'y';
  for(const node of nodes)for(const prior of [...(node.depends??[]),...(node.parent?[node.parent]:[])])assert.ok(result[node.key][axis]>result[prior][axis],node.key+' must follow '+prior);
  for(const a of nodes)for(const b of nodes)if(a.key!==b.key){const x=result[a.key],y=result[b.key];assert.ok(x.x+220<=y.x||y.x+220<=x.x||x.y+a.height<=y.y||y.y+b.height<=x.y,'overlap '+a.key+'/'+b.key);}
  const embedded=new Function(agentCanvasClient+';return layoutAgentTree;')();assert.deepEqual(embedded(nodes,false,direction),result);
 }
 assert.ok(layoutAgents([{key:'a',parent:'b',height:150},{key:'b',parent:'a',height:150}],true,'vertical').a);
});

test('arrow endpoints follow orientation and reverse when cards are manually moved',()=>{
 const a={x:24,y:24,height:150},right={x:324,y:24,height:180},below={x:24,y:274,height:180};
 assert.match(agentWire(a,right,'horizontal'),/^M 244 99 C .* 324 114$/);
 assert.match(agentWire(a,below,'vertical'),/^M 134 174 C .* 134 274$/);
 assert.match(agentWire(below,a,'vertical'),/^M 134 274 C .* 134 174$/);
 const embedded=new Function(agentCanvasClient+';return wireAgentNodes;')();assert.equal(embedded(a,below,'vertical'),agentWire(a,below,'vertical'));
});

test('layout preference is per session and allowlisted independently from old canvas state',()=>{
 const state=canvasPreferences(JSON.parse('{"layouts":{"first":"horizontal","second":"vertical","bad":"secret","__proto__":"vertical"}}'));
 assert.deepEqual(state.layouts,{first:'horizontal',second:'vertical'});assert.deepEqual(canvasPreferences({}).layouts,{});
});
