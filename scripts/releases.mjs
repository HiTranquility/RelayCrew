import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const catalog = join(root, 'releases');
const versionPattern = /^\d+\.\d+\.\d+$/;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

async function verify() {
  const versions = (await readdir(catalog, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && /^v\d+\.\d+\.\d+$/.test(entry.name))
    .map(entry => entry.name).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (!versions.length) throw new Error('No archived releases found.');
  for (const tag of versions) {
    const directory = join(catalog, tag);
    const metadata = JSON.parse(await readFile(join(directory, 'release.json'), 'utf8'));
    if (!versionPattern.test(metadata.version) || `v${metadata.version}` !== tag) throw new Error(`${tag}: invalid archive version.`);
    const checksums = [];
    for (const entry of [metadata.artifact, metadata.source]) {
      if (!entry || typeof entry.file !== 'string' || entry.file !== basename(entry.file) || /[\\/\r\n]/.test(entry.file)
        || !/^[a-f0-9]{64}$/.test(entry.sha256) || !Number.isSafeInteger(entry.bytes) || entry.bytes <= 0) {
        throw new Error(`${tag}: invalid asset metadata.`);
      }
      const file = join(directory, entry.file);
      if (!(await stat(file)).isFile()) throw new Error(`${tag}: asset is not a file.`);
      const bytes = await readFile(file);
      if (bytes.length !== entry.bytes || digest(bytes) !== entry.sha256) throw new Error(`${tag}: checksum mismatch for ${entry.file}.`);
      checksums.push(`${entry.sha256}  ${entry.file}`);
    }
    if ((await readFile(join(directory, 'SHA256SUMS'), 'utf8')).replace(/\r\n/g, '\n') !== checksums.join('\n') + '\n') {
      throw new Error(`${tag}: SHA256SUMS differs from release.json.`);
    }
    await readFile(join(directory, 'NOTES.md'), 'utf8');
    console.log(`${tag}: VSIX and source archive checksums verified.`);
  }
}

async function stage(tag) {
  const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  if (!versionPattern.test(manifest.version) || tag !== `v${manifest.version}`) {
    throw new Error('Release tag must exactly match v<package.json version>. Do not tag current source as an older release.');
  }
  const notes = await readFile(join(catalog, tag, 'NOTES.md'), 'utf8');
  const name = `relaycrew-${manifest.version}.vsix`;
  const source = join(root, name);
  const bytes = await readFile(source);
  const destination = join(root, 'release-assets');
  await mkdir(destination, { recursive: true });
  await copyFile(source, join(destination, name));
  await writeFile(join(destination, 'SHA256SUMS'), `${digest(bytes)}  ${name}\n`);
  await writeFile(join(destination, 'NOTES.md'), notes);
  console.log(`Staged ${tag}: ${name} and SHA256SUMS. No release has been published.`);
}

try {
  if (process.argv[2] === 'verify') await verify();
  else if (process.argv[2] === 'stage') await stage(process.argv[3]);
  else throw new Error('Usage: node scripts/releases.mjs verify | stage vX.Y.Z');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
