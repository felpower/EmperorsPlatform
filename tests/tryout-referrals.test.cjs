const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const workflows=require('../src/modules/club-workflows');

test('referral rewards count joined people once and retain unsuccessful and pending registrations for context',()=>{
  const source=fs.readFileSync('app.bundle.js','utf8');
  const code=source.slice(source.indexOf('  function tryoutReferralStandings('),source.indexOf('  function renderTryoutReferralPeople('));
  const rows=[
    {firstName:'Joined',status:'joined',referredBy:'Captain'},
    {firstName:'Joined duplicate',status:'invited',referredBy:'Captain'},
    {firstName:'Not joined',status:'not_joined',referredBy:'Captain'},
    {firstName:'Upcoming tryout',status:'invited',referredBy:'Captain'},
    {firstName:'Exited',status:'archived',referredBy:'Captain'},
    {firstName:'General',status:'new',referredBy:'Instagram'}
  ];
  const groups=new Map(rows.map((row,index)=>[row,index===1?0:index]));
  const member={id:'captain',name:'Captain'};
  const ctx={normalizeLookupToken:s=>s.toLowerCase(),findTryoutReferralMember:s=>s==='Captain'?{member}:{},tryoutReferralMemberName:m=>m.name};
  vm.createContext(ctx);vm.runInContext(code,ctx);
  const result=ctx.tryoutReferralStandings(rows,{groupKeysByRow:groups});
  assert.equal(result.rows.length,1);
  const row=result.rows[0];
  assert.equal(row.referralCount,1);assert.equal(row.registeredCount,4);assert.equal(row.duplicateCount,1);
  assert.equal(row.referrals.find(x=>x.name==='Joined').status,'joined');
  assert.equal(result.generalSources[0].count,1);
  assert.equal(workflows.TRYOUT_STATUSES.find(x=>x.value==='not_joined').label,'Did not become a member');
});
