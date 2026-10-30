const sepa=require('./sepa-intake');
const rules=require('./exit-rules');
const TABLE='exit_submissions';
function validate(input){
 const data={};
 for(const [key,max] of Object.entries({first_name:80,last_name:80,email:200,signed_on:10,effective_on:10})){
  data[key]=String(input[key]||'').trim();if(!data[key]||data[key].length>max)throw Error('Please check '+key.replaceAll('_',' ')+'.');
 }
 data.email=data.email.toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))throw Error('Please enter a valid email.');
 if(!rules.validDate(data.signed_on)||data.signed_on>rules.today())throw Error('Please enter the actual signature date, not a future date.');
 if(!rules.selectable(data.effective_on,rules.today()))throw Error('Please choose an available club quarter. The current quarter closes after the first day of its second month (Vienna time).');
 if(input.policy_version!==rules.VERSION||input.confirm_signed!==true||input.policy_acknowledged!==true||input.privacy_acknowledged!==true)throw Error('Please confirm the signed declaration, contribution rules and privacy information.');
 return {...data,grace_rule_version:'2026-10-30-v1',grace_deadline:rules.graceDeadline(data.effective_on),policy_version:rules.VERSION,policy_text:rules.POLICY,confirm_signed:true,policy_acknowledged:true,privacy_acknowledged:true};
}
module.exports={...sepa,TABLE,validate,rules};
