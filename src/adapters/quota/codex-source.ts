import type {Profile,Quota} from '../../core/domain';
import {identityMatches,readAccountData,type AccountData} from '../cli/account-data';
import {findLocalCli} from '../cli/local-cli';
import type {QuotaSource} from './quota-service';

/** A declared email cannot borrow the quota of a different authenticated identity. */
export class CodexQuotaSource implements QuotaSource {
 readonly id='codex-native';
 constructor(private secrets:(p:Profile)=>Promise<Record<string,string>>,private observed?:(p:Profile,data:AccountData,executable:string)=>void,private load=readAccountData){}
 supports(p:Profile):boolean{return p.provider==='codex'&&p.transport!=='http'&&!p.quotaFile;}
 async read(profile:Profile):Promise<Quota|undefined>{
  const executable=await findLocalCli(profile.provider,profile.executable);if(!executable)throw new Error('Codex CLI unavailable.');
  const data=await this.load({...profile,executable},await this.secrets(profile));this.observed?.(profile,data,executable);
  return identityMatches(profile,data)?data.quota:undefined;
 }
}
