(() => {
  'use strict';
  const form=document.getElementById('sepa-form');
  const button=document.getElementById('sepa-submit');
  const errorBox=document.getElementById('sepa-error');
  const reference=`sp_${crypto.randomUUID().replaceAll('-','')}`;
  let pending=false;
  form.elements.signed_on.max=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Vienna'}).format(new Date());
  const base64=file=>new Promise((resolve,reject)=>{
    const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('The PDF could not be read. Please select it again.'));reader.readAsDataURL(file);
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(pending || !form.reportValidity())return;
    errorBox.hidden=true;
    const file=form.elements.mandate.files[0];
    if(!file || file.size>2*1024*1024 || !/\.pdf$/i.test(file.name)) {errorBox.textContent='Please choose a signed PDF, at most 2 MB.';errorBox.hidden=false;return;}
    pending=true;button.disabled=true;button.setAttribute('aria-busy','true');button.innerHTML='<span class="work-spinner" aria-hidden="true"></span> Saving your mandate…';
    try {
      const config=window.ClubHubAppwriteConfig;
      if(!window.Appwrite || !config?.projectId)throw Error('The secure form could not load. Refresh and try again.');
      const registration=Object.fromEntries(['first_name','last_name','email','account_holder','iban','joined_on','signed_on'].map(key=>[key,form.elements[key].value]));
      if (/^\d{4}-\d{2}$/.test(registration.joined_on)) registration.joined_on+='-01';
      registration.membership_confirmation_version='2026-10-29';
      registration.membership_confirmed=form.elements.membership_confirmed.checked;
      registration.confirm_signed=form.elements.confirm_signed.checked;registration.privacy_acknowledged=form.elements.privacy_acknowledged.checked;
      const api=new window.Appwrite.Functions(new window.Appwrite.Client().setEndpoint(config.endpoint).setProject(config.projectId));
      let execution=await api.createExecution(config.publicFunctionId,JSON.stringify({task:'sepaSubmit',submissionId:reference,registration,pdfBase64:await base64(file),website:form.elements.website.value}),false);
      for(let attempt=0;['waiting','processing'].includes(execution.status)&&attempt<40;attempt++){
        await new Promise(resolve=>setTimeout(resolve,500));execution=await api.getExecution(config.publicFunctionId,execution.$id);
      }
      let result;try{result=JSON.parse(execution.responseBody||'{}');}catch{throw Error('No confirmed receipt received. Retry with this form or contact Finance; your reference is '+reference);}
      if(execution.status!=='completed'||result.ok!==true)throw Error(result.error||'No confirmed receipt received. Your reference is '+reference+'. Please keep this page open and retry or contact Finance.');
      form.hidden=true;const success=document.getElementById('sepa-success');success.hidden=false;
      document.getElementById('sepa-receipt').textContent=`Reference: ${result.reference}. ${result.linked?'Your submission has been assigned to a matching player for review.':'Finance will match your submission to the correct player.'}`;
      success.focus();
    }catch(error){errorBox.textContent=error.message||'Your submission could not be confirmed. Please try again or contact Finance.';errorBox.hidden=false;errorBox.scrollIntoView({block:'center',behavior:'smooth'});}
    finally{pending=false;button.disabled=false;button.removeAttribute('aria-busy');button.textContent='Submit mandate securely';}
  });
})();
