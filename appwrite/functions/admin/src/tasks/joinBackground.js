const {parseBody,header}=require('../shared/runtime');
const join=require('../shared/join-intake');
const TABLE='join_review_jobs';
module.exports=async(context,handler)=>{
 const {req,res}=context,body=parseBody(req),id=String(body.backgroundJobId||''),actor=header(req,'x-appwrite-user-id');
 if(!/^jr_[a-f0-9]{32}$/.test(id))return res.json({ok:false,error:'Invalid operation reference.'},400);
 const clean={...body};delete clean.backgroundJobId;
 const fingerprint=join.hash(JSON.stringify(clean));
 try{
  let row;try{row=await join.checked(`${join.path(TABLE)}/${id}`);}catch(e){if(e.status!==404)throw e;}
  if(row){if(row.requester_id!==actor||row.fingerprint!==fingerprint)return res.json({ok:false,error:'Operation reference conflict.'},409);return res.json({ok:true,alreadyRunning:true});}
  try{await join.checked(join.path(TABLE),{method:'POST',body:{documentId:id,permissions:[],data:{requester_id:actor,status:'processing',fingerprint,result:''}}});}catch(e){if(e.status!==409)throw e;return res.json({ok:true,alreadyRunning:true});}
  const finish=async(result)=>{
   let text=JSON.stringify(result);if(text.length>950000)text=JSON.stringify({ok:false,error:'This overview is too large. Contact the administrator.'});
   await join.checked(`${join.path(TABLE)}/${id}`,{method:'PATCH',body:{data:{status:'completed',result:text}}});
   return res.json({ok:true,resultStored:true});
  };
  try{return await handler({...context,res:{json:finish}});}catch{return await finish({ok:false,error:'The background operation could not finish. Refresh and check this registration before retrying.'});}
 }catch{return res.json({ok:false,error:'Could not save the operation result. Refresh and check the registration before retrying.'},500);}
};
