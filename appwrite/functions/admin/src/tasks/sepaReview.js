const { parseBody, header, appwriteConfig } = require('../shared/runtime');
const sepa=require('../shared/sepa-intake');
module.exports=async({req,res})=>{
  const body=parseBody(req);
  try {
    if(body.action==='count'){
      const { queryParam } = require('../shared/runtime');
      const queries=[{method:'equal',attribute:'status',values:['new']},{method:'select',values:['$id']},{method:'limit',values:[1]}];
      const result=await sepa.checked(`${sepa.path(sepa.TABLE)}?${queries.map(queryParam).join('&')}`);
      return res.json({ok:true,count:Number(result.total || 0)});
    }
    if(body.action==='overview'){
      const [members,privateRows,submissions,fees]=await Promise.all([
        sepa.list('members',[{method:'select',values:['$id','first_name','last_name','displayName','membership_status','roles_json','deleted_at','iban','mandate_date']}],5000),
        sepa.list('member_private',[{method:'select',values:['$id','iban','mandate_date','mandate_file_id']}],5000),
        sepa.list(sepa.TABLE,[{method:'orderDesc',attribute:'$createdAt'}],500),
        sepa.list('membership_fees',[{method:'select',values:['member_id','fee_period','iban']}],5000)
      ]);
      const byId=new Map(privateRows.map(row=>[row.$id,row]));
      const feeIban=new Map();
      const quarter=value=>{const match=/^Q([1-4])_(\d{4})$/.exec(String(value||''));return match?Number(match[2])*4+Number(match[1]):0;};
      for(const fee of fees)if(sepa.validIban(fee.iban)&&(!feeIban.has(fee.member_id)||quarter(fee.fee_period)>quarter(feeIban.get(fee.member_id).fee_period)))feeIban.set(fee.member_id,fee);
      const memberRows=members.filter(row=>!row.deleted_at).map(row=>{
        const extra=byId.get(row.$id)||{};
        const iban=extra.iban||row.iban||feeIban.get(row.$id)?.iban||'';
        return {id:row.$id,firstName:row.first_name||'',lastName:row.last_name||'',name:`${row.first_name||''} ${row.last_name||''}`.trim()||row.displayName||'Unknown member',membershipStatus:row.membership_status||'',roles:row.roles_json||'[]',ibanPresent:sepa.validIban(iban),mandateDatePresent:sepa.isoDate(extra.mandate_date||row.mandate_date),documentPresent:Boolean(extra.mandate_file_id),ibanEnding:String(iban).slice(-4)};
      });
      return res.json({ok:true,members:memberRows,submissions:submissions.map(row=>{
        const data=sepa.storedPayload(row);
        return {id:row.$id,status:row.status,memberId:row.member_id||null,submittedAt:row.submitted_at,firstName:data.first_name,lastName:data.last_name,email:data.email,accountHolder:data.account_holder,iban:data.iban,joinedOn:data.joined_on,signedOn:data.signed_on,collectionAgreed:data.collection_agreed===true,collectionAgreementVersion:data.collection_agreement_version||null,reviewedAt:data.reviewed_at||null};
      })});
    }
    const id=String(body.submissionId||'');
    if(!/^sp_[a-f0-9]{32}$/.test(id))return res.json({ok:false,error:'Invalid submission reference.'},400);
    const row=await sepa.checked(`${sepa.path(sepa.TABLE)}/${id}`);
    const data=sepa.storedPayload(row);
    if(body.action==='download'){
      const config=appwriteConfig();
      const response=await fetch(`${config.endpoint}/storage/buckets/media/files/${encodeURIComponent(data.file_id)}/download`,{headers:{'X-Appwrite-Project':config.projectId,'X-Appwrite-Key':config.apiKey}});
      if(!response.ok)throw Error('The private mandate file could not be downloaded.');
      const bytes=Buffer.from(await response.arrayBuffer());
      if(bytes.length>sepa.MAX_PDF_BYTES)throw Error('Unexpected mandate file size.');
      return res.json({ok:true,pdfBase64:bytes.toString('base64'),fileName:`mandate-${id}.pdf`});
    }
    if(!['approve','reject','assign'].includes(body.action))return res.json({ok:false,error:'Invalid review action.'},400);
    if(row.status==='uploading')return res.json({ok:false,error:'The file upload has not completed.'},409);
    if(row.status==='approved')return res.json({ok:false,error:'This submission is already approved. Bank changes must be submitted and reviewed separately.'},409);
    const memberId=String(body.memberId||row.member_id||'');
    if(body.action!=='reject'){
      if(!/^[\w.-]{1,36}$/.test(memberId))return res.json({ok:false,error:'Select the correct member first.'},400);
      const member=await sepa.checked(`${sepa.path('members')}/${encodeURIComponent(memberId)}`);
      if(member.deleted_at)return res.json({ok:false,error:'The selected member has been deleted.'},400);
    }
    if(body.action==='assign'){
      await sepa.checked(`${sepa.path(sepa.TABLE)}/${id}`,{method:'PATCH',body:{data:{member_id:memberId}}});
      return res.json({ok:true});
    }
    if(body.action==='approve'){
      const patch={iban:data.iban,mandate_date:data.signed_on,mandate_file_id:data.file_id,account_holder:data.account_holder};
      try { await sepa.checked(`${sepa.path('member_private')}/${encodeURIComponent(memberId)}`,{method:'PATCH',body:{data:patch}}); }
      catch(error){if(error.status!==404)throw error;await sepa.checked(sepa.path('member_private'),{method:'POST',body:{documentId:memberId,data:{member_id:memberId,...patch}}});}
    }
    try {
      await sepa.checked(`${sepa.path(sepa.TABLE)}/${id}`,{method:'PATCH',body:{data:{status:body.action==='approve'?'approved':'rejected',member_id:memberId||null,payload:JSON.stringify({...data,reviewed_by:header(req,'x-appwrite-user-id'),reviewed_at:new Date().toISOString()})}}});
    } catch(error) {
      if(body.action==='approve')return res.json({ok:true,warning:'Bank details were saved, but the review status could not be saved. Refresh and check the member before repeating approval.'});
      throw error;
    }
    return res.json({ok:true});
  } catch(error){return res.json({ok:false,error:error.message||'SEPA review failed.'},500);}
};
