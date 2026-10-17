export interface TaskFolderScope {path:string;permission:'read-only'|'auto'}
export function taskFolderScopes(raw:unknown,approved:string[]):TaskFolderScope[]{
 if(!Array.isArray(raw)||!raw.length||raw.length>20)throw new Error('Choose 1–20 approved folders for the task group.');const seen=new Set<string>();return raw.map(v=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!['path','permission'].includes(k))||typeof v.path!=='string'||!approved.includes(v.path)||seen.has(v.path)||!['read-only','auto'].includes(v.permission))throw new Error('Choose approved folders and read-only or team permissions.');seen.add(v.path);return {path:v.path,permission:v.permission};});
}
