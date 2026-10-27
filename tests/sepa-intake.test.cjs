const test=require('node:test'),assert=require('node:assert/strict');
const shared=require('../appwrite/functions/shared/sepa-intake');
const context=body=>({req:{body,headers:{'x-appwrite-user-id':'finance-user'}},res:{json:(payload,status=200)=>({...payload,httpStatus:status})}});
const registration={first_name:'Test',last_name:'Player',email:'different@example.invalid',account_holder:'Parent Test',iban:'AT61 1904 3002 3457 3201',joined_on:'2026-10-01',signed_on:'2026-10-24',confirm_signed:true,privacy_acknowledged:true};
test('mandate validation checks IBAN checksum, actual dates and explicit signed-document confirmation',()=>{
  assert.equal(shared.validate(registration).iban,'AT611904300234573201');
  assert.equal(shared.validIban('AT611904300234573202'),false);
  assert.equal(shared.validIban('US611904300234573201'),false);
  assert.throws(()=>shared.validate({...registration,signed_on:'2026-02-30'}),/valid.*dates/);
  assert.throws(()=>shared.validate({...registration,signed_on:'2099-01-01'}),/future/);
  assert.throws(()=>shared.validate({...registration,confirm_signed:false}),/confirm/);
  assert.equal(shared.nameKey('Théo','Mörkl'),shared.nameKey('THEO','MORKL'));
  assert.notEqual(shared.nameKey('Ann','Ab'),shared.nameKey('Anna','B'));
});
test('public intake creates a private document, matches by names and never writes member bank data',async()=>{
  const sepa=require('../appwrite/functions/public/src/shared/sepa-intake');
  const runtime=require('../appwrite/functions/public/src/shared/runtime');
  const old={...sepa},oldConfig=runtime.appwriteConfig,oldFetch=global.fetch;
  const id='sp_'+'a'.repeat(32),writes=[];let stored=null,uploads=0;
  sepa.matchingMember=async data=>{assert.equal(data.email,'different@example.invalid');return 'member';};
  sepa.list=async()=>[];
  sepa.checked=async(path,options={})=>{assert.ok(path.includes('sepa_submissions'));if(!options.method){if(stored)return stored;throw Object.assign(Error('Not found'),{status:404});}writes.push(options);if(options.method==='POST'){stored={$id:id,...options.body.data};assert.deepEqual(options.body.permissions,[]);}else Object.assign(stored,options.body.data);return stored;};
  runtime.appwriteConfig=()=>({endpoint:'https://example.invalid',projectId:'test',apiKey:'test'});
  global.fetch=async(url,options)=>{uploads++;assert.match(url,/\/storage\/buckets\/media\/files$/);assert.equal(options.method,'POST');assert.equal(options.body.get('fileId'),id);assert.equal(options.body.has('permissions[]'),false);return {ok:true,status:201};};
  const file=require.resolve('../appwrite/functions/public/src/tasks/sepaSubmit');delete require.cache[file];
  try{
    const task=require(file),body={submissionId:id,registration,pdfBase64:Buffer.from('%PDF-1.4\nTest only\n%%EOF').toString('base64')};
    const result=await task(context(body));assert.equal(result.ok,true);assert.equal(result.linked,true);assert.equal(stored.member_id,'member');assert.equal(stored.status,'new');assert.equal(uploads,1);
    assert.doesNotMatch(JSON.stringify(result),/different@example|AT6119|Parent Test/);
    const repeat=await task(context(body));assert.equal(repeat.duplicate,true);assert.equal(uploads,1);assert.equal(writes.length,2);
    const changed=await task(context({...body,registration:{...registration,first_name:'Other'}}));assert.equal(changed.httpStatus,409);
    const bad=await task(context({...body,pdfBase64:Buffer.from('<html>not a PDF</html>').toString('base64')}));assert.equal(bad.httpStatus,400);
  }finally{Object.assign(sepa,old);runtime.appwriteConfig=oldConfig;global.fetch=oldFetch;delete require.cache[file];}
});
test('finance approval applies a mandate to the explicitly selected member private row only',async()=>{
  const sepa=require('../appwrite/functions/admin/src/shared/sepa-intake');
  const old={...sepa},writes=[];const id='sp_'+'b'.repeat(32);
  sepa.checked=async(path,options={})=>{
    if(options.method){writes.push({path,options});return {};}
    if(path.includes('sepa_submissions'))return {$id:id,status:'new',member_id:'automatic-match',payload:JSON.stringify({...registration,iban:'AT611904300234573201',file_id:id})};
    if(path.includes('/members/'))return {$id:'selected-member',first_name:'Test',last_name:'Player'};
    throw Error('Unexpected read');
  };
  const file=require.resolve('../appwrite/functions/admin/src/tasks/sepaReview');delete require.cache[file];
  try{
    const task=require(file);const result=await task(context({action:'approve',submissionId:id,memberId:'selected-member'}));
    assert.equal(result.ok,true);assert.equal(writes.length,2);assert.match(writes[0].path,/member_private\/documents\/selected-member$/);
    assert.equal(writes[0].options.body.data.iban,'AT611904300234573201');assert.equal(writes[0].options.body.data.mandate_date,'2026-10-24');assert.equal(writes[0].options.body.data.mandate_file_id,id);
    assert.equal(writes[1].options.body.data.status,'approved');assert.equal(writes[1].options.body.data.member_id,'selected-member');assert.equal(JSON.parse(writes[1].options.body.data.payload).reviewed_by,'finance-user');
    assert.ok(writes.every(write=>!write.path.includes('membership_fees')&&!write.path.includes('/members/')));
  }finally{Object.assign(sepa,old);delete require.cache[file];}
});
test('SEPA review is restricted to finance and admins; public page needs no account or matching email',()=>{
  const fs=require('node:fs');assert.deepEqual(require('../appwrite/functions/admin/src/auth').DEFAULT_TASK_ROLES.sepaReview,['admin','finance_admin']);
  const page=fs.readFileSync('sepa.html','utf8');assert.match(page,/No account required/);assert.match(page,/does not need to match/);assert.doesNotMatch(page,/analytics|tracking|createAccount/);
  assert.match(fs.readFileSync('index.html','utf8'),/sepa-intake-ui\.js/);
});
test('SEPA XML uses the actual account holder and signature date from the approved mandate',async()=>{
  const oldEnv={...process.env};
  Object.assign(process.env,{APPWRITE_ENDPOINT:'https://example.invalid',APPWRITE_PROJECT_ID:'test',APPWRITE_API_KEY:'test',APPWRITE_DATABASE_ID:'test',SEPA_CREDITOR_NAME:'Test Club',SEPA_CREDITOR_IBAN:'AT611904300234573201',SEPA_CREDITOR_ID:'AT88EMP00000071393'});
  try{
    const exportTask=require('../appwrite/functions/admin/src/tasks/sepaExport');
    const result=await exportTask({...context({feePeriod:'Q4_2026',members:[{id:'member',firstName:'Test',lastName:'Player',iban:'AT611904300234573201',accountHolder:'Different Account Holder',mandateDate:'2026-10-24'}],fees:[{id:'fee',memberId:'member',feePeriod:'Q4_2026',amount:90,paidAmount:0,status:'pending'}]}),log(){}});
    assert.equal(result.ok,true,result.error);
    const xml=Buffer.from(result.xmlBase64,'base64').toString('utf8');
    assert.match(xml,/<Nm>Different Account Holder<\/Nm>/);assert.match(xml,/<DtOfSgntr>2026-10-24<\/DtOfSgntr>/);
    assert.equal(result.summary.estimatedMandateDates,0);assert.equal(result.preview.included[0].accountHolder,'Different Account Holder');
  }finally{for(const key of Object.keys(process.env))if(!(key in oldEnv))delete process.env[key];Object.assign(process.env,oldEnv);}
});

