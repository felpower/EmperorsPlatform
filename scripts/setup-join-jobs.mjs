import {request,tryRequest,DATABASE_ID} from './lib/appwrite-admin.mjs';
const base=`/databases/${DATABASE_ID}/collections`,id='join_review_jobs';let table=await tryRequest(`${base}/${id}`);
if(!table)table=await request(base,{method:'POST',body:{collectionId:id,name:'Rookie review results (private)',permissions:[],documentSecurity:false,enabled:true}});
for(const [key,size] of Object.entries({requester_id:36,status:20,fingerprint:64,result:1000000}))if(!table.attributes.some(a=>a.key===key))await request(`${base}/${id}/attributes/string`,{method:'POST',body:{key,size,required:false,array:false}});
for(let attempt=0;attempt<30;attempt++){const t=await request(`${base}/${id}`);if(t.attributes.some(a=>a.status==='failed'))throw Error('Job schema failed.');if(t.attributes.every(a=>a.status==='available'))break;if(attempt===29)throw Error('Job schema still processing.');await new Promise(resolve=>setTimeout(resolve,1000));}
console.log('Private rookie review result storage ready.');
