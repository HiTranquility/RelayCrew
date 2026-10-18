import assert from 'node:assert/strict';
import {resolve,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
const modulePath=process.env.RELAYCREW_PLAYWRIGHT_MODULE||'playwright';
const {chromium}=await import(isAbsolute(modulePath)?pathToFileURL(modulePath).href:modulePath);
const browser=await chromium.launch({headless:true,...(process.env.RELAYCREW_BROWSER_EXECUTABLE?{executablePath:process.env.RELAYCREW_BROWSER_EXECUTABLE}:{})});
try{for(const language of ['en','vi']){
 const context=await browser.newContext({viewport:{width:1200,height:950}}),page=await context.newPage(),errors=[];page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(resolve('docs/previews',language==='en'?'board.html':'board.vi.html')).href);
 // Prepare-page onboarding used to dereference a nonexistent .account-card.
 await page.locator('.preparation-account-grid [data-action=checkConnection]').first().click();
 assert.equal((await page.evaluate(()=>window.__messages.filter(m=>m.action!=='boardState').at(-1))).action,'checkConnection');
 await page.evaluate(()=>window.dispatchEvent(new MessageEvent('message',{data:{type:'cliSetupStatus',profileId:'codex-dev',message:'Checked without reading credentials'}})));
 assert.equal(await page.locator('.preparation-account-grid [data-action=checkConnection]').first().isEnabled(),true);
 await page.locator('[data-tab=accounts]').click();
 const accountRow=page.locator('[data-account-row="codex-dev"]');assert.match(await accountRow.innerText(),/owner@example.com/);
 await accountRow.locator('[data-account-usage]').click();assert.equal(await accountRow.locator('details').getAttribute('open'),'');assert.match(await accountRow.innerText(),/60%/);
 await accountRow.locator('[data-action=checkConnection]').first().click();assert.equal(await accountRow.locator('[data-action=checkConnection]').first().isDisabled(),true);assert.equal(await page.locator('.account-card [data-action=checkConnection][data-id="codex-dev"]').isDisabled(),true);
 await page.evaluate(()=>window.dispatchEvent(new MessageEvent('message',{data:{type:'cliSetupStatus',profileId:'codex-dev',message:'Native checked',readout:'<details data-usage-profile="codex-dev"><summary>Native usage</summary><p>Updated 59%</p></details>'}})));
 assert.equal(await accountRow.locator('[data-action=checkConnection]').first().isEnabled(),true);assert.equal(await accountRow.locator('details').getAttribute('open'),'');assert.match(await accountRow.innerText(),/Updated 59%/);
 const sharedRow=page.locator('[data-account-row="antigravity-worker"]');await sharedRow.locator('[data-account-usage]').click();assert.match(await sharedRow.innerText(),language==='vi'?/dùng chung/:/shared CLI login/);assert.equal(await sharedRow.locator('meter').count(),2);assert.match(await sharedRow.innerText(),/0%/);
 for(const width of [390,700,1200]){await page.setViewportSize({width,height:950});assert.ok(await page.locator('.account-list').evaluate(el=>el.getBoundingClientRect().right<=window.innerWidth+1));}await page.locator('.account-list').screenshot({path:resolve('.ui-smoke','account-list-'+language+'.png')});
 await page.locator('.multiple-accounts>summary').click();
 const form=page.locator('#multiple-accounts-form');await form.locator('[name=emails]').focus();await page.evaluate(()=>window.dispatchEvent(new MessageEvent('message',{data:{type:'boardSnapshot',html:document.documentElement.outerHTML,page:'accounts',pageRequest:0}})));assert.equal(await form.locator('[name=emails]').evaluate(el=>el===document.activeElement),true);await form.locator('[name=provider]').selectOption('antigravity');await form.locator('[name=emails]').fill('one@example.com\ntwo@example.com');
 await page.evaluate(()=>window.dispatchEvent(new MessageEvent('message',{data:{type:'boardSnapshot',html:document.documentElement.outerHTML,page:'accounts',pageRequest:0}})));
 assert.equal(await form.locator('[name=emails]').inputValue(),'one@example.com\ntwo@example.com');
 await form.locator('[type=submit]').click();let message=await page.evaluate(()=>window.__messages.filter(m=>m.action!=='boardState').at(-1));assert.equal(message.action,'addEmailAccounts');assert.equal(message.provider,'antigravity');assert.equal(message.emails,'one@example.com\ntwo@example.com');assert.equal(await form.locator('[type=submit]').isDisabled(),true);
 await page.evaluate(()=>window.dispatchEvent(new MessageEvent('message',{data:{type:'multipleAccountsResult',ok:true,message:'Accounts added; sign in manually'}})));assert.equal(await form.locator('[name=emails]').inputValue(),'');
 await form.locator('button[type=submit]').focus();await page.evaluate(()=>{const parsed=new DOMParser().parseFromString(document.documentElement.outerHTML,'text/html'),entry=parsed.createElement('p');entry.id='added-account-marker';entry.textContent='New account received from host';parsed.getElementById('page-accounts').append(entry);window.dispatchEvent(new MessageEvent('message',{data:{type:'boardSnapshot',html:parsed.documentElement.outerHTML,page:'accounts',pageRequest:0}}));});assert.equal(await page.locator('#added-account-marker').isVisible(),true);
 await page.locator('.account-advanced>summary').click();await page.locator('[data-account-edit]').first().click();await page.locator('#account-form [name=accountEmail]').fill('owner@example.com');await page.locator('#account-form [name=fallbackEligible]').uncheck();await page.reload();assert.equal(await page.locator('#account-form [name=fallbackEligible]').isChecked(),false);assert.equal(await page.locator('#account-form [name=accountEmail]').inputValue(),'owner@example.com');
 await page.locator('#account-form button[type=submit]').click();message=await page.evaluate(()=>window.__messages.filter(m=>m.action!=='boardState').at(-1));assert.equal(message.action,'saveAccount');assert.equal(message.profile.accountEmail,'owner@example.com');assert.equal(message.profile.fallbackEligible,false);
 await page.locator('[data-account-close]').click();await page.locator('[data-provider=antigravity] [data-account-edit]').click();assert.equal(await page.locator('#account-form [name=configDir]').isDisabled(),true);await page.locator('[data-account-close]').click();
 assert.equal(await page.locator('.recovery-dashboard [data-setting=autoSwitch]').isChecked(),true);await page.locator('.recovery-dashboard [data-setting=autoSwitch]').uncheck();message=await page.evaluate(()=>window.__messages.filter(m=>m.action!=='boardState').at(-1));assert.deepEqual(message,{action:'toggle',key:'autoSwitch',value:false});
 await page.locator('.recovery-dashboard').screenshot({path:resolve('.ui-smoke','recovery-'+language+'.png')});assert.deepEqual(errors,[]);console.log(language+': bulk accounts, email/fallback drafts, native login limitations, recovery controls and preparation connection check passed');await context.close();
}}finally{await browser.close();}
