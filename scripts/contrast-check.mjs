/** Measure rendered text against composited ancestor backgrounds in a QA page. */
export async function textContrast(surface,selectors){
 return surface.locator(selectors).evaluateAll(elements=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');
  const rgba=css=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=css;ctx.fillRect(0,0,1,1);const p=[...ctx.getImageData(0,0,1,1).data];p[3]/=255;return p;};
  const over=(f,b)=>{const a=f[3]+b[3]*(1-f[3]);return a?[...f.slice(0,3).map((v,i)=>(v*f[3]+b[i]*b[3]*(1-f[3]))/a),a]:[0,0,0,0];};
  const luminance=rgb=>rgb.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
  return elements.filter(el=>el.getClientRects().length&&!el.matches(':disabled')&&!el.closest('[hidden]')).map(el=>{
   let bg=[0,0,0,0];for(let n=el;n;n=n.parentElement){bg=over(bg,rgba(getComputedStyle(n).backgroundColor));if(bg[3]>.999)break;}bg=over(bg,[255,255,255,1]);
   const fg=over(rgba(getComputedStyle(el).color),bg),a=luminance(fg),b=luminance(bg);
   return {element:el.tagName+'.'+el.className,text:el.textContent?.trim().slice(0,60),ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
  });
 });
}
