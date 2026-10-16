import { randomUUID } from 'node:crypto';
import { nextCron, resolveTimezone, type Schedule, type Role } from './domain';
import { acceptanceFromText } from './task-insights';

export function scheduleFromForm(raw:unknown,roots:string[],roles:Record<Role,string>,previous?:Schedule,now=Date.now()):Schedule {
  const v=raw as Record<string,unknown>;
  if(!v||Array.isArray(v)||typeof v!=='object'||Object.keys(v).some(k=>!['id','title','kind','prompt','cwd','nextAt','cron','timezone','durationMinutes','acceptance'].includes(k)))throw new Error('Invalid schedule form.');
  for(const key of ['title','kind','prompt','cwd','nextAt','cron','timezone','acceptance'])if(v[key]!==undefined&&(typeof v[key]!=='string'||(v[key] as string).length>(key==='prompt'?16000:key==='acceptance'?6000:500)||(v[key] as string).includes('\0')))throw new Error('Invalid schedule form.');
  if(!['task','reminder'].includes(v.kind as string)||!roots.includes(v.cwd as string)||!(v.prompt as string)?.trim())throw new Error('Choose a workspace and enter the scheduled task.');
  if(v.id!==undefined&&v.id!==''&&v.id!==previous?.id)throw new Error('Schedule no longer exists.');
  const timezone=resolveTimezone((v.timezone as string)||''),cron=(v.cron as string)?.trim()||undefined;
  if(cron)nextCron(cron,timezone,new Date(now));
  const start=(v.nextAt as string)?.trim();
  if(start&&!/(?:Z|[+-]\d{2}:\d{2})$/i.test(start))throw new Error('Use an ISO start time with an explicit timezone offset.');
  if(start&&!Number.isFinite(Date.parse(start)))throw new Error('Choose a future start time.');
  const nextAt=start?new Date(start).toISOString():cron?nextCron(cron,timezone,new Date(now)):'';
  if(!nextAt||Date.parse(nextAt)<=now)throw new Error('Choose a future start time.');
  const durationMinutes=Number(v.durationMinutes||30);if(!Number.isInteger(durationMinutes)||durationMinutes<1||durationMinutes>1440)throw new Error('Planned duration must be 1–1440 minutes.');
  return {...previous,id:previous?.id??randomUUID(),title:(v.title as string)?.trim()||(v.prompt as string).trim().slice(0,80),kind:v.kind as Schedule['kind'],prompt:(v.prompt as string).trim(),cwd:v.cwd as string,roles:{...(previous?.roles??roles)},nextAt,cron,timezone,enabled:previous?.enabled??true,durationMinutes,acceptance:acceptanceFromText(v.acceptance)};
}
export function scheduleOccurrences(schedules:Schedule[],now=Date.now(),days=7):{schedule:Schedule;at:string;end:string}[]{
  const out:{schedule:Schedule;at:string;end:string}[]=[];
  for(const schedule of schedules.filter(s=>s.enabled)){
    let at=schedule.nextAt;
    for(let i=0;i<30&&Date.parse(at)<now+days*86400000;i++){
      out.push({schedule,at,end:new Date(Date.parse(at)+(schedule.durationMinutes??30)*60000).toISOString()});
      if(!schedule.cron)break;try{at=nextCron(schedule.cron,schedule.timezone,new Date(Math.max(now,Date.parse(at))));}catch{break;}
    }
  }
  return out.sort((a,b)=>a.at.localeCompare(b.at)).slice(0,120);
}
