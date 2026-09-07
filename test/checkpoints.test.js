import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {checkpointCodec} from '../checkpoints.js';
import {createRun,reveal,decide} from '../engine.js';
import {createApp} from '../server.js';

test('encrypted checkpoints preserve hidden state and reject tampering or changed keys',()=>{
 const codec=checkpointCodec('testing-secret-'.repeat(4));
 const r=createRun('capstone',42);reveal(r,'support');
 const token='a'.repeat(64),envelope=codec.encode(r,token);
 assert.deepEqual(codec.decode(envelope),{version:1,run:r,token});
 assert.equal(envelope.includes('variant'),false);assert.equal(envelope.includes(token),false);
 const parts=envelope.split('.');parts[3]=(parts[3][0]==='A'?'B':'A')+parts[3].slice(1);
 assert.throws(()=>codec.decode(parts.join('.')),/cannot be restored/);
 assert.throws(()=>checkpointCodec('other-secret-'.repeat(4)).decode(envelope),/cannot be restored/);
 assert.throws(()=>codec.decode('v1.fake'),/cannot be restored/);
 assert.throws(()=>checkpointCodec('short'),/at least 32/);
});

test('full free-tier disk loss restores progress and identity; stale backups cannot rewind live state',async()=>{
 const first=mkdtempSync(join(tmpdir(),'flightlab-first-')),fresh=mkdtempSync(join(tmpdir(),'flightlab-fresh-'));
 const backupSecret='persistent-environment-key-'.repeat(3);
 let server,base,cookie='';
 const open=async dir=>{server=createApp({dataDir:dir,backupSecret,production:false,origin:''});await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;};
 const call=async(path,method='GET',body)=>{
  const response=await fetch(base+'/api'+path,{method,headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
  return {status:response.status,data:await response.json()};
 };
 try{
  await open(first);
  const made=await call('/runs','POST',{moduleId:'apis',seed:42}),id=made.data.id;
  const older=made.data.checkpoint;
  await call(`/runs/${id}/evidence`,'POST',{source:'trace'});
  const saved=await call(`/runs/${id}/draft`,'PUT',{rationale:'E1 shows a timeout with an unknown payment outcome. Verify the original result before any retry.'});
  const originalCookie=cookie;
  await new Promise(r=>server.close(r));await open(fresh);cookie='';
  assert.deepEqual((await call('/runs')).data,[]);
  const restored=await call('/restore','POST',{checkpoint:saved.data.checkpoint});
  assert.equal(restored.status,200);assert.equal(cookie,originalCookie);
  assert.equal(restored.data.evidence.length,1);assert.equal(restored.data.budget,3);
  assert.equal(restored.data.rationale,saved.data.rationale);
  assert.equal(restored.data.variant,undefined);assert.equal(restored.data.review,undefined);
  assert.equal((await call('/runs')).data.length,1);
  const oldReplay=await call('/restore','POST',{checkpoint:older});
  assert.equal(oldReplay.data.evidence.length,1);assert.equal(oldReplay.data.budget,3);
  assert.equal((await call('/restore','POST',{checkpoint:'forged'})).status,400);
  assert.equal((await call(`/runs/${id}`)).data.id,id);
 }finally{if(server?.listening)await new Promise(r=>server.close(r));for(const dir of [first,fresh])rmSync(dir,{recursive:true,force:true});}
});

test('production mode requires HTTPS origin and sets Secure cookies',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'flightlab-production-'));
 const server=createApp({dataDir:dir,production:true,origin:'https://flightlab.example',backupSecret:'production-test-only-secret-'.repeat(3)});
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${server.address().port}`;
  const request=origin=>fetch(base+'/api/runs',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({moduleId:'apis'})});
  const rejected=await request('http://flightlab.example');assert.equal(rejected.status,403);await rejected.text();
  const accepted=await request('https://flightlab.example');assert.equal(accepted.status,201);
  assert.match(accepted.headers.get('set-cookie'),/; Secure/);
  assert.match(accepted.headers.get('strict-transport-security'),/max-age/);
  assert.ok((await accepted.json()).checkpoint);
 }finally{await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});}
});
