import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import type {Job,Profile} from '../src/core/domain';
import {DemoWalkthrough} from '../src/core/demo-walkthrough';
import {adaptDemoView,demoBrowserPage} from '../src/ui/demo-browser';
import {mapWindowContent,renderAgentMapWindow} from '../src/ui/agent-map-window';
import {liveSessionContent,renderLiveSessionWindow} from '../src/ui/live-session-window';

async function main(){
 const profiles:Profile[]=[{id:'codex-main',label:'Codex',provider:'codex',executable:'codex'},{id:'claude-main',label:'Claude',provider:'claude',executable:'claude'},{id:'antigravity-main',label:'Antigravity',provider:'antigravity',executable:'agy'}];
 const args=process.argv.slice(2),argument=(name:string)=>args.includes(name)?args[args.indexOf(name)+1]:undefined,port=Number(argument('--port')??0);if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Invalid local port.');
 const recording=argument('--recording'),liveRecording=argument('--live-recording');let real:Job|undefined;
 if(recording&&liveRecording)throw new Error('Choose a finished or live recording, not both.');
 if(recording){const saved=JSON.parse(await readFile(resolve(recording),'utf8'));if(!saved.simulation&&typeof saved.id==='string'&&Array.isArray(saved.steps)&&['completed','needs_attention','failed','cancelled','interrupted'].includes(saved.status))real=saved;else throw new Error('Only a finished CLI recording may be viewed.');}
 let refreshing=false;const refreshRecording=async()=>{if(!liveRecording||refreshing)return;refreshing=true;try{const saved=JSON.parse(await readFile(resolve(liveRecording),'utf8'));if(saved.simulation||saved.readOnly!==true||typeof saved.id!=='string'||!Array.isArray(saved.steps)||!['queued','running','waiting_owner','waiting_quota','completed','needs_attention','failed','cancelled','interrupted'].includes(saved.status))throw new Error('Use a read-only CLI recording.');real=saved;}finally{refreshing=false;}};if(liveRecording)await refreshRecording();
 let walkthrough=new DemoWalkthrough(4,2,process.cwd(),profiles),speed=1400,last=0;walkthrough.play();
 const flowTitle=(job:Job)=>{const accounts=job.steps.length>(job.flow?.length??0)?job.steps.map(step=>step.profileId??job.roles[step.role]):(job.flow??[]).map(role=>job.roles[role]);return accounts.map(id=>profiles.find(p=>p.id===id)?.label??id).join(' → ');};
 const key=randomBytes(24).toString('hex'),jobs=()=>[walkthrough.job,...(real?[real]:[])],find=(id:unknown)=>id?jobs().find(j=>j.id===id):walkthrough.job;
 const report=(job:Job)=>'# RelayCrew · '+(job.simulation?'GIẢ LẬP — không xác minh code':'Kết quả CLI thật')+'\n\n'+job.prompt+'\n\n'+job.steps.map(s=>'## '+(s.reviewName??s.role)+' · '+s.status+'\n\n'+(s.response??'Chưa có kết quả')).join('\n\n')+'\n\n## Chủ việc trả lời\n\n'+(job.ownerReplies??[]).join('\n\n')+'\n\n## Nhánh con\n\n'+(job.nativeAgentRuns??[]).map(a=>'### '+a.name+' → '+(job.steps[a.stepIndex]?.reviewName??'Executor')+' · '+a.status+'\n\n'+a.assignment+'\n\n'+(a.response??'Chưa có kết quả')).join('\n\n');
 const server=createServer(async(req,res)=>{try{
  const url=new URL(req.url??'/','http://127.0.0.1');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  const json=(value:unknown,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
  if(req.method==='POST'&&url.pathname==='/action'){
   if(req.headers['x-demo-key']!==key){json({message:'Invalid demo request.'},403);return;}let body='';for await(const part of req){body+=part;if(body.length>18000){json({message:'Request too large.'},413);return;}}const m=JSON.parse(body);
   try{
    if(m.action==='new'){const next=new DemoWalkthrough(m.workers,m.children,process.cwd(),profiles);walkthrough.stop();walkthrough=next;walkthrough.play();last=Date.now();json({jobId:walkthrough.job.id});return;}
    if(['mapReady','mapState','liveReady'].includes(m.action)){json(null);return;}
    if(m.id!==walkthrough.job.id)throw new Error('Phiên CLI thật chỉ cho xem; chọn phiên giả lập để thao tác.');
    if(m.action==='playPause')walkthrough.paused?walkthrough.play():walkthrough.pause();
    else if(m.action==='step'){walkthrough.pause();walkthrough.tick(true);}
    else if(m.action==='stop'||m.action==='mapStop'||m.action==='liveCommand'&&m.command==='cancel')walkthrough.stop();
    else if(m.action==='speed'){if(![650,1400,2200].includes(m.milliseconds))throw new Error('Invalid speed.');speed=m.milliseconds;}
    else if(m.action==='reply'||m.action==='liveSendReply'){
     walkthrough.reply(m.text,m.action==='reply'?m.version:m.replyVersion,m.requestId);
     json(m.action==='liveSendReply'?{type:'liveReplyResult',id:m.id,requestId:m.requestId,ok:true,message:'Đã nhận trả lời; tiếp tục kịch bản giả lập.'}:{ok:true});return;
    }else throw new Error('Thao tác không thuộc kịch bản demo.');
    json({ok:true});
   }catch(error){const message=String(error);if(m.action==='liveSendReply')json({type:'liveReplyResult',id:m.id,requestId:m.requestId,ok:false,message});else json({message},400);}return;
  }
  if(req.method!=='GET'){res.writeHead(405).end();return;}
  if(url.pathname==='/state'){json({activeId:liveRecording&&real?real.id:walkthrough.job.id,jobs:jobs().map(job=>({id:job.id,title:job.simulation?walkthrough.workers+' Executor × '+walkthrough.children+' nhánh con':flowTitle(job),simulation:!!job.simulation,status:job.status,paused:job.simulation?walkthrough.paused:true,progress:job.simulation?walkthrough.progress:undefined,question:job.ownerQuestion,replyVersion:job.ownerReplies?.length??0,running:job.steps.filter(s=>s.status==='running').length+(job.nativeAgentRuns??[]).filter(a=>a.status==='running').length,scope:{cwd:job.cwd,sourceCwd:job.sourceCwd,branch:job.worktree?.branch,readOnly:job.readOnly,permission:job.permission},children:job.nativeAgentRuns?.length??0}))});return;}
  const job=find(url.searchParams.get('id'));if(!job){json({message:'Phiên này không còn trong phòng demo. Về bảng để chọn phiên hiện có.'},404);return;}
  if(url.pathname==='/report'){res.writeHead(200,{'Content-Type':'text/markdown; charset=utf-8','Content-Disposition':'attachment; filename="relaycrew-demo.md"'});res.end(report(job));return;}
  if(url.pathname==='/snapshot'){
   const copyText={last:job.steps.slice().reverse().find(s=>s.response)?.response??'',report:report(job)};
   json(url.searchParams.get('page')==='map'?{type:'mapSnapshot',selected:job.id,html:mapWindowContent([job],profiles,'vi',job.id),copyText}:{type:'liveSnapshot',html:liveSessionContent(job,profiles,'vi',[job]),copyText});return;
  }
  res.setHeader('Content-Type','text/html; charset=utf-8');
  if(url.pathname==='/map'){res.end(adaptDemoView(renderAgentMapWindow([job],profiles,'vi',{selected:job.id,follow:true}),'map',job.id,key,!!job.simulation));return;}
  if(url.pathname==='/live'){res.end(adaptDemoView(renderLiveSessionWindow(job,profiles,'vi',[job]),'live',job.id,key,!!job.simulation));return;}
  if(url.pathname==='/'){res.end(demoBrowserPage(key));return;}res.writeHead(404).end();
 }catch(error){res.writeHead(500).end('Local demo error');console.error(String(error));}});
 const timer=setInterval(()=>{if(Date.now()-last>=speed){walkthrough.tick();last=Date.now();}},150),recordingTimer=setInterval(()=>void refreshRecording().catch(()=>{/* keep the last complete snapshot while a local writer updates it */}),1000);timer.unref();recordingTimer.unref();server.on('close',()=>{clearInterval(timer);clearInterval(recordingTimer);});
 server.listen(port,'127.0.0.1',()=>console.log('DEMO http://127.0.0.1:'+(server.address() as {port:number}).port));
 process.on('SIGINT',()=>{walkthrough.stop();server.close();});
}
void main().catch(error=>{console.error(String(error));process.exitCode=1;});