test('submission overview defaults to new uploads, sorts newest first and paginates ten at a time',()=>{
  const fs=require('node:fs'),vm=require('node:vm'),window={};
  vm.runInNewContext(fs.readFileSync('src/modules/sepa-intake-ui.js','utf8'),{window});
  const rows=Array.from({length:23},(_,i)=>({id:String(i),firstName:'Player',lastName:String(i),email:'contact@example.invalid',status:i<20?'new':'approved',submittedAt:`2026-10-${String(i+1).padStart(2,'0')}`}));
  const first=window.ClubHubModules.sepaIntake.submissionPage(rows);
  assert.equal(first.total,20);assert.equal(first.rows.length,10);assert.equal(first.rows[0].id,'19');assert.equal(first.pages,2);
  const second=window.ClubHubModules.sepaIntake.submissionPage(rows,{page:99});assert.equal(second.page,1);assert.equal(second.rows[0].id,'9');
  const approved=window.ClubHubModules.sepaIntake.submissionPage(rows,{status:'approved'});assert.equal(approved.total,3);
  assert.equal(window.ClubHubModules.sepaIntake.submissionPage(rows,{search:'not present'}).rows.length,0);
});
test('dashboard count reads only one ID and uses the server total for new submissions',async()=>{
  const sepa=require('../appwrite/functions/admin/src/shared/sepa-intake'),old=sepa.checked;
  sepa.checked=async path=>{
    const decoded=decodeURIComponent(path);assert.match(decoded,/"status"/);assert.match(decoded,/"new"/);assert.match(decoded,/"limit","values":\[1\]/);assert.match(decoded,/"select","values":\["\$id"\]/);
    return {total:234,documents:[{$id:'one'}]};
  };
  const file=require.resolve('../appwrite/functions/admin/src/tasks/sepaReview');delete require.cache[file];
  try{const result=await require(file)(context({action:'count'}));assert.equal(result.count,234);assert.equal(result.ok,true);assert.equal(result.members,undefined);}
  finally{sepa.checked=old;delete require.cache[file];}
});
test('PDF preview renders private bytes locally and cleans up the renderer and blob on close',async()=>{
  const fs=require('node:fs'),vm=require('node:vm');const source=fs.readFileSync('src/modules/sepa-intake-ui.js','utf8');
  const closeButton={},revoked=[],nodes={};let cleanup,renders=0,destroyed=0;
  const canvas={style:{},setAttribute(){},getContext:()=>({})};
  const content={querySelectorAll:()=>[],querySelector:selector=>selector==='canvas'?canvas:selector==='.sepa-pdf-pages'?{clientWidth:600}:(nodes[selector]||=( {} ))};
  const viewer={isConnected:false,set innerHTML(value){this.html=value;},querySelector:selector=>selector==='[data-preview-close]'?closeButton:content,addEventListener:(name,fn)=>{cleanup=fn;},showModal(){},close(){cleanup();},remove(){this.isConnected=false;}};
  const page={getViewport:({scale})=>({width:600*scale,height:800*scale}),render:()=>{renders++;return {promise:Promise.resolve(),cancel(){}};}};
  const ctx={escape:String,window:{devicePixelRatio:1},loadPdfRenderer:async()=>({getDocument:options=>{assert.equal(options.isEvalSupported,false);return {promise:Promise.resolve({numPages:1,getPage:async()=>page}),destroy:async()=>{destroyed++;}};}}),document:{createElement:()=>viewer,body:{append:()=>{viewer.isConnected=true;}}},URL:{createObjectURL:()=> 'blob:private-pdf',revokeObjectURL:url=>revoked.push(url)},Blob,Uint8Array,atob};
  const preview=vm.runInNewContext(source.slice(source.indexOf('  async function previewPdf'),source.indexOf('  async function open('))+';previewPdf',ctx);
  let calls=0;await preview({runAdminTask:async task=>{calls++;assert.equal(task.action,'download');return {pdfBase64:Buffer.from('%PDF-test').toString('base64')};}},{id:'private-id',firstName:'Test',lastName:'Player'});
  assert.equal(calls,1);assert.equal(renders,1);assert.ok(canvas.width>0);assert.match(content.innerHTML,/<canvas/);assert.doesNotMatch(content.innerHTML,/download=/);
  assert.match(nodes['[data-pdf-page]'].textContent,/Page 1 of 1/);
  closeButton.onclick();assert.deepEqual(revoked,['blob:private-pdf']);assert.equal(destroyed,1);
});
