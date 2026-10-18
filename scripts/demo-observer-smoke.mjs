import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {isAbsolute,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const modulePath=process.env.RELAYCREW_PLAYWRIGHT_MODULE||'playwright';
const {chromium}=await import(isAbsolute(modulePath)?pathToFileURL(modulePath).href:modulePath);
const child=spawn(process.execPath,['--import','tsx','scripts/demo-observer.ts','--port','0'],{stdio:['ignore','pipe','pipe'],windowsHide:true});
let logs='';child.stderr.on('data',chunk=>logs+=chunk);
const url=await new Promise((accept,reject)=>{const timeout=setTimeout(()=>reject(new Error(logs||'Demo server did not start')),12000);child.stdout.on('data',chunk=>{const match=String(chunk).match(/DEMO (http:\/\/127\.0\.0\.1:\d+)/);if(match){clearTimeout(timeout);accept(match[1]);}});child.on('exit',code=>{clearTimeout(timeout);reject(new Error('Demo server exit '+code+' '+logs));});});
const browser=await chromium.launch({headless:true,...(process.env.RELAYCREW_BROWSER_EXECUTABLE?{executablePath:process.env.RELAYCREW_BROWSER_EXECUTABLE}:{})});
try{
 const page=await browser.newPage({viewport:{width:1560,height:1080}}),errors=[];page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));await page.goto(url);const state=()=>page.request.get(url+'/state').then(r=>r.json());
 await page.locator('#speed').selectOption('650');await page.locator('#question').waitFor({state:'visible',timeout:20000});assert.match(await page.locator('#question-text').innerText(),/Executor 1 \/ Nhánh 1/);
 const waiting=await state();assert.equal(waiting.jobs[0].status,'waiting_owner');assert.equal(waiting.jobs[0].children,2);
 const map=page.frameLocator('#map'),live=page.frameLocator('#live');await map.locator('[data-map-node="native:demo-child-0-0"]').waitFor();assert.equal(await map.locator('[data-map-node="native:demo-child-0-0"]').getAttribute('data-map-parent'),'worker:primary:0');
 await map.locator('[data-canvas-mode=dependency]').click();await map.locator('[data-canvas-mode=table]').click();await map.locator('[data-canvas-mode=graph]').click();await map.locator('[data-map-node="native:demo-child-0-0"]').dblclick();assert.equal(await map.locator('dialog.agent-detail-popup').isVisible(),true);await map.locator('dialog.agent-detail-popup>header button').click();
 await page.screenshot({path:resolve('.ui-smoke/demo-walkthrough-question.png'),fullPage:true});
 await page.locator('[data-view=map]').click();assert.equal(await page.locator('#live').isVisible(),false);await page.locator('[data-view=split]').click();await page.locator('#divider').focus();await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('#divider').getAttribute('aria-valuenow'),'52');
 await page.locator('[data-answer]').first().click();await page.waitForFunction(()=>document.getElementById('question').hidden);assert.equal((await state()).jobs[0].replyVersion,1);
 await map.locator('[data-map-configure]').first().click();await page.locator('#config').waitFor({state:'visible'});await page.locator('#config-close').click();await page.locator('#configure').click();await page.locator('#workers').selectOption('6');await page.locator('#children').selectOption('2');await page.locator('#new').click();await page.locator('#question').waitFor({state:'visible',timeout:20000});
 await live.locator('#live-reply-input').fill('Rà logic và UI/UX trong giả lập.');await live.locator('#live-reply-input').press('Control+Enter');await page.waitForFunction(()=>document.getElementById('question').hidden);assert.equal((await state()).jobs[0].replyVersion,1);
 await page.locator('#play').click();await page.waitForFunction(()=>document.getElementById('play').textContent.includes('Tiếp tục'));const before=(await state()).jobs[0].progress.done;await page.waitForTimeout(1600);assert.equal((await state()).jobs[0].progress.done,before);await page.locator('#step').click();assert.equal((await state()).jobs[0].progress.done,before+1);
 const download=page.waitForEvent('download');await page.locator('#report').click();assert.match((await download).suggestedFilename(),/relaycrew-demo/);
 await page.locator('#stop').click();assert.equal((await state()).jobs[0].status,'cancelled');await page.setViewportSize({width:420,height:850});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'narrow layout must not overflow horizontally');assert.deepEqual(errors,[]);console.log('Demo: parent/child ownership, canvas views and popup, owner gate, both reply forms, pane controls, setup, pause/step/stop, narrow layout and report download passed.');
}finally{await browser.close();child.kill();}
