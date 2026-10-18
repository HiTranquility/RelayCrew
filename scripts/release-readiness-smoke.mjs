import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';

const modulePath=process.env.RELAYCREW_PLAYWRIGHT_MODULE||'playwright';
const {chromium}=await import(isAbsolute(modulePath)?pathToFileURL(modulePath).href:modulePath);
const browser=await chromium.launch({headless:true,...(process.env.RELAYCREW_BROWSER_EXECUTABLE?{executablePath:process.env.RELAYCREW_BROWSER_EXECUTABLE}:{})});
try {
  for(const language of ['en','vi']){
    const context=await browser.newContext({viewport:{width:1320,height:960}});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
    const suffix=language==='en'?'':'.vi';
    const fixture=await readFile(resolve('docs/previews','run-review'+suffix+'.html'),'utf8');
    const last=action=>page.evaluate(action=>(window.__messages||[]).filter(m=>m.action===action).at(-1),action);
    const reply=data=>page.evaluate(data=>window.dispatchEvent(new MessageEvent('message',{data})),data);
    await page.goto(pathToFileURL(resolve('docs/previews','board'+suffix+'.html')).href);
    await page.locator('[data-tab=console]').click();
    await page.locator('#console-mode').selectOption('task');
    await page.locator('#console-input').fill('Implement a bounded task, inspect changed lines and verify acceptance.');
    await page.locator('#console-acceptance>summary').click();
    await page.locator('#console-criteria').fill('Tests pass\nChanged lines reviewed');
    await page.locator('#console-input').press('Control+Enter');
    let reviewed=await last('consoleReview');assert.ok(reviewed);assert.equal(await last('consoleSubmit'),undefined);
    await reply({type:'runReview',requestId:reviewed.requestId,ok:true,html:fixture});
    assert.equal(await page.locator('#run-review').isVisible(),true);
    await page.screenshot({path:resolve('.ui-smoke','release-review-'+language+'.png')});
    assert.ok(await page.locator('#run-review .run-review-team li').count()>=3);
    assert.equal(await page.locator('#run-review [data-review-heading]').evaluate(e=>e===document.activeElement),true);
    await page.locator('#console-input').fill('Changed after reviewing');
    await page.locator('[data-confirm-run]').click();
    assert.equal(await last('consoleSubmit'),undefined);assert.equal(await page.locator('#run-review').isVisible(),false);
    await page.locator('#console-input').press('Control+Enter');reviewed=await last('consoleReview');
    await reply({type:'runReview',requestId:reviewed.requestId,ok:true,html:fixture});
    await page.locator('[data-confirm-run]').press('Enter');
    const queued=await last('consoleSubmit');assert.equal(queued.text,'Changed after reviewing');assert.equal(queued.reviewToken,'fixture-review-token');assert.equal(queued.acceptance,'Tests pass\nChanged lines reviewed');
    await reply({type:'consoleAck',requestId:queued.requestId,ok:true,message:'Queued'});
    assert.equal(await page.locator('#console-input').inputValue(),'');assert.equal(await page.locator('#run-review').isVisible(),false);
    await page.locator('#console-mode').selectOption('chat');await page.locator('#console-input').fill('hello');await page.locator('#console-input').press('Control+Enter');
    const hello=await last('consoleSubmit');assert.equal(hello.text,'hello');assert.equal(hello.reviewToken,undefined);
    await reply({type:'consoleAck',requestId:hello.requestId,ok:true,message:'Hello'});
    await page.locator('[data-tab=setup]').click();await page.locator('[data-preparation-step=advanced]').first().click();
    await page.locator('#storage-form').evaluate(form=>form.requestSubmit());
    assert.equal((await last('storageInspect')).keepBackups,20);assert.equal(await last('storageCleanup'),undefined);
    await reply({type:'storageResult',html:'<p>One disposable test file</p><button type="button" data-storage-apply="fixture-retention-token">Confirm test preview</button>'});
    await page.locator('[data-storage-apply]').click();assert.equal((await last('storageCleanup')).token,'fixture-retention-token');
    await reply({type:'storageResult',message:'Queue must be paused first (test response).'});
    assert.match(await page.locator('#storage-result').innerText(),/paused/);
    await page.setViewportSize({width:430,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
    assert.deepEqual(errors,[]);
    console.log(language+': inline review, changed-draft rejection, keyboard confirmation, direct Chat, storage preview/confirmation and narrow setup passed.');
    await context.close();
  }
} finally {await browser.close();}
