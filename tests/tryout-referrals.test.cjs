const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const workflows=require('../src/modules/club-workflows');

test('referral rewards count joined people once and retain unsuccessful and pending registrations for context',()=>{
  const source=fs.readFileSync('app.bundle.js','utf8');
  const code=source.slice(source.indexOf('  function tryoutReferralStandings('),source.indexOf('  function renderTryoutReferralPeople('));
  const rows=[
    {firstName:'Joined',status:'joined',linkedMemberId:'joined',referredBy:'Captain'},
    {firstName:'Joined duplicate',status:'invited',referredBy:'Captain'},
    {firstName:'Not joined',status:'not_joined',referredBy:'Captain'},
    {firstName:'Upcoming tryout',status:'invited',referredBy:'Captain'},
    {firstName:'Exited',status:'archived',referredBy:'Captain'},
    {firstName:'General',status:'new',referredBy:'Instagram'}
  ];
  const groups=new Map(rows.map((row,index)=>[row,index===1?0:index]));
  const member={id:'captain',name:'Captain'};
  const fees=['Q3_2026','Q4_2026'].map(feePeriod=>({memberId:'joined',feePeriod,amount:90,paidAmount:90,status:'paid'}));
  const ctx={workflows,currentAccessRole:'admin',state:{fees,members:[{id:'joined',membershipStatus:'active'}]},normalizeLookupToken:s=>s.toLowerCase(),findTryoutReferralMember:s=>s==='Captain'?{member}:{},tryoutReferralMemberName:m=>m.name};
  vm.createContext(ctx);vm.runInContext(code,ctx);
  const result=ctx.tryoutReferralStandings(rows,{groupKeysByRow:groups});
  assert.equal(result.rows.length,1);
  const row=result.rows[0];
  assert.equal(row.referralCount,1);assert.equal(row.registeredCount,4);assert.equal(row.duplicateCount,1);
  assert.equal(row.referrals.find(x=>x.name==='Joined').status,'joined');
  assert.equal(result.generalSources[0].count,1);
  ctx.state.members[0].membershipStatus='exited';
  const exited=ctx.tryoutReferralStandings(rows,{groupKeysByRow:groups});
  assert.equal(exited.rows[0].referralCount,1);
  assert.equal(exited.rows[0].referrals.find(x=>x.name==='Joined').exclusionReason,'');
  assert.equal(rows[0].status,'joined');
  ctx.state.members[0].membershipStatus='active';
  assert.equal(ctx.tryoutReferralStandings(rows,{groupKeysByRow:groups}).rows[0].referralCount,1);
  for(const status of ['inactive','pending']) {
    ctx.state.members[0].membershipStatus=status;
    assert.equal(ctx.tryoutReferralStandings(rows,{groupKeysByRow:groups}).rows[0].referralCount,1);
  }
  ctx.state.members[0].membershipStatus='active';ctx.state.members[0].deletedAt='2026-10-21';
  assert.equal(ctx.tryoutReferralStandings(rows,{groupKeysByRow:groups}).rows[0].referralCount,1);
  ctx.state.fees=fees.slice(0,1);
  assert.equal(ctx.tryoutReferralStandings(rows,{groupKeysByRow:groups}).rows[0].referralCount,0);
  ctx.state.fees=fees;ctx.currentAccessRole='coach';
  const unavailable=ctx.tryoutReferralStandings(rows,{groupKeysByRow:groups});
  assert.equal(unavailable.paymentsAvailable,false);assert.equal(unavailable.rows[0].referralCount,0);
  assert.equal(workflows.TRYOUT_STATUSES.find(x=>x.value==='not_joined').label,'Did not become a member');
});


test('two different fully paid positive quarters qualify, excluding rookie fees, independent of later exit',()=>{
  const fee=(patch={})=>({memberId:'player',feePeriod:'Q3_2026',amount:90,paidAmount:90,status:'paid',...patch});
  const rows=[fee(),fee(),fee({feePeriod:'Q4_2026',amount:100,paidAmount:100,status:'paid_with_fee'}),
    fee({feePeriod:'Q1_2026'}),fee({feePeriod:'Q2_2027',status:'partial',paidAmount:25}),
    fee({feePeriod:'Q3_2027',amount:0,paidAmount:0,status:'exempt'}),fee({memberId:'other',feePeriod:'Q1_2027'}),
    fee({feePeriod:'invalid'}),fee({feePeriod:'Q1_2027',status:'paid_rookie_fee',amount:50,paidAmount:50}),
    fee({feePeriod:'Q4_2027',status:'paid_with_fee',amount:100,paidAmount:90})];
  assert.deepEqual(workflows.referralPaidQuarters('player',rows,'2026-09-01T19:30:00+02:00'),['Q3_2026','Q4_2026']);
  assert.deepEqual(workflows.referralPaidQuarters('player',rows,'2026-11-01T19:30:00+01:00'),['Q4_2026']);
  assert.deepEqual(workflows.referralPaidQuarters('player',[fee({feePeriod:'Q4_2025'})],'2026-01-10'),['Q4_2025']);
  assert.deepEqual(workflows.referralPaidQuarters('player',rows,'invalid-date'),[]);
});
