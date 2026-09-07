import {randomBytes, randomInt} from 'node:crypto';
import {modules, sources, capstoneStages} from './curriculum.js';

export class InputError extends Error { constructor(message, status=400) {super(message);this.status=status;} }
export function createRun(moduleId, seed=randomInt(1,2147483646)) {
 const m=modules.find(x=>x.id===moduleId); if(!m) throw new InputError('Choose a valid track.');
 if(!Number.isSafeInteger(seed)||seed<1||seed>2147483646) throw new InputError('Seed must be between 1 and 2147483646.');
 // Mix the seed before selecting the hidden constraint profile.
 let n=seed|0;n^=n<<13;n^=n>>>17;n^=n<<5;
 return {id:randomBytes(16).toString('hex'),moduleId,seed,variant:(n>>>0)%2,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),stage:0,phase:'investigate',budget:5,evidence:[],artifact:Object.fromEntries(m.fields.map(f=>[f,''])),rationale:'',confidence:60,decisions:[],adaptations:[],stageScores:[],events:[],complete:false};
}
const definition = r=>modules.find(x=>x.id===r.moduleId);
const profile = r=>definition(r).profiles[r.variant];
function choices(r){return r.moduleId==='capstone'&&r.stage>0?capstoneStages[r.stage].options:definition(r).options;}
function answer(r){return r.moduleId==='capstone'&&r.stage>0?r.variant:profile(r).key;}
const adaptationOptions = [
 'Contain the affected path; reconcile state, add a regression check and verify recovery before expanding.',
 'Revisit the decision guardrails; segment affected users, constrain the rollout and validate the tradeoff before expanding.',
 'Keep the rollout unchanged; the headline improvement is sufficient.'
];
export function publicRun(r){
 const m=definition(r),p=profile(r);
 const view={id:r.id,moduleId:r.moduleId,title:m.title,company:m.company,brief:m.brief,seed:r.seed,stage:r.stage,stageCount:m.id==='capstone'?5:1,stageTitle:m.id==='capstone'?capstoneStages[r.stage].title:'Practice mission',prompt:m.id==='capstone'?capstoneStages[r.stage].prompt:'What should the team do first?',phase:r.phase,budget:r.budget,evidence:r.evidence,artifact:r.artifact,rationale:r.rationale,reflection:r.reflection||'',confidence:r.confidence,options:choices(r),events:r.events,complete:r.complete,updatedAt:r.updatedAt,decisions:r.decisions.map(d=>({choice:d.choice,label:d.label,rationale:d.rationale,confidence:d.confidence})),sources, rubric:m.rubric};
 if(r.phase==='adapt') {view.adaptationOptions=adaptationOptions;view.event=r.events.at(-1);}
 if(r.complete) view.review={score:Math.round(r.stageScores.reduce((a,s)=>a+s.total,0)/r.stageScores.length),scores:r.stageScores,truth:p.truth,feedback:m.rubric,decisions:r.decisions,adaptations:r.adaptations,calibration:'Confidence is recorded for reflection, not treated as a probability estimate of your PM ability.'};
 return view;
}
export function saveDraft(r,body){
 if(r.complete) throw new InputError('This attempt is complete. Start a replay to change your work.',409);
 if(body.artifact!==undefined){
 if(!body.artifact||typeof body.artifact!=='object'||Array.isArray(body.artifact)) throw new InputError('Invalid artifact.');
 for(const f of definition(r).fields){if(body.artifact[f]!==undefined){if(typeof body.artifact[f]!=='string'||body.artifact[f].length>12000)throw new InputError('Each artifact section must be at most 12,000 characters.');r.artifact[f]=body.artifact[f];}}
 }
 if(body.rationale!==undefined){if(typeof body.rationale!=='string'||body.rationale.length>8000)throw new InputError('Rationale must be at most 8,000 characters.');r.rationale=body.rationale;}
 if(body.confidence!==undefined){if(!Number.isInteger(body.confidence)||body.confidence<0||body.confidence>100)throw new InputError('Confidence must be 0–100.');r.confidence=body.confidence;}
 if(body.reflection!==undefined){if(typeof body.reflection!=='string'||body.reflection.length>8000)throw new InputError('Reflection must be at most 8,000 characters.');r.reflection=body.reflection;}
}
export function reveal(r,id){
 if(r.phase!=='investigate'||r.complete)throw new InputError('Investigation is closed for this stage.',409);
 const s=sources.find(s=>s.id===id);if(!s)throw new InputError('Unknown evidence source.');
 if(r.evidence.some(e=>e.source===id))return;
 if(r.budget<s.cost)throw new InputError('Not enough investigation credits.');
 const p=profile(r),content={analytics:p.data,support:p.people,trace:p.trace,constraints:p.constraint}[id];
 r.budget-=s.cost;r.evidence.push({id:`E${r.evidence.length+1}`,source:id,title:s.name,content});
}
export function decide(r,body){
 if(r.phase!=='investigate'||r.complete)throw new InputError('Decision already committed.',409);
 saveDraft(r,body);
 if(!Number.isInteger(body.choice)||!choices(r)[body.choice])throw new InputError('Choose a decision.');
 if(r.rationale.trim().length<60)throw new InputError('Explain your reasoning in at least 60 characters.');
 const correct=body.choice===answer(r),p=profile(r);
 r.decisions.push({stage:r.stage,choice:body.choice,label:choices(r)[body.choice],rationale:r.rationale,confidence:r.confidence,correct,expected:choices(r)[answer(r)],artifact:structuredClone(r.artifact)});
 r.phase='adapt';
 r.events.push({stage:r.stage,title:correct?'Field update · 48 hours later':'Escalation · 48 hours later',text:correct?p.risk:`The selected intervention leaves the core constraint unresolved. ${p.risk}`,previousDecision:choices(r)[body.choice]});
}
export function adapt(r,body){
 if(r.phase!=='adapt'||r.complete)throw new InputError('There is no pending update.',409);
 if(!Number.isInteger(body.choice)||!adaptationOptions[body.choice])throw new InputError('Choose a response.');
 if(typeof body.reflection!=='string'||body.reflection.trim().length<40||body.reflection.length>8000)throw new InputError('Explain your response in 40–8,000 characters.');
 const p=profile(r),d=r.decisions.at(-1);
 const cited=r.evidence.some(e=>new RegExp(`\\b${e.id}\\b`,'i').test(d.rationale));
 const investigation=(r.evidence.some(e=>e.source===p.source)?12:0)+(r.evidence.length>=2?8:0)+(cited?5:0);
 const decision=d.correct?35:body.choice===p.response?10:0;
 const adaptation=body.choice===p.response?20:body.choice===2?0:10;
 const filled=Object.values(d.artifact).filter(v=>v.trim().length>=60).length;
 const artifact=Math.round(20*filled/definition(r).fields.length);
 r.adaptations.push({stage:r.stage,choice:body.choice,label:adaptationOptions[body.choice],reflection:body.reflection});
 r.stageScores.push({stage:r.stage,title:r.moduleId==='capstone'?capstoneStages[r.stage].title:'Mission',investigation,decision,adaptation,artifact,total:investigation+decision+adaptation+artifact,notes:[r.evidence.some(e=>e.source===p.source)?'You inspected the decisive source.':`The ${sources.find(s=>s.id===p.source).name.toLowerCase()} contained the decisive clue.`,cited?'Your rationale references a collected evidence ID.':'Reference evidence IDs (for example E1) to make reasoning traceable.',d.correct?'Your decision fits the revealed constraints.':`Better-supported first move: ${d.expected}.`,body.choice===p.response?'Your response addresses the new risk.':'Compare your response with the new failure mode; a positive headline alone is insufficient.',`${filled}/${definition(r).fields.length} artifact sections have at least 60 characters. This checks completeness, not writing quality.`]});
 if(r.moduleId==='capstone'&&r.stage<4){r.stage++;r.phase='investigate';r.rationale='';r.reflection='';r.confidence=60;}
 else {r.complete=true;r.phase='review';}
}
export function catalog(){return modules.map(({id,title,short,company,fields})=>({id,title,short,company,fields,duration:id==='capstone'?'90–180 min':'20–40 min'}));}
