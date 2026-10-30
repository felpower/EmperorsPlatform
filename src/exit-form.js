(() => {
  'use strict';
  const form=document.getElementById('exit-form');
  const button=document.getElementById('exit-submit');
  const errorBox=document.getElementById('exit-error');
  const reference=`ex_${crypto.randomUUID().replaceAll('-','')}`;
  let pending=false;
  for(const item of window.EmperorsExitRules.nextBoundaries()){
    const option=document.createElement('option');option.value=item.date;option.textContent=`${item.period.replace('_',' ')} — ${item.date}`;form.elements.effective_on.append(option);
  }
  form.elements.signed_on.max=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Vienna'}).format(new Date());
  const base64=file=>new Promise((resolve,reject)=>{
    const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('The PDF could not be read. Please select it again.'));reader.readAsDataURL(file);
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(pending || !form.reportValidity())return;
    errorBox.hidden=true;
    const file=form.elements.declaration.files[0];
    if(!file || file.size>2*1024*1024 || !/\.pdf$/i.test(file.name)) {errorBox.textContent='Please choose a signed exit declaration PDF, at most 2 MB.';errorBox.hidden=false;return;}
    pending=true;button.disabled=true;button.setAttribute('aria-busy','true');button.innerHTML='<span class="work-spinner" aria-hidden="true"></span> Saving your declaration…';
    try {
      const config=window.ClubHubAppwriteConfig;
      if(!window.Appwrite || !config?.projectId)throw Error('The secure form could not load. Refresh and try again.');
      const registration=Object.fromEntries(['first_name','last_name','email','effective_on','signed_on'].map(key=>[key,form.elements[key].value]));
      registration.policy_version=window.EmperorsExitRules.VERSION;
      for(const key of ['confirm_signed','policy_acknowledged','privacy_acknowledged'])registration[key]=form.elements[key].checked;
      const api=new window.Appwrite.Functions(new window.Appwrite.Client().setEndpoint(config.endpoint).setProject(config.projectId));
      let execution=await api.createExecution(config.publicFunctionId,JSON.stringify({task:'exitSubmit',submissionId:reference,registration,pdfBase64:await base64(file),website:form.elements.website.value}),false);
      for(let attempt=0;['waiting','processing'].includes(execution.status)&&attempt<40;attempt++){
        await new Promise(resolve=>setTimeout(resolve,500));execution=await api.getExecution(config.publicFunctionId,execution.$id);
      }
      let result;try{result=JSON.parse(execution.responseBody||'{}');}catch{throw Error('No confirmed receipt received. Retry with this form or contact Finance; your reference is '+reference);}
      if(execution.status!=='completed'||result.ok!==true)throw Error(result.error||'No confirmed receipt received. Your reference is '+reference+'. Please keep this page open and retry or contact Finance.');
      form.hidden=true;const success=document.getElementById('exit-success');success.hidden=false;
      document.getElementById('exit-receipt').textContent=`Reference: ${result.reference}. ${result.linked?'The club will verify the member assignment.':'The club will match your submission to the correct member.'}`;
      success.focus();
    }catch(error){errorBox.textContent=error.message||'Your submission could not be confirmed. Please try again or contact Finance.';errorBox.hidden=false;errorBox.scrollIntoView({block:'center',behavior:'smooth'});}
    finally{pending=false;button.disabled=false;button.removeAttribute('aria-busy');button.textContent='Submit exit declaration securely';}
  });
})();
