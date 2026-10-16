import { answerOwner, type Job } from '../core/domain';
import { parseConsoleInput } from '../core/console-input';
import type { Attachment } from '../storage/attachments';
import { acceptanceFromText } from '../core/task-insights';

export interface ConsoleRequest { requestId:unknown; text:unknown; cwd:unknown; sessionId?:unknown; replyVersion?:unknown; attachments?:unknown; mode?:unknown;profileId?:unknown;acceptance?:unknown }
interface Hooks {
  jobs:Job[]; roots:()=>string[]; create:(prompt:string,cwd:string)=>Job;
  createChat?:(prompt:string,cwd:string,profileId:string,parent?:Job)=>Job;
  prepare?:(mode:'task'|'chat',profileId?:string)=>Promise<void>;
  paused:()=>boolean; pause:(paused:boolean)=>void; cancel:(id:string)=>void;
  save:()=>Promise<void>; changed:()=>void; start:()=>void;
  attachments?:(ids:unknown)=>Promise<Attachment[]>;
}
export class ConsoleController {
  private submitting=false;
  constructor(private hooks:Hooks){}
  async submit(request:ConsoleRequest):Promise<{jobId?:string;message:string}> {
    if(this.submitting)throw new Error('Another submission is being saved. Retry shortly.');
    if(typeof request.requestId!=='string'||!/^console-[a-f0-9-]{36}$/i.test(request.requestId))throw new Error('Invalid console request.');
    const parsed=parseConsoleInput(request.text),command=parsed.kind==='task'&&request.mode==='chat'&&typeof request.text==='string'&&!request.text.trim().startsWith('/')?{...parsed,kind:'chat' as const}:parsed,h=this.hooks;
    if(command.kind==='task'||command.kind==='chat'){
      const previous=h.jobs.find(job=>job.consoleRequestId===request.requestId);
      if(previous){await h.save();h.changed();h.start();return {jobId:previous.id,message:'Task already queued.'};}
    }
    const selected=typeof request.sessionId==='string'?h.jobs.find(job=>job.id===request.sessionId):undefined;
    if(command.kind==='reply'&&selected?.consoleReplyIds?.includes(request.requestId)){await h.save();h.changed();h.start();return {jobId:selected.id,message:'Reply already saved.'};}
    this.submitting=true;
    try {
      const attachments=h.attachments?await h.attachments(request.attachments):[];
      if(attachments.length&&!['task','chat','reply'].includes(command.kind))throw new Error('Attachments can only be sent with a task or reply.');
      let jobId:string|undefined,message:string;
      if(command.kind==='task'||command.kind==='chat'){
        if(typeof request.cwd!=='string'||!h.roots().includes(request.cwd))throw new Error('Select an open workspace folder.');
        if(command.kind==='chat'&&(typeof request.profileId!=='string'||!h.createChat))throw new Error('Choose an account for chat.');
        await h.prepare?.(command.kind,typeof request.profileId==='string'?request.profileId:undefined);
        const acceptance=command.kind==='task'?acceptanceFromText(request.acceptance):[];
        const job=command.kind==='chat'?h.createChat!(command.text,request.cwd,request.profileId as string,selected?.kind==='chat'?selected:undefined):h.create(command.text,request.cwd);if(acceptance.length)job.acceptance=acceptance;job.consoleRequestId=request.requestId;if(attachments.length)job.attachments=attachments;h.jobs.push(job);jobId=job.id;message=command.kind==='chat'?'Chat queued. One account replies without an audit.':'Task queued. Follow the session below.';
      }else if(command.kind==='reply'){
        if(!selected)throw new Error('Select a session waiting for your reply.');
        if(request.replyVersion!==(selected.ownerReplies?.length??0))throw new Error('The agent question changed. Review the latest question before replying.');
        const combined=[...(selected.attachments??[]),...attachments.filter(a=>!selected.attachments?.some(b=>b.id===a.id))];
        if(combined.length>8||combined.reduce((sum,a)=>sum+a.bytes,0)>16*1024*1024)throw new Error('Choose up to 8 attachments (16 MB total).');
        answerOwner(selected,command.text);if(combined.length)selected.attachments=combined;(selected.consoleReplyIds??=[]).push(request.requestId);jobId=selected.id;message='Reply saved. The task can continue when its queue and plan allow it.';
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
