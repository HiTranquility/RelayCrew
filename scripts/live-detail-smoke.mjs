import assert from 'node:assert/strict';
import {resolve,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
const modulePath=process.env.RELAYCREW_PLAYWRIGHT_MODULE||'playwright';
const {chromium}=await import(isAbsolute(modulePath)?pathToFileURL(modulePath).href:modulePath);
const browser=await chromium.launch({headless:true,...(process.env.RELAYCREW_BROWSER_EXECUTABLE?{executablePath:process.env.RELAYCREW_BROWSER_EXECUTABLE}:{})});
try{for(const language of ['en','vi']){
 const context=await browser.newContext({viewport:{width:1400,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(8000);
 await page.goto(pathToFileURL(resolve('docs/previews','agent-map'+(language==='vi'?'.vi':'')+'.html')).href);
 await page.locator('[data-map-session]:visible [data-map-node="builder:primary:0"]').dblclick();
 const popup=page.locator('dialog.agent-detail-popup'),body=popup.locator('.agent-detail-popup-body');await popup.waitFor();
 assert.equal(await popup.locator('[data-code-block]').count(),1);assert.equal(await popup.locator('.code-line-number').count(),2);
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copiedCode=text;}}}));
 await popup.locator('[data-copy-code]').click();assert.equal(await page.evaluate(()=>window.__copiedCode),'export const maxRetries = 3;\n  // PUBLIC PREVIEW FIXTURE ONLY');
 const snapshot=async text=>page.evaluate(text=>{const source=document.querySelector('[data-map-session]:not([hidden]) [data-map-inspector="builder:primary:0"]');for(const work of source.querySelectorAll('[data-public-work]')){let line=work.querySelector('[data-test-progress]');if(!line){line=document.createElement('p');line.dataset.testProgress='';work.append(line);}line.textContent=text;}window.dispatchEvent(new MessageEvent('message',{data:{type:'mapSnapshot',html:document.documentElement.outerHTML}}));},text);
 await popup.locator('[data-map-tab=events]').click();await body.evaluate(el=>el.scrollTop=100);const scroll=await body.evaluate(el=>el.scrollTop);
 await snapshot('PUBLIC UPDATE ONE · reading src/demo.ts');await popup.locator('[data-inspector-pane=events] [data-test-progress]').filter({hasText:'UPDATE ONE'}).waitFor();assert.equal(await popup.locator('[data-map-tab=events]').getAttribute('aria-pressed'),'true');assert.ok(Math.abs((await body.evaluate(el=>el.scrollTop))-scroll)<10);
 await popup.locator('[data-popup-freeze]').click();await snapshot('PUBLIC UPDATE TWO · command completed');assert.equal(await popup.locator('[data-inspector-pane=events] [data-test-progress]').innerText(),'PUBLIC UPDATE ONE · reading src/demo.ts');
 await popup.locator('[data-popup-freeze]').click();await popup.locator('[data-inspector-pane=events] [data-test-progress]').filter({hasText:'UPDATE TWO'}).waitFor();
 assert.match(await popup.locator('.popup-live-label').innerText(),/Live/);await popup.locator('[data-popup-close]').click();assert.equal(await popup.count(),0);
 await page.goto(pathToFileURL(resolve('docs/previews','live-session'+(language==='vi'?'.vi':'')+'.html')).href);assert.equal(await page.locator('.execution-journey').isVisible(),true);assert.ok(await page.locator('.execution-journey li').count()>=3);
 assert.deepEqual(errors,[]);console.log(language+': live popup refresh, tab/scroll preservation, pause/resume view, exact code copying and recorded execution journey passed.');await context.close();
}}finally{await browser.close();}
