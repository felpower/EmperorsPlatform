import {request,DATABASE_ID} from './lib/appwrite-admin.mjs';
const path=`/databases/${DATABASE_ID}/collections/tryout_settings`;
const collection=await request(path);
for(const [key,size] of Object.entries({confirmation_subject:255,confirmation_body:12000}))if(!collection.attributes.some(row=>row.key===key))await request(`${path}/attributes/string`,{method:'POST',body:{key,size,required:false,array:false}});
for(let attempt=0;attempt<30;attempt++){
 const info=await request(path);if(info.attributes.some(row=>row.status==='failed'))throw Error('Template schema failed.');
 if(info.attributes.every(row=>row.status==='available'))break;
 if(attempt===29)throw Error('Schema still processing.');await new Promise(resolve=>setTimeout(resolve,1000));
}
console.log('Tryout confirmation email fields ready; existing text unchanged.');
