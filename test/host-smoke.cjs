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
    await vscode.commands.executeCommand('aiTeam.logs');
    await vscode.commands.executeCommand('aiTeam.dashboard.focus');
    await vscode.commands.executeCommand('aiTeam.board');
    await vscode.commands.executeCommand('aiTeam.flow');
    let panels=[];
    const deadline=Date.now()+5000;
    while(Date.now()<deadline){panels=vscode.window.tabGroups.all.flatMap(g=>g.tabs).filter(t=>t.input instanceof vscode.TabInputWebview);if(panels.some(t=>t.label.includes('Bảng phân công'))&&panels.some(t=>t.label.includes('Setup flow')))break;await new Promise(resolve=>setTimeout(resolve,50));}
    assert.ok(panels.some(t=>t.label.includes('Bảng phân công')),'Assignment board opened');
    assert.ok(panels.some(t=>t.label.includes('Setup flow')),'Flow editor opened');
    await fs.writeFile(process.env.AI_TEAM_SMOKE_RESULT, JSON.stringify({ passed: true, extension: ext.id, commands: commands.filter(x => x.startsWith('aiTeam.')) }, null, 2));
  } catch (e) {
    await fs.writeFile(process.env.AI_TEAM_SMOKE_RESULT, JSON.stringify({ passed: false, error: String(e), stack: e.stack }));
    throw e;
  }
};
