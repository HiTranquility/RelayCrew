import { parseQuota, validateFlow, validateManagement, type Profile, type Role, type RoleOverrides } from './domain';
import type { WorkflowConfiguration } from './workflow';

export function flowConfiguration(raw:unknown,profiles:Profile[]):WorkflowConfiguration {
  const value=raw as any,ids=new Set(profiles.map(p=>p.id));
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid flow configuration.');
  const flow=validateFlow(value.flow),roles={} as Record<Role,string>,overrides:RoleOverrides={};
  for(const role of ['builder','auditor','worker','lead'] as Role[]){
    if(typeof value.roles?.[role]!=='string'||!ids.has(value.roles[role]))throw new Error('Choose an existing profile for every node.');
    roles[role]=value.roles[role];const item=value.overrides?.[role];
    if(item!==undefined&&(!item||typeof item!=='object'||Array.isArray(item)||Object.keys(item).some(key=>!['model','effort'].includes(key))))throw new Error('Invalid model / reasoning value.');
    for(const field of ['model','effort'])if(item?.[field]!==undefined&&(typeof item[field]!=='string'||item[field].length>(field==='model'?200:40)||/[\r\n\0]/.test(item[field])))throw new Error('Invalid model / reasoning value.');
    overrides[role]={model:item?.model?.trim()||undefined,effort:item?.effort?.trim()||undefined};
  }
  const management=validateManagement(value.management??{primaryProfileId:roles.lead,coordinatorIds:[]},profiles);
  if(management.primaryProfileId!==roles.lead)throw new Error('Primary manager must match the Lead account.');
  return {flow,roles,overrides,management};
}
export function routingConfiguration(raw:unknown,profiles:Profile[],flow:Role[]):{mode:'selected'|'roundRobin';pools:Partial<Record<Role,string[]>>}{
  const value=raw as any,ids=new Set(profiles.map(p=>p.id));if(!value||!['selected','roundRobin'].includes(value.mode))throw new Error('Invalid routing configuration.');
  const pools:Partial<Record<Role,string[]>>={};
  for(const role of ['builder','auditor','worker','lead'] as Role[]){
    const pool=value.pools?.[role]??[];
    if(!Array.isArray(pool)||pool.some(id=>typeof id!=='string'||!ids.has(id))||new Set(pool).size!==pool.length||value.mode==='roundRobin'&&flow.includes(role)&&!pool.length)throw new Error('Select a rotation account for every active role.');
    pools[role]=pool;
  }return {mode:value.mode,pools};
}
export function manualQuota(raw:unknown){
  const value=raw as any;if(!value||typeof value.usedPercent!=='number')throw new Error('Enter 0–100.');
  if(value.remainingTokens!==undefined&&value.limitTokens!==undefined&&value.remainingTokens>value.limitTokens)throw new Error('Remaining tokens cannot exceed total tokens.');
  return parseQuota({usedPercent:value.usedPercent,observedAt:new Date().toISOString(),source:'manual',...(value.resetsAt?{resetsAt:value.resetsAt}:{}),...(value.remainingTokens!==undefined?{remainingTokens:value.remainingTokens}:{}),...(value.limitTokens!==undefined?{limitTokens:value.limitTokens}:{})});
}
