// Final resource cleanup. Dry run by default; --apply verifies backups first.
// Never changes the subscription or touches members, payments or auth accounts.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {request,listAll,hasFlag,PROJECT_ID,writeReport} from './lib/appwrite-admin.mjs';

const APPLY=hasFlag('apply');
const OLD_FUNCTIONS=['CreateAuthAccount','PassSyncFunction','SepaExport','69fe0260003aa6db005b','ContactEmail','TryoutEmail'];
const OLD_BUCKETS=['ProfilePictures','equipment','teams','RosterPictures','hall_of_fame'];
const KEEP=['emperors-public','emperors-admin'];
const report={projectId:PROJECT_ID,createdAt:new Date().toISOString(),apply:APPLY,verifiedFiles:[],deleted:[],checks:{}};
const backup=path.resolve('migration-reports',`free-final-backup-${new Date().toISOString().replace(/[:.]/g,'-')}`);
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const loadConfig=source=>{const window={};vm.runInNewContext(source,{window});return window.ClubHubAppwriteConfig;};
const assert=(condition,message)=>{if(!condition)throw Error(message);};
const local=loadConfig(fs.readFileSync('src/appwrite-config.js','utf8'));
const live=loadConfig(await(await fetch('https://emperors.page/src/appwrite-config.js?verify='+Date.now())).text());
for(const config of [local,live]) {
  assert(config.projectId===PROJECT_ID,'Wrong project configuration.');
  assert(['inviteFunctionId','passSyncFunctionId','sepaExportFunctionId','tryoutEmailFunctionId'].every(k=>config[k]==='emperors-admin'),'Admin functions not switched.');
  assert(['contactFunctionId','diagnosticsFunctionId','publicFunctionId'].every(k=>config[k]==='emperors-public'),'Public functions not switched.');
  assert(['profilePicturesBucketId','rosterPicturesBucketId','equipmentPicturesBucketId','hallOfFamePicturesBucketId','teamsBucketId'].every(k=>config[k]==='media'),'Storage not switched.');
  assert(config.authEmailMode==='mailgun','Authentication still depends on paid custom SMTP.');
}
const functions=await listAll('/functions','functions');
const buckets=await listAll('/storage/buckets','buckets');
for(const id of KEEP) {
  const fn=functions.find(x=>x.$id===id);assert(fn?.enabled&&fn.deploymentId,`${id} has no active deployment.`);
  const deployment=await request(`/functions/${id}/deployments/${fn.deploymentId}`);
  assert(deployment.status==='ready',`${id} deployment is not ready.`);
  assert(!fn.schedule&&!fn.events?.length&&!fn.interval,`${id} has unreviewed background triggers.`);
  const vars=(await request(`/functions/${id}/variables`)).variables;
  const values=Object.fromEntries(vars.map(x=>[x.key,x.value]));
  for(const key of ['APPWRITE_API_KEY','APPWRITE_DATABASE_ID','MAILGUN_API_KEY','MAILGUN_DOMAIN','MAILGUN_FROM_EMAIL'])assert(values[key],`${id}: ${key} missing.`);
  assert(values.AUTH_EMAIL_MODE==='mailgun',`${id}: wrong auth email mode.`);
}
const legacyFunctions=functions.filter(x=>OLD_FUNCTIONS.includes(x.$id));
assert(functions.every(x=>KEEP.includes(x.$id)||OLD_FUNCTIONS.includes(x.$id)),'Unexpected function: manual review needed.');
assert(buckets.every(x=>x.$id==='media'||OLD_BUCKETS.includes(x.$id)),'Unexpected bucket: manual review needed.');
const target=buckets.find(x=>x.$id==='media');assert(target?.enabled&&target.fileSecurity,'Media bucket missing or security differs.');
const targetFiles=await listAll('/storage/buckets/media/files','files');
const targetById=new Map(targetFiles.map(x=>[x.$id,x]));
const manifest={functions:[],buckets:[],platforms:[]};
if(APPLY)fs.mkdirSync(backup,{recursive:true});
for(const bucket of buckets.filter(x=>OLD_BUCKETS.includes(x.$id))) {
  const files=await listAll(`/storage/buckets/${bucket.$id}/files`,'files');manifest.buckets.push({...bucket,files});
  for(const file of files) {
    const migrated=targetById.get(file.$id);assert(migrated&&migrated.sizeOriginal===file.sizeOriginal,`File missing or size mismatch: ${bucket.$id}/${file.$id}`);
    const read=async bucketId=>Buffer.from(await(await request(`/storage/buckets/${bucketId}/files/${encodeURIComponent(file.$id)}/download`,{raw:true})).arrayBuffer());
    const [source,copy]=await Promise.all([read(bucket.$id),read('media')]);
    assert(hash(source)===hash(copy),`File content differs: ${bucket.$id}/${file.$id}`);
    const effective=(permissions)=>new Set(permissions.filter(x=>/^(read|update|delete|write)\(/.test(x)).map(x=>x.replace(/\("any"\)$/,m=>/^(update|delete|write)\(/.test(x)?'("users")':m)));
    const oldPerms=effective([...(bucket.$permissions||[]),...(bucket.fileSecurity?file.$permissions||[]:[])]);
    const newPerms=effective([...(target.$permissions||[]),...(target.fileSecurity?migrated.$permissions||[]:[])]);
    assert([...oldPerms].every(p=>newPerms.has(p))&&[...newPerms].every(p=>oldPerms.has(p)),`File permissions differ: ${bucket.$id}/${file.$id}`);
    if(APPLY) {const folder=path.join(backup,'files',bucket.$id);fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,file.$id),source);}
    report.verifiedFiles.push({bucket:bucket.$id,id:file.$id,size:file.sizeOriginal,sha256:hash(source)});
  }
}
for(const fn of legacyFunctions) {
  assert(!fn.schedule&&!fn.events?.length&&!fn.interval,`${fn.$id} still has triggers.`);
  const variables=(await request(`/functions/${fn.$id}/variables`)).variables;
  assert(variables.every(x=>!x.secret||x.value),`${fn.$id}: cannot back up hidden variables.`);
  manifest.functions.push({...fn,variables});
  if(APPLY&&fn.deploymentId) {
    const bytes=Buffer.from(await(await request(`/functions/${fn.$id}/deployments/${fn.deploymentId}/download`,{raw:true})).arrayBuffer());
    assert(bytes.length>0,'Empty function source archive.');fs.writeFileSync(path.join(backup,fn.$id+'.tar.gz'),bytes);
  }
}
const platforms=await request(`/projects/${PROJECT_ID}/platforms`);
manifest.platforms=platforms.platforms;
const obsolete=platforms.platforms.filter(x=>x.hostname==='felpower.github.io');
const redirect=await fetch('https://felpower.github.io/EmperorsPlatform/',{redirect:'follow'});
assert(new URL(redirect.url).hostname==='emperors.page','Old GitHub URL does not redirect: keep platform.');
if(APPLY) {
  // DPAPI encrypts environment variables to the current Windows user, never stdout/logs.
  const encrypted=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','[void][Reflection.Assembly]::LoadWithPartialName("System.Security"); $backupBytes=[Convert]::FromBase64String([Console]::In.ReadToEnd()); [Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($backupBytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))'],{input:Buffer.from(JSON.stringify(manifest),'utf8').toString('base64'),encoding:'utf8',maxBuffer:16*1024*1024});
  fs.writeFileSync(path.join(backup,'manifest.dpapi'),encrypted);
  // Verify encryption can be reversed before deleting anything.
  const recovered=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','[void][Reflection.Assembly]::LoadWithPartialName("System.Security"); $backupBytes=[Convert]::FromBase64String([Console]::In.ReadToEnd()); [Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Unprotect($backupBytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))'],{input:encrypted,encoding:'utf8',maxBuffer:16*1024*1024});
  assert(JSON.stringify(JSON.parse(Buffer.from(recovered.trim(),'base64').toString('utf8')))===JSON.stringify(manifest),'Encrypted backup verification failed.');
  report.backup=backup;
  for(const fn of legacyFunctions){await request(`/functions/${fn.$id}`,{method:'DELETE'});report.deleted.push({type:'function',id:fn.$id});}
  for(const bucket of manifest.buckets){await request(`/storage/buckets/${bucket.$id}`,{method:'DELETE'});report.deleted.push({type:'bucket',id:bucket.$id});}
  for(const platform of obsolete){await request(`/projects/${PROJECT_ID}/platforms/${platform.$id}`,{method:'DELETE'});report.deleted.push({type:'platform',id:platform.$id});}
}
report.checks={functionsToRemove:legacyFunctions.length,bucketsToRemove:manifest.buckets.length,filesVerified:report.verifiedFiles.length,platformsToRemove:obsolete.length,liveConfigVerified:true};
console.log(JSON.stringify({apply:APPLY,...report.checks,deleted:report.deleted,backup:report.backup,report:writeReport('free-finalization',report)},null,2));
