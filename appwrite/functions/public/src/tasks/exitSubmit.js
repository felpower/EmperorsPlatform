const { parseBody, appwriteConfig } = require('../shared/runtime');
const sepa = require('../shared/exit-intake');
module.exports = async ({req,res}) => {
  const body=parseBody(req);
  try {
    if(body.website) return res.json({ok:false,error:'The submission could not be accepted.'},400);
    const id=String(body.submissionId || '');
    if(!/^ex_[a-f0-9]{32}$/.test(id)) return res.json({ok:false,error:'Invalid submission reference. Reload the form.'},400);
    const data=sepa.validate(body.registration || {});
    const encoded=String(body.pdfBase64 || '');
    if(!encoded || encoded.length>Math.ceil(sepa.MAX_PDF_BYTES/3)*4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))return res.json({ok:false,error:'Upload a signed exit PDF, at most 2 MB.'},400);
    const bytes=Buffer.from(encoded,'base64');
    if(bytes.length>sepa.MAX_PDF_BYTES || bytes.subarray(0,5).toString()!=='%PDF-' || !bytes.subarray(Math.max(0,bytes.length-2048)).toString().includes('%%EOF'))return res.json({ok:false,error:'The uploaded file must be a complete PDF, at most 2 MB.'},400);
    const fingerprint=sepa.hash(JSON.stringify(data)+sepa.hash(bytes));
    let row;
    try { row=await sepa.checked(`${sepa.path(sepa.TABLE)}/${id}`); } catch(error) { if(error.status!==404)throw error; }
    if(row) {
      if(row.fingerprint!==fingerprint)return res.json({ok:false,error:'This reference belongs to another submission. Reload before submitting changed details.'},409);
      if(row.status!=='uploading')return res.json({ok:true,reference:id,duplicate:true,linked:Boolean(row.member_id)});
    } else {
      const recent=await sepa.list(sepa.TABLE,[{method:'equal',attribute:'email_hash',values:[sepa.hash(data.email)]},{method:'greaterThan',attribute:'$createdAt',values:[new Date(Date.now()-86400000).toISOString()]}],10);
      if(recent.length>=3)return res.json({ok:false,error:'Several submissions have already been received for this contact today. Please contact Finance instead of submitting again.'},429);
      const memberId=await sepa.matchingMember(data);
      row=await sepa.checked(sepa.path(sepa.TABLE),{method:'POST',body:{documentId:id,permissions:[],data:{status:'uploading',member_id:memberId,email_hash:sepa.hash(data.email),submitted_at:new Date().toISOString(),fingerprint,payload:JSON.stringify({...data,file_id:id,reviewed_by:null,reviewed_at:null})}}});
    }
    const config=appwriteConfig();const form=new FormData();form.set('fileId',id);form.set('file',new Blob([bytes],{type:'application/pdf'}),'signed-exit-declaration.pdf');
    const response=await fetch(`${config.endpoint}/storage/buckets/media/files`,{method:'POST',headers:{'X-Appwrite-Project':config.projectId,'X-Appwrite-Key':config.apiKey},body:form});
    if(!response.ok && response.status!==409)throw Error('The private declaration file could not be saved.');
    await sepa.checked(`${sepa.path(sepa.TABLE)}/${id}`,{method:'PATCH',body:{data:{status:'new'}}});
    return res.json({ok:true,reference:id,linked:Boolean(row.member_id)});
  } catch(error) {
    const validation=/Please|signature date|IBAN|confirm/.test(error.message);
    return res.json({ok:false,error:validation?error.message:'Your submission could not be completed. Keep this form open and retry with the same reference or contact the club.'},validation?400:500);
  }
};
