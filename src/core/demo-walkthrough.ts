import {answerOwner,type Job,type Profile,type Step} from './domain';
import {newJob} from './engine';
import {jobPromptTemplates} from './delegation';

/** An explicit, token-free walkthrough. Never pass these jobs to Engine. */
export class DemoWalkthrough {
 readonly job:Job;
 paused=true;
 private cursor=0;
 private actions:(()=>void)[]=[];
 private receipts=new Set<string>();
 constructor(readonly workers:number,readonly children:number,cwd:string,profiles:Profile[]){
  if(!Number.isInteger(workers)||workers<1||workers>6||!Number.isInteger(children)||children<1||children>3||workers*children>12)throw new Error('Use 1–6 executors, 1–3 children each, at most 12 children.');
  if(profiles.length<3)throw new Error('Three display profiles are required.');
  const roles={builder:profiles[0].id,auditor:profiles[1].id,worker:profiles[2].id,lead:profiles[0].id};
  this.job=newJob('[GIẢ LẬP] Theo dõi phân nhánh Executor, trao đổi và câu hỏi cho chủ việc',cwd,roles);
  const job=this.job;job.simulation=true;job.readOnly=true;job.permission='read-only';job.delegation={workflow:'plan-execute',mode:'fixed',minWorkers:workers,maxWorkers:workers};job.promptTemplates=jobPromptTemplates(undefined,job.delegation);job.reviewPolicy={maxRounds:3};
  job.steps=[{role:'builder',reviewName:'Dispatcher',title:'Chốt phạm vi',prompt:'GIẢ LẬP: chuẩn bị phạm vi, không gọi CLI.',status:'pending'},{role:'auditor',reviewName:'Planner',title:'Chia việc có giới hạn',prompt:`GIẢ LẬP: giao ${workers} việc độc lập; mỗi Executor minh họa ${children} nhánh con.`,status:'pending'},...Array.from({length:workers},(_,i)=>({role:'worker' as const,reviewName:'Executor '+(i+1),parentStepIndex:1,title:['Luồng dữ liệu','Giao diện và hotkeys','Hạn mức và recover','Conventions và tests','Tài liệu và i18n','Lịch và backlog'][i],prompt:'GIẢ LẬP: rà phạm vi được giao, phân nhánh có trần và tổng hợp kết quả.',status:'pending' as const})),{role:'lead',reviewName:'Manager',title:'Tổng hợp báo cáo',prompt:'GIẢ LẬP: nhận toàn bộ kết quả và giới hạn; không đưa nghiệm thu thật.',status:'pending'}];
  for(const step of job.steps){step.profileId=job.roles[step.role];step.model='GIẢ LẬP · không dùng model';}
  const start=(index:number)=>()=>{const step=job.steps[index];job.status='running';step.status='running';step.startedAt=new Date().toISOString();this.event('orchestrator',this.address(step),'assignment',step.prompt);};
  const finish=(index:number,text:string)=>()=>{const step=job.steps[index];step.status='done';step.finishedAt=new Date().toISOString();step.response='GIẢ LẬP: '+text;this.event(this.address(step),'orchestrator','response',step.response);};
  this.actions.push(start(0),finish(0,'Phạm vi và tiêu chí đã chuyển cho Planner.'),start(1),finish(1,`Đã giao ${workers} việc. Worker chạy tuần tự; các nhánh con trong mỗi worker được minh họa song song.`));
  for(let worker=0;worker<workers;worker++){
   const index=worker+2,step=job.steps[index];this.actions.push(start(index));
   for(let child=0;child<children;child++)this.actions.push(()=>{
    const id='demo-child-'+worker+'-'+child,at=new Date().toISOString(),name='E'+(worker+1)+' · Nhánh '+(child+1);
    (job.nativeAgentRuns??=[]).push({id,stepIndex:index,profileId:roles.worker,parentId:'demo-executor-'+worker,name,status:'running',assignment:`GIẢ LẬP: ${step.title} — ${['đọc hợp đồng và caller','kiểm tra UX và trạng thái lỗi','đối chiếu tiêu chí và bằng chứng'][child]}. Chỉ trong phạm vi; không sửa code.`,model:'GIẢ LẬP · không gọi CLI',startedAt:at,updatedAt:at});
    this.event(this.address(step),'native:'+id,'handoff',step.reviewName+' giao '+name+': '+job.nativeAgentRuns!.at(-1)!.assignment);
   });
   if(worker===0)this.actions.push(()=>{
    job.status='waiting_owner';step.status='waiting_owner';job.ownerQuestion='Executor 1 / Nhánh 1 cần bạn chọn phạm vi: chỉ rà lỗi logic, hay rà cả UI/UX? Cả hai vẫn chỉ là giả lập, không sửa code. Chọn một hướng hoặc viết câu trả lời bên dưới.';
    step.response=JSON.stringify({needs_owner:true,question:job.ownerQuestion});for(const child of job.nativeAgentRuns??[])if(child.stepIndex===index)child.status='waiting_owner';
    this.event('native:demo-child-0-0','owner','question',job.ownerQuestion);
   });
   for(let child=0;child<children;child++)this.actions.push(()=>{const agent=job.nativeAgentRuns!.find(a=>a.id==='demo-child-'+worker+'-'+child)!;agent.status='done';agent.updatedAt=new Date().toISOString();agent.response='GIẢ LẬP: đã hoàn tất nhánh '+(child+1)+' trong phạm vi '+step.title+'. Không đọc code hay xác minh test thật.';this.event('native:'+agent.id,this.address(step),'response',agent.response);});
   this.actions.push(finish(index,'Đã nhận đủ '+children+' báo cáo con, lưu giới hạn và chuyển cho Manager.'));
  }
  const last=job.steps.length-1;this.actions.push(start(last),finish(last,'Đã tổng hợp mọi nhánh. Kịch bản kết thúc; không có model call, thay đổi file hay nghiệm thu thật.'),()=>{job.status='completed';});
 }
 private address(step:Step){return step.role+':'+step.profileId;}
 private event(from:string,to:string,kind:string,text:string){(this.job.timeline??=[]).push({at:new Date().toISOString(),from,to,kind,text});}
 get progress(){return {done:this.cursor,total:this.actions.length};}
 play(){if(['completed','cancelled'].includes(this.job.status))return;this.paused=false;}
 pause(){this.paused=true;}
 tick(manual=false):boolean{
  if(!this.job.simulation)throw new Error('A walkthrough cannot execute a real job.');
  if(this.paused&&!manual||['waiting_owner','completed','cancelled'].includes(this.job.status)||this.cursor>=this.actions.length)return false;
  this.actions[this.cursor++]();return true;
 }
 reply(text:string,version:number,receipt:string){
  if(!receipt||receipt.length>100)throw new Error('Invalid reply receipt.');
  if(this.receipts.has(receipt))return;
  if(version!==(this.job.ownerReplies?.length??0))throw new Error('The question changed. Review the current question first.');
  answerOwner(this.job,text);this.receipts.add(receipt);
  const step=this.job.steps.find(s=>s.status==='pending'&&s.startedAt);if(step)step.status='running';this.job.status='running';
  for(const child of this.job.nativeAgentRuns??[])if(child.status==='waiting_owner')child.status='running';
 }
 stop(){if(['completed','cancelled'].includes(this.job.status))return;this.paused=true;this.job.status='cancelled';for(const step of this.job.steps)if(['running','waiting_owner'].includes(step.status))step.status='failed';for(const child of this.job.nativeAgentRuns??[])if(['running','waiting_owner'].includes(child.status))child.status='interrupted';this.event('owner','orchestrator','task','Đã dừng giả lập; không chạy tiếp.');}
}
