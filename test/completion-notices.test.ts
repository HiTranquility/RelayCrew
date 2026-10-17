import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CompletionNotices,completionCandidates} from '../src/core/completion-notices';
import {newJob} from '../src/core/engine';
import {renderCompletionCenter} from '../src/ui/completion-center';
const roles={builder:'a',auditor:'a',worker:'a',lead:'a'};
test('completion notices baseline old jobs, record new stages and whole flow exactly once across reloads',()=>{
 const old=newJob('old','.',roles);old.status='completed';old.steps[0].status='done';const jobs=[old],tracker=new CompletionNotices(jobs);assert.deepEqual(tracker.collect(jobs),[]);
 const job=newJob('new','.',roles);jobs.push(job);assert.deepEqual(tracker.collect(jobs),[]);job.steps[0].status='done';job.steps[0].finishedAt='2026-10-17T07:00:00Z';job.steps[0].attempts=1;assert.equal(tracker.collect(jobs)[0].kind,'step');assert.deepEqual(tracker.collect(jobs),[]);
 assert.ok(tracker.items.filter(n=>n.jobId===old.id).every(n=>n.read));
 job.steps.push({role:'lead',title:'Decision',prompt:'verify',status:'done',finishedAt:'2026-10-17T07:02:00Z'});job.status='completed';assert.deepEqual(tracker.collect(jobs).map(n=>n.kind),['step','flow']);assert.deepEqual(tracker.collect(jobs),[]);tracker.markRead();assert.ok(tracker.items.every(n=>n.read));const restored=new CompletionNotices(jobs,tracker.snapshot());assert.equal(restored.items.filter(n=>n.jobId===job.id).length,3);assert.deepEqual(restored.collect(jobs),[]);
});
test('owner/quota waits, cancelled runs and a failed response contract do not announce successful completion',()=>{
 const job=newJob('task','.',roles),tracker=new CompletionNotices([job]);for(const status of ['waiting_owner','waiting_quota','cancelled','failed'] as const){job.status=status;job.steps[0].status=status==='waiting_owner'?'waiting_owner':'pending';assert.deepEqual(tracker.collect([job]),[]);}
 job.status='failed';job.steps[0].status='done';assert.deepEqual(completionCandidates([job]),[]);job.status='running';assert.equal(tracker.collect([job]).length,1);
 job.steps[0].status='pending';tracker.collect([job]);job.steps[0].status='done';job.steps[0].attempts=2;job.steps[0].finishedAt='2026-10-17T08:00:00Z';assert.equal(tracker.collect([job]).length,1);
});
test('completion history is bounded, localized and contains no secret account configuration',()=>{
 const tracker=new CompletionNotices([]),jobs=Array.from({length:110},(_,i)=>{const job=newJob('<img src=x>'+i,'.',roles);job.steps[0].status='done';job.status='completed';return job;});tracker.collect(jobs);assert.equal(tracker.items.length,100);
 const html=renderCompletionCenter(tracker.items,jobs,[{id:'a',label:'Account <A>',provider:'codex',executable:'codex',env:{TOKEN:'NEVER_RENDER'}}],'vi');assert.ok(!html.includes('NEVER_RENDER'));assert.ok(!html.includes('<img src=x>'));assert.match(html,/Đã hoàn tất flow/);assert.match(html,/data-notification-level/);assert.equal((html.match(/data-open-notice=/g)??[]).length,100);
});
