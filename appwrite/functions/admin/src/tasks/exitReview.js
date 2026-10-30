const {parseBody,header,appwriteConfig,queryParam}=require('../shared/runtime');
const exit=require('../shared/exit-intake');
module.exports=async({req,res})=>{
 const body=parseBody(req),actor=header(req,'x-appwrite-user-id');
 try{
  if(body.action==='count'){
   const q=[{method:'equal',attribute:'status',values:['new']},{method:'select',values:['$id']},{method:'limit',values:[1]}];
   const result=await exit.checked(`${exit.path(exit.TABLE)}?${q.map(queryParam).join('&')}`);
   return res.json({ok:true,count:Number(result.total||0)});
  }
  if(body.action==='overview'){
   const [rows,members]=await Promise.all([exit.list(exit.TABLE,[{method:'orderDesc',attribute:'$createdAt'}],500),exit.list('members',[{method:'select',values:['$id','first_name','last_name','membership_status','deleted_at']}],5000)]);
   return res.json({ok:true,members:members.filter(m=>!m.deleted_at).map(m=>({id:m.$id,name:`${m.first_name||''} ${m.last_name||''}`.trim(),status:m.membership_status})),submissions:rows.map(row=>({id:row.$id,status:row.status,memberId:row.member_id,submittedAt:row.submitted_at,...exit.storedPayload(row)}))});
  }
  const id=String(body.submissionId||'');if(!/^ex_[a-f0-9]{32}$/.test(id))return res.json({ok:false,error:'Invalid exit reference.'},400);
  const row=await exit.checked(`${exit.path(exit.TABLE)}/${id}`),data=exit.storedPayload(row);
  if(body.action==='download'){
   const c=appwriteConfig();const response=await fetch(`${c.endpoint}/storage/buckets/media/files/${encodeURIComponent(data.file_id)}/download`,{headers:{'X-Appwrite-Project':c.projectId,'X-Appwrite-Key':c.apiKey}});
   if(!response.ok)throw Error('The private declaration could not be loaded.');
   const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>exit.MAX_PDF_BYTES)throw Error('Unexpected PDF size.');
   return res.json({ok:true,pdfBase64:bytes.toString('base64'),fileName:`exit-${id}.pdf`});
  }
  const save=dataPatch=>exit.checked(`${exit.path(exit.TABLE)}/${id}`,{method:'PATCH',body:{data:dataPatch}});
  const privatePatch=async(memberId,patch)=>{try{await exit.checked(`${exit.path('member_private')}/${memberId}`,{method:'PATCH',body:{data:patch}});}catch(error){if(error.status!==404)throw error;await exit.checked(exit.path('member_private'),{method:'POST',body:{documentId:memberId,data:{member_id:memberId,...patch}}});}};
  if(body.action==='reject'){
   if(row.status!=='new')return res.json({ok:false,error:'Only a new submission can be marked as a duplicate or invalid.'},409);
   const reason=String(body.reason||'').trim();if(!reason||reason.length>1000)return res.json({ok:false,error:'Please document why this submission is invalid or a duplicate. A valid resignation must not be rejected merely because it is inconvenient.'},400);
   await save({status:'rejected',payload:JSON.stringify({...data,rejection_reason:reason,reviewed_at:new Date().toISOString(),reviewed_by:actor})});return res.json({ok:true});
  }
  if(body.action==='approve'){
   if(row.status!=='new')return res.json({ok:false,error:'This declaration is not awaiting review.'},409);
   const memberId=String(body.memberId||'');const effective=String(body.effectiveOn||data.effective_on||'');
   if(!/^[\w.-]{1,36}$/.test(memberId)||!exit.rules.isBoundary(effective)||effective<data.effective_on||!exit.rules.selectable(effective,exit.rules.receivedDate(row.submitted_at))||body.documentChecked!==true)return res.json({ok:false,error:'Check the signed document, select its member and confirm a quarter that was available when this declaration was received. The received date is preserved.'},400);
   const member=await exit.checked(`${exit.path('members')}/${memberId}`);if(member.deleted_at)return res.json({ok:false,error:'Member has been deleted.'},400);
   const other=await exit.list(exit.TABLE,[{method:'equal',attribute:'member_id',values:[memberId]}],500);
   if(other.some(x=>x.$id!==id&&x.status==='approved'))return res.json({ok:false,error:'This member already has an approved exit. Review the existing record first.'},409);
   await privatePatch(memberId,{exit_effective_on:effective});
   // Keep past fees and bank details unchanged. Future exit dates stay active until effective.
   if(effective<=exit.rules.today())await exit.checked(`${exit.path('members')}/${memberId}`,{method:'PATCH',body:{data:{membership_status:'exited'}}});
   await save({status:'approved',member_id:memberId,payload:JSON.stringify({...data,effective_on:effective,reviewed_at:new Date().toISOString(),reviewed_by:actor,document_checked:true})});
   return res.json({ok:true,memberId,effectiveOn:effective});
  }
  if(body.action==='rejoin'){
   if(row.status!=='approved')return res.json({ok:false,error:'Select an approved exit before recording a return.'},409);
   const rejoin=String(body.rejoinOn||'');const note=String(body.note||'').trim();
   const decision=String(body.decision||'');const amount=Number(body.amountCents);
   if(body.decisionConfirmed!==true||!exit.rules.validDate(rejoin)||rejoin<data.effective_on||rejoin>exit.rules.today()||!['full','partial','waived','not_required'].includes(decision)||!note||note.length>2000||!Number.isSafeInteger(amount)||amount<0||amount>10000000||(['waived','not_required'].includes(decision)&&amount!==0)||(['full','partial'].includes(decision)&&amount===0)||(exit.rules.needsReview(data.effective_on,rejoin)&&decision==='not_required'))return res.json({ok:false,error:'Enter the return date, a documented board decision and its amount. Within twelve months choose full, partial or waived. No payment will be created.'},400);
   const memberId=row.member_id;const member=await exit.checked(`${exit.path('members')}/${memberId}`);if(member.deleted_at)throw Error('Member has been deleted.');
   const extra=await exit.checked(`${exit.path('member_private')}/${memberId}`);
   if(extra.exit_effective_on&&extra.exit_effective_on!==data.effective_on)return res.json({ok:false,error:'The member has a different current exit date. Resolve this conflict first.'},409);
   // Save the decision before reactivating. Retry is safe if a later write fails.
   await save({payload:JSON.stringify({...data,rejoin_on:rejoin,rejoin_decision:decision,rejoin_amount_cents:amount,rejoin_note:note,rejoin_reviewed_by:actor,rejoin_reviewed_at:new Date().toISOString()})});
   await privatePatch(memberId,{exit_effective_on:null});
   await exit.checked(`${exit.path('members')}/${memberId}`,{method:'PATCH',body:{data:{membership_status:'active'}}});
   await save({status:'rejoined'});return res.json({ok:true,memberId,effectiveOn:'',membershipStatus:'active'});
  }
  return res.json({ok:false,error:'Unknown exit action.'},400);
 }catch(error){return res.json({ok:false,error:'The operation could not be completed. Refresh and check the saved record before retrying. '+(error.status===404?'A required record was not found.':'')},500);}
};
