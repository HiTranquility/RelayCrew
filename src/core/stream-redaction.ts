export function secretEvents(secrets:string[],emit:(event:{kind:string;text:string})=>void){
 const values=secrets.filter(Boolean);let pending='',kind='assistant';
 const flush=(final=false)=>{
  let text=values.reduce((s,v)=>s.split(v).join('[REDACTED]'),pending),keep=0;
  for(const secret of values)for(let n=Math.min(text.length,secret.length-1);n>keep;n--)if(text.endsWith(secret.slice(0,n))){keep=n;break;}
  if(final&&keep){text=text.slice(0,-keep)+'[REDACTED]';keep=0;}
  const end=text.length-keep;if(end)emit({kind,text:text.slice(0,end)});pending=text.slice(end);
 };
 return {write(event:{kind:string;text:string}){if(event.kind!==kind){flush(true);kind=event.kind;}pending+=event.text;flush();},finish(){flush(true);}};
}
