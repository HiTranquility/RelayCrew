import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const exec = promisify(execFile);
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
async function fixture(t: { after: (cleanup: () => Promise<void>) => void }) {
  const root = await mkdtemp(join(tmpdir(), 'relaycrew-release-'));
  t.after(async () => {
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    await rm(root, { recursive: true, force: true });
  });
  await mkdir(join(root, 'scripts'));
  const script = join(root, 'scripts', 'releases.mjs');
  await copyFile(resolve('scripts/releases.mjs'), script);
  const archive = join(root, 'releases', 'v0.3.1');
  await mkdir(archive, { recursive: true });
  await writeFile(join(archive, 'NOTES.md'), '# Fixture release\n');
  await writeFile(join(root, 'package.json'), JSON.stringify({ version: '0.3.1' }));
  return { root, archive, run: (...args: string[]) => exec(process.execPath, [script, ...args]) };
}

test('release verification detects a changed archived asset', async t => {
  const { archive, run } = await fixture(t);
  const artifact = { file: 'fixture.vsix', sha256: hash('package'), bytes: 7 };
  const source = { file: 'source.zip', sha256: hash('source'), bytes: 6 };
  await writeFile(join(archive, artifact.file), 'package');
  await writeFile(join(archive, source.file), 'source');
  await writeFile(join(archive, 'release.json'), JSON.stringify({ version: '0.3.1', artifact, source }));
  await writeFile(join(archive, 'SHA256SUMS'), `${artifact.sha256}  ${artifact.file}\n${source.sha256}  ${source.file}\n`);
  assert.match((await run('verify')).stdout, /checksums verified/);
  await writeFile(join(archive, artifact.file), 'changed');
  await assert.rejects(run('verify'), (error: any) => /checksum mismatch/.test(error.stderr));
});

test('release staging rejects old-version tags and emits exact package checksums', async t => {
  const { root, run } = await fixture(t);
  await assert.rejects(run('stage', 'v0.1.0'), (error: any) => /must exactly match/.test(error.stderr));
  await writeFile(join(root, 'relaycrew-0.3.1.vsix'), 'fixture package');
  await run('stage', 'v0.3.1');
  assert.equal(await readFile(join(root, 'release-assets', 'relaycrew-0.3.1.vsix'), 'utf8'), 'fixture package');
  assert.equal(await readFile(join(root, 'release-assets', 'SHA256SUMS'), 'utf8'), `${hash('fixture package')}  relaycrew-0.3.1.vsix\n`);
});
