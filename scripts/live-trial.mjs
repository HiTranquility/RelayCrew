// Explicitly opt-in: this makes three real provider calls with the CLI's current login.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
if(process.env.RELAYCREW_LIVE_TEST!=='1')throw new Error('Set RELAYCREW_LIVE_TEST=1 to authorize three real CLI calls.');
const [code,cli]=process.argv.slice(2);if(!code||!cli)throw new Error('Pass absolute Code and authenticated Codex CLI executable paths.');
const temp=await mkdtemp(join(tmpdir(),'relaycrew-live-')),root=resolve('.');
const env={...process.env,RELAYCREW_LIVE_CLI:cli,RELAYCREW_LIVE_STATE:join(temp,'user','User','workspaceStorage'),RELAYCREW_LIVE_RESULT:join(temp,'result.json')};delete env.ELECTRON_RUN_AS_NODE;
const child=spawn(code,[root,'--user-data-dir',join(temp,'user'),'--extensions-dir',join(temp,'extensions'),'--extensionDevelopmentPath',root,'--extensionTestsPath',join(root,'test','live-cli.cjs'),'--disable-workspace-trust','--skip-welcome','--skip-release-notes','--new-window'],{env,windowsHide:true,stdio:'pipe'});
let log='';child.stdout.on('data',chunk=>{log+=chunk;});child.stderr.on('data',chunk=>{log+=chunk;});const timer=setTimeout(()=>child.kill(),210000);
await new Promise((resolve,reject)=>{child.on('close',resolve);child.on('error',reject);});clearTimeout(timer);
try{const result=JSON.parse(await readFile(env.RELAYCREW_LIVE_RESULT,'utf8'));console.log(JSON.stringify({...result,artifactDirectory:temp},null,2));if(!result.passed)process.exitCode=1;}catch{console.error(log.slice(-4000));process.exitCode=1;}
