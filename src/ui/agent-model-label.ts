import type {AgentNode} from './agent-map';
import type {Job,Profile} from '../core/domain';
import {profileModelLabel,translator,type Language} from '../core/i18n';

export function agentModelLabel(job:Job,node:AgentNode,profiles:Profile[],language:Language):string{
 const t=translator(language);if(node.native)return node.step?.model??t('Model not reported');const profile=profiles.find(p=>p.id===node.profileId),override=node.coordinator||node.step?.reviewProfileId?undefined:job.overrides?.[node.role];
 if(!job.simulation&&node.step?.model)return node.step.model;
 if(!job.simulation&&node.step?.startedAt)return t((node.step.transport??profile?.transport??'cli')==='cli'?'CLI default · exact model not reported':'Model not reported');
 const planned=override?.modelPolicy==='custom'||!override?.modelPolicy&&override?.model?override.model:override?.modelPolicy==='flagship'?t('Automatic recommended'):override?.modelPolicy==='cli'?t('CLI default'):profile?.model?profileModelLabel(profile,language):t('Model selected when the step starts');
 return job.simulation?t('Planned · {0}',planned):planned??t('Model not reported');
}
