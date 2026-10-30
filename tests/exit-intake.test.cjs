const test=require('node:test'),assert=require('node:assert/strict');
const rules=require('../src/exit-rules');
const context=body=>({req:{body,headers:{'x-appwrite-user-id':'board-reviewer'}},res:{json:(payload,status=200)=>({...payload,httpStatus:status})}});
const id='ex_'+'a'.repeat(32);
test('club quarter boundaries and twelve-month review use effective date, including January',()=>{
 assert.equal(rules.quarterStart('Q4_2026'),'2026-11-01');
 assert.equal(rules.quarterStart('Q1_2027'),'2027-02-01');
 assert.equal(rules.quarterStart('Q0_2027'),'');
 assert.equal(rules.excluded('2026-11-01','Q3_2026'),false);
 assert.equal(rules.excluded('2026-11-01','Q4_2026'),true);
 assert.equal(rules.excluded('2026-11-01','Q1_2027'),true);
 assert.equal(rules.needsReview('2026-11-01','2027-10-31'),true);
 assert.equal(rules.needsReview('2026-11-01','2027-11-01'),false);
 assert.deepEqual(rules.nextBoundaries('2027-01-10',1),[{date:'2027-02-01',period:'Q1_2027'}]);
 assert.equal(rules.isBoundary('2026-01-01'),false);
});
test('anonymous exit validation refuses old or calendar-quarter dates and unconfirmed policy',()=>{
 const exit=require('../appwrite/functions/shared/exit-intake');
 const input={first_name:'Test',last_name:'Player',email:'OTHER@example.invalid',signed_on:rules.today(),effective_on:rules.nextBoundaries()[0].date,policy_version:rules.VERSION,confirm_signed:true,policy_acknowledged:true,privacy_acknowledged:true};
 assert.equal(exit.validate(input).policy_text,rules.POLICY);
 assert.equal(exit.validate(input).email,'other@example.invalid');
 assert.throws(()=>exit.validate({...input,effective_on:'2026-02-01'}));
 assert.throws(()=>exit.validate({...input,effective_on:'2099-01-01'}));
 assert.throws(()=>exit.validate({...input,signed_on:'2099-01-01'}));
 assert.throws(()=>exit.validate({...input,policy_acknowledged:false}));
 assert.throws(()=>exit.validate({...input,policy_version:'invented'}));
});
test('private exit upload is idempotent and never writes member status or bank data',async()=>{
 const exit=require('../appwrite/functions/public/src/shared/exit-intake'),runtime=require('../appwrite/functions/public/src/shared/runtime');
 const old={...exit},oldConfig=runtime.appwriteConfig,oldFetch=global.fetch;let stored=null,uploads=0;const writes=[];
 exit.matchingMember=async()=>null;exit.list=async()=>[];
 exit.checked=async(path,options={})=>{assert.match(path,/exit_submissions/);if(!options.method){if(stored)return stored;throw Object.assign(Error('missing'),{status:404});}writes.push(options.body);if(options.method==='POST'){assert.deepEqual(options.body.permissions,[]);stored={$id:id,...options.body.data};}else Object.assign(stored,options.body.data);return stored;};
 runtime.appwriteConfig=()=>({endpoint:'https://example.invalid',projectId:'test',apiKey:'test'});
 global.fetch=async()=>{uploads++;return {ok:true,status:201};};
 const file=require.resolve('../appwrite/functions/public/src/tasks/exitSubmit');delete require.cache[file];
 const registration={first_name:'Test',last_name:'Player',email:'other@example.invalid',signed_on:rules.today(),effective_on:rules.nextBoundaries()[0].date,policy_version:rules.VERSION,confirm_signed:true,policy_acknowledged:true,privacy_acknowledged:true};
 const body={submissionId:id,registration,pdfBase64:Buffer.from('%PDF-1.4\nfixture\n%%EOF').toString('base64')};
 try{const task=require(file);assert.equal((await task(context(body))).ok,true);assert.equal((await task(context(body))).duplicate,true);assert.equal(uploads,1);assert.equal(writes.length,2);assert.equal((await task(context({...body,registration:{...registration,last_name:'Changed'}}))).httpStatus,409);assert.equal(stored.status,'new');}
 finally{Object.assign(exit,old);runtime.appwriteConfig=oldConfig;global.fetch=oldFetch;delete require.cache[file];}
});
test('review schedules only the private date, preserves current status for future exits, and requires signed document check',async()=>{
 const exit=require('../appwrite/functions/admin/src/shared/exit-intake'),old={...exit},writes=[];
 const effective=rules.nextBoundaries()[0].date;
 const row={$id:id,status:'new',submitted_at:rules.today()+'T10:00:00Z',payload:JSON.stringify({effective_on:effective,file_id:id})};
 exit.list=async()=>[];
 exit.checked=async(path,options={})=>{if(options.method){writes.push({path,...options});return {};}if(path.includes('exit_submissions'))return row;if(path.includes('/members/'))return {$id:'member'};throw Error('Unexpected read');};
 const file=require.resolve('../appwrite/functions/admin/src/tasks/exitReview');delete require.cache[file];
 try{const task=require(file);assert.equal((await task(context({action:'approve',submissionId:id,memberId:'member',effectiveOn:effective}))).httpStatus,400);assert.equal(writes.length,0);assert.equal((await task(context({action:'approve',submissionId:id,memberId:'member',effectiveOn:effective,documentChecked:true}))).ok,true);assert.deepEqual(writes[0].body.data,{exit_effective_on:effective});assert.match(writes[0].path,/member_private/);assert.equal(writes.length,2);assert.equal(writes[1].body.data.status,'approved');}
 finally{Object.assign(exit,old);delete require.cache[file];}
});
test('early-return exemption saves board audit before reactivation and never creates fees',async()=>{
 const exit=require('../appwrite/functions/admin/src/shared/exit-intake'),old={...exit},writes=[];
 const row={$id:id,status:'approved',member_id:'member',payload:JSON.stringify({effective_on:'2026-02-01',file_id:id})};
 exit.checked=async(path,options={})=>{if(options.method){writes.push({path,...options});return {};}if(path.includes('exit_submissions'))return row;if(path.includes('member_private'))return {exit_effective_on:'2026-02-01'};if(path.includes('/members/'))return {$id:'member'};throw Error('Unexpected read');};
 const file=require.resolve('../appwrite/functions/admin/src/tasks/exitReview');delete require.cache[file];
 try{const task=require(file),body={action:'rejoin',submissionId:id,rejoinOn:'2026-10-01',decision:'waived',amountCents:0,note:'Board approved waiver for volunteer coaching',decisionConfirmed:true};assert.equal((await task(context({...body,decision:'not_required'}))).httpStatus,400);assert.equal(writes.length,0);assert.equal((await task(context(body))).ok,true);assert.equal(JSON.parse(writes[0].body.data.payload).rejoin_decision,'waived');assert.deepEqual(writes[1].body.data,{exit_effective_on:null});assert.deepEqual(writes[2].body.data,{membership_status:'active'});assert.equal(writes[3].body.data.status,'rejoined');assert.ok(writes.every(w=>!/membership_fees/.test(w.path)));}
 finally{Object.assign(exit,old);delete require.cache[file];}
});
test('new workflow is finance/admin-only and PDF template stays private until explicitly submitted',()=>{
 const fs=require('node:fs');assert.match(fs.readFileSync('appwrite/functions/admin/src/auth.js','utf8'),/exitReview: \["admin", "finance_admin"\]/);
 assert.match(fs.readFileSync('exit.html','utf8'),/noindex,nofollow/);
 assert.match(fs.readFileSync('exit.html','utf8'),/No account required/);
 assert.doesNotMatch(fs.readFileSync('exit.html','utf8'),/analytics|tracking|name="iban"/);
 assert.equal(fs.readFileSync('src/exit-rules.js','utf8'),fs.readFileSync('appwrite/functions/shared/exit-rules.js','utf8'));
});

