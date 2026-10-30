import {request,tryRequest,DATABASE_ID} from './lib/appwrite-admin.mjs';
const base=`/databases/${DATABASE_ID}/collections`;
let table=await tryRequest(`${base}/join_submissions`);
if(!table)table=await request(base,{method:'POST',body:{collectionId:'join_submissions',name:'Rookie join registrations (private)',permissions:[],documentSecurity:false,enabled:true}});
for(const [key,size] of Object.entries({status:40,member_id:36,email_hash:64,submitted_at:32,fingerprint:64,payload:12000}))if(!table.attributes.some(a=>a.key===key))await request(`${base}/join_submissions/attributes/string`,{method:'POST',body:{key,size,required:false,array:false}});
for(let attempt=0;attempt<30;attempt++){
 const tables=await Promise.all([request(`${base}/join_submissions`)]);
 if(tables.some(t=>t.attributes.some(a=>a.status==='failed')))throw Error('Join schema creation failed.');
 if(tables.every(t=>t.attributes.every(a=>a.status==='available')))break;
 if(attempt===29)throw Error('Schema still processing. Run setup again.');
 await new Promise(resolve=>setTimeout(resolve,1000));
}
const indexes=await request(`${base}/join_submissions/indexes`);
for(const [key,attributes,orders,lengths] of [['email_created',['email_hash','$createdAt'],['ASC','DESC'],[64,0]],['status_count',['status'],['ASC'],[0]]])if(!indexes.indexes.some(i=>i.key===key))await request(`${base}/join_submissions/indexes`,{method:'POST',body:{key,type:'key',attributes,orders,lengths}});
console.log('Private rookie join registrations schema ready.');
