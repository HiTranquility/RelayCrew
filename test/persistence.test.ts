import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { JsonStore } from '../src/storage/json-store';
import { inside, listBackups, snapshotWorkspace } from '../src/storage/backup';
const exec=promisify(execFile);
test('atomic persistence serializes writes, retains previous state, and recovers malformed primary without deleting it',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'team-store-'));const file=join(dir,'state.json');const recovered:string[]=[];
  const valid=(x:any):x is {n:number}=>typeof x?.n==='number';
  try{
    const store=new JsonStore(file,valid);assert.deepEqual(await store.load({n:0}),{n:0});
    await Promise.all([store.save({n:1}),store.save({n:2}),store.save({n:3})]);
    assert.deepEqual(JSON.parse(await readFile(file,'utf8')),{n:3});
    assert.equal((await readdir(store.backups)).length,2);
    await writeFile(file,'{truncated');
    const reader=new JsonStore(file,valid,path=>recovered.push(path));
    assert.deepEqual(await reader.load({n:0}),{n:2});assert.equal(recovered.length,1);
    assert.ok((await readdir(dir)).some(n=>n.startsWith('state.json.corrupt-')));
    await reader.save({n:2});assert.deepEqual(JSON.parse(await readFile(file,'utf8')),{n:2});
    await reader.save({n:4});await rm(file);
    const missing=new JsonStore(file,valid);assert.deepEqual(await missing.load({n:0}),{n:2});
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('source snapshot preserves tracked/untracked work and explicit ignored data; caps block rather than silently skip',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'team-source-'));const cwd=join(dir,'repo'),backups=join(dir,'backups');await mkdir(cwd);
  try{
    await exec('git',['init'],{cwd,windowsHide:true});
    await writeFile(join(cwd,'.gitignore'),'data.db\n');await writeFile(join(cwd,'tracked.txt'),'original');await exec('git',['add','.'],{cwd,windowsHide:true});
    await writeFile(join(cwd,'tracked.txt'),'work in progress');await writeFile(join(cwd,'untracked.txt'),'not committed');await writeFile(join(cwd,'data.db'),'runtime data');
    const path=await snapshotWorkspace(cwd,backups,'test','builder',{maxBytes:10000,totalBytes:20000,extraPaths:['data.db']});
    assert.equal(await readFile(join(path,'files','tracked.txt'),'utf8'),'work in progress');assert.equal(await readFile(join(path,'files','untracked.txt'),'utf8'),'not committed');assert.equal(await readFile(join(path,'files','data.db'),'utf8'),'runtime data');
    assert.equal((await listBackups(backups))[0].manifest.files.length,4);
    await assert.rejects(snapshotWorkspace(cwd,backups,'test','worker',{maxBytes:1,totalBytes:20000}),/cap/);
    await assert.rejects(snapshotWorkspace(cwd,backups,'test','worker',{maxBytes:10000,totalBytes:20000,extraPaths:['../outside']}),/inside/);
    assert.equal(inside(cwd,join(dir,'outside')),false);
    assert.equal(await readFile(join(cwd,'tracked.txt'),'utf8'),'work in progress');
  }finally{await rm(dir,{recursive:true,force:true});}
});
