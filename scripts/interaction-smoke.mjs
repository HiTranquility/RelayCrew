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
 await page.locator('[data-tab=daily]').click();const prompt=page.locator('#daily-item-form [name=prompt]');await prompt.fill('draft during live update');await prompt.focus();
 await page.evaluate(()=>window.dispatchEvent(new MessageEvent('message',{data:{type:'boardSnapshot',html:document.documentElement.outerHTML,pageRequest:0,page:'daily'}})));
 assert.equal(await prompt.inputValue(),'draft during live update');assert.equal(await prompt.evaluate(e=>e===document.activeElement),true);
 await page.setViewportSize({width:420,height:900});await page.locator('[data-tab=console]').click();await page.waitForTimeout(150);
 assert.equal(await side.isVisible(),false);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.deepEqual(errors,[]);console.log('Drag, keyboard resize, layout persistence, draft/focus during snapshots and narrow layout passed.');
}finally{await browser.close();}
