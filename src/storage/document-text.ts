import {strFromU8,unzipSync} from 'fflate';
// Select a single bounded document part. Other zip entries are never inflated;
// macros, relationships and external resources are not followed.
export function documentText(name:string,data:Buffer):{name:string;data:Buffer}|undefined{
 const docx=/\.docx$/i.test(name),odt=/\.odt$/i.test(name);if(!docx&&!odt)return;
 if(data.length>4*1024*1024)throw new Error('Document must be at most 4 MB.');
 const entry=docx?'word/document.xml':'content.xml';
 let xml:string;try{const parts=unzipSync(data,{filter:f=>f.name===entry&&f.originalSize<=1024*1024});if(!parts[entry])throw new Error();xml=strFromU8(parts[entry]);}catch{throw new Error('Invalid or oversized DOCX/ODT text.');}
 if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('Document entities are not supported.');
 const text=xml.replace(/<\/(?:w:p|text:p|text:h|table:table-row)>/g,'\n').replace(/<(?:w:tab|text:tab)[^>]*\/>/g,'\t').replace(/<[^>]+>/g,'').replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi,v=>{
  const known:Record<string,string>={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"};if(known[v])return known[v];const n=v.startsWith('&#x')?parseInt(v.slice(3,-1),16):Number(v.slice(2,-1));return Number.isInteger(n)&&n>0&&n<=0x10ffff?String.fromCodePoint(n):'';
 }).trim();
 const result=Buffer.from(text);if(!result.length||result.length>256*1024)throw new Error('Document has no extractable text or exceeds 256 KB. Export a smaller text excerpt.');
 return {name:name.slice(0,170)+'.txt',data:result};
}
