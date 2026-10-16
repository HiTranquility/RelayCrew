const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const vscode = require('vscode');
const {createServer}=require('node:http');
const path=require('node:path');
exports.run = async function () {
  try {
    const ext = vscode.extensions.getExtension('local-ai-team.ai-team-workbench');
    assert.ok(ext, 'Extension registered');
    await ext.activate();
    assert.ok(ext.isActive, 'Extension active');
    const commands = await vscode.commands.getCommands(true);
    for (const id of ['aiTeam.newTask', 'aiTeam.switch', 'aiTeam.schedule', 'aiTeam.quota', 'aiTeam.cancel', 'aiTeam.report', 'aiTeam.board', 'aiTeam.flow', 'aiTeam.connections', 'aiTeam.reply', 'aiTeam.resume', 'aiTeam.backlog', 'aiTeam.utilization']) assert.ok(commands.includes(id), id);
    for(const item of ext.packageJSON.contributes.commands)assert.ok(commands.includes(item.command),item.command);
    const configuration=vscode.workspace.getConfiguration('aiTeam');
    await configuration.update('language','en',vscode.ConfigurationTarget.Global);
    await vscode.commands.executeCommand('aiTeam.logs');
    await vscode.commands.executeCommand('aiTeam.dashboard.focus');
    await vscode.commands.executeCommand('aiTeam.board');
    await vscode.commands.executeCommand('aiTeam.newTask');
    await vscode.commands.executeCommand('aiTeam.flow');
    const checkBoard=async(label)=>{const deadline=Date.now()+5000;while(Date.now()<deadline){const panels=vscode.window.tabGroups.all.flatMap(g=>g.tabs).filter(t=>t.input instanceof vscode.TabInputWebview);if(panels.some(t=>t.label.includes(label))){assert.equal(panels.length,1,'Configuration stays in the same board');return;}await new Promise(resolve=>setTimeout(resolve,50));}assert.fail('Missing localized board: '+label);};
    await checkBoard('Assignment board');
    const oldPick=vscode.window.showQuickPick,oldInput=vscode.window.showInputBox;let popups=0;
    vscode.window.showQuickPick=async()=>{popups++;throw new Error('Configuration opened a QuickPick');};vscode.window.showInputBox=async()=>{popups++;throw new Error('Configuration opened an input popup');};
    try{for(const id of ['aiTeam.connectCli','aiTeam.profiles','aiTeam.flow','aiTeam.routing','aiTeam.quota','aiTeam.switch','aiTeam.connections','aiTeam.secret','aiTeam.accountMenu','aiTeam.language','aiTeam.schedule','aiTeam.dailyStart','aiTeam.dailyTask'])await vscode.commands.executeCommand(id);}finally{vscode.window.showQuickPick=oldPick;vscode.window.showInputBox=oldInput;}
    assert.equal(popups,0,'Routine configuration must not open native input dialogs');
    let apiCalls=0;const api=createServer(async(req,res)=>{res.setHeader('Content-Type','application/json');if(req.url==='/v1/models')res.end(JSON.stringify({data:[{id:'local-smoke-model'}]}));else if(req.url==='/v1/chat/completions'){apiCalls++;let body='';for await(const chunk of req)body+=chunk;const payload=JSON.parse(body);assert.equal(payload.model,'local-smoke-model');assert.equal(payload.tools,undefined);res.end(JSON.stringify({choices:[{message:{content:'Xin chào!'}}]}));}else{res.writeHead(404);res.end();}});
    await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
    try{
      await configuration.update('profiles',[{id:'http-smoke',label:'Local smoke',provider:'compatible',transport:'http',hosting:'local',endpoint:`http://127.0.0.1:${api.address().port}/v1`,executable:'http',modelPolicy:'flagship'}],vscode.ConfigurationTarget.Global);
      const connection=await vscode.commands.executeCommand('aiTeam.checkConnection','http-smoke');assert.deepEqual(connection.models,['local-smoke-model']);assert.equal(connection.authenticated,'unknown');
      const result=await vscode.commands.executeCommand('aiTeam.chat','hello','http-smoke');assert.ok(result?.jobId,'Local API chat queued');let job;const until=Date.now()+15000;
      while(Date.now()<until){for(const directory of await fs.readdir(process.env.AI_TEAM_SMOKE_STATE)){try{const state=JSON.parse(await fs.readFile(path.join(process.env.AI_TEAM_SMOKE_STATE,directory,ext.id,'state.json'),'utf8'));job=state.jobs.find(j=>j.id===result.jobId);}catch{}}
        if(job&&!['queued','running'].includes(job.status))break;await new Promise(resolve=>setTimeout(resolve,100));}
      assert.equal(job?.status,'completed',job?.error);assert.equal(job.steps.length,1);assert.equal(job.steps[0].transport,'http');assert.equal(job.steps[0].model,'local-smoke-model');assert.equal(job.steps[0].response,'Xin chào!');assert.equal(apiCalls,1);
    }finally{api.closeAllConnections();await new Promise(resolve=>api.close(resolve));}
    await configuration.update('language','vi',vscode.ConfigurationTarget.Global);
    await checkBoard('Bảng phân công');
    await vscode.commands.executeCommand('aiTeam.setup');await vscode.commands.executeCommand('aiTeam.dailyPlan');await vscode.commands.executeCommand('aiTeam.projects');
    assert.equal(vscode.workspace.getConfiguration('aiTeam').get('language'),'vi');
    await fs.writeFile(process.env.AI_TEAM_SMOKE_RESULT, JSON.stringify({ passed: true, extension: ext.id,version:ext.packageJSON.version, languages:['en','vi'],httpIntegration:{chatCalls:apiCalls,readOnly:true}, commands: commands.filter(x => x.startsWith('aiTeam.')) }, null, 2));
  } catch (e) {
    await fs.writeFile(process.env.AI_TEAM_SMOKE_RESULT, JSON.stringify({ passed: false, error: String(e), stack: e.stack }));
    throw e;
  }
};
