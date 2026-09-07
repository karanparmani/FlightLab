import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {createApp} from '../server.js';

test('API isolation, hidden state, validation, sandbox and durable restart',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'flightlab-test-'));let server=createApp({dataDir:dir});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let base=`http://127.0.0.1:${server.address().port}`;
 const a={cookie:''},b={cookie:''};
 async function req(path,{method='GET',body,client=a,origin=base}={}){const res=await fetch(base+path,{method,headers:{...(client.cookie?{Cookie:client.cookie}:{}),...(body?{'Content-Type':'application/json',Origin:origin}: {})},body:body?JSON.stringify(body):undefined});if(res.headers.get('set-cookie'))client.cookie=res.headers.get('set-cookie').split(';')[0];const text=await res.text();return{status:res.status,headers:res.headers,data:res.headers.get('content-type')?.includes('application/json')?JSON.parse(text):text};}
 try{
  assert.equal((await req('/health')).status,200);
  const page=await req('/');assert.equal(page.status,200);assert.ok(page.headers.get('content-security-policy').includes("script-src 'self'"));
  for(const path of ['/engine.js','/curriculum.js','/.env','/data/flightlab.sqlite'])assert.equal((await req(path)).status,404);
  assert.equal((await req('/api/catalog')).data.length,10);
  assert.equal((await req('/api/runs',{method:'POST',body:{moduleId:'apis'},origin:'https://evil.example'})).status,403);
  const made=await req('/api/runs',{method:'POST',body:{moduleId:'apis',seed:1}});assert.equal(made.status,201);const id=made.data.id;
  assert.equal(made.data.variant,undefined);assert.equal(made.data.review,undefined);
  assert.equal((await req(`/api/runs/${id}`,{client:b})).status,404);
  assert.equal((await req(`/api/runs/${id}/decision`,{client:b,method:'POST',body:{choice:0}})).status,404);
  assert.deepEqual((await req('/api/runs',{client:b})).data,[]);
  assert.equal((await req(`/api/runs/${id}/draft`,{method:'PUT',body:{rationale:'Saved reasoning that survives a restart of the application server.'}})).status,200);
  const post=body=>req(`/api/runs/${id}/sandbox`,{method:'POST',body:{method:'POST',amount:1200,key:'order-1',...body}});
  assert.equal((await post({timeout:true})).data.status,504);
  const retry=await post({});assert.equal(retry.data.status,200);assert.equal(retry.data.body.replayed,true);
  assert.equal((await post({amount:1300})).data.status,409);assert.equal((await post({amount:-1})).data.status,422);
  await new Promise(r=>server.close(r));server=createApp({dataDir:dir});await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;
  assert.equal((await req(`/api/runs/${id}`)).data.rationale,'Saved reasoning that survives a restart of the application server.');
  const concurrent=await Promise.all([req(`/api/runs/${id}/evidence`,{method:'POST',body:{source:'trace'}}),req(`/api/runs/${id}/evidence`,{method:'POST',body:{source:'analytics'}})]);assert.ok(concurrent.every(x=>x.status===200));assert.equal((await req(`/api/runs/${id}`)).data.budget,1);
  const decision={choice:0,rationale:'E1 and E2 support a durable idempotency key. I would verify duplicates and roll back if the outcome worsens.'};
  assert.equal((await req(`/api/runs/${id}/decision`,{method:'POST',body:decision})).status,200);
  assert.equal((await req(`/api/runs/${id}/decision`,{method:'POST',body:decision})).status,409);
  assert.equal((await req(`/api/runs/${id}/adapt`,{method:'POST',body:{choice:0,reflection:'Reconcile the duplicate callbacks and verify a regression test before extending the rollout.'}})).data.complete,true);
  const exported=await req(`/api/runs/${id}/export`);assert.equal(exported.data.schemaVersion,1);assert.ok(exported.data.attempt.review);
 }finally{await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});}
});
