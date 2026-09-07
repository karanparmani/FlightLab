import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,publicRun,reveal,decide,adapt,saveDraft} from '../engine.js';
import {modules} from '../curriculum.js';
const reason='E1 and E2 provide independent evidence for this choice. I would reverse it if the observed constraint changes in a controlled pilot.';
const reflection='Contain the new failure, verify the affected cohort, and track the recovery against an explicit rollout gate.';
function fill(r){saveDraft(r,{artifact:Object.fromEntries(Object.keys(r.artifact).map(k=>[k,'Describe a concrete journey with an accountable owner, measurable acceptance criteria and an explicit failure recovery path.']))});}
test('all ten tracks and both hidden profiles can complete with bounded scores',()=>{
 assert.equal(modules.length,10);
 for(const m of modules)for(const variant of [0,1]){
  const r=createRun(m.id);r.variant=variant;const p=m.profiles[variant];
  reveal(r,p.source);reveal(r,['analytics','support','trace'].find(s=>s!==p.source));fill(r);
  const count=m.id==='capstone'?5:1;
  for(let stage=0;stage<count;stage++){
   decide(r,{choice:m.id==='capstone'&&stage>0?variant:p.key,rationale:reason});
   assert.equal(publicRun(r).review,undefined);
   adapt(r,{choice:p.response,reflection});
  }
  assert.equal(r.complete,true);assert.equal(publicRun(r).review.score,100);
 }
});
test('public views do not leak unrevealed facts, answer keys or interim grades',()=>{
 const r=createRun('apis',5);const p=modules.find(m=>m.id==='apis').profiles[r.variant];
 for(const phase of ['investigate','adapt']){
  if(phase==='adapt')decide(r,{choice:0,rationale:reason});
  const v=publicRun(r),json=JSON.stringify(v);
  for(const key of ['variant','correct','expected','stageScores','truth','profiles','sandbox'])assert.equal(Object.hasOwn(v,key),false);
  assert.equal(json.includes(p.truth),false);assert.equal(json.includes(p.trace),false);
  assert.ok(v.decisions.every(d=>!Object.hasOwn(d,'correct')&&!Object.hasOwn(d,'expected')));
 }
});
test('evidence is idempotent, budgeted and unavailable after commitment',()=>{
 const r=createRun('blueprint',1);reveal(r,'trace');reveal(r,'trace');assert.equal(r.budget,3);assert.equal(r.evidence.length,1);
 reveal(r,'analytics');assert.throws(()=>reveal(r,'support'),/credits/);reveal(r,'constraints');assert.equal(r.budget,0);
 decide(r,{choice:1,rationale:reason});assert.throws(()=>reveal(r,'support'),/closed/);
});
test('phase transitions reject duplicate or premature submission; snapshots are immutable',()=>{
 const r=createRun('prd',1);assert.throws(()=>adapt(r,{choice:0,reflection}),/pending/);
 fill(r);decide(r,{choice:0,rationale:reason});const snapshot=structuredClone(r.decisions[0].artifact);
 assert.throws(()=>decide(r,{choice:1,rationale:reason}),/committed/);
 saveDraft(r,{artifact:{[Object.keys(r.artifact)[0]]:'Different later revision'}});
 assert.deepEqual(r.decisions[0].artifact,snapshot);adapt(r,{choice:0,reflection});
 assert.throws(()=>saveDraft(r,{rationale:reason}),/complete/);assert.throws(()=>adapt(r,{choice:0,reflection}),/pending/);
});
test('different profiles change the recommended first move; seeded generation is reproducible',()=>{
 for(const m of modules)assert.notEqual(m.profiles[0].key,m.profiles[1].key);
 assert.equal(createRun('apis',491).variant,createRun('apis',491).variant);
 assert.equal(new Set(Array.from({length:20},(_,i)=>createRun('apis',i+1).variant)).size,2);
});
test('weak submissions cannot receive maximum scores and invalid inputs fail',()=>{
 const r=createRun('quality',1);assert.throws(()=>decide(r,{choice:0,rationale:'short'}),/60/);
 assert.throws(()=>saveDraft(r,{confidence:101}),/0–100/);assert.throws(()=>createRun('missing'),/valid/);assert.throws(()=>createRun('apis',-1),/Seed/);
 decide(r,{choice:2,rationale:reason});adapt(r,{choice:2,reflection});assert.equal(publicRun(r).review.score,0);
});
