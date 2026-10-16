export type TaskPermission='read-only'|'auto'|'full';
export interface DailyWorkspace {path:string;permission:TaskPermission;enabled:boolean}
export function dailyWorkspaces(raw:unknown,approved:string[]):DailyWorkspace[]{
 if(!Array.isArray(raw)||!raw.length||raw.length>20)throw new Error('Choose 1–20 local folders.');
 const seen=new Set<string>();return raw.map(v=>{
  if(!v||typeof v!=='object'||typeof v.path!=='string'||!approved.includes(v.path)||seen.has(v.path)||!['read-only','auto','full'].includes(v.permission))throw new Error('Choose approved folders and valid permissions.');
  seen.add(v.path);return {path:v.path,permission:v.permission,enabled:true};
 });
}
export function permissionAllows(current:TaskPermission,snapshot:TaskPermission):boolean{
 return ['read-only','auto','full'].indexOf(current)>=['read-only','auto','full'].indexOf(snapshot);
}
