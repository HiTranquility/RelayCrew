import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultPromptTemplates, renderPromptTemplate, snapshotPromptTemplates, validatePromptTemplates } from '../src/core/prompt-templates';
import { Engine, newJob, stepPrompt } from '../src/core/engine';
import { importWorkflow } from '../src/core/workflow';
const roles={builder:'a',auditor:'a',worker:'a',lead:'a'},profiles=[{id:'a',label:'A',provider:'codex' as const,executable:'codex'},{id:'b',label:'B',provider:'claude' as const,executable:'claude'}];

test('prompt templates fill role defaults, snapshot immutably and reject invalid fields, oversized text and unknown variables',()=>{
  const raw={version:1,roles:{builder:{input:'Do {{task}}',output:'Report validation'}}},before=JSON.stringify(raw),set=validatePromptTemplates(raw),snapshot=snapshotPromptTemplates(raw);
  assert.equal(set.roles.auditor.input,defaultPromptTemplates.roles.auditor.input);set.roles.builder.input='changed';assert.equal(snapshot.roles.builder.input,'Do {{task}}');assert.equal(JSON.stringify(raw),before);assert.match(snapshot.sha256,/^[a-f0-9]{64}$/);
  for(const item of [{...raw,version:2},{...raw,executable:'sh'},{version:1,roles:{admin:raw.roles.builder}},{version:1,roles:{builder:{input:'{{credentials}}',output:'ok'}}},{version:1,roles:{builder:{input:'x'.repeat(8001),output:'ok'}}},{version:1,roles:{builder:{input:'ok',output:' '}}}])assert.throws(()=>validatePromptTemplates(item));
});
test('template rendering substitutes context once without interpreting task contents or executing expressions',()=>{
  const values={task:'User text {{workspace}} <script>x</script>',workspace:'/repo',assignment:'repair',role:'builder',history:'[]',owner_replies:'[]'};
  assert.equal(renderPromptTemplate('{{task}} / {{ workspace }}',values),'User text {{workspace}} <script>x</script> / /repo');
});
test('custom role templates reach actual engine requests while parser contracts, coordinator authority and read-only permissions remain enforced',async()=>{
  const set=structuredClone(defaultPromptTemplates);for(const role of ['builder','auditor','worker','lead','coordinator'] as const)set.roles[role]={input:'INPUT-'+role+' {{task}}',output:'OUTPUT-'+role};
  const job=newJob('Owner task','/repo',roles,undefined,undefined,{primaryProfileId:'a',coordinatorIds:['b']});job.promptTemplates=snapshotPromptTemplates(set);set.roles.builder.input='later edit';const seen:string[]=[];
  await new Engine([job],{profiles:()=>profiles,quotas:()=>({}),settings:()=>({autoSwitch:false,threshold:95,maxTasks:1,edits:false}),save:async()=>{},changed:()=>{},run:async(_profile,step,_job,edits)=>{assert.equal(edits,false);const role=step.coordinatorProfileId?'coordinator':step.role;seen.push(role);assert.ok(step.request?.includes('INPUT-'+role+' Owner task'));assert.ok(step.request?.includes('OUTPUT-'+role));assert.ok(step.request?.includes('Do not publish, push, deploy'));if(step.coordinatorProfileId){assert.match(step.request!,/cannot approve/);return 'Supporting evidence';}if(step.role==='auditor'){assert.match(step.request!,/Required response contract/);return JSON.stringify({summary:'audit',issues:[],tasks:[{title:'repair',instructions:'fix with tests'}]});}if(step.role==='lead')return '{"decision":"approved","summary":"verified"}';return 'Public result';}}).drain();
  assert.deepEqual(seen,['builder','auditor','worker','coordinator','lead']);assert.equal(job.status,'completed');assert.equal(job.promptTemplates.roles.builder.input,'INPUT-builder {{task}}');
});
test('Markdown can import validated template overrides while preserving current templates for ordinary guides',()=>{
  const current={flow:['builder','auditor','lead'] as ('builder'|'auditor'|'lead')[],roles,overrides:{},management:{primaryProfileId:'a',coordinatorIds:[]},promptTemplates:structuredClone(defaultPromptTemplates)};
  const md=(value:unknown)=>Buffer.from('# Guide\n```relaycrew\n'+JSON.stringify(value)+'\n```\n');const result=importWorkflow('guide.md',md({version:1,promptTemplates:{version:1,roles:{lead:{input:'Review {{task}}',output:'Explain tests in summary'}}}}),profiles,current);
  assert.equal(result.configuration.promptTemplates?.roles.lead.output,'Explain tests in summary');assert.deepEqual(importWorkflow('plain.md',Buffer.from('# plain'),profiles,current).configuration.promptTemplates,current.promptTemplates);
  assert.throws(()=>importWorkflow('bad.md',md({version:1,promptTemplates:{version:1,roles:{lead:{input:'{{unknown}}',output:'x'}}}}),profiles,current));
});
test('connection trials keep their bounded instructions even when custom templates exist',()=>{
  const job=newJob('Trial','/repo',roles);job.connectionTrial=true;const set=structuredClone(defaultPromptTemplates);set.roles.builder.input='CUSTOM INPUT MUST NOT RUN';job.promptTemplates=snapshotPromptTemplates(set);assert.ok(!stepPrompt(job,job.steps[0]).includes('CUSTOM INPUT MUST NOT RUN'));
});
