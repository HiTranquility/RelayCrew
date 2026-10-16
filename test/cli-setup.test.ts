import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installPlan,loginArguments,quotedCommand,inspectCli } from '../src/adapters/cli/setup';
test('provider installation/login plans use fixed commands and quote paths without executing user input',()=>{
  assert.equal(installPlan('codex','win32').command,'npm.cmd install -g @openai/codex');assert.equal(installPlan('claude','win32').command,'winget install --id Anthropic.ClaudeCode --exact');assert.match(installPlan('gemini','linux').command,/@google\/gemini-cli$/);
  assert.deepEqual(loginArguments('codex'),['login']);assert.deepEqual(loginArguments('claude'),['auth','login']);assert.deepEqual(loginArguments('gemini'),[]);
  assert.equal(quotedCommand("C:\\Owner's Folder\\cli.exe",['auth','login'],'win32'),"& 'C:\\Owner''s Folder\\cli.exe' 'auth' 'login'");
  assert.equal(quotedCommand('/path/$(touch file)',[],'linux'),"'/path/$(touch file)'");
});
test('CLI status does not assume installation or authentication from a configured label',async()=>{
  const result=await inspectCli({id:'a',label:'A',provider:'gemini',executable:process.execPath},{});assert.equal(result.installed,true);assert.equal(result.authenticated,'unknown');assert.match(result.version!,/^v\d+/);assert.ok(!JSON.stringify(result).includes('access_token'));
});
