const {parseBody}=require('../shared/runtime');
const join=require('../shared/join-intake');
module.exports=async({req,res})=>{
 const body=parseBody(req);
 try{
  if(body.action==='info')return res.json({ok:true,offers:await join.offers()});
  if(body.website)return res.json({ok:false,error:'The submission could not be accepted.'},400);
  const id=String(body.submissionId||'');if(!/^jn_[a-f0-9]{32}$/.test(id))return res.json({ok:false,error:'Invalid reference. Reload the form.'},400);
  const data=join.validate(body.registration||{}),fingerprint=join.hash(JSON.stringify(data));
  let existing;try{existing=await join.checked(`${join.path(join.TABLE)}/${id}`);}catch(error){if(error.status!==404)throw error;}
  if(existing){if(existing.fingerprint!==fingerprint)return res.json({ok:false,error:'This reference belongs to a different registration. Reload before changing the details.'},409);return res.json({ok:true,reference:id,duplicate:true});}
  const recent=await join.list(join.TABLE,[{method:'equal',attribute:'email_hash',values:[join.hash(data.email)]},{method:'greaterThan',attribute:'$createdAt',values:[new Date(Date.now()-86400000).toISOString()]}],10);
  if(recent.length>=3)return res.json({ok:false,error:'Several registrations were already received today. Please contact the club instead of registering again.'},429);
  const offer=(await join.offers()).find(o=>o.period===data.fee_period);if(!offer)throw Error('Contribution settings unavailable.');
  const memberId=await join.matchingMember(data);
  try{await join.checked(join.path(join.TABLE),{method:'POST',body:{documentId:id,permissions:[],data:{status:'new',member_id:memberId,email_hash:join.hash(data.email),submitted_at:new Date().toISOString(),fingerprint,payload:JSON.stringify({...data,expected_cents:offer.amountCents})}}});}
  catch(error){if(error.status!==409)throw error;const saved=await join.checked(`${join.path(join.TABLE)}/${id}`);if(saved.fingerprint!==fingerprint)return res.json({ok:false,error:'Registration reference conflict. Contact the club.'},409);}
  return res.json({ok:true,reference:id});
 }catch(error){const validation=/^Please/.test(error.message);return res.json({ok:false,error:validation?error.message:'Your registration could not be confirmed. Keep the form open and retry with the same reference or contact the club.'},validation?400:500);}
};
