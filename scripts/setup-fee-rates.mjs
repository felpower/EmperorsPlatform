import {request,tryRequest,requireApiKey,DATABASE_ID,hasFlag} from './lib/appwrite-admin.mjs';
import rules from '../src/modules/club-workflows.js';
requireApiKey();
const base=`/databases/${DATABASE_ID}/collections`,dry=hasFlag('dry-run');
let info=await tryRequest(`${base}/fee_rates`);
if (!info) {
 if(dry){console.log('Would create admin-managed fee_rates with initial 82.50 / 50 and 90 / 50 schedules.');process.exit(0);}
 info=await request(base,{method:'POST',body:{collectionId:'fee_rates',name:'Contribution rates',documentSecurity:false,enabled:true,permissions:['read("users")','create("label:admin")','update("label:admin")','delete("label:admin")']}});
}
for(const key of ['fee_period','normal_cents','rookie_cents']) if(!info.attributes.some(a=>a.key===key)) {
 if(dry){console.log('Would add',key);continue;}
 await request(`${base}/fee_rates/attributes/${key==='fee_period'?'string':'integer'}`,{method:'POST',body:{key,required:true,array:false,...(key==='fee_period'?{size:16}:{min:1,max:1000000})}});
}
if(dry)process.exit(0);
for(let i=0;i<30;i++) {
 info=await request(`${base}/fee_rates`);
 if(info.attributes.some(a=>a.status==='failed'))throw Error('Attribute failed');
 if(info.attributes.every(a=>a.status==='available'))break;
 if(i===29)throw Error('Attributes not ready. Retry migration.');
 await new Promise(r=>setTimeout(r,1000));
}
for(const data of rules.DEFAULT_FEE_RATES)if(!await tryRequest(`${base}/fee_rates/documents/${data.fee_period}`))await request(`${base}/fee_rates/documents`,{method:'POST',body:{documentId:data.fee_period,data}});
console.log('Contribution settings ready; existing settings preserved.');
