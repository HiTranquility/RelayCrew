import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { importWorkflow } from '../src/core/workflow';
import { Engine, newJob, stepPrompt } from '../src/core/engine';
const roles={builder:'codex-main',auditor:'claude-main',worker:'gemini-main',lead:'codex-main'};
const profiles=['codex','claude','gemini'].map(provider=>({id:provider+'-main',label:provider,provider:provider as 'codex'|'claude'|'gemini',executable:provider}));
const current={flow:['builder','auditor','lead'] as ('builder'|'auditor'|'lead')[],roles,overrides:{builder:{model:'old'}},management:{primaryProfileId:'codex-main',coordinatorIds:[]}};
const md=(value:unknown)=>Buffer.from('# Guide\n\n```relaycrew\n'+JSON.stringify(value)+'\n```\n\nAsk owner before architecture changes.');
test('Markdown imports guide snapshots and optional configuration without changing the existing task or current config',async()=>{
  const before=JSON.stringify(current),plain=importWorkflow('guide.md',Buffer.from('# Quy trình\nKiểm tra UI trước khi duyệt.'),profiles,current);
  assert.equal(plain.structured,false);assert.deepEqual(plain.configuration,current);
  const imported=importWorkflow('workflow.md',await readFile('docs/workflow.example.md'),profiles,current);assert.equal(imported.structured,true);assert.equal(imported.configuration.flow.length,4);
  const job=newJob('task','/repo',roles);job.workflow=structuredClone(imported.document);
  imported.document.markdown='changed later';assert.match(stepPrompt(job,job.steps[0]),/Owner-supplied workflow guide/);assert.match(job.workflow.markdown,/Primary manager/);
  assert.equal(JSON.stringify(current),before);
});
test('workflow import rejects invalid accounts, arbitrary executable configuration, incompatible flows and manager authority conflicts',()=>{
  for(const value of [{version:2},{version:1,executable:'sh'},{version:1,flow:['builder','lead']},{version:1,roles:{builder:'missing'}},{version:1,roles:{constructor:'codex-main'}},{version:1,overrides:{builder:{model:'x\nconfig'}}},{version:1,overrides:{auditor:{executable:'shell'}}},{version:1,management:{primaryProfileId:'claude-main',coordinatorIds:[]}}])assert.throws(()=>importWorkflow('guide.md',md(value),profiles,current));
  assert.throws(()=>importWorkflow('a.md',Buffer.alloc(65537,65),profiles,current));assert.throws(()=>importWorkflow('a.md',Buffer.from([255]),profiles,current));assert.throws(()=>importWorkflow('a.txt',Buffer.from('text'),profiles,current));
  assert.throws(()=>importWorkflow('a.md',Buffer.from('```relaycrew\ninvalid\n```'),profiles,current));
});
test('read-only connection trial uses three real engine stages with bounded audit/lead instructions and no repairs',async()=>{
  const assignments={builder:'codex-main',auditor:'codex-main',worker:'codex-main',lead:'codex-main'},job=newJob('Connection trial','/repo',assignments,['builder','auditor','lead'],{},{primaryProfileId:'codex-main',coordinatorIds:[]});job.connectionTrial=true;job.readOnly=true;let calls=0;
  await new Engine([job],{profiles:()=>profiles,quotas:()=>({}),settings:()=>({autoSwitch:false,threshold:95,maxTasks:4,edits:true}),save:async()=>{},changed:()=>{},run:async(_profile,step,_job,edits)=>{calls++;assert.equal(edits,false);if(step.role==='auditor'){assert.match(step.prompt,/connection trial/);return '{"summary":"verified","issues":[],"tasks":[]}';}if(step.role==='lead'){assert.match(step.prompt,/connection trial/);return '{"decision":"approved","summary":"connected"}';}return 'name version';}}).drain();assert.equal(calls,3);assert.equal(job.status,'completed');
});
