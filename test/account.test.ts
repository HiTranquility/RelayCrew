import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountFromForm } from '../src/core/account';
import type { Profile } from '../src/core/domain';
import { isAbsolute, resolve } from 'node:path';
import { findLocalCli, cliVersion } from '../src/adapters/cli/local-cli';
import { renderBoard } from '../src/ui/board';
test('inline account editing preserves secret references and unrelated environment while isolating CLI homes',()=>{
  const old:Profile={id:'a',label:'A',provider:'codex',executable:'codex',env:{EXTRA:'keep',CODEX_HOME:resolve('old-home')},secretEnv:['TOKEN']};
  const draft={id:'a',label:'Second account',provider:'codex',executable:'codex',model:'exact-model',effort:'medium',configDir:resolve('new-home')},saved=accountFromForm(draft,[old]);
  assert.equal(saved.env?.CODEX_HOME,draft.configDir);assert.equal(saved.env?.EXTRA,'keep');assert.deepEqual(saved.secretEnv,['TOKEN']);assert.equal(old.label,'A');
  assert.equal(accountFromForm({...draft,configDir:''},[old]).env?.CODEX_HOME,undefined);
  for(const invalid of [{...draft,env:{TOKEN:'raw'}},{...draft,provider:'claude'},{...draft,model:'bad\nflag'},{...draft,configDir:'relative/path'},{...draft,id:'../bad'},{...draft,executable:''}])assert.throws(()=>accountFromForm(invalid,[old]));
});
test('CLI discovery accepts a real executable path and version check does not need a model call',async()=>{
  const path=await findLocalCli('codex',process.execPath);assert.equal(path,process.execPath);assert.equal(isAbsolute(path!),true);assert.match(await cliVersion(path!),/^v\d+/);
});
test('reopened board state cannot inject script through a draft',()=>{
  const html=renderBoard([],[],{},{items:[],enabled:false,remaining:0,until:0},'',{queuePaused:false,autoSwitch:false,resumeAfterQuota:false,resumeProviderLimited:false,allowEdits:false,routingMode:'selected',timeoutMinutes:30,initialState:{consoleDraft:'</script><script>evil()</script>'}});
  assert.ok(!html.includes('</script><script>evil()'));assert.ok(html.includes('\\u003c/script>'));
});
