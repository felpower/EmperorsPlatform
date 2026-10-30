(() => {
'use strict';
const form=document.getElementById('join-form'),button=document.getElementById('join-submit'),errorBox=document.getElementById('join-error');
const reference='jn_'+crypto.randomUUID().replaceAll('-','');let pending=false,offers=[];
form.elements.transferred_on.max=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Vienna'}).format(new Date());
async function call(body){
 const config=window.ClubHubAppwriteConfig;if(!window.Appwrite||!config?.projectId)throw Error('The secure form could not load. Refresh and try again.');
 const api=new window.Appwrite.Functions(new window.Appwrite.Client().setEndpoint(config.endpoint).setProject(config.projectId));
 let execution=await api.createExecution(config.publicFunctionId,JSON.stringify({task:'joinSubmit',...body}),false);
 for(let attempt=0;['waiting','processing'].includes(execution.status)&&attempt<40;attempt++){await new Promise(resolve=>setTimeout(resolve,500));execution=await api.getExecution(config.publicFunctionId,execution.$id);}
 let result;try{result=JSON.parse(execution.responseBody||'{}');}catch{throw Error('No confirmed response received. Keep this page open. Your reference is '+reference);}
 if(execution.status!=='completed'||result.ok!==true)throw Error(result.error||'No confirmed receipt received. Keep this page open and retry. Reference: '+reference);
 return result;
}
function rate(){const offer=offers.find(o=>o.period===form.elements.fee_period.value);document.getElementById('join-rate').textContent=offer?`Configured rookie contribution: €${(offer.amountCents/100).toFixed(2)}. Enter the amount you actually transferred.`:'';}
form.elements.fee_period.onchange=rate;
let infoPending=false;
const retryInfo=document.getElementById('join-rate-retry');
async function loadOffers(){
 if(infoPending)return;infoPending=true;retryInfo.hidden=true;errorBox.hidden=true;button.disabled=true;form.elements.fee_period.disabled=true;
 document.getElementById('join-rate').innerHTML='<span class="work-spinner" aria-hidden="true"></span> Loading contribution settings…';
 try{
  let result;for(let attempt=0;attempt<2;attempt++){try{result=await call({action:'info'});break;}catch(error){if(attempt||!/Failed to fetch|NetworkError/i.test(error.message))throw error;await new Promise(resolve=>setTimeout(resolve,1000));}}
  offers=result.offers||[];if(!offers.length)throw Error('Contribution settings are unavailable. Contact the club.');
  const selected=form.elements.fee_period.value;form.elements.fee_period.innerHTML='';
  for(const o of offers){const option=document.createElement('option');option.value=o.period;option.textContent=o.period.replace('_',' ');form.elements.fee_period.append(option);}
  if(offers.some(o=>o.period===selected))form.elements.fee_period.value=selected;
  form.elements.fee_period.disabled=false;button.disabled=false;rate();
 }catch(e){errorBox.hidden=false;errorBox.textContent=e.message;document.getElementById('join-rate').textContent='Contribution settings could not be loaded. Your entered details are still here; retry loading or contact the club.';retryInfo.hidden=false;}
 finally{infoPending=false;}
}
retryInfo.onclick=loadOffers;void loadOffers();
form.addEventListener('submit',async event=>{
 event.preventDefault();if(pending||!form.reportValidity())return;errorBox.hidden=true;
 const amount=form.elements.amount.value;if(!/^\d+(?:\.\d{1,2})?$/.test(amount)){errorBox.textContent='Enter a euro amount with at most two decimal places.';errorBox.hidden=false;return;}
 const registration=Object.fromEntries(['first_name','last_name','email','phone','fee_period','transferred_on'].map(k=>[k,form.elements[k].value]));
 registration.age=Number(form.elements.age.value);registration.amount_cents=Math.round(Number(amount)*100);registration.version='2026-10-30-v1';
 for(const key of ['membership_requested','transfer_confirmed','privacy_acknowledged'])registration[key]=form.elements[key].checked;
 pending=true;button.disabled=true;button.setAttribute('aria-busy','true');button.innerHTML='<span class="work-spinner" aria-hidden="true"></span> Saving your registration…';
 try{const result=await call({submissionId:reference,registration,website:form.elements.website.value});form.hidden=true;const success=document.getElementById('join-success');success.hidden=false;document.getElementById('join-receipt').textContent='Reference: '+result.reference;success.focus();}
 catch(e){errorBox.textContent=e.message;errorBox.hidden=false;errorBox.scrollIntoView({block:'center',behavior:'smooth'});}
 finally{pending=false;button.disabled=false;button.removeAttribute('aria-busy');button.textContent='Submit rookie registration';}
});
})();
