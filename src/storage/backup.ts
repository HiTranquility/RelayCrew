import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
const exec = promisify(execFile);
export interface BackupManifest {
  version: 1; createdAt: string; cwd: string; jobId: string; role: string;
  files: { path: string; size: number; sha256: string; mode: number }[];
  omitted: { path: string; reason: string }[]; totalBytes: number;
}
export function inside(root: string, path: string): boolean {
  const rel = relative(resolve(root), resolve(path)); return rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}
export async function listBackups(root: string): Promise<{ path: string; manifest: BackupManifest }[]> {
  let names: string[]; try { names = await readdir(root); } catch (e: any) { if (e.code === 'ENOENT') return []; throw e; }
  const results: { path: string; manifest: BackupManifest }[] = [];
  for (const name of names.filter(n => /^\d+-[a-f0-9-]+$/.test(n))) {
    try { const manifest = JSON.parse(await readFile(join(root, name, 'manifest.json'), 'utf8')); if (manifest.version === 1) results.push({ path: join(root, name), manifest }); } catch { /* incomplete snapshot is never advertised as recoverable */ }
  }
  return results.sort((a,b) => b.manifest.createdAt.localeCompare(a.manifest.createdAt));
}
export async function snapshotWorkspace(cwd: string, root: string, jobId: string, role: string, options: { maxBytes: number; totalBytes: number; extraPaths?: string[] }): Promise<string> {
  if (inside(cwd, root)) throw new Error('Backup storage must be outside the workspace being backed up.');
  const existing = await listBackups(root);
  const used = existing.reduce((sum,b) => sum+b.manifest.totalBytes,0);
  let output: string;
  try { output = (await exec('git', ['ls-files','--cached','--others','--exclude-standard','-z'], { cwd, windowsHide:true, timeout:15_000, maxBuffer:16_000_000 })).stdout; }
  catch { throw new Error('Source backup requires a Git working directory. Initialize Git or configure backup behavior before editable tasks.'); }
  const paths = new Set(output.split('\0').filter(Boolean));
  const canonicalRoot = await realpath(cwd);
  const addExtra = async (path: string) => {
    const absolute = resolve(cwd,path);
    if (!inside(cwd,absolute) || path.split(/[\\/]/).includes('.git')) throw new Error('Extra backup paths must remain inside the workspace and outside .git.');
    const info = await lstat(absolute);
    if (!inside(canonicalRoot, await realpath(absolute))) throw new Error('Extra backup path resolves outside the workspace.');
    if (info.isSymbolicLink()) throw new Error('Extra backup paths cannot be symlinks.');
    if (info.isDirectory()) for (const name of await readdir(absolute)) await addExtra(join(path,name));
    else paths.add(path);
    if (paths.size > 10_000) throw new Error('Backup exceeds 10,000 files. Narrow the editable workspace.');
  };
  for (const path of options.extraPaths ?? []) await addExtra(path);
  if (paths.size > 10_000) throw new Error('Backup exceeds 10,000 files. Narrow the editable workspace.');
  const files: { path: string; data: Buffer; mode: number }[] = [];
  const omitted: BackupManifest['omitted'] = [];
  let totalBytes = 0;
  for (const path of paths) {
    const absolute=resolve(cwd,path);
    if (!inside(cwd,absolute) || path.split(/[\\/]/).includes('.git')) throw new Error('Git returned an unsafe backup path.');
    let info;
    try { info=await lstat(absolute); } catch(e:any) { if(e.code==='ENOENT'){omitted.push({path,reason:'already deleted before step'});continue;}throw e; }
    if (info.isSymbolicLink() || !info.isFile()) { omitted.push({path,reason:'symlink or submodule/directory; manage separately'});continue; }
    if (!inside(canonicalRoot,await realpath(absolute))) throw new Error('Backup file resolves outside the workspace.');
    totalBytes+=info.size;
    if (totalBytes>options.maxBytes || used+totalBytes>options.totalBytes) throw new Error('Backup size/storage cap reached. Manage existing snapshots or adjust backup limits before continuing.');
    const data=await readFile(absolute);const after=await stat(absolute);
    if(after.mtimeMs!==info.mtimeMs || data.length!==info.size)throw new Error('Files changed while creating backup; no CLI was started.');
    files.push({path,data,mode:info.mode});
  }
  const folder=join(root,`${Date.now()}-${randomUUID()}`);await mkdir(join(folder,'files'),{recursive:true});
  const manifest:BackupManifest={version:1,createdAt:new Date().toISOString(),cwd,jobId,role,files:[],omitted,totalBytes};
  for(const file of files){const destination=resolve(folder,'files',file.path);if(!inside(join(folder,'files'),destination))throw new Error('Unsafe snapshot destination.');await mkdir(resolve(destination,'..'),{recursive:true});await writeFile(destination,file.data);manifest.files.push({path:file.path,size:file.data.length,mode:file.mode,sha256:createHash('sha256').update(file.data).digest('hex')});}
  await writeFile(join(folder,'manifest.json'),JSON.stringify(manifest,null,2),{encoding:'utf8',flush:true});
  return folder;
}
