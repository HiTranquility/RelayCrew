import { answerOwner, type Job } from '../core/domain';
import { parseConsoleInput } from '../core/console-input';

export interface ConsoleRequest { requestId:unknown; text:unknown; cwd:unknown; sessionId?:unknown; replyVersion?:unknown }
interface Hooks {
  jobs:Job[]; roots:()=>string[]; create:(prompt:string,cwd:string)=>Job;
  paused:()=>boolean; pause:(paused:boolean)=>void; cancel:(id:string)=>void;
  save:()=>Promise<void>; changed:()=>void; start:()=>void;
}
export class ConsoleController {
  private submitting=false;
  constructor(private hooks:Hooks){}
  async submit(request:ConsoleRequest):Promise<{jobId?:string;message:string}> {
    if(this.submitting)throw new Error('Another submission is being saved. Retry shortly.');
    if(typeof request.requestId!=='string'||!/^console-[a-f0-9-]{36}$/i.test(request.requestId))throw new Error('Invalid console request.');
    const command=parseConsoleInput(request.text),h=this.hooks;
    if(command.kind==='task'){
      const previous=h.jobs.find(job=>job.consoleRequestId===request.requestId);
      if(previous){await h.save();h.changed();h.start();return {jobId:previous.id,message:'Task already queued.'};}
    }
    const selected=typeof request.sessionId==='string'?h.jobs.find(job=>job.id===request.sessionId):undefined;
    if(command.kind==='reply'&&selected?.consoleReplyIds?.includes(request.requestId)){await h.save();h.changed();h.start();return {jobId:selected.id,message:'Reply already saved.'};}
    this.submitting=true;
    try {
      let jobId:string|undefined,message:string;
      if(command.kind==='task'){
        if(typeof request.cwd!=='string'||!h.roots().includes(request.cwd))throw new Error('Select an open workspace folder.');
        const job=h.create(command.text,request.cwd);job.consoleRequestId=request.requestId;h.jobs.push(job);jobId=job.id;message='Task queued. Follow the session below.';
      }else if(command.kind==='reply'){
        if(!selected)throw new Error('Select a session waiting for your reply.');
        if(request.replyVersion!==(selected.ownerReplies?.length??0))throw new Error('The agent question changed. Review the latest question before replying.');
        answerOwner(selected,command.text);(selected.consoleReplyIds??=[]).push(request.requestId);jobId=selected.id;message='Reply saved. The task can continue when its queue and plan allow it.';
      }else if(command.kind==='pause'||command.kind==='resume'){
        h.pause(command.kind==='pause');message=command.kind==='pause'?'Queue paused.':'Queue resumed.';
      }else if(command.kind==='stop'){
        if(selected?.status==='cancelled'){await h.save();return {jobId:selected.id,message:'Task stopped. Existing edits are preserved.'};}
        if(!selected||!['running','queued','waiting_owner','waiting_quota'].includes(selected.status))throw new Error('Select an active session to stop.');
        h.cancel(selected.id);jobId=selected.id;message='Task stopped. Existing edits are preserved.';
      }else return {jobId:selected?.id,message:h.paused()?'Queue paused.':'Queue active.'};
      await h.save();h.changed();h.start();return {jobId,message};
    }finally{this.submitting=false;}
  }
}
