export interface CanvasPreferences {expanded?:string;mode:'graph'|'list'|'table'|'dependency';filters:Record<string,{query:string;status:string}>;positions:Record<string,Record<string,{x:number;y:number}>>;views:Record<string,{x:number;y:number;scale:number}>;tabs:Record<string,string>}
export function canvasPreferences(raw:unknown):CanvasPreferences{
 const v=raw&&typeof raw==='object'?raw as any:{},result:CanvasPreferences={...(typeof v.expanded==='string'&&v.expanded.length<=200?{expanded:v.expanded}:{}),mode:['graph','list','table','dependency'].includes(v.mode)?v.mode:'graph',positions:{},views:{},tabs:{},filters:{}};
 const entries=(value:unknown,limit:number)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.entries(value).filter(([k])=>k.length<=200&&!['__proto__','constructor','prototype'].includes(k)).slice(-limit):[];
 const number=(value:unknown,min:number,max:number,fallback:number)=>typeof value==='number'&&Number.isFinite(value)?Math.min(max,Math.max(min,value)):fallback;
 for(const[id,points]of entries(v.positions,50)){result.positions[id]={};for(const[key,p]of entries(points,100)){if(!p||typeof p!=='object')continue;const point=p as any;result.positions[id][key]={x:number(point.x,0,8000,24),y:number(point.y,0,8000,24)};}}
 for(const[id,value]of entries(v.views,50)){if(!value||typeof value!=='object')continue;const view=value as any;result.views[id]={x:number(view.x,-10000,10000,16),y:number(view.y,-10000,10000,16),scale:number(view.scale,.25,3,1)};}
 for(const[id,value]of entries(v.tabs,50))if(['result','request','events'].includes(value as string))result.tabs[id]=value as string;
 for(const[id,value]of entries(v.filters,50)){if(!value||typeof value!=='object')continue;const f=value as any;result.filters[id]={query:typeof f.query==='string'?f.query.slice(0,160):'',status:['all','running','attention','done','pending'].includes(f.status)?f.status:'all'};}
 return result;
}
