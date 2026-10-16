import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import ts from 'typescript';
import { resolveLanguage, roleLabel, statusLabel, translator, vietnamese } from '../src/core/i18n';
import { validateSettingsPatch } from '../src/core/settings';
import { renderBoard, type BoardOptions } from '../src/ui/board';
import { flowEditor } from '../src/ui/flow-editor';
import { newJob } from '../src/core/engine';

test('locale selection supports explicit English/Vietnamese and predictable auto fallback',()=>{
  assert.equal(resolveLanguage('vi','en-US'),'vi');assert.equal(resolveLanguage('en','vi'),'en');
  for(const locale of ['vi','vi-VN','VI-vn'])assert.equal(resolveLanguage('auto',locale),'vi');
  for(const locale of ['en-US','ja','fr','vietnamese'])assert.equal(resolveLanguage('auto',locale),'en');
  assert.equal(resolveLanguage('invalid','vi'),'vi');assert.equal(statusLabel('waiting_owner','vi'),'Chờ bạn trả lời');assert.equal(roleLabel('auditor','en'),'Audit');
});
test('translations retain placeholders and do not recursively replace user-provided content',()=>{
  const placeholders=(text:string)=>[...text.matchAll(/\{\d+\}/g)].map(m=>m[0]).sort();
  for(const [source,target]of Object.entries(vietnamese)){assert.ok(target.trim(),source);assert.deepEqual(placeholders(target),placeholders(source),source);}
  assert.equal(translator('en')('Input sent to {0}','<b>{1}</b>'),'Input sent to <b>{1}</b>');
  assert.equal(translator('vi')('unknown provider output'), 'unknown provider output');
  assert.equal(translator('vi')('__proto__'),'__proto__');
});
test('literal runtime messages and manifest localization keys have both language entries',async()=>{
  const files=async(dir:string):Promise<string[]> => (await Promise.all((await readdir(dir,{withFileTypes:true})).map(entry=>entry.isDirectory()?files(join(dir,entry.name)):entry.name.endsWith('.ts')?[join(dir,entry.name)]:[]))).flat();
  for(const file of await files('src')){
    const source=ts.createSourceFile(file,await readFile(file,'utf8'),ts.ScriptTarget.Latest,true);
    const visit=(node:ts.Node)=>{if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&['t','tr'].includes(node.expression.text)&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0]))assert.ok(Object.hasOwn(vietnamese,node.arguments[0].text),`${file}: missing ${node.arguments[0].text}`);ts.forEachChild(node,visit);};visit(source);
  }
  const manifest=JSON.parse(await readFile('package.json','utf8')),en=JSON.parse(await readFile('package.nls.json','utf8')),vi=JSON.parse(await readFile('package.nls.vi.json','utf8'));
  assert.deepEqual(Object.keys(en).sort(),Object.keys(vi).sort());
  const visit=(value:unknown)=>{if(typeof value==='string'&&/^%[^%]+%$/.test(value)){const key=value.slice(1,-1);assert.ok(en[key]&&vi[key],key);}else if(value&&typeof value==='object')Object.values(value).forEach(visit);};visit(manifest);
});
test('bilingual board and flow preserve prompts, model IDs, account labels and report contents',()=>{
  const roles={builder:'a',auditor:'a',worker:'a',lead:'a'},profiles=[{id:'a',label:'Tài khoản người dùng',provider:'codex' as const,executable:'codex',model:'exact-model-id',env:{TOKEN:'DO_NOT_RENDER'}}];
  const job=newJob('Giữ nguyên yêu cầu <owner>','.',roles);job.steps[0].response='Original agent response <result>';job.status='waiting_owner';job.ownerQuestion='Original owner question';
  const before=JSON.stringify(job),base:BoardOptions={queuePaused:false,autoSwitch:false,resumeAfterQuota:false,resumeProviderLimited:false,allowEdits:false,routingMode:'selected',timeoutMinutes:30};
  const render=(language:'en'|'vi')=>renderBoard([job],profiles,{}, {items:[],enabled:false,remaining:0,until:0},'',{...base,language});
  assert.match(render('en'),/lang="en"/);assert.match(render('en'),/RelayCrew · Assignment board/);assert.match(render('vi'),/Bảng phân công/);assert.match(render('vi'),/Chờ bạn trả lời/);
  for(const language of ['en','vi'] as const){const html=render(language);for(const original of ['Giữ nguyên yêu cầu &lt;owner&gt;','Original agent response &lt;result&gt;','Original owner question','exact-model-id','Tài khoản người dùng'])assert.ok(html.includes(original),original);assert.ok(!html.includes('DO_NOT_RENDER'));assert.match(html,/role="tablist"/);assert.match(html,/data-action="saveSettings"/);assert.match(html,/data-action="language"/);assert.match(flowEditor(profiles,['builder','auditor','lead'],roles,{},language),new RegExp(`lang="${language}"`));}
  assert.equal(JSON.stringify(job),before);
});
test('webview settings reject unknown keys, invalid numbers and out-of-range writes',()=>{
  assert.deepEqual(validateSettingsPatch({quotaThreshold:99.5,maxChildTasks:0}),{quotaThreshold:99.5,maxChildTasks:0});
  for(const value of [{profiles:[]},{timeoutMinutes:0},{timeoutMinutes:1.5},{quotaThreshold:NaN},{backupBeforeEdits:false},{quotaRefreshSeconds:14},[]])assert.throws(()=>validateSettingsPatch(value));
});
