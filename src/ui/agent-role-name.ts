import type {AgentNode} from './agent-map';
import type {Job} from '../core/domain';
import {roleLabel,translator,type Language} from '../core/i18n';
export function agentRoleName(job:Job,node:AgentNode,language:Language):string{
 const t=translator(language);if(node.step?.reviewName)return node.step.reviewName;
 if(node.coordinator)return job.management?.names?.[node.profileId]??job.promptTemplates?.roles.coordinator.name??t('Manager {0}',(job.management?.coordinatorIds.indexOf(node.profileId)??0)+2);
 if(node.role==='lead')return job.management?.names?.[node.profileId]??job.promptTemplates?.roles.lead.name??t('Manager {0}',1);
 return job.promptTemplates?.roles[node.role]?.name??(node.role==='auditor'?t('Audit {0}',1):roleLabel(node.role,language));
}
