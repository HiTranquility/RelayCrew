import {delegationPolicy,type DelegationPolicy} from './delegation';
import {flowConfiguration} from './configuration';
import { validatePromptTemplates, type PromptTemplates } from './prompt-templates';
import { createHash } from 'node:crypto';
import { validateFlow, validateManagement, type Management, type Profile, type Role, type RoleOverrides } from './domain';
export interface WorkflowDocument {name:string;markdown:string;sha256:string}
export interface WorkflowConfiguration {flow:Role[];roles:Record<Role,string>;overrides:RoleOverrides;management:Management;promptTemplates?:PromptTemplates;delegation?:DelegationPolicy;auditors?:import('./domain').AuditReviewer[]}
export function importWorkflow(name:string,bytes:Buffer,profiles:Profile[],current:WorkflowConfiguration):{document:WorkflowDocument;configuration:WorkflowConfiguration;structured:boolean}{
  if(!/\.md$/i.test(name)||bytes.length>64*1024||!bytes.length)throw new Error('Choose a Markdown file up to 64 KB.');
  let markdown:string;try{markdown=new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(markdown.includes('\0')||!markdown.trim())throw new Error();}catch{throw new Error('Workflow Markdown must contain UTF-8 text.');}
  const blocks=[...markdown.matchAll(/^```relaycrew\s*\r?\n([\s\S]*?)^```\s*$/gm)];
  if(blocks.length>1)throw new Error('Use one relaycrew configuration block per Markdown file.');
  let configuration=structuredClone(current);
  if(blocks.length){
    let value:any;try{value=JSON.parse(blocks[0][1]);}catch{throw new Error('The relaycrew block must contain valid JSON.');}
    if(!value||Array.isArray(value)||value.version!==1||Object.keys(value).some(key=>!['version','flow','roles','overrides','management','promptTemplates','delegation','auditors'].includes(key)))throw new Error('Unsupported workflow configuration. Use version 1 with flow, roles, overrides and management.');
    if(value.auditors!==undefined)configuration.auditors=value.auditors;
    if(value.delegation!==undefined)configuration.delegation=delegationPolicy(value.delegation);
    if(value.promptTemplates!==undefined)configuration.promptTemplates=validatePromptTemplates(value.promptTemplates);
    configuration.flow=validateFlow(value.flow??current.flow);
    if(value.roles!==undefined){if(!value.roles||Array.isArray(value.roles)||typeof value.roles!=='object'||Object.keys(value.roles).some(key=>!['builder','auditor','worker','lead'].includes(key)))throw new Error('Invalid workflow roles.');configuration.roles={...configuration.roles,...value.roles};}
    const ids=new Set(profiles.map(p=>p.id));if(Object.values(configuration.roles).some(id=>!ids.has(id)))throw new Error('Workflow references an unknown account. Configure its profile before importing.');
    if(value.overrides!==undefined){
      if(!value.overrides||Array.isArray(value.overrides)||typeof value.overrides!=='object'||Object.keys(value.overrides).some(key=>!['builder','auditor','worker','lead'].includes(key)))throw new Error('Invalid workflow model overrides.');
      const overrides:RoleOverrides={};for(const [key,raw]of Object.entries(value.overrides)){const item=raw as any;if(!item||Array.isArray(item)||typeof item!=='object'||Object.keys(item).some(key=>!['model','effort','modelPolicy'].includes(key)))throw new Error('Invalid workflow model overrides.');for(const field of ['model','effort'])if(item[field]!==undefined&&(typeof item[field]!=='string'||item[field].length>(field==='model'?200:40)||/[\r\n\0]/.test(item[field])))throw new Error('Invalid workflow model overrides.');if(item.modelPolicy!==undefined&&!['flagship','cli','custom'].includes(item.modelPolicy))throw new Error('Invalid model policy.');overrides[key as Role]={...(item.modelPolicy?{modelPolicy:item.modelPolicy}:{}),model:item.model?.trim()||undefined,effort:item.effort?.trim()||undefined};}configuration.overrides=overrides;
    }
    configuration.management=validateManagement(value.management??{...current.management,primaryProfileId:configuration.roles.lead,coordinatorIds:current.management.coordinatorIds.filter(id=>id!==configuration.roles.lead)},profiles);
    if(configuration.management.primaryProfileId!==configuration.roles.lead)throw new Error('Primary manager must match the Lead account.');
  }
  const checked=flowConfiguration(configuration,profiles);
  configuration={...configuration,...checked,overrides:Object.fromEntries(Object.keys(configuration.overrides).map(role=>[role,Object.fromEntries(Object.entries(checked.overrides[role as Role]??{}).filter(([,v])=>v!==undefined))]))};
  return {document:{name,markdown,sha256:createHash('sha256').update(bytes).digest('hex')},configuration,structured:!!blocks.length};
}
