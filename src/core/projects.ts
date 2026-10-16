import { basename, isAbsolute, normalize } from 'node:path';
import type { Job } from './domain';

export interface ProjectRoot { name: string; path: string }
export interface ProjectSummary extends ProjectRoot { open: boolean; jobs: Job[] }
const key = (path: string) => process.platform === 'win32' ? normalize(path).toLowerCase() : normalize(path);

/** Group by the exact execution folder. Nested worktrees remain separate projects. */
export function projectSummaries(roots: ProjectRoot[], jobs: Job[]): ProjectSummary[] {
  const groups = new Map<string, ProjectSummary>();
  for (const root of roots) groups.set(key(root.path), { ...root, open: true, jobs: [] });
  for (const job of jobs) {
    const path=job.sourceCwd??job.cwd, id = key(path);
    if (!groups.has(id)) groups.set(id, { name: basename(path) || path, path, open: false, jobs: [] });
    groups.get(id)!.jobs.push(job);
  }
  return [...groups.values()];
}

/** Official desktop deep link: prepares a composer; it never submits a task. */
export function codexProjectLink(path: string): string {
  if (!isAbsolute(path) || /[\u0000-\u001f]/.test(path)) throw new Error('Choose an absolute local project folder.');
  return `codex://threads/new?path=${encodeURIComponent(path)}`;
}