test('authoritative XML exit check blocks already-created future rows while keeping earlier debts collectible',async()=>{
 const oldEnv={...process.env},oldFetch=global.fetch;
 Object.assign(process.env,{APPWRITE_ENDPOINT:'https://example.invalid',APPWRITE_PROJECT_ID:'test',APPWRITE_API_KEY:'test',APPWRITE_DATABASE_ID:'test',SEPA_CREDITOR_NAME:'Test Club',SEPA_CREDITOR_IBAN:'AT611904300234573201',SEPA_CREDITOR_ID:'AT88EMP00000071393'});
 global.fetch=async url=>({ok:true,json:async()=>decodeURIComponent(url).includes('exit_effective_on')?{documents:[{$id:'ended',exit_effective_on:'2026-11-01'}],total:1}:{documents:[],total:0}});
 try{
  const task=require('../appwrite/functions/admin/src/tasks/sepaExport');
  const members=[{id:'ended',name:'Ended Member',iban:'AT611904300234573201',mandateDate:'2026-01-01'},{id:'stays',name:'Staying Member',iban:'AT611904300234573201',mandateDate:'2026-01-01'}];
  const run=feePeriod=>task({...context({feePeriod,members,fees:members.map(m=>({id:'fee-'+m.id,memberId:m.id,feePeriod,amount:90,paidAmount:0,status:'pending'}))}),log(){}});
  const future=await run('Q4_2026');assert.equal(future.ok,true,future.error);assert.equal(future.summary.transactionCount,1);assert.ok(future.preview.skipped.some(x=>x.reason==='membership_ended_for_quarter'));
  const prior=await run('Q3_2026');assert.equal(prior.ok,true,prior.error);assert.equal(prior.summary.transactionCount,2);
 }finally{global.fetch=oldFetch;for(const key of Object.keys(process.env))if(!(key in oldEnv))delete process.env[key];Object.assign(process.env,oldEnv);}
});

