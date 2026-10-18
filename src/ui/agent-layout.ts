export type AgentOrientation='auto'|'horizontal'|'vertical';
export interface LayoutAgent {key:string;parent?:string;depends?:string[];height:number}
/** Lay out the actual ownership tree; children of an Executor keep that parent. */
export function layoutAgents(nodes:LayoutAgent[],wide=true,orientation:AgentOrientation='auto'):Record<string,{x:number;y:number}>{
 const result:Record<string,{x:number;y:number}>={},ids=new Set(nodes.map(n=>n.key)),visiting=new Set<string>(),height=(n:LayoutAgent)=>Math.max(145,n.height||145);
 if(orientation==='horizontal'||orientation==='vertical'){
  const ranks=new Map<string,number>(),byId=new Map(nodes.map(n=>[n.key,n]));
  const rank=(n:LayoutAgent):number=>{if(ranks.has(n.key))return ranks.get(n.key)!;if(visiting.has(n.key))return 0;visiting.add(n.key);const deps=[...new Set([...(n.depends??[]),...(n.parent?[n.parent]:[])])].filter(id=>id!==n.key&&byId.has(id));const value=deps.length?Math.max(...deps.map(id=>rank(byId.get(id)!)))+1:0;visiting.delete(n.key);ranks.set(n.key,value);return value;};
  nodes.forEach(rank);const levels=[...new Set(ranks.values())].sort((a,b)=>a-b);let next=24;
  for(const level of levels){const group=nodes.filter(n=>ranks.get(n.key)===level);let across=24;for(const n of group){result[n.key]=orientation==='horizontal'?{x:next,y:across}:{x:across,y:next};across+=orientation==='horizontal'?height(n)+40:280;}next+=orientation==='horizontal'?300:Math.max(...group.map(height))+80;}
  return result;
 }
 if(!wide){let y=24;const visit=(n:LayoutAgent,depth:number)=>{if(result[n.key])return;result[n.key]={x:24+Math.min(depth,4)*60,y};y+=height(n)+28;for(const child of nodes.filter(c=>c.parent===n.key))visit(child,depth+1);};for(const n of nodes.filter(n=>!n.parent||!ids.has(n.parent)))visit(n,0);for(const n of nodes)visit(n,0);return result;}
 const roots=nodes.filter(n=>!n.parent||!ids.has(n.parent)),baseY=24+Math.max(145,...roots.map(height))+60;
 const span=(n:LayoutAgent):number=>{if(visiting.has(n.key))return height(n)+28;visiting.add(n.key);const children=nodes.filter(c=>c.parent===n.key),value=Math.max(height(n)+28,children.reduce((sum,c)=>sum+span(c),0));visiting.delete(n.key);return value;};
 const visit=(n:LayoutAgent,x:number,y:number)=>{if(result[n.key])return;result[n.key]={x,y};let next=y;for(const child of nodes.filter(c=>c.parent===n.key)){visit(child,x+260,next);next+=span(child);}};
 let nextColumn=24;
 for(const root of roots){result[root.key]={x:nextColumn,y:24};let y=baseY;for(const child of nodes.filter(c=>c.parent===root.key)){visit(child,nextColumn,y);y+=span(child);}const subtree=Object.values(result);nextColumn=Math.max(nextColumn+260,...subtree.map(p=>p.x+260));}
 let orphanY=baseY;for(const node of nodes)if(!result[node.key]){visit(node,nextColumn,orphanY);orphanY+=span(node);}return result;
}

/** Attach arrowheads to card edges, including reversed manually dragged links. */
export function agentWire(from:{x:number;y:number;height:number},to:{x:number;y:number;height:number},orientation:AgentOrientation='auto'):string {
 const vertical=orientation==='vertical'||orientation==='auto'&&Math.abs(to.x-from.x)<100&&to.y>from.y+from.height;
 const forward=vertical?to.y>=from.y:to.x>=from.x,direction=forward?1:-1;
 const x=vertical?from.x+110:from.x+(forward?220:0),y=vertical?from.y+(forward?from.height:0):from.y+from.height/2;
 const tx=vertical?to.x+110:to.x+(forward?0:220),ty=vertical?to.y+(forward?0:to.height):to.y+to.height/2,curve=Math.max(28,Math.abs(vertical?ty-y:tx-x)*.5);
 return vertical?`M ${x} ${y} C ${x} ${y+curve*direction} ${tx} ${ty-curve*direction} ${tx} ${ty}`:`M ${x} ${y} C ${x+curve*direction} ${y} ${tx-curve*direction} ${ty} ${tx} ${ty}`;
}
