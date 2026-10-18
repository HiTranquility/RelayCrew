import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newJob} from '../src/core/engine';
import {sessionScope} from '../src/ui/session-scope';

test('folder inspection displays effective and original scope, without editable running-task paths',()=>{
 const job=newJob('Inspect','C:\\work\\feature',{builder:'dev',auditor:'audit',worker:'dev',lead:'lead'});
 job.sourceCwd='C:\\work\\main';job.worktree={path:job.cwd,repository:job.sourceCwd,branch:'feature/<script>',baseCommit:'abc'};job.readOnly=true;job.permission='full';
 const before=structuredClone(job),html=sessionScope(job,'en');
 assert.match(html,/Assigned workspace/);assert.match(html,/C:\\work\\feature/);assert.match(html,/Original folder/);assert.match(html,/feature\/&lt;script&gt;/);assert.match(html,/Read-only/);assert.ok(!html.includes('Full CLI permissions'));
 assert.match(html,new RegExp('data-scope-job="'+job.id+'"'));assert.ok(!/<input|<select|<textarea/.test(html));assert.deepEqual(job,before);
});

test('simulation scope does not offer real folder access or imply execution permissions',()=>{
 const job=newJob('Demo','<img src=x>',{builder:'dev',auditor:'audit',worker:'dev',lead:'lead'});job.simulation=true;job.permission='full';
 const html=sessionScope(job,'vi');assert.match(html,/Giả lập · không truy cập file/);assert.match(html,/&lt;img src=x&gt;/);assert.ok(!html.includes('data-session-scope="reveal"'));assert.ok(!html.includes('Quyền CLI đầy đủ'));
 assert.match(html,/Task mới \/ chọn thư mục/);
});
