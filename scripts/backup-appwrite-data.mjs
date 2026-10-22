// Manual, local snapshot for Free (Appwrite's scheduled backups are paid).
// Uses the current Windows user's DPAPI; keep this machine/account accessible.
// No credentials or personal records are printed or committed.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {request,listAll,PROJECT_ID,DATABASE_ID} from './lib/appwrite-admin.mjs';
const dir=path.resolve('migration-reports',`appwrite-snapshot-${new Date().toISOString().replace(/[:.]/g,'-')}`);
fs.mkdirSync(dir,{recursive:true});
const snapshot={projectId:PROJECT_ID,databaseId:DATABASE_ID,createdAt:new Date().toISOString(),collections:[],buckets:[],functions:[]};
for(const collection of await listAll(`/databases/${DATABASE_ID}/collections`,'collections')) {
  snapshot.collections.push({...collection,documents:await listAll(`/databases/${DATABASE_ID}/collections/${collection.$id}/documents`,'documents')});
}
let fileCount=0;
for(const bucket of await listAll('/storage/buckets','buckets')) {
  const files=await listAll(`/storage/buckets/${bucket.$id}/files`,'files');
  snapshot.buckets.push({...bucket,files});
  for(const file of files) {
    const bytes=Buffer.from(await(await request(`/storage/buckets/${bucket.$id}/files/${encodeURIComponent(file.$id)}/download`,{raw:true})).arrayBuffer());
    if(bytes.length!==file.sizeOriginal)throw Error('Incomplete file download; snapshot not complete.');
    const folder=path.join(dir,'files',bucket.$id);fs.mkdirSync(folder,{recursive:true});
    fs.writeFileSync(path.join(folder,file.$id),bytes);
    file.backupSha256=crypto.createHash('sha256').update(bytes).digest('hex');fileCount++;
  }
}
for(const fn of await listAll('/functions','functions'))snapshot.functions.push({...fn,variables:(await request(`/functions/${fn.$id}/variables`)).variables});
const encrypted=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','[void][Reflection.Assembly]::LoadWithPartialName("System.Security"); $backupBytes=[Convert]::FromBase64String([Console]::In.ReadToEnd()); [Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($backupBytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))'],{input:Buffer.from(JSON.stringify(snapshot),'utf8').toString('base64'),encoding:'utf8',maxBuffer:128*1024*1024});
fs.writeFileSync(path.join(dir,'snapshot.dpapi'),encrypted);
const recovered=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','[void][Reflection.Assembly]::LoadWithPartialName("System.Security"); $backupBytes=[Convert]::FromBase64String([Console]::In.ReadToEnd()); [Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Unprotect($backupBytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))'],{input:encrypted,encoding:'utf8',maxBuffer:128*1024*1024});
if(JSON.stringify(JSON.parse(Buffer.from(recovered.trim(),'base64').toString('utf8')))!==JSON.stringify(snapshot))throw Error('Snapshot encryption verification failed.');
const summary={createdAt:snapshot.createdAt,projectId:PROJECT_ID,collections:snapshot.collections.length,documents:snapshot.collections.reduce((n,x)=>n+x.documents.length,0),files:fileCount,functions:snapshot.functions.length,encryption:'Windows DPAPI CurrentUser',verified:true};
fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify({...summary,directory:dir},null,2));
