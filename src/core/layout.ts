export interface WorkbenchLayout {sidebarWidth:number;composerPercent:number;textPercent:number;density:'comfortable'|'compact';contentWidth:'fluid'|'reading'}
export function normalizeLayout(raw:unknown):WorkbenchLayout {
  const v=raw&&typeof raw==='object'?raw as Partial<WorkbenchLayout>:{};
  return {sidebarWidth:typeof v.sidebarWidth==='number'&&Number.isFinite(v.sidebarWidth)?Math.max(160,Math.min(420,Math.round(v.sidebarWidth))):235,composerPercent:typeof v.composerPercent==='number'&&Number.isFinite(v.composerPercent)?Math.max(20,Math.min(65,Math.round(v.composerPercent))):40,textPercent:typeof v.textPercent==='number'&&Number.isFinite(v.textPercent)?Math.max(90,Math.min(150,Math.round(v.textPercent))):100,density:v.density==='compact'?'compact':'comfortable',contentWidth:v.contentWidth==='reading'?'reading':'fluid'};
}
export function paneBounds(width:number,height:number){
  const narrow=width<720,maxSidebar=Math.max(160,Math.min(420,Math.floor(width*.42),width-360));
  return {narrow,minSidebar:160,maxSidebar,minComposer:Math.min(180,height*.5),maxComposer:Math.max(180,height-167)};
}
