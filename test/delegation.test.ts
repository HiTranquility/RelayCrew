import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {applyRoleOverride,delegationPolicy,jobPromptTemplates} from '../src/core/delegation';
import {Engine,newJob,stepPrompt,type EngineHooks} from '../src/core/engine';
import {flowConfiguration} from '../src/core/configuration';
import {importWorkflow,type WorkflowConfiguration} from '../src/core/workflow';
import {simulateFlow} from '../src/core/simulation';
import {completionCandidates} from '../src/core/completion-notices';
import {defaultPromptTemplates} from '../src/core/prompt-templates';
import type {Profile} from '../src/core/domain';

const profiles:Profile[]=['codex','claude','antigravity'].map(provider=>({id:provider+'-main',label:provider,provider:provider as Profile['provider'],executable:provider}));
const roles={builder:'codex-main',auditor:'claude-main',worker:'antigravity-main',lead:'codex-main'};
const configuration:WorkflowConfiguration={roles,flow:['builder','auditor','worker','lead'],management:{primaryProfileId:roles.lead,coordinatorIds:[]},overrides:{},delegation:{workflow:'plan-execute',mode:'adaptive',minWorkers:1,maxWorkers:2}};
function jobFor(policy=configuration.delegation!){const job=newJob('Inspect the routing code.','.',roles);job.delegation=structuredClone(policy);job.promptTemplates=jobPromptTemplates(undefined,policy);return job;}
function hooks(count=1,overrides:Partial<EngineHooks>={}):EngineHooks{return {profiles:()=>profiles,quotas:()=>({}),settings:()=>({autoSwitch:false,threshold:95,maxTasks:4,edits:true}),save:async()=>{},changed:()=>{},run:async(_p,step)=>step.role==='auditor'?JSON.stringify({summary:'Bounded checks',issues:[],tasks:Array.from({length:count},(_,i)=>({title:'Check '+i,instructions:'Inspect this scope and report evidence.'}))}):step.role==='lead'?'{"decision":"approved","summary":"Evidence reviewed"}':'Public evidence.',...overrides};}

test('delegation validates fixed/adaptive bounds including zero and the global ceiling',()=>{
 assert.equal(delegationPolicy(undefined,0).maxWorkers,0);
 for(const raw of [null,{}, {...configuration.delegation,minWorkers:-1},{...configuration.delegation,maxWorkers:1.5},{...configuration.delegation,minWorkers:3,maxWorkers:2},{...configuration.delegation,mode:'fixed'}])assert.throws(()=>delegationPolicy(raw));
 assert.throws(()=>delegationPolicy(configuration.delegation,1));
 assert.throws(()=>flowConfiguration({...configuration,flow:['builder','auditor','lead']},profiles));
 assert.throws(()=>flowConfiguration({...configuration,flow:['builder','auditor','lead'],delegation:{workflow:'delivery',mode:'adaptive',minWorkers:1,maxWorkers:2}},profiles));
});

test('dispatcher plans through Claude and bounded sequential Antigravity workers before manager review',async()=>{
 const job=jobFor(),calls:string[]=[],base=hooks(2);let active=0;
 await new Engine([job],hooks(2,{run:async(p,s,j,edits,signal)=>{assert.equal(active++,0);calls.push(`${s.role}:${p.id}:${edits}`);assert.match(stepPrompt(j,s),/no recursive or provider-native/);const result=await base.run(p,s,j,edits,signal);active--;return result;}})).drain();
 assert.equal(job.status,'completed');assert.deepEqual(calls,['builder:codex-main:false','auditor:claude-main:false','worker:antigravity-main:true','worker:antigravity-main:true','lead:codex-main:false']);
 assert.equal(job.steps[1].title,'Plan worker tasks');assert.match(job.steps[1].request!,/between 1 and 2/);assert.match(job.steps.at(-1)!.request!,/Public evidence/);
 assert.ok(job.timeline?.some(e=>e.kind==='handoff'&&e.from==='builder:codex-main'&&e.to==='auditor:claude-main'));
 assert.ok(job.timeline?.some(e=>e.kind==='handoff'&&e.from==='auditor:claude-main'&&e.to==='worker:antigravity-main'));
});

