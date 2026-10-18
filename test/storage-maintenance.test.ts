import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,utimes,readFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve,basename} from 'node:path';
import {StorageMaintenance} from '../src/storage/maintenance';

test('retention previews exact candidates and preserves referenced, recent and protected data',async()=>{
  const root=await mkdtemp(join(tmpdir(),'relaycrew-retention-')),now=Date.now(),old=new Date(now-40*86400000),id='11111111-1111-1111-1111-111111111111',kept='22222222-2222-2222-2222-222222222222';
  try{
    for(const folder of ['attachments','reports','state.json.backups','source-backups'])await mkdir(join(root,folder));
    const put=async(path:string,text='fixture')=>{await writeFile(join(root,path),text);await utimes(join(root,path),old,old);};
    await put('state.json');await put('source-backups/keep.txt');
    for(const uid of [id,kept]){await put(`attachments/${uid}.data`);await put(`attachments/${uid}.json`);await put(`reports/${uid}.md`);}
    for(let i=0;i<7;i++)await put(`state.json.backups/${now-i}-${id}.json`);
    const refs={attachments:new Set([kept]),jobs:new Set([kept])},store=new StorageMaintenance(process.platform==='win32'?root.toUpperCase():root),plan=await store.preview({keepBackups:5,orphanDays:30},refs,now);
    assert.equal(plan.entries.length,5);assert.ok(!plan.entries.some(e=>e.path.includes(kept)||e.path==='state.json'||e.path.startsWith('source-backups')));
    await assert.rejects(store.apply(plan.token,refs,false,false,now),/Pause/);
    await assert.rejects(store.apply(plan.token,refs,true,true,now),/Pause/);
    // A candidate becoming referenced after preview must survive confirmation.
    const result=await store.apply(plan.token,{attachments:new Set([id,kept]),jobs:refs.jobs},true,false,now);
    assert.equal(result.removed,3);assert.equal(result.skipped,2);assert.equal(await readFile(join(root,'attachments',id+'.data'),'utf8'),'fixture');
    assert.equal(await readFile(join(root,'source-backups/keep.txt'),'utf8'),'fixture');
    await assert.rejects(store.apply(plan.token,refs,true,false,now),/expired/);
  }finally{if(dirname(resolve(root))!==resolve(tmpdir())||!basename(root).startsWith('relaycrew-retention-'))throw new Error('Unexpected cleanup path');await rm(root,{recursive:true,force:true,maxRetries:6});}
});
test('retention rejects invalid policy and changed or linked files',async()=>{
  const root=await mkdtemp(join(tmpdir(),'relaycrew-retention-')),now=Date.now(),old=new Date(now-40*86400000),id='33333333-3333-3333-3333-333333333333',refs={attachments:new Set<string>(),jobs:new Set<string>()};
  try{
    await mkdir(join(root,'reports'));await writeFile(join(root,'reports',id+'.md'),'before');await utimes(join(root,'reports',id+'.md'),old,old);
    const store=new StorageMaintenance(root);await assert.rejects(store.preview({keepBackups:0,orphanDays:30},refs),/5–50/);
    const plan=await store.preview({keepBackups:5,orphanDays:30},refs,now);await writeFile(join(root,'reports',id+'.md'),'changed');
    assert.equal((await store.apply(plan.token,refs,true,false,now)).removed,0);
    if(process.platform!=='win32'){await symlink(join(root,'reports',id+'.md'),join(root,'reports','44444444-4444-4444-4444-444444444444.md'));assert.equal((await store.preview({keepBackups:5,orphanDays:30},refs,now)).entries.length,0);}
  }finally{if(dirname(resolve(root))!==resolve(tmpdir())||!basename(root).startsWith('relaycrew-retention-'))throw new Error('Unexpected cleanup path');await rm(root,{recursive:true,force:true,maxRetries:6});}
});
