import http from 'node:http';
import {readFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createRun,publicRun,saveDraft,reveal,decide,adapt,catalog,InputError} from './engine.js';
import {checkpointCodec} from './checkpoints.js';

const root=dirname(fileURLToPath(import.meta.url));
export function createApp({dataDir=process.env.DATA_DIR||join(root,'data'),production=process.env.NODE_ENV==='production',origin=process.env.APP_ORIGIN||'',backupSecret=process.env.BACKUP_SECRET}={}){
 mkdirSync(dataDir,{recursive:true});
 if(!backupSecret){
  if(production)throw new Error('Set BACKUP_SECRET before starting in production.');
  const keyFile=join(dataDir,'backup-key');
  if(!existsSync(keyFile))writeFileSync(keyFile,randomBytes(32).toString('hex'),{mode:0o600});
  backupSecret=readFileSync(keyFile,'utf8');
 }
 const checkpoints=checkpointCodec(backupSecret);
 const db=new DatabaseSync(join(dataDir,'flightlab.sqlite'));
 db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, created INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES sessions(id), body TEXT NOT NULL); CREATE INDEX IF NOT EXISTS runs_owner ON runs(owner);');
 const rates=new Map();
 const cleanup=setInterval(()=>{for(const[k,v]of rates)if(Date.now()-v.time>60000)rates.delete(k);},60000);cleanup.unref();
 const send=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  res.setHeader('Cache-Control','no-store');
  if(production)res.setHeader('Strict-Transport-Security','max-age=31536000');
  try{
   const url=new URL(req.url,'http://localhost');
   if(url.pathname==='/health'){send(res,200,{status:'ok'});return;}
   if(!url.pathname.startsWith('/api/')){
    if(req.method!=='GET'&&req.method!=='HEAD')throw new InputError('Method not allowed.',405);
    const files={'/':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/backups.js':['backups.js','text/javascript'],'/style.css':['style.css','text/css'],'/favicon.svg':['favicon.svg','image/svg+xml']};
    const f=files[url.pathname];if(!f)throw new InputError('Not found.',404);
    res.writeHead(200,{'Content-Type':`${f[1]}; charset=utf-8`});res.end(req.method==='HEAD'?undefined:readFileSync(join(root,'public',f[0])));return;
   }
   const ip=req.socket.remoteAddress||'local';const rate=rates.get(ip)||{time:Date.now(),count:0};if(Date.now()-rate.time>60000){rate.time=Date.now();rate.count=0;}rate.count++;rates.set(ip,rate);if(rate.count>600)throw new InputError('Too many requests. Try again in a minute.',429);
   if(!['GET','POST','PUT'].includes(req.method))throw new InputError('Method not allowed.',405);
   if(req.method!=='GET'){
    const expected=origin||`${production?'https':'http'}://${req.headers.host}`;
    if(req.headers.origin!==expected)throw new InputError('Request origin rejected.',403);
    if(!String(req.headers['content-type']).startsWith('application/json'))throw new InputError('JSON required.',415);
   }
   let token=String(req.headers.cookie||'').match(/(?:^|;\s*)flightlab=([a-f0-9]{64})(?:;|$)/)?.[1];
   let owner=token?createHash('sha256').update(token).digest('hex'):null;
   const session=owner?db.prepare('SELECT created FROM sessions WHERE id=?').get(owner):null;
   if(!session||Date.now()-session.created>180*86400000){token=randomBytes(32).toString('hex');owner=createHash('sha256').update(token).digest('hex');db.prepare('INSERT INTO sessions VALUES (?,?)').run(owner,Date.now());res.setHeader('Set-Cookie',`flightlab=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=15552000${production?'; Secure':''}`);}
   let body={};if(req.method!=='GET'){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>(url.pathname==='/api/restore'?2100000:100000))throw new InputError('Request too large.',413);}try{body=JSON.parse(raw||'{}');}catch{throw new InputError('Invalid JSON.');}if(!body||typeof body!=='object'||Array.isArray(body))throw new InputError('JSON object required.');}
   const present=r=>({...publicRun(r),checkpoint:checkpoints.encode(r,token)});
   if(url.pathname==='/api/restore'&&req.method==='POST'){
    const restored=checkpoints.decode(body.checkpoint),r=restored.run;
    token=restored.token;owner=createHash('sha256').update(token).digest('hex');
    const current=db.prepare('SELECT owner,body FROM runs WHERE id=?').get(r.id);
    if(current&&current.owner!==owner)throw new InputError('Backup ownership does not match this attempt.',409);
    db.prepare('INSERT INTO sessions VALUES (?,?) ON CONFLICT(id) DO UPDATE SET created=excluded.created').run(owner,Date.now());
    // Existing server progress wins: replaying an older envelope cannot rewind it.
    if(!current){
     if(db.prepare('SELECT count(*) AS n FROM runs WHERE owner=?').get(owner).n>=500)throw new InputError('Profile attempt limit reached.',409);
     db.prepare('INSERT INTO runs VALUES (?,?,?)').run(r.id,owner,JSON.stringify(r));
    }
    res.setHeader('Set-Cookie',`flightlab=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=15552000${production?'; Secure':''}`);
    send(res,200,present(current?JSON.parse(current.body):r));return;
   }
   if(url.pathname==='/api/catalog'&&req.method==='GET'){send(res,200,catalog());return;}
   if(url.pathname==='/api/runs'&&req.method==='GET'){const rows=db.prepare('SELECT body FROM runs WHERE owner=? ORDER BY rowid DESC').all(owner);send(res,200,rows.map(x=>{const r=JSON.parse(x.body);return{id:r.id,moduleId:r.moduleId,complete:r.complete,stage:r.stage,updatedAt:r.updatedAt,seed:r.seed,score:r.complete?publicRun(r).review.score:null};}));return;}
   if(url.pathname==='/api/runs'&&req.method==='POST'){
    if(db.prepare('SELECT count(*) AS n FROM runs WHERE owner=?').get(owner).n>=500)throw new InputError('This profile has reached 500 attempts. Export your work before starting a new browser profile.',409);
    const r=createRun(body.moduleId,body.seed);db.prepare('INSERT INTO runs VALUES (?,?,?)').run(r.id,owner,JSON.stringify(r));send(res,201,present(r));return;
   }
   const match=url.pathname.match(/^\/api\/runs\/([a-f0-9]{32})(?:\/(draft|evidence|decision|adapt|export|sandbox))?$/);
   if(!match)throw new InputError('Not found.',404);
   const row=db.prepare('SELECT body FROM runs WHERE id=? AND owner=?').get(match[1],owner);if(!row)throw new InputError('Attempt not found.',404);
   const r=JSON.parse(row.body),action=match[2];
   if(!action&&req.method==='GET'){send(res,200,present(r));return;}
   if(action==='export'&&req.method==='GET'){send(res,200,{schemaVersion:1,exportedAt:new Date().toISOString(),attempt:present(r)});return;}
   if(action==='sandbox'&&req.method==='POST'){
    if(!['GET','POST'].includes(body.method))throw new InputError('Choose GET or POST.');
    if(body.method==='GET'){send(res,200,{simulated:true,status:200,body:{paymentId:'pay_demo',status:r.variant?'pending':'captured',note:'Training data only; no provider was contacted.'}});return;}
    if(!Number.isInteger(body.amount)||body.amount<=0||body.amount>1000000){send(res,200,{simulated:true,status:422,body:{error:'amount must be integer minor units between 1 and 1000000'}});return;}
    if(typeof body.key!=='string'||body.key.length>100)throw new InputError('Idempotency key must be at most 100 characters.');
    r.sandbox??={};const key=body.key||randomBytes(8).toString('hex');const old=r.sandbox[key];
    if(Object.keys(r.sandbox).length>=100&&!old)throw new InputError('Sandbox limit reached for this attempt.');
    if(old&&old.amount!==body.amount){send(res,200,{simulated:true,status:409,body:{error:'Idempotency key reused with a different amount'}});return;}
    const value=old||{paymentId:`pay_${randomBytes(4).toString('hex')}`,amount:body.amount,status:'captured'};r.sandbox[key]=value;db.prepare('UPDATE runs SET body=? WHERE id=? AND owner=?').run(JSON.stringify(r),r.id,owner);
    send(res,200,{simulated:true,checkpoint:checkpoints.encode(r,token),id:r.id,updatedAt:r.updatedAt,status:body.timeout?504:old?200:201,body:body.timeout?{error:'Response timed out; capture outcome unknown. Retry with the same key.'}:{...value,replayed:!!old}});return;
   }
   if(action==='draft'&&req.method==='PUT')saveDraft(r,body);
   else if(action==='evidence'&&req.method==='POST')reveal(r,body.source);
   else if(action==='decision'&&req.method==='POST')decide(r,body);
   else if(action==='adapt'&&req.method==='POST')adapt(r,body);
   else throw new InputError('Method not allowed.',405);
   r.updatedAt=new Date().toISOString();db.prepare('UPDATE runs SET body=? WHERE id=? AND owner=?').run(JSON.stringify(r),r.id,owner);send(res,200,present(r));
  }catch(err){send(res,err.status||500,{error:err.status?err.message:'An unexpected error occurred. Your last saved work is preserved.'});if(!err.status)console.error(err);}
 });
 server.on('close',()=>{clearInterval(cleanup);db.close();});return server;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const port=Number(process.env.PORT)||3000;const server=createApp();server.listen(port,'0.0.0.0',()=>console.log(`Flightlab ready at http://localhost:${port}`));
 for(const s of ['SIGTERM','SIGINT'])process.on(s,()=>server.close(()=>process.exit(0)));
}