test('invalid plans dispatch no workers, changed global caps stop before any provider, owner decisions pause',async()=>{
 for(const count of [0,3]){const job=jobFor();await new Engine([job],hooks(count)).drain();assert.equal(job.status,'failed');assert.equal(job.steps.filter(s=>s.role==='worker').length,0);}
 const exact=jobFor({workflow:'plan-execute',mode:'fixed',minWorkers:2,maxWorkers:2});await new Engine([exact],hooks(1)).drain();assert.equal(exact.status,'failed');assert.equal(exact.steps.filter(s=>s.role==='worker').length,0);
 const invalid=jobFor();let calls=0;await new Engine([invalid],hooks(1,{settings:()=>({autoSwitch:false,threshold:95,maxTasks:0,edits:false}),run:async()=>{calls++;return '';}})).drain();assert.equal(calls,0);assert.equal(invalid.status,'failed');
 const waiting=jobFor(),base=hooks();await new Engine([waiting],hooks(1,{run:async(p,s,j,e,signal)=>s.role==='auditor'?'{"needs_owner":true,"question":"Which API contract should we preserve?"}':base.run(p,s,j,e,signal)})).drain();assert.equal(waiting.status,'waiting_owner');assert.equal(waiting.steps.filter(s=>s.role==='worker').length,0);
});

test('automatic role choices clear stale pins; legacy custom models and effort still work',()=>{
 const p={...profiles[0],model:'old-model',modelPolicy:'custom' as const};
 for(const modelPolicy of ['flagship','cli'] as const){const parsed=flowConfiguration({...configuration,overrides:{builder:{modelPolicy,model:'stale',effort:'high'}}},profiles);assert.equal(parsed.overrides.builder?.model,undefined);const next=applyRoleOverride(p,parsed.overrides.builder);assert.equal(next.model,undefined);assert.equal(next.modelPolicy,modelPolicy);assert.equal(next.effort,'high');}
 assert.equal(applyRoleOverride(p,{model:'sonnet'}).modelPolicy,'custom');
 assert.throws(()=>flowConfiguration({...configuration,overrides:{auditor:{modelPolicy:'custom',model:' '}}},profiles));
 const templates=structuredClone(defaultPromptTemplates);templates.roles.builder.name='Owner dispatcher';templates.roles.worker.input='Custom scope: {{assignment}}';const snapshot=jobPromptTemplates(templates,configuration.delegation);assert.equal(snapshot.roles.builder.name,'Owner dispatcher');assert.equal(snapshot.roles.worker.input,templates.roles.worker.input);assert.match(snapshot.roles.auditor.input,/Plan bounded/);
});

test('simulation records only labelled illustration and never real approval, attempts or completion notices',()=>{
 const before=JSON.stringify(configuration),job=simulateFlow('Read the code','.',configuration,profiles);
 assert.equal(job.simulation,true);assert.equal(job.readOnly,true);assert.match(job.prompt,/SIMULATION/);assert.equal(job.steps.filter(s=>s.role==='worker').length,1);
 assert.ok(job.steps.every(s=>!s.attempts&&/SIMULATION ONLY/.test(s.response!)));assert.equal(job.audit,undefined);assert.equal(job.acceptance,undefined);assert.deepEqual(completionCandidates([job]),[]);assert.equal(JSON.stringify(configuration),before);
 const fixed=simulateFlow('Read','.',{...configuration,delegation:{workflow:'plan-execute',mode:'fixed',minWorkers:2,maxWorkers:2}},profiles);assert.equal(fixed.steps.filter(s=>s.role==='worker').length,2);
});

test('shipped planning workflow imports bounds and optional dynamic model policies',async()=>{
 const imported=importWorkflow('plan-execute.md',await readFile('examples/workflows/plan-execute.md'),profiles,configuration);assert.equal(imported.structured,true);assert.deepEqual(imported.configuration.delegation,configuration.delegation);assert.equal(imported.configuration.overrides.builder?.modelPolicy,'flagship');assert.equal(imported.configuration.overrides.builder?.model,undefined);
 assert.throws(()=>importWorkflow('bad.md',Buffer.from('```relaycrew\n'+JSON.stringify({version:1,flow:['builder','auditor','lead']})+'\n```'),profiles,configuration));
});
