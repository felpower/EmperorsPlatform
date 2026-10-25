import {request,tryRequest,DATABASE_ID} from './lib/appwrite-admin.mjs';
const base=`/databases/${DATABASE_ID}/collections`;
let table=await tryRequest(`${base}/sepa_submissions`);
if(!table)table=await request(base,{method:'POST',body:{collectionId:'sepa_submissions',name:'SEPA submissions (private)',permissions:[],documentSecurity:false,enabled:true}});
for(const [key,size] of Object.entries({status:40,member_id:36,email_hash:64,submitted_at:32,fingerprint:64,payload:12000})){
  if(!table.attributes.some(attr=>attr.key===key))await request(`${base}/sepa_submissions/attributes/string`,{method:'POST',body:{key,size,required:false,array:false}});
}
const privateTable=await request(`${base}/member_private`);
if(!privateTable.attributes.some(attr=>attr.key==='account_holder'))await request(`${base}/member_private/attributes/string`,{method:'POST',body:{key:'account_holder',size:160,required:false,array:false}});
if(!privateTable.attributes.some(attr=>attr.key==='mandate_file_id'))await request(`${base}/member_private/attributes/string`,{method:'POST',body:{key:'mandate_file_id',size:36,required:false,array:false}});
for(let attempt=0;attempt<30;attempt++){
  const tables=await Promise.all([request(`${base}/sepa_submissions`),request(`${base}/member_private`)]);
  if(tables.some(t=>t.attributes.some(a=>a.status==='failed')))throw Error('SEPA schema creation failed.');
  if(tables.every(t=>t.attributes.every(a=>a.status==='available')))break;
  if(attempt===29)throw Error('Schema is still processing. Run setup again.');
  await new Promise(resolve=>setTimeout(resolve,1000));
}
const indexes=await request(`${base}/sepa_submissions/indexes`);
if(!indexes.indexes.some(index=>index.key==='email_created'))await request(`${base}/sepa_submissions/indexes`,{method:'POST',body:{key:'email_created',type:'key',attributes:['email_hash','$createdAt'],orders:['ASC','DESC'],lengths:[64,0]}});
console.log('Private SEPA collection and mandate file reference are ready.');
