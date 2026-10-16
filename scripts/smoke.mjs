import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const executable = process.argv[2];
if (!executable) throw new Error('Pass the absolute path to Code.exe.');
const root = resolve('.');
const temp = await mkdtemp(join(tmpdir(), 'ai-team-host-'));
await mkdir(join(temp, 'workspace'));
const env = { ...process.env, AI_TEAM_SMOKE_RESULT: join(temp, 'result.json'),AI_TEAM_SMOKE_STATE:join(temp,'user','User','workspaceStorage') };
delete env.ELECTRON_RUN_AS_NODE;
const args = [join(temp, 'workspace'), '--user-data-dir', join(temp, 'user'), '--extensions-dir', join(temp, 'extensions'), '--extensionDevelopmentPath', root, '--extensionTestsPath', join(root, 'test', 'host-smoke.cjs'), '--disable-workspace-trust', '--skip-welcome', '--skip-release-notes', '--new-window'];
const child = spawn(executable, args, { env, windowsHide: true, stdio: 'pipe' });
let logs = '';
child.stdout.on('data', c => { logs += c; }); child.stderr.on('data', c => { logs += c; });
const timer = setTimeout(() => child.kill(), 90_000);
await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
clearTimeout(timer);
try {
  const result = JSON.parse(await readFile(env.AI_TEAM_SMOKE_RESULT, 'utf8'));
  console.log(JSON.stringify({ ...result, artifactDirectory: temp }, null, 2));
  if (!result.passed) process.exitCode = 1;
} catch { console.error(logs.slice(-8000)); process.exitCode = 1; }
