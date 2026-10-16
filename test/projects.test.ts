import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { projectSummaries, codexProjectLink } from '../src/core/projects';
import { newJob } from '../src/core/engine';
import { renderProjectsPanel } from '../src/ui/projects-panel';

const roles={builder:'dev',auditor:'dev',worker:'dev',lead:'dev'};
test('projects group exact execution folders, retain history and keep nested worktrees distinct',()=>{
  const path=resolve('repo'),nested=join(path,'worktree');
  const jobs=[newJob('first',path,roles),newJob('second',join(path,'.'),roles),newJob('isolated',nested,roles)];
  const before=JSON.stringify(jobs);
  const projects=projectSummaries([{name:'My project',path},{name:'Empty project',path:resolve('empty')}],jobs);
  assert.equal(projects.length,3);assert.equal(projects[0].name,'My project');assert.equal(projects[0].jobs.length,2);
  assert.equal(projects[1].jobs.length,0);assert.equal(projects[2].path,nested);assert.equal(projects[2].open,false);
  assert.equal(JSON.stringify(jobs),before);
  if(process.platform==='win32')assert.equal(projectSummaries([{name:'Repo',path}], [newJob('case',path.toUpperCase(),roles)]).length,1);
});
test('Codex project links preserve spaces, Unicode and URI metacharacters without submitting a prompt',()=>{
  const path=resolve('Dự án & code #1');const link=new URL(codexProjectLink(path));
  assert.equal(link.protocol,'codex:');assert.equal(link.hostname,'threads');assert.equal(link.pathname,'/new');
  assert.equal(link.searchParams.get('path'),path);assert.deepEqual([...link.searchParams.keys()],['path']);
  for(const invalid of ['relative','https://example.com/project',path+'\n'])assert.throws(()=>codexProjectLink(invalid));
});
test('projects show actual running accounts and escape project/task labels in both languages',()=>{
  const path=resolve('project'),job=newJob('<owner task>',path,roles);job.status='running';
  job.steps[0].status='running';job.steps[0].profileId='switched';job.steps[0].model='actual-model';
  for(const language of ['en','vi'] as const){
    const html=renderProjectsPanel([{name:'<project>',path}],[job],[{id:'switched',label:'Actual account',provider:'codex',executable:'codex'}],language);
    for(const text of ['&lt;project&gt;','&lt;owner task&gt;','Actual account','actual-model','data-action="projectCodex"','data-action="projectTask"'])assert.ok(html.includes(text),text);
  }
});
