import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve, isAbsolute } from 'node:path';
const modulePath=process.env.RELAYCREW_PLAYWRIGHT_MODULE||'playwright';
const {chromium}=await import(isAbsolute(modulePath)?pathToFileURL(modulePath).href:modulePath);
const browser=await chromium.launch({headless:true,...(process.env.RELAYCREW_BROWSER_EXECUTABLE?{executablePath:process.env.RELAYCREW_BROWSER_EXECUTABLE}:{})});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(resolve('docs/previews/board.html')).href);
 await page.locator('[data-tab=console]').click();
 await page.locator('[data-console-view=console]').click();
 const side=page.locator('#sidebar-divider');await side.focus();await side.press('End');
 assert.equal(await side.getAttribute('aria-valuenow'),'420');
 const box=await side.boundingBox();await page.mouse.move(box.x+3,box.y+50);await page.mouse.down();await page.mouse.move(300,box.y+50);await page.mouse.up();
 assert.ok(Number(await side.getAttribute('aria-valuenow'))<420);
 await page.locator('#console-input').fill('Keep my draft');
 await page.keyboard.press('Alt+l');await page.locator('#layout-text').selectOption('125');await page.keyboard.press('Escape');
 assert.equal(await page.locator('#layout-settings').isVisible(),false);
 assert.equal(await page.locator('#console-input').inputValue(),'Keep my draft');
 await page.reload();assert.equal(await page.locator('#console-input').inputValue(),'Keep my draft');
 assert.equal(await page.locator('html').evaluate(e=>e.style.getPropertyValue('--rc-text-scale')),'1.25');
 await page.keyboard.press('Alt+l');await page.locator('[data-layout-field=composerPosition]').selectOption('right');await page.keyboard.press('Escape');await page.waitForTimeout(100);assert.equal(await page.locator('.console-workspace').evaluate(e=>e.classList.contains('composer-right')),true);assert.equal(await page.locator('#composer-divider').getAttribute('aria-orientation'),'vertical');
 await page.locator('#voice-toggle').click();assert.match(await page.locator('#voice-status').innerText(),/system dictation/);
 await page.evaluate(()=>{window.SpeechRecognition=class{start(){window.__voiceEngine=this;setTimeout(()=>this.onresult({resultIndex:0,results:[Object.assign([{transcript:'voice fixture'}],{isFinal:true})]}),0)}abort(){this.onend?.()}};});await page.locator('#voice-settings summary').click();await page.locator('#voice-opt-in').check();await page.locator('#voice-toggle').click();await page.waitForTimeout(50);assert.match(await page.locator('#console-input').inputValue(),/voice fixture/);assert.equal(await page.locator('#voice-toggle svg').count(),1);assert.equal(await page.locator('#voice-toggle').getAttribute('aria-label'),'Stop dictation');await page.keyboard.press('Escape');assert.equal(await page.locator('#voice-toggle').getAttribute('aria-pressed'),'false');const voiceDraft=await page.locator('#console-input').inputValue();await page.evaluate(()=>window.__voiceEngine.onresult({resultIndex:0,results:[Object.assign([{transcript:'late transcript'}],{isFinal:true})]}));assert.equal(await page.locator('#console-input').inputValue(),voiceDraft);assert.equal(await page.locator('#voice-toggle svg').count(),1);
 // Reproduce a live update while reading both the session and nested CLI log.
 await page.locator('[data-session]').first().click();await page.locator('#console-follow').uncheck();
 await page.evaluate(()=>{const panel=document.querySelector('[data-session-panel]:not([hidden])');for(const selector of ['.team-conversation','.console-output']){const el=panel.querySelector(selector);if(selector==='.console-output')el.closest('details').open=true;el.style.height='180px';el.style.maxHeight='180px';for(let i=0;i<40;i++){const p=document.createElement('p');p.textContent='Recorded public output '+i;p.style.height='36px';el.append(p);}el.scrollTop=140;}document.querySelector('[data-session-panel]:not([hidden])').scrollTop=210;document.getElementById('console-form').scrollTop=80;});
 await page.waitForTimeout(60);
 for(const type of ['consoleSnapshot','boardSnapshot','consoleSnapshot']){
  const before=await page.evaluate(()=>({outer:document.querySelector('[data-session-panel]:not([hidden])').scrollTop,conversation:document.querySelector('[data-session-panel]:not([hidden]) .team-conversation').scrollTop,log:document.querySelector('[data-session-panel]:not([hidden]) .console-output').scrollTop,composer:document.getElementById('console-form').scrollTop,window:scrollY,draft:document.getElementById('console-input').value}));
  assert.ok(before.outer>0&&before.conversation>0&&before.log>0,'fixture must be scrolled away from the top: '+JSON.stringify(before));
  await page.evaluate(type=>{const parsed=new DOMParser().parseFromString(document.documentElement.outerHTML,'text/html');const output=parsed.querySelector('[data-session-panel]:not([hidden]) .team-conversation');const p=parsed.createElement('p');p.textContent='New CLI event';output.append(p);window.dispatchEvent(new MessageEvent('message',{data:{type,html:parsed.documentElement.outerHTML,pageRequest:0,page:'console'}}));},type);
  await page.waitForTimeout(60);
  const after=await page.evaluate(()=>({outer:document.querySelector('[data-session-panel]:not([hidden])').scrollTop,conversation:document.querySelector('[data-session-panel]:not([hidden]) .team-conversation').scrollTop,log:document.querySelector('[data-session-panel]:not([hidden]) .console-output').scrollTop,composer:document.getElementById('console-form').scrollTop,window:scrollY,draft:document.getElementById('console-input').value}));
  assert.deepEqual(after,before,type+' must preserve the reading position and draft');
 }
 await page.locator('#console-follow').check();assert.equal(await page.locator('#console-follow').isChecked(),true);
 await page.locator('[data-session-panel]:visible .team-conversation').dispatchEvent('wheel',{deltaY:-100});assert.equal(await page.locator('#console-follow').isChecked(),false);
 await page.locator('[data-tab=daily]').click();const prompt=page.locator('#daily-item-form [name=prompt]');await prompt.fill('draft during live update');await prompt.focus();
 await page.evaluate(()=>window.dispatchEvent(new MessageEvent('message',{data:{type:'boardSnapshot',html:document.documentElement.outerHTML,pageRequest:0,page:'daily'}})));
 assert.equal(await prompt.inputValue(),'draft during live update');assert.equal(await prompt.evaluate(e=>e===document.activeElement),true);
 await page.setViewportSize({width:420,height:900});await page.locator('[data-tab=console]').click();await page.waitForTimeout(150);
 assert.equal(await side.isVisible(),false);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.screenshot({path:resolve('.ui-smoke/latest-console.png'),fullPage:true});assert.deepEqual(errors,[]);console.log('Drag, keyboard resize, layout persistence, draft/focus during snapshots and narrow layout passed.');
}finally{await browser.close();}
