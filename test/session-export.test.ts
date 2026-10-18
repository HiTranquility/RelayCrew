import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newJob} from '../src/core/engine';
import {exportSession,sessionEvidenceMarkdown} from '../src/core/session-export';

test('portable session evidence keeps public work and observed changes without internal baselines or private items',()=>{
  const job=newJob('owner task','/repo',{builder:'c',auditor:'c',worker:'c',lead:'c'});
  job.steps[0].response='public result';job.fileChangeBaseline={'private-file':'INTERNAL_HASH'};
  job.timeline=[{at:'2026-10-18T00:00:00Z',kind:'tool',from:'builder:c',to:'observer',text:'rg src/example.ts'},{at:'2026-10-18T00:00:01Z',kind:'reasoning',from:'builder:c',to:'observer',text:'PRIVATE_ITEM'}];
  job.fileChanges=[{path:'src/example.ts',kind:'modified',at:'2026-10-18T00:00:02Z',stepIndex:0,fingerprint:'INTERNAL_FINGERPRINT'}];
  const report=exportSession(job),serialized=JSON.stringify(report);
  assert.equal(report.format,'relaycrew-session');assert.equal(report.version,1);assert.equal(report.session.steps[0].response,'public result');assert.equal(report.session.timeline.length,1);
  for(const forbidden of ['INTERNAL_HASH','INTERNAL_FINGERPRINT','PRIVATE_ITEM','fileChangeBaseline'])assert.ok(!serialized.includes(forbidden));
  assert.match(sessionEvidenceMarkdown(job),/src\/example.ts/);assert.match(sessionEvidenceMarkdown(job),/concurrent user edits/);
});
