import type { Profile } from '../core/domain';
import { execute as executeCli } from './cli/runner';
import { findLocalCli } from './cli/local-cli';
import { resolveModel } from './cli/model-selection';
import { executeHttp, resolveHttpModel } from './http/compatible';

// Built-in transports share the engine contract. CLI remains the default for
// existing profiles; HTTP has deliberately fewer capabilities.
export async function prepareProfile(profile:Profile,secrets:Record<string,string>,signal:AbortSignal){
  if(profile.transport==='http')return {profile:await resolveHttpModel(profile,secrets,signal),source:(profile.model?'custom':'catalog') as 'custom'|'catalog',note:'API model selected from the configured endpoint.'};
  const executable=await findLocalCli(profile.provider,profile.executable);
  if(!executable)throw new Error(`CLI missing for ${profile.label}. Open Accounts to install or sign in.`);
  return resolveModel({...profile,executable},secrets,signal);
}
export function execute(options:Parameters<typeof executeCli>[0]):Promise<string>{return options.profile.transport==='http'?executeHttp(options):executeCli(options);}
