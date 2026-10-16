const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const vscode=require('vscode');
exports.run=async()=>{
  try{
    assert.equal(process.env.RELAYCREW_LIVE_TEST,'1','Real provider test requires explicit opt-in.');
    const configuration=vscode.workspace.getConfiguration('aiTeam');
    await configuration.update('profiles',[{id:'live-codex',label:'Codex · live trial',provider:'codex',executable:process.env.RELAYCREW_LIVE_CLI,effort:'medium'}],vscode.ConfigurationTarget.Global);
    await configuration.update('timeoutMinutes',2,vscode.ConfigurationTarget.Global);await configuration.update('language','vi',vscode.ConfigurationTarget.Global);
    const extension=vscode.extensions.getExtension('local-ai-team.ai-team-workbench');await extension.activate();
    const chat=process.env.RELAYCREW_LIVE_MODE==='chat';const connection=await vscode.commands.executeCommand('aiTeam.checkConnection','live-codex');assert.equal(connection.installed,true);assert.equal(connection.authenticated,'yes');const result=chat?await vscode.commands.executeCommand('aiTeam.chat','hello','live-codex'):await vscode.commands.executeCommand('aiTeam.tryCli','live-codex');const id=chat?result.jobId:result;assert.ok(id,'Trial queued');
    let job;const deadline=Date.now()+180000;
    while(Date.now()<deadline){
      for(const directory of await fs.readdir(process.env.RELAYCREW_LIVE_STATE)){
        try{const state=JSON.parse(await fs.readFile(path.join(process.env.RELAYCREW_LIVE_STATE,directory,extension.id,'state.json'),'utf8'));job=state.jobs.find(j=>j.id===id);}catch{/* state may still be saving */}
        if(job)break;
      }
      if(job&&!['queued','running'].includes(job.status))break;
      await new Promise(resolve=>setTimeout(resolve,1000));
    }
    assert.equal(job?.status,'completed',job?.error??'Trial did not finish.');assert.equal(job.readOnly,true);assert.equal(job.steps.length,chat?1:3);if(chat){assert.equal(job.kind,'chat');assert.ok(!job.timeline.some(event=>event.kind==='tool'),'Greeting must not inspect code or run commands');}assert.ok(job.steps.every(step=>step.status==='done'&&step.profileId==='live-codex'));assert.ok(job.timeline.some(event=>event.kind==='stream'),'Public output received');
    await fs.writeFile(process.env.RELAYCREW_LIVE_RESULT,JSON.stringify({passed:true,jobId:id,status:job.status,readOnly:job.readOnly,steps:job.steps.map(({role,status,model,effort,response})=>({role,status,model,effort,response})),publicEvents:job.timeline.length},null,2));
  }catch(error){await fs.writeFile(process.env.RELAYCREW_LIVE_RESULT,JSON.stringify({passed:false,error:String(error)}));throw error;}
};
