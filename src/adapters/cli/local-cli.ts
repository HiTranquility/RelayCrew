import spawn from 'cross-spawn';
import { access, readdir, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, isAbsolute, join } from 'node:path';
import type { Provider } from '../../core/domain';

export async function findLocalCli(provider:Provider,preferred?:string):Promise<string|undefined>{
  if(provider==='compatible')return;
  const suffixes=process.platform==='win32'?['.exe','.cmd','.bat','']:[''];
  const candidates:string[]=[];
  if(preferred&&isAbsolute(preferred))candidates.push(preferred);
  const paths=(process.env.PATH??process.env.Path??'').split(delimiter).filter(Boolean);
  paths.push(join(homedir(),'.local','bin'),join(homedir(),'.npm-global','bin'));
  if(process.env.APPDATA)paths.push(join(process.env.APPDATA,'npm'));
  if(provider==='antigravity'&&process.env.LOCALAPPDATA)paths.push(join(process.env.LOCALAPPDATA,'agy','bin'));
  for(const dir of paths)for(const suffix of suffixes)candidates.push(join(dir,(provider==='antigravity'?'agy':provider)+suffix));
  if(provider==='codex'&&process.platform==='win32'&&process.env.LOCALAPPDATA){
    const root=join(process.env.LOCALAPPDATA,'OpenAI','Codex','bin');
    try {const dirs=await Promise.all((await readdir(root,{withFileTypes:true})).filter(d=>d.isDirectory()).map(async d=>({path:join(root,d.name,'codex.exe'),time:(await stat(join(root,d.name))).mtimeMs})));candidates.push(...dirs.sort((a,b)=>b.time-a.time).map(d=>d.path));}catch{/* optional desktop installation */}
  }
  for(const path of candidates)try{await access(path,process.platform==='win32'?constants.F_OK:constants.X_OK);if((await stat(path)).isFile())return path;}catch{/* next candidate */}
  return;
}
export async function cliVersion(executable:string):Promise<string>{
  return new Promise((resolve,reject)=>{
    const child=spawn(executable,['--version'],{windowsHide:true,stdio:['ignore','pipe','pipe']});let text='';
    const timer=setTimeout(()=>{child.kill();reject(new Error('CLI check timed out. Verify the executable path.'));},8000);
    child.stdout?.on('data',chunk=>{text+=chunk.toString();if(text.length>16000){child.kill();reject(new Error('Invalid CLI version response.'));}});
    child.stderr?.resume();child.on('error',error=>{clearTimeout(timer);reject(error);});
    child.on('close',code=>{clearTimeout(timer);if(code===0&&text.trim())resolve(text.trim().split(/\r?\n/)[0].slice(0,200));else reject(new Error('CLI check failed. Install the CLI or choose its executable.'));});
  });
}
