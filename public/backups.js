// Only encrypted checkpoints live here. No answer keys or plaintext run internals.
let opening;
function database(){
 if(!opening)opening=new Promise((resolve,reject)=>{
  const request=indexedDB.open('flightlab-backups',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('attempts',{keyPath:'id'});
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(new Error('Browser backups are unavailable. Export your work before leaving.'));
 });
 return opening;
}
export async function saveBackup(record){
 if(!record?.id||!record?.checkpoint)return;
 const db=await database();
 await new Promise((resolve,reject)=>{
  const tx=db.transaction('attempts','readwrite');
  tx.objectStore('attempts').put({id:record.id,checkpoint:record.checkpoint,updatedAt:record.updatedAt});
  tx.oncomplete=resolve;
  tx.onerror=tx.onabort=()=>reject(new Error('The server saved your work, but browser backup failed. Export your work before leaving.'));
 });
}
export async function listBackups(){
 const db=await database();
 return new Promise((resolve,reject)=>{
  const request=db.transaction('attempts','readonly').objectStore('attempts').getAll();
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(new Error('Could not read your browser backups.'));
 });
}
