import {test} from 'node:test';
import assert from 'node:assert/strict';
import {agentNodes,renderAgentMap} from '../src/ui/agent-map';
import {newJob} from '../src/core/engine';
import type {Profile} from '../src/core/domain';
import {mapDependencies} from '../src/ui/map-views';
import {mapCommunication} from '../src/ui/map-communication';
import {jobPromptTemplates} from '../src/core/delegation';

const roles={builder:'dev',auditor:'audit',worker:'dev',lead:'manager'};
const profiles:Profile[]=[{id:'dev',label:'Dev <account>',provider:'codex',executable:'codex',env:{TOKEN:'NEVER_IN_MAP'}},{id:'audit',label:'Audit',provider:'claude',executable:'claude'},{id:'manager',label:'Manager',provider:'antigravity',executable:'agy'}];
test('agent map represents the recorded sequence, repeated repair steps and supporting coordinators',()=>{
 const job=newJob('Inspect budgets','.',roles,undefined,{}, {primaryProfileId:'manager',coordinatorIds:['audit']});
 job.steps=[{role:'builder',title:'Dev',prompt:'read only',profileId:'dev',status:'done'}, {role:'auditor',title:'Audit',prompt:'verify',profileId:'audit',status:'done'}, {role:'worker',title:'Repair A',prompt:'A',profileId:'dev',status:'done'}, {role:'worker',title:'Repair B',prompt:'B',profileId:'dev',status:'running'}, {role:'lead',title:'Coordinator',prompt:'report',coordinatorProfileId:'audit',status:'pending'}, {role:'lead',title:'Decision',prompt:'decide',status:'pending'}];
 const nodes=agentNodes(job);assert.equal(nodes.length,6);assert.equal(new Set(nodes.map(n=>n.key)).size,6);assert.equal(nodes.find(n=>n.status==='running')?.step?.title,'Repair B');assert.equal(nodes.at(-1)?.coordinator,true);
 const html=renderAgentMap([job],profiles,'en');assert.match(html,/Dev &lt;account&gt;/);assert.ok(!html.includes('NEVER_IN_MAP'));assert.match(html,/Reports to the primary manager/);assert.equal((html.match(/data-map-node=/g)??[]).length,6);
});
test('quota waits and omitted repairs are displayed without inventing a running process',()=>{
 const job=newJob('check','.',roles);job.status='waiting_quota';job.blockedProfileId='dev';job.steps[0].profileId='dev';job.steps[0].status='pending';job.audit={summary:'clear',issues:[],tasks:[]};
 const nodes=agentNodes(job);assert.equal(nodes[0].status,'waiting_quota');assert.equal(nodes.find(n=>n.role==='worker')?.status,'skipped');assert.ok(!nodes.some(n=>n.status==='running'));
 job.kind='chat';assert.equal(agentNodes(job).length,1);
});
test('map details escape exact requests, failures and public output; pending models stay unknown',()=>{
 const job=newJob('<script>owner</script>','.',roles,['builder','auditor','lead']);job.steps[0].request='<img src=x onerror=alert(1)>';job.steps[0].error='<script>failure</script>';
 const html=renderAgentMap([job],profiles,'vi');assert.match(html,/&lt;img src=x/);assert.ok(!html.includes('<script>'));assert.match(html,/Model được chọn khi bước bắt đầu/);assert.match(html,/Yêu cầu được giao/);assert.equal((html.match(/data-map-node=/g)??[]).length,3);
});

test('map emphasizes the actual runtime model and effort without marking completed work as running',()=>{
 const job=newJob('observe','.',roles,['builder','auditor','lead']);job.status='running';job.steps[0].status='running';job.steps[0].profileId='dev';job.steps[0].model='actual-runtime-model';job.steps[0].effort='medium';
 let html=renderAgentMap([job],profiles,'en');assert.match(html,/agent-runtime-banner" data-run-state="running/);assert.match(html,/Running now/);assert.match(html,/Reasoning: medium/);assert.match(html,/actual-runtime-model/);assert.match(html,/Viewing details/);
 job.status='completed';for(const step of job.steps)step.status='done';html=renderAgentMap([job],profiles,'en');assert.match(html,/agent-runtime-banner" data-run-state="completed/);assert.match(html,/No agent process running/);assert.ok(!html.includes('<strong>Running now</strong>'));assert.match(html,/agent-effort-chip[^>]*>medium/);
});

test('dependency views place coordinator reports before manager approval and escape recorded exchanges',()=>{
 const job=newJob('inspect','.',roles,['builder','auditor','lead'],{}, {primaryProfileId:'manager',coordinatorIds:['audit']});const nodes=agentNodes(job),deps=mapDependencies(nodes),coordinator=nodes.find(n=>n.coordinator)!;
 assert.deepEqual(deps['builder:primary:0'],[]);assert.deepEqual(deps[coordinator.key],['auditor:primary:0']);assert.ok(deps['lead:primary:0'].includes(coordinator.key));
 job.status='completed';job.timeline=[{at:new Date().toISOString(),from:'orchestrator',to:'auditor:audit',kind:'assignment',text:'<script>untrusted</script>'}];const html=mapCommunication(job,nodes,'en');assert.match(html,/data-exchange-live="false"/);assert.match(html,/&lt;script&gt;/);assert.ok(!html.includes('<script>'));assert.match(html,/data-exchange-tab="request"/);
});

test('public stream observer is distinct from a role named Dispatcher; relayed handoffs show their real direction',()=>{
 const job=newJob('inspect','.',roles);job.promptTemplates=jobPromptTemplates(undefined,{workflow:'plan-execute',mode:'adaptive',minWorkers:1,maxWorkers:2});job.steps[0].profileId='dev';
 job.timeline=[{at:new Date().toISOString(),from:'builder:dev',to:'orchestrator / observer',kind:'stream',text:'Public brief'}];
 let html=mapCommunication(job,agentNodes(job),'en');assert.match(html,/<b>Dispatcher<\/b><i aria-hidden="true">→<\/i><b>Observer<\/b>/);
 job.timeline.push({at:new Date().toISOString(),from:'builder:dev',to:'auditor:audit',kind:'handoff',text:'Relayed assignment'});html=mapCommunication(job,agentNodes(job),'en');assert.match(html,/<b>Dispatcher<\/b><i aria-hidden="true">→<\/i><b>Planner<\/b>/);assert.match(html,/Handoff/);
});

test('a later manager recheck depends on the previous manager report rather than reversing their order',()=>{
 const job=newJob('Review and recheck','.',roles,['builder','auditor','lead']);job.steps.push({role:'auditor',title:'Initial audit',prompt:'Review',status:'done'},{role:'lead',title:'Plan approval',prompt:'Assess plan',status:'done',profileId:'manager'},{role:'lead',title:'Post-change recheck',prompt:'Verify changed UI',status:'pending',profileId:'dev'});const deps=mapDependencies(agentNodes(job));assert.deepEqual(deps['lead:primary:0'],['auditor:primary:0']);assert.deepEqual(deps['lead:primary:1'],['lead:primary:0']);
});
