const {parseBody,appwriteConfig}=require('../shared/runtime');
const confirmation=require('../shared/tryout-confirmation');
module.exports=async({req,res})=>{
  const body=parseBody(req);
  try {
    if(body.action==='load')return res.json({ok:true,...await confirmation.load()});
    if(body.action!=='save')return res.json({ok:false,error:'Invalid template action.'},400);
    let template;try{template=confirmation.validate(body.subject,body.body);}catch(error){return res.json({ok:false,error:error.message},400);}
    const {appwriteRequest}=require('../shared/runtime');
    const collection=process.env.APPWRITE_TRYOUT_SETTINGS_TABLE_ID||'tryout_settings';
    const base=`/databases/${encodeURIComponent(appwriteConfig().databaseId)}/collections/${encodeURIComponent(collection)}/documents`;
    const data={key:'confirmation_email',confirmation_subject:template.subject,confirmation_body:template.body};
    let result=await appwriteRequest(`${base}/confirmation-email`,{method:'PATCH',body:{data}});
    if(result.response.status===404)result=await appwriteRequest(base,{method:'POST',body:{documentId:'confirmation-email',data}});
    if(!result.response.ok)throw Error(result.payload.message||'The template could not be saved.');
    return res.json({ok:true,updatedAt:result.payload.$updatedAt});
  }catch(error){return res.json({ok:false,error:error.message||'Template operation failed.'},500);}
};
