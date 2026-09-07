import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
import {deflateSync,inflateSync} from 'node:zlib';
import {InputError} from './engine.js';

// A browser can hold these envelopes but cannot read or alter hidden scenario state.
// BACKUP_SECRET must stay stable across redeploys. Rotating it invalidates old backups.
export function checkpointCodec(secret){
 if(typeof secret!=='string'||secret.length<32)throw new Error('BACKUP_SECRET must contain at least 32 characters.');
 const key=createHash('sha256').update(secret).digest();
 return {
  encode(run,token){
   const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
   const payload=deflateSync(Buffer.from(JSON.stringify({version:1,run,token})));
   const ciphertext=Buffer.concat([cipher.update(payload),cipher.final()]);
   return ['v1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),ciphertext.toString('base64url')].join('.');
  },
  decode(envelope){
   try{
    if(typeof envelope!=='string'||envelope.length>2000000)throw new Error();
    const [version,iv,tag,data,...extra]=envelope.split('.');
    if(version!=='v1'||extra.length||!iv||!tag||!data)throw new Error();
    const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(iv,'base64url'));
    decipher.setAuthTag(Buffer.from(tag,'base64url'));
    const compressed=Buffer.concat([decipher.update(Buffer.from(data,'base64url')),decipher.final()]);
    const result=JSON.parse(inflateSync(compressed,{maxOutputLength:2000000}).toString('utf8'));
    if(result.version!==1||!result.run||!/^[a-f0-9]{32}$/.test(result.run.id)||!/^[a-f0-9]{64}$/.test(result.token))throw new Error();
    return result;
   }catch{throw new InputError('This backup cannot be restored. It may be damaged or use a previous backup key.',400);}
  }
 };
}
