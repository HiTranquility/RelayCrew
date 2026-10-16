export type ConsoleInput={kind:'task'|'chat'|'reply';text:string}|{kind:'pause'|'resume'|'stop'|'status'};
export function parseConsoleInput(value:unknown):ConsoleInput {
  if(typeof value!=='string'||!value.trim()||value.length>16000)throw new Error('Enter a request of 1–16000 characters.');
  const text=value.trim();
  if(!text.startsWith('/'))return {kind:/^(?:hello|hi|hey|xin chào|xin chao|chào|chao)[!.?\s]*$/i.test(text)?'chat':'task',text};
  const match=/^\/(\S+)(?:\s+([\s\S]*))?$/.exec(text)!;
  const command=match[1].toLowerCase(),body=match[2]?.trim()??'';
  if(command==='new'||command==='task'||command==='ask'||command==='reply'){
    if(!body)throw new Error('Add text after /new or /reply.');
    return {kind:command==='reply'?'reply':command==='ask'?'chat':'task',text:body};
  }
  if(['pause','resume','stop','status'].includes(command)&&!body)return {kind:command as 'pause'|'resume'|'stop'|'status'};
  throw new Error('Supported commands: /new, /reply, /pause, /resume, /stop, /status.');
}
