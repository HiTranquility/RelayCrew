import * as vscode from 'vscode';
import type {Job,Profile} from '../core/domain';
import {translator,type Language} from '../core/i18n';
import {mapWindowContent,mapWindowState,renderAgentMapWindow,type MapWindowState} from '../ui/agent-map-window';

interface MapServices {reviewAction?:(message:any)=>Promise<void>;jobs:()=>Job[];profiles:()=>Profile[];language:()=>Language;selected:()=>string;openConsole:(id:string,reply:boolean)=>Promise<void>;stop:(id:string)=>Promise<void>;editTeam:(role:string)=>Promise<void>;error:(error:unknown)=>void}
export class AgentMapPanel implements vscode.Disposable {
 private panel?:vscode.WebviewPanel;private ready=false;private renderedLanguage?:Language;private state:MapWindowState;
 constructor(private context:vscode.ExtensionContext,private services:MapServices){this.state=mapWindowState(context.workspaceState.get('agentMapWindowState'));}
 async open(id?:string,newWindow=false):Promise<void>{
  if(id&&this.services.jobs().some(j=>j.id===id))this.state.selected=id;else this.state.selected=this.services.selected()||this.state.selected;
  if(this.panel)this.panel.reveal();else{
   const panel=this.panel=vscode.window.createWebviewPanel('aiTeam.agentMap','RelayCrew · '+translator(this.services.language())('Agent map'),vscode.ViewColumn.Beside,{enableScripts:true,retainContextWhenHidden:true});
   panel.onDidDispose(()=>{if(this.panel===panel){this.panel=undefined;this.ready=false;}},undefined,this.context.subscriptions);
   panel.webview.onDidReceiveMessage(message=>{void this.handle(message).catch(this.services.error);},undefined,this.context.subscriptions);
   this.renderedLanguage=this.services.language();panel.webview.html=renderAgentMapWindow(this.services.jobs(),this.services.profiles(),this.renderedLanguage,this.state);
  }
  this.refresh();if(newWindow)await this.moveToWindow();
 }
 refresh():void{if(!this.panel)return;const language=this.services.language();if(language!==this.renderedLanguage){this.ready=false;this.renderedLanguage=language;this.panel.title='RelayCrew · '+translator(language)('Agent map');this.panel.webview.html=renderAgentMapWindow(this.services.jobs(),this.services.profiles(),language,this.state);return;}if(!this.ready)return;const selected=this.state.follow?this.services.selected()||this.state.selected:this.state.selected;void this.panel.webview.postMessage({type:'mapSnapshot',selected,html:mapWindowContent(this.services.jobs(),this.services.profiles(),language,selected)});}
 private async moveToWindow():Promise<void>{if(!this.panel)return;this.panel.reveal();const command='workbench.action.moveEditorToNewWindow';if((await vscode.commands.getCommands(true)).includes(command))await vscode.commands.executeCommand(command);else await this.panel.webview.postMessage({type:'mapWindowMessage',message:translator(this.services.language())('Drag this VS Code tab to another editor group or window.')});}
 private async handle(message:any):Promise<void>{
  if(message?.action==='mapEditTeam'&&typeof message.role==='string'&&(['builder','auditor','worker','lead'].includes(message.role)||message.role.startsWith('coordinator:')&&this.services.profiles().some(p=>p.id===message.role.slice(12))||message.role.startsWith('audit-review:')&&this.services.profiles().some(p=>p.id===message.role.slice(13)))){await this.services.editTeam(message.role);return;}
  if(message?.action==='mapReady'){this.ready=true;this.refresh();return;}
  if(message?.action==='mapNewWindow'){await this.moveToWindow();return;}
  if(message?.action==='mapState'){if(JSON.stringify(message.state??{}).length>384000)return;const next=mapWindowState(message.state);if(next.selected&&!this.services.jobs().some(j=>j.id===next.selected))return;this.state=next;await this.context.workspaceState.update('agentMapWindowState',next);this.refresh();return;}
  if(message?.action==='mapReturn'){await this.services.openConsole(typeof message.id==='string'&&this.services.jobs().some(j=>j.id===message.id)?message.id:'',false);this.dispose();return;}
  if(typeof message?.id!=='string'||!this.services.jobs().some(j=>j.id===message.id))return;
  if(['chooseDecisionPolicy','resolveReviewDecision'].includes(message.action)){await this.services.reviewAction?.(message);return;}
  if(['mapOpenConsole','mapReply'].includes(message.action))await this.services.openConsole(message.id,message.action==='mapReply');
  if(message.action==='mapStop')await this.services.stop(message.id);
 }
 dispose():void{this.panel?.dispose();this.panel=undefined;this.ready=false;}
}
