const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const vscode = require('vscode');
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
    try{for(const id of ['aiTeam.connectCli','aiTeam.profiles','aiTeam.flow','aiTeam.routing','aiTeam.quota','aiTeam.switch','aiTeam.connections','aiTeam.secret','aiTeam.accountMenu','aiTeam.language'])await vscode.commands.executeCommand(id);}finally{vscode.window.showQuickPick=oldPick;vscode.window.showInputBox=oldInput;}
    assert.equal(popups,0,'Routine configuration must not open native input dialogs');
    await configuration.update('language','vi',vscode.ConfigurationTarget.Global);
    await checkBoard('Bảng phân công');
    await vscode.commands.executeCommand('aiTeam.setup');await vscode.commands.executeCommand('aiTeam.dailyPlan');await vscode.commands.executeCommand('aiTeam.projects');
    assert.equal(vscode.workspace.getConfiguration('aiTeam').get('language'),'vi');
    await fs.writeFile(process.env.AI_TEAM_SMOKE_RESULT, JSON.stringify({ passed: true, extension: ext.id, languages:['en','vi'], commands: commands.filter(x => x.startsWith('aiTeam.')) }, null, 2));
  } catch (e) {
    await fs.writeFile(process.env.AI_TEAM_SMOKE_RESULT, JSON.stringify({ passed: false, error: String(e), stack: e.stack }));
    throw e;
  }
};
