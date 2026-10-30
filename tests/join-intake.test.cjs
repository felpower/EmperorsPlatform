const test=require('node:test'),assert=require('node:assert/strict');
const source=require('../appwrite/functions/shared/join-intake');
const context=body=>({req:{body,headers:{'x-appwrite-user-id':'finance-reviewer'}},res:{json:(payload,status=200)=>({...payload,httpStatus:status})}});
const id='jn_'+'b'.repeat(32);
const registration=()=>({first_name:'Test',last_name:'Player',email:'new-contact@example.invalid',phone:'+43 660 1234567',age:23,fee_period:source.periods()[0],transferred_on:source.rules.today(),amount_cents:5000,version:source.VERSION,membership_requested:true,transfer_confirmed:true,privacy_acknowledged:true});
test('rookie registration validates consent, age and an actual transfer without requiring SEPA or login',()=>{
 const input=registration(),data=source.validate({...input,iban:'must-not-be-stored',profile_id:'attacker',status:'approved'});assert.equal(data.email,input.email);assert.equal(data.amount_cents,5000);assert.equal(data.iban,undefined);assert.equal(data.profile_id,undefined);assert.equal(data.status,undefined);
 for(const invalid of [{age:''},{age:0},{age:101},{amount_cents:0},{amount_cents:50.5},{transfer_confirmed:false},{membership_requested:false},{privacy_acknowledged:false},{transferred_on:'2099-01-01'},{fee_period:'Q1_2020'}])assert.throws(()=>source.validate({...input,...invalid}));
 assert.deepEqual(source.periods('2027-01-10'),['Q4_2026','Q1_2027','Q2_2027']);
});
test('public contribution information uses configured rookie rates rather than a fixed fifty euros',async()=>{
 const join=require('../appwrite/functions/public/src/shared/join-intake'),sepa=require('../appwrite/functions/public/src/shared/sepa-intake');const oldList=sepa.list;
 sepa.list=async table=>{assert.equal(table,'fee_rates');return [{fee_period:'Q1_2020',normal_cents:9500,rookie_cents:6500}];};
 try{const result=await require('../appwrite/functions/public/src/tasks/joinSubmit')(context({action:'info'}));assert.equal(result.ok,true);assert.equal(result.offers.length,3);assert.ok(result.offers.every(x=>x.amountCents===6500));assert.equal(result.members,undefined);assert.equal(result.tryouts,undefined);}
 finally{sepa.list=oldList;}
});
test('public join submission is private and idempotent; it cannot mark payment, create members or expose tryout data',async()=>{
 const join=require('../appwrite/functions/public/src/shared/join-intake'),old={...join};let stored=null,writes=0;
 join.matchingMember=async()=> 'existing';join.offers=async()=>[{period:source.periods()[0],amountCents:5000}];join.list=async()=>[];
 join.checked=async(path,options={})=>{assert.match(path,/join_submissions/);if(!options.method){if(stored)return stored;throw Object.assign(Error('missing'),{status:404});}writes++;assert.equal(options.method,'POST');assert.deepEqual(options.body.permissions,[]);stored={$id:id,...options.body.data};return stored;};
 const file=require.resolve('../appwrite/functions/public/src/tasks/joinSubmit');delete require.cache[file];
 try{const task=require(file),body={submissionId:id,registration:registration()};const result=await task(context(body));assert.equal(result.ok,true);assert.equal(result.memberId,undefined);assert.equal(stored.status,'new');assert.equal(JSON.parse(stored.payload).expected_cents,5000);assert.equal((await task(context(body))).duplicate,true);assert.equal(writes,1);assert.equal((await task(context({...body,registration:{...registration(),last_name:'Changed'}}))).httpStatus,409);}
 finally{Object.assign(join,old);delete require.cache[file];}
});
async function fixture(extra={},failOnce=''){
 const join=require('../appwrite/functions/admin/src/shared/join-intake'),old={...join};
 const records=new Map(),writes=[];let failure=failOnce;
 const put=(table,row)=>records.set(table+'/'+row.$id,structuredClone(row));
 put('join_submissions',{$id:id,status:'new',member_id:null,payload:JSON.stringify({...registration(),expected_cents:5000}),submitted_at:new Date().toISOString()});
 put('tryout_registrations',{$id:'tryout',first_name:'Test',last_name:'Player',email:'different-old@example.invalid',phone:'old phone',age:22,status:'invited',contact_consent:true,preferred_position:'offense',referred_by:'referrer'});
 for(const [table,rows] of Object.entries(extra))for(const row of rows)put(table,row);
 join.list=async(table,queries=[])=>[...records.entries()].filter(([key])=>key.startsWith(table+'/')).map(([,v])=>structuredClone(v)).filter(v=>queries.every(q=>q.method!=='equal'||q.values.includes(v[q.attribute])));
 join.checked=async(path,options={})=>{
  assert.doesNotMatch(path,/\/users|\/account|messaging|mailgun/);
  const match=/\/collections\/([^/]+)\/documents(?:\/([^/?]+))?/.exec(path);assert.ok(match,path);const table=match[1];let recordId=match[2];
  if(!options.method){const row=records.get(table+'/'+recordId);if(!row)throw Object.assign(Error('missing'),{status:404});return structuredClone(row);}
  if(failure===table){failure='';throw Object.assign(Error('simulated write failure'),{status:503});}
  writes.push({table,method:options.method,data:structuredClone(options.body.data)});
  if(options.method==='POST'){recordId=options.body.documentId;if(records.has(table+'/'+recordId))throw Object.assign(Error('duplicate'),{status:409});put(table,{$id:recordId,...options.body.data});}
  else {assert.ok(records.has(table+'/'+recordId));put(table,{...records.get(table+'/'+recordId),...options.body.data});}
  return structuredClone(records.get(table+'/'+recordId));
 };
 const file=require.resolve('../appwrite/functions/admin/src/tasks/joinReview');delete require.cache[file];
 return {records,writes,task:require(file),restore(){Object.assign(join,old);delete require.cache[file];}};
}
const approve={action:'approve',submissionId:id,tryoutId:'tryout',paymentConfirmed:true,identityConfirmed:true};
test('verified rookie admission creates one member without auth, marks one contribution paid, and links tryout/referral history',async()=>{
 const f=await fixture();try{
  assert.equal((await f.task(context({...approve,paymentConfirmed:false}))).httpStatus,409);assert.equal(f.writes.length,0);
  const result=await f.task(context(approve));assert.equal(result.ok,true,result.error);
  const members=[...f.records.entries()].filter(([key])=>key.startsWith('members/')).map(([,v])=>v);assert.equal(members.length,1);const member=members[0];assert.equal(member.membership_status,'active');assert.equal(member.email,'new-contact@example.invalid');assert.equal(member.profile_id,undefined);assert.equal(member.iban,undefined);assert.equal(member.first_name,'Test');assert.equal(member.roles_json,'["player"]');
  const fees=[...f.records.entries()].filter(([key])=>key.startsWith('membership_fees/')).map(([,v])=>v);assert.equal(fees.length,1);assert.equal(fees[0].status,'paid_rookie_fee');assert.equal(fees[0].amount_cents,5000);assert.equal(fees[0].paid_cents,5000);
  const tryout=f.records.get('tryout_registrations/tryout');assert.equal(tryout.status,'joined');assert.equal(tryout.linked_member_id,member.$id);assert.equal(tryout.referred_by,'referrer');assert.equal(tryout.email,'different-old@example.invalid');assert.equal((await f.task(context(approve))).duplicate,true);
 }finally{f.restore();}
});
test('retry after a failed tryout link reuses the already-created member and paid fee',async()=>{
 const f=await fixture({},'tryout_registrations');try{const first=await f.task(context(approve));assert.equal(first.ok,false);assert.equal(f.records.get('join_submissions/'+id).status,'processing');const memberId=f.records.get('join_submissions/'+id).member_id;const second=await f.task(context(approve));assert.equal(second.ok,true,second.error);assert.equal(second.memberId,memberId);assert.equal([...f.records.keys()].filter(x=>x.startsWith('members/')).length,1);assert.equal([...f.records.keys()].filter(x=>x.startsWith('membership_fees/')).length,1);assert.equal(f.records.get('join_submissions/'+id).status,'approved');}finally{f.restore();}
});
test('existing membership, login linkage, bank details and phone survive rookie approval',async()=>{
 const f=await fixture({members:[{$id:'existing',first_name:'Test',last_name:'Player',email:'account@example.invalid',membership_status:'pending',roles_json:'["player"]',profile_id:'auth-existing',iban:'do-not-change'}],member_private:[{$id:'existing',member_id:'existing',iban:'private-bank-details',phone:'existing phone',notes:'Keep this note',mandate_date:'2020-01-01'}]});
 try{const result=await f.task(context({...approve,memberId:'existing'}));assert.equal(result.ok,true,result.error);const member=f.records.get('members/existing');assert.equal(member.profile_id,'auth-existing');assert.ok(Number.isInteger(member.rookie_season));assert.equal(member.email,'account@example.invalid');assert.equal(member.iban,'do-not-change');const extra=f.records.get('member_private/existing');assert.equal(extra.iban,'private-bank-details');assert.equal(extra.phone,'existing phone');assert.equal(extra.mandate_date,'2020-01-01');assert.match(extra.notes,/Keep this note/);assert.equal([...f.records.keys()].filter(x=>x.startsWith('members/')).length,1);}finally{f.restore();}
});
test('duplicate identity, exited members and existing full payments require manual resolution',async()=>{
 const member={$id:'existing',first_name:'Test',last_name:'Player',email:'old@example.invalid',membership_status:'active',roles_json:'["player"]'};
 for(const [extra,body] of [[{members:[member]},{...approve,tryoutId:'',memberId:''}],[{members:[{...member,membership_status:'exited'}]},{...approve,memberId:'existing'}],[{members:[member],membership_fees:[{$id:'fee',member_id:'existing',fee_period:source.periods()[0],amount_cents:9000,paid_cents:9000,status:'paid'}]},{...approve,memberId:'existing'}]]){
  const f=await fixture(extra);try{const result=await f.task(context(body));assert.equal(result.ok,false);assert.equal(result.httpStatus,409);assert.equal(f.writes.length,0);}finally{f.restore();}
 }
});
test('SEPA continuation keeps old confirmations valid and does not restart the joining date',()=>{
 const sepa=require('../appwrite/functions/shared/sepa-intake'),input={first_name:'Test',last_name:'Player',email:'test@example.invalid',account_holder:'Test',iban:'AT611904300234573201',joined_on:'2025-09',signed_on:'2026-10-01',confirm_signed:true,privacy_acknowledged:true,membership_confirmed:true};
 const old=sepa.validate({...input,membership_confirmation_version:'2026-10-29'});assert.match(old.membership_confirmation_text,/joining the Uni/);
 const current=sepa.validate({...input,membership_confirmation_version:'2026-10-30-continuation-v1'});assert.equal(current.joined_on,'2025-09-01');assert.match(current.membership_confirmation_text,/does not restart an existing membership/);
});
test('fully paid current rookie quarter defers missing-SEPA warnings, and ends automatically after that quarter',async()=>{
 const sepa=require('../appwrite/functions/admin/src/shared/sepa-intake'),join=require('../appwrite/functions/admin/src/shared/join-intake');const oldList=sepa.list,oldPeriods=join.periods;
 sepa.list=async table=>table==='members'?[{$id:'rookie',first_name:'Test',last_name:'Rookie',membership_status:'active',roles_json:'["player"]'}]:table==='membership_fees'?[{member_id:'rookie',fee_period:'Q4_2026',status:'paid_rookie_fee',amount_cents:5000,paid_cents:5000}]:[];
 try{join.periods=()=>['Q4_2026'];const task=require('../appwrite/functions/admin/src/tasks/sepaReview');assert.equal((await task(context({action:'overview'}))).members[0].sepaDeferred,true);join.periods=()=>['Q1_2027'];assert.equal((await task(context({action:'overview'}))).members[0].sepaDeferred,false);}finally{sepa.list=oldList;join.periods=oldPeriods;}
});
