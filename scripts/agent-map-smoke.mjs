import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve,isAbsolute} from 'node:path';
import {mkdir} from 'node:fs/promises';
const modulePath=process.env.RELAYCREW_PLAYWRIGHT_MODULE||'playwright';
const {chromium}=await import(isAbsolute(modulePath)?pathToFileURL(modulePath).href:modulePath);
const browser=await chromium.launch({headless:true,...(process.env.RELAYCREW_BROWSER_EXECUTABLE?{executablePath:process.env.RELAYCREW_BROWSER_EXECUTABLE}:{})});
await mkdir('.ui-smoke',{recursive:true});
try{
 for(const language of ['en','vi']){
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(resolve('docs/previews',language==='en'?'board.html':'board.vi.html')).href);
  await page.locator('[data-tab=console]').click();await page.locator('[data-console-layout=sessions]').click();
  const deck=page.locator('.console-deck'),content=page.locator('#agent-map-content'),active=page.locator('[data-map-session]:visible');
  assert.equal(await deck.getAttribute('data-view'),'split');assert.equal(await active.count(),1);assert.equal(await active.locator('[data-map-node]').count(),5);
  assert.equal(await active.locator('[data-map-node="auditor:primary:0"]').getAttribute('aria-pressed'),'true');
  await page.locator('#console-input').fill('Keep draft while inspecting agents');
  await active.locator('.agent-node-nav [data-map-jump="builder:primary:0"]').click();
  assert.equal(await active.locator('[data-map-inspector="builder:primary:0"]').isVisible(),true);
  await active.locator('[data-map-inspector]:visible [data-map-tab=request]').click();
  const top=await content.evaluate(e=>e.scrollTop);assert.ok(top>=0);
  for(const type of ['consoleSnapshot','boardSnapshot']){
   await page.evaluate(type=>{const parsed=new DOMParser().parseFromString(document.documentElement.outerHTML,'text/html'),panel=parsed.querySelector('[data-map-session]:not([hidden])');panel.querySelector('[data-map-node="auditor:primary:0"]').dataset.status='done';panel.querySelector('[data-map-node="lead:primary:0"]').dataset.status='running';window.dispatchEvent(new MessageEvent('message',{data:{type,html:parsed.documentElement.outerHTML,page:'console',pageRequest:0}}));},type);
   await page.waitForTimeout(80);
   assert.equal(await active.locator('[data-map-node="builder:primary:0"]').getAttribute('aria-pressed'),'true');
   assert.equal(await active.locator('[data-map-inspector]:visible [data-map-detail$=":request"]').evaluate(e=>e.open),true);
   assert.equal(await content.evaluate(e=>e.scrollTop),top);
  }
  assert.equal(await page.locator('#console-input').inputValue(),'Keep draft while inspecting agents');
  await page.locator('#agent-map-follow').click();assert.equal(await active.locator('[data-map-node="lead:primary:0"]').getAttribute('aria-pressed'),'true');
  const divider=page.locator('#agent-map-divider');await divider.focus();await divider.press('End');assert.equal(await divider.getAttribute('aria-valuenow'),'60');
  await page.reload();assert.equal(await divider.getAttribute('aria-valuenow'),'60');assert.equal(await page.locator('#console-input').inputValue(),'Keep draft while inspecting agents');
  const box=await divider.boundingBox();await page.mouse.move(box.x+3,box.y+40);await page.mouse.down();await page.mouse.move(box.x+70,box.y+40);await page.mouse.up();assert.ok(Number(await divider.getAttribute('aria-valuenow'))<60);
  await page.locator('[data-console-view=map]').click();assert.equal(await page.locator('.console-workspace').isVisible(),false);assert.equal(await page.locator('.agent-map-panel').isVisible(),true);
  await page.locator('[data-console-view=console]').click();assert.equal(await page.locator('.agent-map-panel').isVisible(),false);assert.equal(await page.locator('.console-workspace').isVisible(),true);
  await page.keyboard.press('Alt+m');assert.equal(await deck.getAttribute('data-view'),'split');
  await page.screenshot({path:resolve('.ui-smoke',`agent-map-${language}.png`),fullPage:true});
  await page.locator('[data-console-layout=sessions]').click();await page.locator('[data-session]').last().click();
  await page.locator('[data-console-view=map]').click();await active.locator('[data-map-inspector]:visible [data-compose-reply]').click();assert.equal(await deck.getAttribute('data-view'),'split');assert.equal(await page.locator('#console-mode').inputValue(),'reply');
  const jobId=await active.getAttribute('data-map-session');await active.locator('[data-map-inspector]:visible [data-action=cancel]').click();assert.deepEqual(await page.evaluate(()=>window.__messages.filter(m=>m.action!=='boardState').at(-1)),{action:'cancel',id:jobId});
  await page.setViewportSize({width:420,height:950});await page.waitForTimeout(150);assert.equal(await deck.evaluate(e=>e.classList.contains('map-stacked')),true);assert.equal(await divider.getAttribute('aria-orientation'),'horizontal');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const narrowDeck=await deck.boundingBox(),narrowConsole=await page.locator('.console-workspace').boundingBox(),narrowMap=await page.locator('.agent-map-panel').boundingBox();assert.ok(narrowDeck.height<=1110);assert.ok(narrowMap.y-narrowConsole.y-narrowConsole.height<=8);assert.ok(narrowMap.height>=260);
  await page.screenshot({path:resolve('.ui-smoke',`agent-map-${language}-narrow.png`),fullPage:true});
  assert.deepEqual(errors,[]);console.log(language+': agent selection, live snapshots, scroll/draft preservation, follow, resizing, views, replies, stop and narrow layout passed.');await context.close();
 }
}finally{await browser.close();}
