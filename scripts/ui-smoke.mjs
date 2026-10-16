import assert from 'node:assert/strict';
import { copyFile, mkdir } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Optional local visual QA. Playwright/browser installation is independent of npm test.
const modulePath=process.env.RELAYCREW_PLAYWRIGHT_MODULE||'playwright';
const {chromium}=await import(isAbsolute(modulePath)?pathToFileURL(modulePath).href:modulePath);
const browser=await chromium.launch({headless:true,...(process.env.RELAYCREW_BROWSER_EXECUTABLE?{executablePath:process.env.RELAYCREW_BROWSER_EXECUTABLE}:{})});
const dir=resolve('.ui-smoke');await mkdir(dir,{recursive:true});
const light={'--vscode-foreground':'#333333','--vscode-editor-background':'#ffffff','--vscode-descriptionForeground':'#616161','--vscode-panel-border':'#e5e5e5','--vscode-badge-background':'#e5e5e5','--vscode-badge-foreground':'#333333','--vscode-input-background':'#ffffff','--vscode-input-foreground':'#333333','--vscode-input-border':'#cecece','--vscode-button-secondaryBackground':'#e5e5e5','--vscode-button-secondaryForeground':'#333333','--vscode-button-secondaryHoverBackground':'#d9d9d9','--vscode-editorGroupHeader-tabsBackground':'#f3f3f3','--vscode-tab-activeBackground':'#ffffff','--vscode-tab-activeForeground':'#333333','--vscode-tab-inactiveForeground':'#616161','--vscode-list-hoverBackground':'#f0f0f0'};
try{
  for(const language of ['en','vi'])for(const scheme of ['dark','light']){
    const context=await browser.newContext({viewport:{width:1280,height:900},colorScheme:scheme}),page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const suffix=language==='en'?'':'.vi';
    const load=async(name)=>{await page.goto(pathToFileURL(resolve('docs/previews',name+suffix+'.html')).href);if(scheme==='light')await page.evaluate(values=>{for(const[k,v]of Object.entries(values))document.documentElement.style.setProperty(k,v);},light);};
    await load('board');assert.equal(await page.locator('html').getAttribute('lang'),language);
    await page.locator('[data-tab=accounts]').click();assert.equal(await page.locator('#page-accounts').isVisible(),true);
    assert.equal(await page.locator('#page-accounts tbody tr').count(),4);assert.match(await page.locator('#page-accounts').innerText(),/claude-manager/);
    await page.locator('[data-tab=accounts]').press('ArrowRight');assert.equal(await page.locator('#page-setup').isVisible(),true);
    await page.locator('[data-number-setting=timeoutMinutes]').fill('45');await page.reload();
    if(scheme==='light')await page.evaluate(values=>{for(const[k,v]of Object.entries(values))document.documentElement.style.setProperty(k,v);},light);
    assert.equal(await page.locator('#page-setup').isVisible(),true);assert.equal(await page.locator('[data-number-setting=timeoutMinutes]').inputValue(),'45');
    await page.locator('[data-action=saveSettings]').click();assert.equal((await page.evaluate(()=>window.__messages.at(-1))).settings.timeoutMinutes,45);
    await page.locator('[data-language]').selectOption(language==='en'?'vi':'en');assert.equal((await page.evaluate(()=>window.__messages.at(-1))).action,'setLanguage');
    await page.locator('[data-tab=daily]').click();assert.equal(await page.locator('[data-daily-account=gemini-worker]').isChecked(),false);
    await page.locator('[data-daily-account=gemini-worker]').check();assert.deepEqual(await page.evaluate(()=>window.__messages.at(-1)),{action:'dailyAccount',id:'gemini-worker',value:true});
    await page.evaluate(()=>sessionStorage.clear());await load('board');
    for(const view of ['tasks','accounts','setup','daily','projects']){await page.locator(`[data-tab=${view}]`).click();const name=`${view}-${language}-${scheme}.png`;await page.screenshot({path:join(dir,name),fullPage:true});if(scheme==='dark')await copyFile(join(dir,name),resolve('docs/previews',`${view==='tasks'?'board':view}${suffix}.png`));}
    await page.locator('[data-setting=isolateTasks]').last().check();assert.deepEqual(await page.evaluate(()=>window.__messages.at(-1)),{action:'toggle',key:'isolateTasks',value:true});await page.locator('[data-setting=openTasksInCodex]').last().check();assert.deepEqual(await page.evaluate(()=>window.__messages.at(-1)),{action:'toggle',key:'openTasksInCodex',value:true});
    await page.locator('[data-action=projectCodex]').first().click();assert.deepEqual(await page.evaluate(()=>window.__messages.at(-1)),{action:'projectCodex',id:'/demo/relay-app'});
    await page.evaluate(()=>sessionStorage.clear());await load('flow');
    const model=page.locator('[data-role=builder] [data-field=model]');await model.fill('exact-model <draft>');await page.reload();
    if(scheme==='light')await page.evaluate(values=>{for(const[k,v]of Object.entries(values))document.documentElement.style.setProperty(k,v);},light);
    assert.equal(await model.inputValue(),'exact-model <draft>');
    await page.locator('[data-role=lead] [data-field=profile]').selectOption('codex-dev');await page.locator('[data-coordinator][value=claude-manager]').check();await page.locator('#save').click();
    const message=await page.evaluate(()=>window.__messages.at(-1));assert.equal(message.type,'saveFlow');assert.equal(message.management.primaryProfileId,'codex-dev');assert.ok(message.management.coordinatorIds.includes('claude-manager'));assert.ok(!message.management.coordinatorIds.includes('codex-dev'));
    await page.evaluate(()=>sessionStorage.clear());await load('flow');const flowShot=join(dir,`flow-${language}-${scheme}.png`);await page.screenshot({path:flowShot,fullPage:true});if(scheme==='dark')await copyFile(flowShot,resolve('docs/previews',`flow${suffix}.png`));
    await page.setViewportSize({width:420,height:850});await page.evaluate(()=>sessionStorage.clear());await load('board');await page.locator('[data-tab=setup]').click();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'Setup should fit narrow screens');
    assert.deepEqual(errors,[]);console.log(`${language}/${scheme}: tabs, keyboard navigation, drafts, settings, daily accounts, manager selection and project/worktree controls passed.`);await context.close();
  }
}finally{await browser.close();}
