import { isAbsolute } from 'node:path';
import { validateProfiles, type Profile } from './domain';
export function accountFromForm(raw:unknown,profiles:Profile[]):Profile {
  const value=raw as Record<string,unknown>;
  if(!value||Array.isArray(value)||typeof value!=='object'||Object.keys(value).some(key=>!['id','label','provider','executable','model','effort','configDir'].includes(key)))throw new Error('Invalid account form.');
  for(const key of ['id','label','provider','executable','model','effort','configDir'])if(value[key]!==undefined&&(typeof value[key]!=='string'||(value[key] as string).length>(key==='effort'?40:key==='model'?200:500)||/[\r\n\0]/.test(value[key] as string)))throw new Error('Invalid account form.');
  const id=value.id as string;if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id))throw new Error('Invalid account form.');
  const previous=profiles.find(p=>p.id===id);if(previous&&value.provider!==previous.provider)throw new Error('The provider of an existing account cannot be changed. Add another account instead.');
  const profile:Profile={...previous,id,label:(value.label as string)?.trim(),provider:value.provider as Profile['provider'],executable:(value.executable as string)?.trim(),model:(value.model as string)?.trim()||undefined,effort:(value.effort as string)?.trim()||undefined};
  if(value.configDir!==undefined&&profile.provider!=='gemini'){
    const dir=(value.configDir as string).trim();if(dir&&!isAbsolute(dir))throw new Error('Use an absolute configuration folder path or leave empty.');
    profile.env={...previous?.env};const key=profile.provider==='codex'?'CODEX_HOME':'CLAUDE_CONFIG_DIR';if(dir)profile.env[key]=dir;else delete profile.env[key];
  }
  validateProfiles([profile]);return profile;
}
