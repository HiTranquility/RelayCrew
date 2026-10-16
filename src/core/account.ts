import { isAbsolute } from 'node:path';
import { validateProfiles, type Profile } from './domain';
export function accountFromForm(raw:unknown,profiles:Profile[]):Profile {
  const value=raw as Record<string,unknown>;
  if(!value||Array.isArray(value)||typeof value!=='object'||Object.keys(value).some(key=>!['id','label','provider','executable','model','effort','configDir','quotaFile','modelPolicy','quotaCeiling','hosting','transport','endpoint'].includes(key)))throw new Error('Invalid account form.');
  for(const key of ['id','label','provider','executable','model','effort','configDir','quotaFile'])if(value[key]!==undefined&&(typeof value[key]!=='string'||(value[key] as string).length>(key==='effort'?40:key==='model'?200:500)||/[\r\n\0]/.test(value[key] as string)))throw new Error('Invalid account form.');
  const id=value.id as string;if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id))throw new Error('Invalid account form.');
  const previous=profiles.find(p=>p.id===id);if(previous&&value.provider!==previous.provider)throw new Error('The provider of an existing account cannot be changed. Add another account instead.');
  const profile:Profile={...previous,id,label:(value.label as string)?.trim(),provider:value.provider as Profile['provider'],executable:(value.executable as string)?.trim(),model:(value.model as string)?.trim()||undefined,effort:(value.effort as string)?.trim()||undefined};
  profile.hosting=(value.hosting??previous?.hosting??'cloud') as Profile['hosting'];
  profile.transport=profile.provider==='compatible'?'http':'cli';
  if(profile.transport==='http'){profile.executable='http';profile.endpoint=value.endpoint as string;profile.effort=undefined;}else profile.endpoint=undefined;
  if(value.modelPolicy!==undefined){if(!['flagship','cli','custom'].includes(value.modelPolicy as string))throw new Error('Invalid model policy.');profile.modelPolicy=value.modelPolicy as Profile['modelPolicy'];if(value.modelPolicy!=='custom')profile.model=undefined;}
  if(value.quotaCeiling!==undefined){if(typeof value.quotaCeiling!=='number'&&typeof value.quotaCeiling!=='string')throw new Error('Account quota ceiling must be between 1 and 100.');const ceiling=value.quotaCeiling===''?undefined:Number(value.quotaCeiling);if(ceiling!==undefined&&(!Number.isFinite(ceiling)||ceiling<1||ceiling>100))throw new Error('Account quota ceiling must be between 1 and 100.');profile.quotaCeiling=ceiling;}
  if(value.quotaFile!==undefined){const path=(value.quotaFile as string).trim();if(path&&!isAbsolute(path))throw new Error('Use an absolute path or leave empty.');profile.quotaFile=path||undefined;}
  if(value.configDir!==undefined&&['codex','claude'].includes(profile.provider)){
    const dir=(value.configDir as string).trim();if(dir&&!isAbsolute(dir))throw new Error('Use an absolute configuration folder path or leave empty.');
    profile.env={...previous?.env};const key=profile.provider==='codex'?'CODEX_HOME':'CLAUDE_CONFIG_DIR';if(dir)profile.env[key]=dir;else delete profile.env[key];
  }
  validateProfiles([profile]);return profile;
}
