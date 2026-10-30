const {parseBody,header,queryParam}=require('../shared/runtime');
const join=require('../shared/join-intake');
const TABLE=join.TABLE;
const tryoutTable=()=>String(process.env.APPWRITE_TRYOUT_REGISTRATIONS_COLLECTION_ID||'tryout_registrations');
const contextError=message=>Object.assign(Error(message),{expose:true});
const safeId=id=>/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$/.test(String(id));
const read=async(table,id)=>{try{return await join.checked(`${join.path(table)}/${id}`);}catch(error){if(error.status===404)return null;throw error;}};
const patch=(table,id,data)=>join.checked(`${join.path(table)}/${id}`,{method:'PATCH',body:{data}});
const create=(table,id,data)=>join.checked(join.path(table),{method:'POST',body:{documentId:id,permissions:[],data}});
module.exports=async({req,res})=>{
 const body=parseBody(req),actor=header(req,'x-appwrite-user-id');let working=false;
 try{
  if(['jobResult','jobAck'].includes(body.action)){
   const jobId=String(body.jobId||'');if(!/^jr_[a-f0-9]{32}$/.test(jobId))return res.json({ok:false,error:'Invalid operation reference.'},400);
   const job=await read('join_review_jobs',jobId);if(!job)return res.json({ok:true,pending:true});
   if(job.requester_id!==actor)return res.json({ok:false,error:'This operation belongs to another account.'},403);
   if(body.action==='jobAck'){if(job.status==='completed')await patch('join_review_jobs',jobId,{status:'collected',result:''});return res.json({ok:true});}
   if(job.status==='collected')return res.json({ok:false,error:'This result was already received. Refresh the overview.'},409);
   return res.json(job.status==='completed'?{ok:true,pending:false,result:JSON.parse(job.result)}:{ok:true,pending:true});
  }
  if(body.action==='count'){
   const q=[{method:'equal',attribute:'status',values:['new','processing']},{method:'select',values:['$id']},{method:'limit',values:[1]}];
   const r=await join.checked(`${join.path(TABLE)}?${q.map(queryParam).join('&')}`);return res.json({ok:true,count:Number(r.total||0)});
  }
  if(body.action==='overview'){
   const rows=await join.list(TABLE,[{method:'orderDesc',attribute:'$createdAt'}],500);
   if(!rows.length)return res.json({ok:true,members:[],tryouts:[],submissions:[]});
   const [members,tryouts]=await Promise.all([
    join.list('members',[{method:'select',values:['$id','first_name','last_name','email','membership_status','deleted_at']}],5000),
    join.list(tryoutTable(),[{method:'select',values:['$id','first_name','last_name','email','phone','age','preferred_position','linked_member_id','status','contact_consent','tryout_cycle']}],5000)
   ]);
   const memberRows=members.filter(x=>!x.deleted_at).map(m=>({id:m.$id,name:`${m.first_name||''} ${m.last_name||''}`.trim(),firstName:m.first_name,lastName:m.last_name,email:m.email||'',status:m.membership_status}));
   return res.json({ok:true,members:memberRows,tryouts:tryouts.map(t=>({id:t.$id,firstName:t.first_name,lastName:t.last_name,name:`${t.first_name} ${t.last_name}`,email:t.email,phone:t.phone,age:t.age,preferredPosition:t.preferred_position,memberId:t.linked_member_id,status:t.status,cycle:t.tryout_cycle})),submissions:rows.map(row=>({id:row.$id,status:row.status,memberId:row.member_id,submittedAt:row.submitted_at,...join.storedPayload(row)}))});
  }
  const id=String(body.submissionId||'');if(!/^jn_[a-f0-9]{32}$/.test(id))return res.json({ok:false,error:'Invalid rookie reference.'},400);
  const row=await read(TABLE,id);if(!row)return res.json({ok:false,error:'Registration not found.'},404);
  const data=join.storedPayload(row);
  if(body.action==='reject'){
   if(row.status!=='new')throw contextError('Only a new registration can be marked invalid or duplicate. A partially completed approval must be finished.');
   const reason=String(body.reason||'').trim();if(!reason||reason.length>1000)throw contextError('Enter a reason.');
   await patch(TABLE,id,{status:'rejected',payload:JSON.stringify({...data,reviewed_at:new Date().toISOString(),reviewed_by:actor,rejection_reason:reason})});return res.json({ok:true});
  }
  if(body.action!=='approve')return res.json({ok:false,error:'Unknown review action.'},400);
  if(row.status==='approved')return res.json({ok:true,duplicate:true,memberId:row.member_id});
  if(!['new','processing'].includes(row.status))throw contextError('This registration is not awaiting approval.');
  if(body.paymentConfirmed!==true||body.identityConfirmed!==true)throw contextError('Check the actual bank transfer and the member/tryout assignment first.');
  let plan=data.approval_plan;
  if(!plan){
   const tryoutId=String(body.tryoutId||'');let tryout=null;
   if(tryoutId){if(!safeId(tryoutId))throw contextError('Select a valid tryout registration.');tryout=await read(tryoutTable(),tryoutId);if(!tryout||!tryout.contact_consent||tryout.status==='archived')throw contextError('The selected tryout registration is unavailable or has no contact consent.');}
   let memberId=String(body.memberId||row.member_id||'');
   if(tryout?.linked_member_id){if(memberId&&memberId!==tryout.linked_member_id)throw contextError('The tryout is already linked to a different member. Resolve the assignment first.');memberId=tryout.linked_member_id;}
   if(tryout&&join.nameKey(tryout.first_name,tryout.last_name)!==join.nameKey(data.first_name,data.last_name)&&!tryout.linked_member_id)throw contextError('The selected tryout has a different name. Check the identity before linking it.');
   if(memberId&&!safeId(memberId))throw contextError('Select a valid member.');
   let member=memberId?await read('members',memberId):null;
   if(memberId&&!member)throw contextError('The selected member was not found.');
   if(!memberId){
    const existing=await join.list('members',[{method:'select',values:['$id','first_name','last_name','email','deleted_at']}],5000);
    const matches=existing.filter(m=>!m.deleted_at&&(join.nameKey(m.first_name,m.last_name)===join.nameKey(data.first_name,data.last_name)||String(m.email||'').toLowerCase()===data.email));
    if(matches.length)throw contextError('An existing member has this name or email. Select the correct member; do not create a duplicate.');
    memberId='rookie-'+join.hash(join.nameKey(data.first_name,data.last_name)).slice(0,28);
    member=await read('members',memberId);if(member)throw contextError('A member with this identity already exists. Refresh and assign it explicitly.');
   }
   if(member&&(member.deleted_at||['inactive','exited','coach'].includes(member.membership_status)))throw contextError('This member is inactive, exited or a coach. Resolve their membership or return separately.');
   if(member){let roles=[];try{roles=JSON.parse(member.roles_json||'[]');}catch{}if(!roles.includes('player'))throw contextError('The selected member has no player role. Review it before processing a rookie contribution.');}
   const extra=await read('member_private',memberId);
   if(extra?.fee_exemption_reason||extra?.exit_effective_on)throw contextError('This member has a contribution exemption or recorded exit. Review it separately before applying a rookie registration.');
   const expected=Number(data.expected_cents);if(!Number.isSafeInteger(expected)||expected<=0||Number(data.amount_cents)!==expected)throw contextError('The reported transfer does not match the configured rookie contribution at submission. Resolve the amount with Finance before approval.');
   const fees=await join.list('membership_fees',[{method:'equal',attribute:'member_id',values:[memberId]},{method:'equal',attribute:'fee_period',values:[data.fee_period]}],100);
   if(fees.length>1)throw contextError('Multiple fee rows exist for this member and quarter. Resolve the duplicate first.');
   const fee=fees[0];if(fee&&!((fee.status==='paid_rookie_fee'&&Number(fee.amount_cents)===expected&&Number(fee.paid_cents)===expected)||(['pending','not_collected','partial'].includes(fee.status)&&Number(fee.paid_cents)===0)))throw contextError('The existing contribution contains a payment or special status. It will not be overwritten. Review it in Membership Finance.');
   const first=tryout?.first_name||data.first_name,last=tryout?.last_name||data.last_name;
   plan={member_id:memberId,tryout_id:tryoutId||null,new_member:!member,fee_id:fee?.$id||'rookie-fee-'+join.hash(memberId+':'+data.fee_period).slice(0,24),existing_fee:Boolean(fee),fee_before:fee?{status:fee.status,amount_cents:Number(fee.amount_cents),paid_cents:Number(fee.paid_cents)}:null,amount_cents:expected,first_name:first,last_name:last,email:data.email,phone:data.phone,age:data.age,preferred_position:tryout?.preferred_position||'',started_at:new Date().toISOString(),started_by:actor};
   await patch(TABLE,id,{status:'processing',member_id:memberId,payload:JSON.stringify({...data,approval_plan:plan})});
  }
  working=true;
  const memberId=plan.member_id;let member=await read('members',memberId);
  if(!member){if(!plan.new_member)throw contextError('The assigned member was removed. Contact an administrator.');
   const created={displayName:`${plan.first_name} ${plan.last_name}`.trim(),first_name:plan.first_name,last_name:plan.last_name,email:plan.email,membership_status:'pending',roles_json:'["player"]',positions_json:'[]',rookie_season:Number(data.transferred_on.slice(0,4))-(Number(data.transferred_on.slice(5,7))<9?1:0)};
   try{member=await create('members',memberId,created);}catch(error){if(error.status!==409)throw error;member=await read('members',memberId);}
  }
  if(!member||member.deleted_at||['inactive','exited','coach'].includes(member.membership_status))throw contextError('The assigned member changed status. Resolve the membership before retrying.');
  const extra=await read('member_private',memberId);
  if(extra?.exit_effective_on||extra?.fee_exemption_reason)throw contextError('The assigned member now has an exit or exemption. Review it before retrying.');
  const marker=`[Rookie join ${id}]`;
  const notes=String(extra?.notes||'');const note=`${marker}\nQuarter: ${data.fee_period}; transfer: ${data.transferred_on}; age: ${plan.age}\nTryout: ${plan.tryout_id||'none'}; preference: ${plan.preferred_position||'not set'}`;
  const privateData={phone:extra?.phone||plan.phone,notes:notes.includes(marker)?notes:(notes+(notes?'\n':'')+note).slice(0,2048)};
  if(extra)await patch('member_private',memberId,privateData);else await create('member_private',memberId,{member_id:memberId,...privateData});
  const fee=await read('membership_fees',plan.fee_id),amount=plan.amount_cents;
  const alreadyPaid=fee?.status==='paid_rookie_fee'&&Number(fee.amount_cents)===amount&&Number(fee.paid_cents)===amount;
  if(fee&&(fee.member_id!==memberId||fee.fee_period!==data.fee_period))throw contextError('The contribution assignment changed. Contact Finance.');
  if(!alreadyPaid){
   if(fee&&!(['pending','not_collected','partial'].includes(fee.status)&&Number(fee.paid_cents)===0))throw contextError('The contribution changed during review. Existing payments will not be overwritten.');
   const paidStatus=join.workflows.FEE_STATUSES.find(s=>s==='paid_rookie_fee');if(!paidStatus)throw Error('Rookie status missing.');
   const paid={amount_cents:amount,paid_cents:amount,status:paidStatus};
   if(fee)await patch('membership_fees',plan.fee_id,paid);else{try{await create('membership_fees',plan.fee_id,{member_id:memberId,fee_period:data.fee_period,season_label:data.fee_period.split('_')[1],...paid,status_note:`Manual transfer verified via rookie registration ${id}`});}catch(error){if(error.status!==409)throw error;const conflict=await read('membership_fees',plan.fee_id);if(conflict?.member_id!==memberId||conflict?.fee_period!==data.fee_period||conflict?.status!==paidStatus||Number(conflict?.paid_cents)!==amount||Number(conflict?.amount_cents)!==amount)throw contextError('Contribution reference conflict. Refresh and contact Finance.');}}
  }
  if(plan.tryout_id){const t=await read(tryoutTable(),plan.tryout_id);if(!t||t.linked_member_id&&t.linked_member_id!==memberId)throw contextError('The tryout assignment changed. Resolve it before retrying.');await patch(tryoutTable(),plan.tryout_id,{status:'joined',linked_member_id:memberId});}
  await patch('members',memberId,{membership_status:join.workflows.MEMBERSHIP_STATUSES.find(s=>s==='active'),...(!member.membership_active_since?{membership_active_since:data.transferred_on}:{}),...(member.rookie_season===null||member.rookie_season===undefined?{rookie_season:Number(data.transferred_on.slice(0,4))-(Number(data.transferred_on.slice(5,7))<9?1:0)}:{})});
  let warning='';try{await create('diagnostics_logs','rookie-audit-'+join.hash(id).slice(0,22),{logged_at:new Date().toISOString(),level:'info',scope:'finance-audit',message:'Rookie registration approved; contribution verified',details:JSON.stringify({feeId:plan.fee_id,memberId,feePeriod:data.fee_period,source:id,changes:Object.fromEntries(Object.entries({status:'paid_rookie_fee',amount_cents:amount,paid_cents:amount}).filter(([key,value])=>plan.fee_before?.[key]!==value).map(([key,value])=>[key,{from:plan.fee_before?.[key]??null,to:value}]))}),user_id:actor,member_id:memberId,origin:'admin-function'});}catch(error){if(error.status!==409)warning='Membership and payment were saved, but the finance history could not be written.';}
  await patch(TABLE,id,{status:'approved',member_id:memberId,payload:JSON.stringify({...data,approval_plan:plan,reviewed_at:new Date().toISOString(),reviewed_by:actor,verified_fee_id:plan.fee_id})});
  return res.json({ok:true,memberId,warning});
 }catch(error){return res.json({ok:false,error:error.expose?error.message:working?'Approval was partially completed. Refresh and use Retry approval for this same registration; a second member or contribution must not be created.':'The registration could not be processed. Refresh and try again.'},error.expose?409:500);}
};
