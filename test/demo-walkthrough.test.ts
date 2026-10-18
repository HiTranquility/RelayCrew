import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DemoWalkthrough} from '../src/core/demo-walkthrough';
import {Engine} from '../src/core/engine';
import {agentNodes} from '../src/ui/agent-map';
import {layoutAgents} from '../src/ui/agent-layout';
import {agentCanvasClient} from '../src/ui/agent-canvas';
const profiles=[{id:'c',label:'Codex demo',provider:'codex' as const,executable:'codex'},{id:'a',label:'Claude demo',provider:'claude' as const,executable:'claude'},{id:'g',label:'Antigravity demo',provider:'antigravity' as const,executable:'agy'}];
test('a multi-executor walkthrough stops for the owner, preserves its parent tree, then completes without model evidence',()=>{
 const demo=new DemoWalkthrough(6,2,'/demo',profiles);assert.equal(demo.tick(),false);demo.play();for(let i=0;i<20&&demo.job.status!=='waiting_owner';i++)demo.tick();assert.equal(demo.job.status,'waiting_owner');assert.equal(demo.job.nativeAgentRuns?.length,2);assert.equal(demo.tick(),false);const child=agentNodes(demo.job).find(n=>n.native)!;assert.equal(child.parentKey,'worker:primary:0');assert.equal(child.status,'waiting_owner');
 assert.throws(()=>demo.reply('Only logic',1,'reply-a'));demo.reply('Only logic',0,'reply-a');demo.reply('Only logic',0,'reply-a');assert.equal(demo.job.ownerReplies?.length,1);demo.pause();assert.equal(demo.tick(),false);assert.equal(demo.tick(true),true);demo.play();for(let i=0;i<150&&String(demo.job.status)!=='completed';i++)demo.tick();assert.equal(demo.job.status,'completed');assert.equal(demo.job.nativeAgentRuns?.length,12);assert.ok(demo.job.nativeAgentRuns!.every(a=>a.status==='done'));assert.ok(demo.job.steps.every(s=>s.response?.startsWith('GIẢ LẬP:')));assert.equal(demo.progress.done,demo.progress.total);
});
test('a cancelled or accidentally queued simulation never invokes providers',async()=>{
 const demo=new DemoWalkthrough(2,2,'/demo',profiles);demo.play();demo.tick();demo.stop();assert.equal(demo.tick(true),false);let calls=0;demo.job.status='queued';await new Engine([demo.job],{profiles:()=>profiles,quotas:()=>({}),settings:()=>({autoSwitch:false,threshold:95,maxTasks:4,edits:true}),save:async()=>{},changed:()=>{},run:async()=>{calls++;return 'not allowed';}}).drain();assert.equal(calls,0);
 for(const [workers,children]of [[0,1],[7,1],[6,3],[2,0],[1,4],[1.5,2]])assert.throws(()=>new DemoWalkthrough(workers,children,'/demo',profiles));
});
test('tree geometry keeps Executor descendants together and never overlaps cards, including malformed cycles',()=>{
 const nodes=[{key:'dispatch',height:150},{key:'planner',height:170},{key:'manager',height:150},...Array.from({length:4},(_,i)=>({key:'worker'+i,parent:'planner',height:150})),...Array.from({length:8},(_,i)=>({key:'child'+i,parent:'worker'+Math.floor(i/2),height:160}))];
 for(const wide of [true,false]){const positions=layoutAgents(nodes,wide);for(const a of nodes)for(const b of nodes)if(a.key!==b.key){const x=positions[a.key],y=positions[b.key];assert.ok(x.x+220<=y.x||y.x+220<=x.x||x.y+a.height<=y.y||y.y+b.height<=x.y,'overlap '+a.key+' / '+b.key);}}
 assert.ok(layoutAgents([{key:'a',parent:'b',height:150},{key:'b',parent:'a',height:150}]).a);
 const embedded=new Function(agentCanvasClient+';return layoutAgentTree;')();assert.deepEqual(embedded(nodes,true),layoutAgents(nodes,true),'the browser-serialized layout must run without Node/compiler helpers');
});