test('grace period includes quarter opening and the entire first day of month two, then closes',()=>{
 for(const [start,deadline,closed] of [['2026-02-01','2026-03-01','2026-03-02'],['2026-05-01','2026-06-01','2026-06-02'],['2026-08-01','2026-09-01','2026-09-02'],['2026-11-01','2026-12-01','2026-12-02']]){
  assert.equal(rules.graceDeadline(start),deadline);assert.equal(rules.selectable(start,start),true);assert.equal(rules.selectable(start,deadline),true);assert.equal(rules.selectable(start,closed),false);
 }
 assert.equal(rules.selectable('2026-11-01','2026-11-30'),true);
 assert.equal(rules.selectable('2026-11-01','2027-01-01'),false);
 assert.equal(rules.selectable('2026-10-01','2026-10-15'),false);
 assert.equal(rules.receivedDate('2026-12-01T22:59:59Z'),'2026-12-01');
 assert.equal(rules.receivedDate('2026-12-01T23:00:00Z'),'2026-12-02');
 assert.equal(rules.nextBoundaries('2026-12-01')[0].date,'2026-11-01');
 assert.equal(rules.nextBoundaries('2026-12-02')[0].date,'2027-02-01');
 assert.equal(rules.nextBoundaries('2027-01-01')[0].date,'2027-02-01');
});
test('public validation applies the same grace deadline as the dropdown and stores the rule',()=>{
 const exit=require('../appwrite/functions/shared/exit-intake'),oldToday=exit.rules.today;
 const input={first_name:'Test',last_name:'Player',email:'test@example.invalid',signed_on:'2026-11-20',effective_on:'2026-11-01',policy_version:rules.VERSION,confirm_signed:true,policy_acknowledged:true,privacy_acknowledged:true};
 try{exit.rules.today=()=> '2026-12-01';const data=exit.validate(input);assert.equal(data.grace_deadline,'2026-12-01');assert.equal(data.grace_rule_version,'2026-10-30-v1');exit.rules.today=()=> '2026-12-02';assert.throws(()=>exit.validate(input),/available club quarter/);}
 finally{exit.rules.today=oldToday;}
});
test('delayed admin review uses Vienna receipt date, not review date, and rejects late receipt without writes',async()=>{
 const exit=require('../appwrite/functions/admin/src/shared/exit-intake'),old={...exit},oldToday=exit.rules.today,writes=[];
 let received='2026-12-01T22:59:59Z';exit.rules.today=()=> '2026-12-20';
 exit.list=async()=>[];
 exit.checked=async(path,options={})=>{if(options.method){writes.push({path,...options});return {};}if(path.includes('exit_submissions'))return {$id:id,status:'new',submitted_at:received,payload:JSON.stringify({effective_on:'2026-11-01',file_id:id})};if(path.includes('/members/'))return {$id:'member'};throw Error('Unexpected read');};
 const file=require.resolve('../appwrite/functions/admin/src/tasks/exitReview');delete require.cache[file];
 try{const task=require(file),body={action:'approve',submissionId:id,memberId:'member',effectiveOn:'2026-11-01',documentChecked:true};const good=await task(context(body));assert.equal(good.ok,true,good.error);assert.deepEqual(writes[0].body.data,{exit_effective_on:'2026-11-01'});assert.deepEqual(writes[1].body.data,{membership_status:'exited'});assert.equal(writes[2].body.data.status,'approved');writes.length=0;received='2026-12-01T23:00:00Z';assert.equal((await task(context(body))).httpStatus,400);assert.equal(writes.length,0);}
 finally{Object.assign(exit,old);exit.rules.today=oldToday;delete require.cache[file];}
});
