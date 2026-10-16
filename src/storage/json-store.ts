import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/** Same-directory atomic replacement, with validated recovery and previous-value backups. */
export class JsonStore<T> {
  private pending = Promise.resolve();
  private last?: string;
  readonly backups: string;
  constructor(readonly file: string, private validate: (value: unknown) => value is T, private recovered?: (path: string) => void) {
    this.backups = join(dirname(file), `${file.split(/[\\/]/).at(-1)}.backups`);
  }
  async load(fallback: T): Promise<T> {
    try {
      const raw = await readFile(this.file, 'utf8'), data = JSON.parse(raw);
      if (!this.validate(data)) throw new Error('Unsupported state.');
      this.last = raw; return data;
    } catch (e: any) {
      const missing=e.code==='ENOENT';
      let names: string[] = [];
      try { names = (await readdir(this.backups)).filter(n => /^\d+-[a-f0-9-]+\.json$/.test(n)).sort().reverse(); } catch { /* no backups */ }
      for (const name of names) {
        try {
          const data = JSON.parse(await readFile(join(this.backups, name), 'utf8'));
          if (!this.validate(data)) continue;
          try { await rename(this.file, `${this.file}.corrupt-${randomUUID()}`); } catch(renameError:any) { if(renameError.code!=='ENOENT')throw renameError; }
          this.recovered?.(join(this.backups, name)); return data;
        } catch { /* try next validated backup */ }
      }
      if(missing && !names.length)return fallback;
      throw new Error(`Cannot read ${this.file}. No valid backup found; original file preserved.`);
    }
  }
  save(value: T): Promise<void> {
    const text = JSON.stringify(value, null, 2);
    this.pending = this.pending.catch(() => {}).then(async () => {
      if (text === this.last) return;
      await mkdir(dirname(this.file), { recursive: true }); await mkdir(this.backups, { recursive: true });
      try { await copyFile(this.file, join(this.backups, `${Date.now()}-${randomUUID()}.json`)); } catch (e: any) { if (e.code !== 'ENOENT') throw e; }
      const temp = `${this.file}.${randomUUID()}.tmp`;
      await writeFile(temp, text, { encoding: 'utf8', flush: true }); await rename(temp, this.file); this.last = text;
      const names = (await readdir(this.backups)).filter(n => /^\d+-[a-f0-9-]+\.json$/.test(n)).sort().reverse();
      for (const name of names.slice(50)) await unlink(join(this.backups, name));
    });
    return this.pending;
  }
}
