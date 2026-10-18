export interface LayoutAgent {key:string;parent?:string;height:number}
/** Lay out the actual ownership tree; children of an Executor keep that parent. */
export function layoutAgents(nodes:LayoutAgent[],wide=true):Record<string,{x:number;y:number}>{
 const result:Record<string,{x:number;y:number}>={},ids=new Set(nodes.map(n=>n.key)),visiting=new Set<string>(),height=(n:LayoutAgent)=>Math.max(145,n.height||145);
 if(!wide){let y=24;const visit=(n:LayoutAgent,depth:number)=>{if(result[n.key])return;result[n.key]={x:24+Math.min(depth,4)*60,y};y+=height(n)+28;for(const child of nodes.filter(c=>c.parent===n.key))visit(child,depth+1);};for(const n of nodes.filter(n=>!n.parent||!ids.has(n.parent)))visit(n,0);for(const n of nodes)visit(n,0);return result;}
 const roots=nodes.filter(n=>!n.parent||!ids.has(n.parent)),baseY=24+Math.max(145,...roots.map(height))+60;
 const span=(n:LayoutAgent):number=>{if(visiting.has(n.key))return height(n)+28;visiting.add(n.key);const children=nodes.filter(c=>c.parent===n.key),value=Math.max(height(n)+28,children.reduce((sum,c)=>sum+span(c),0));visiting.delete(n.key);return value;};
 const visit=(n:LayoutAgent,x:number,y:number)=>{if(result[n.key])return;result[n.key]={x,y};let next=y;for(const child of nodes.filter(c=>c.parent===n.key)){visit(child,x+260,next);next+=span(child);}};
 let nextColumn=24;
 for(const root of roots){result[root.key]={x:nextColumn,y:24};let y=baseY;for(const child of nodes.filter(c=>c.parent===root.key)){visit(child,nextColumn,y);y+=span(child);}const subtree=Object.values(result);nextColumn=Math.max(nextColumn+260,...subtree.map(p=>p.x+260));}
 let orphanY=baseY;for(const node of nodes)if(!result[node.key]){visit(node,nextColumn,orphanY);orphanY+=span(node);}return result;
}
