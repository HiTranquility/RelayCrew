import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {mapWindowState,renderAgentMapWindow} from '../src/ui/agent-map-window';
import {newJob} from '../src/core/engine';
import {canvasPreferences} from '../src/core/canvas-state';
test('detached map keeps only window preferences and escapes provider/owner content',()=>{
 assert.deepEqual(mapWindowState({selected:'job',follow:false,secret:'discard'}),{selected:'job',follow:false});assert.deepEqual(mapWindowState(null),{selected:'',follow:true});
 const job=newJob('<script>owner</script>','.',{builder:'a',auditor:'a',worker:'a',lead:'a'}),p={id:'a',label:'Account <A>',provider:'codex' as const,executable:'codex',env:{TOKEN:'HIDDEN_SECRET'}};
 for(const language of ['en','vi'] as const){const html=renderAgentMapWindow([job],[p],language,{selected:job.id,follow:true});assert.ok(!html.includes('HIDDEN_SECRET'));assert.ok(!html.includes('<script>owner</script>'));assert.match(html,/Account &lt;A&gt;/);assert.match(html,/script-src 'nonce-/);for(const s of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))assert.doesNotThrow(()=>new Script(s[1]));}
});
test('detached canvas persists only bounded positions, view and inspector preferences',()=>{
 const raw={mode:'list',positions:{job:{dev:{x:Infinity,y:-100,env:{TOKEN:'secret'}}}},views:{job:{x:20000,y:-20000,scale:100}},tabs:{job:'request'},secret:'discard'};
 const clean=canvasPreferences(raw);assert.deepEqual(clean.positions.job.dev,{x:24,y:0});assert.deepEqual(clean.views.job,{x:10000,y:-10000,scale:3});assert.equal(clean.mode,'list');assert.equal(clean.tabs.job,'request');assert.ok(!JSON.stringify(clean).includes('secret'));assert.deepEqual(mapWindowState({selected:'job',canvas:raw}).canvas,clean);
});
