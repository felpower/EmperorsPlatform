const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const runtime = require('../appwrite/functions/admin/src/shared/runtime');
const context = body => ({ req:{ body, headers:{ 'x-appwrite-user-id':'caller' } }, res:{ json:(body,status=200)=>({...body,httpStatus:status}) } });
const result = (payload,status=200) => ({ response:{ ok:status<400,status }, payload });
async function stubTask(name, request, run) {
  const old = {...runtime};
  const file = require.resolve(`../appwrite/functions/admin/src/tasks/${name}`);
  runtime.appwriteConfig=()=>({databaseId:'db',membersCollectionId:'members'});
  runtime.appwriteRequest=request;
  delete require.cache[file];
  try { await run(require(file)); } finally { Object.assign(runtime,old); delete require.cache[file]; }
}
test('personal overview uses trusted caller and filters every private query to that member', async()=>{
  const calls=[];
  await stubTask('myOverview',async path=>{
    calls.push(path);
    if(path.includes('/members/')) return result({documents:[{$id:'own-member'}]});
    if(path.includes('/membership_fees/')) return result({documents:[{fee_period:'Q3_2026',status:'pending',amount_cents:8250,paid_cents:0,iban:'SECRET'}]});
    return result({documents:[{pass_status:'valid',expires_on:'2027-01-01',notes:'PRIVATE'}]});
  }, async task=>{
    const response=await task(context({memberId:'someone-else',userId:'someone-else'}));
    assert.equal(response.ok,true); assert.equal(response.fees[0].amount,82.5);
    assert.match(decodeURIComponent(calls[0]),/caller/);
    assert.ok(calls.slice(1).every(path=>decodeURIComponent(path).includes('own-member')));
    assert.doesNotMatch(JSON.stringify(response),/SECRET|PRIVATE|someone-else/);
  });
});
test('fee changes record authoritative before and after amounts without notes or bank details',async()=>{
  const writes=[]; const before={$id:'fee',member_id:'member',fee_period:'Q3_2026',status:'pending',amount_cents:8250,paid_cents:0};
  await stubTask('feeChange',async(path,options={})=>{
    if(path.startsWith('/users/'))return result({name:'Finance User'});
    if(options.method==='PATCH'){writes.push(options);return result({...before,...options.body.data});}
    if(options.method==='POST'){writes.push(options);return result({$id:'audit'});}
    return result(before);
  },async task=>{
    const response=await task(context({feeId:'fee',patch:{status:'paid',paid_cents:8250,iban:'SECRET',status_note:'PRIVATE'}}));
    assert.equal(response.ok,true);assert.equal(writes.length,2);
    const entry=writes[1].body.data;assert.equal(entry.user_id,'caller');
    assert.deepEqual(JSON.parse(entry.details).changes.paid_cents,{from:0,to:8250});
    assert.doesNotMatch(JSON.stringify(entry),/SECRET|PRIVATE/);
    const invalid=await task(context({feeId:'fee',patch:{amount_cents:-1}}));assert.equal(invalid.httpStatus,400);assert.equal(writes.length,2);
  });
});
test('a successful fee update and failed history write returns saved result with an explicit warning',async()=>{
  let updates=0;
  await stubTask('feeChange',async(path,options={})=>{
    if(path.startsWith('/users/'))return result({name:'Admin'});
    if(options.method==='PATCH'){updates++;return result({status:'paid',paid_cents:9000});}
    if(options.method==='POST')return result({message:'Unavailable'},503);
    return result({member_id:'member',status:'pending',paid_cents:0});
  },async task=>{
    const response=await task(context({feeId:'fee',patch:{status:'paid',paid_cents:9000}}));
    assert.equal(response.ok,true);assert.match(response.auditWarning,/saved.*history.*Do not repeat/);assert.equal(updates,1);
  });
});
test('delivery inspection only reads Mailgun and reports accepted separately from delivered',async()=>{
  const oldFetch=global.fetch; const oldKey=process.env.MAILGUN_API_KEY,oldDomain=process.env.MAILGUN_DOMAIN;
  process.env.MAILGUN_API_KEY='test';process.env.MAILGUN_DOMAIN='example.invalid';let lookups=0;
  global.fetch=async(url,options)=>{lookups++;assert.equal(options.method,undefined);assert.equal(new URL(url).searchParams.get('recipient'),'player@example.invalid');return {ok:true,json:async()=>({items:[{event:'accepted',timestamp:100},{event:'delivered',timestamp:101}]})};};
  try {
    await stubTask('tryoutDelivery',async()=>result({email:'player@example.invalid'}),async task=>{
      const response=await task(context({ids:['one']}));assert.equal(response.entries[0].events[0].event,'accepted');assert.equal(response.entries[0].events[1].event,'delivered');
      assert.equal((await task(context({ids:Array.from({length:21},(_,i)=>String(i))}))).httpStatus,400);assert.equal(lookups,1);
    });
  } finally {global.fetch=oldFetch;if(oldKey===undefined)delete process.env.MAILGUN_API_KEY;else process.env.MAILGUN_API_KEY=oldKey;if(oldDomain===undefined)delete process.env.MAILGUN_DOMAIN;else process.env.MAILGUN_DOMAIN=oldDomain;}
});
test('new task permissions distinguish personal data from finance and mail administration',()=>{
  const roles=require('../appwrite/functions/admin/src/auth').DEFAULT_TASK_ROLES;
  assert.deepEqual(roles.myOverview,['self']);assert.deepEqual(roles.feeChange,['admin','finance_admin']);assert.deepEqual(roles.tryoutDelivery,['admin','coach']);
});
test('SEPA generation prepares a reviewed snapshot and download refuses changed data',()=>{
  const source=fs.readFileSync('app.bundle.js','utf8');
  const generate=source.slice(source.indexOf('  async function exportSepaXmlViaFunction'),source.indexOf('  async function sendTryoutEmailsViaFunction'));
  assert.doesNotMatch(generate,/downloadBlobFile\(/);assert.match(generate,/reviewedSepaFile =/);
  assert.match(source,/reviewedSepaFile.snapshot !== JSON.stringify/);assert.match(source,/Download reviewed XML/);
});
