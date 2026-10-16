import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const readOnlyDenyRules=['write_file(*)','command(*)','unsandboxed(*)','mcp(*)','execute_url(*)'];
export function antigravityReadOnly(raw:unknown):boolean {
 const value=raw as {permissions?:{deny?:unknown}}|undefined,deny=value?.permissions?.deny;
 return Array.isArray(deny)&&readOnlyDenyRules.every(rule=>deny.includes(rule));
}
// The documented CLI has no per-run read-only switch. Fail closed rather than
// silently applying Gemini flags or weakening an existing read-only task.
export async function assertAntigravityReadOnly():Promise<void>{
 let settings:unknown;try{settings=JSON.parse(await readFile(join(homedir(),'.gemini','antigravity-cli','settings.json'),'utf8'));}catch{/* fail closed */}
 if(!antigravityReadOnly(settings))throw new Error('Antigravity read-only policy is not verified. Configure the deny rules in docs/ANTIGRAVITY.md or choose another CLI for read-only roles.');
}
