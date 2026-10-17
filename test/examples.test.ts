import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile,readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { importWorkflow } from '../src/core/workflow';
import { defaultPromptTemplates,snapshotPromptTemplates,type TemplateRole } from '../src/core/prompt-templates';

test('shipped Markdown guides import without account/model changes and each role guide survives validated snapshots',async()=>{
  const profiles=[{id:'owners-account',label:'Existing account',provider:'codex' as const,executable:'codex'}],current={flow:['builder','auditor','lead'] as ('builder'|'auditor'|'lead')[],roles:{builder:'owners-account',auditor:'owners-account',worker:'owners-account',lead:'owners-account'},overrides:{builder:{effort:'medium'}},management:{primaryProfileId:'owners-account',coordinatorIds:[]}};
  const workflows=(await readdir('examples/workflows')).filter(name=>name!=='plan-execute.md');assert.equal(workflows.length,4);
  for(const file of workflows){const imported=importWorkflow(file,await readFile(join('examples/workflows',file)),profiles,current);assert.equal(imported.structured,false);assert.deepEqual(imported.configuration,current);assert.equal(imported.document.sha256.length,64);}
  const names:Record<TemplateRole,string>={builder:'developer.md',auditor:'auditor.md',worker:'repair-worker.md',lead:'primary-manager.md',coordinator:'coordinator.md'};
  for(const [role,file]of Object.entries(names)){const markdown=new TextDecoder('utf-8',{fatal:true}).decode(await readFile(join('examples/roles',file))),templates=structuredClone(defaultPromptTemplates);templates.roles[role as TemplateRole]={...templates.roles[role as TemplateRole],guideName:file,guideMarkdown:markdown};const snapshot=snapshotPromptTemplates(templates);assert.equal(snapshot.roles[role as TemplateRole].guideMarkdown,markdown);assert.ok(Buffer.byteLength(markdown)<32768);}
  for(const file of ['feature-brief.md','definition-of-done.md'])assert.match(await readFile(join('examples/tasks',file),'utf8'),/\[ \]/);
});
