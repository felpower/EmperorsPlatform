const sepa=require('./sepa-intake');
const rules=require('./exit-rules');
const workflows=require('./club-workflows');
const TABLE='join_submissions',VERSION='2026-10-30-v1';
function periods(on=rules.today()){
 const month=Number(on.slice(5,7));let year=Number(on.slice(0,4)),quarter;
 if(month===1){quarter=4;year--;}else quarter=Math.floor((month-2)/3)+1;
 const out=[];for(let n=0;n<3;n++){out.push(`Q${quarter}_${year}`);quarter++;if(quarter>4){quarter=1;year++;}}return out;
}
async function offers(){const rates=await sepa.list('fee_rates',[],200);if(!rates.length)throw Error('Contribution settings are unavailable.');return periods().map(period=>({period,amountCents:workflows.feeRatesForPeriod(period,rates).rookie_cents}));}
function validate(input){
 const data={};for(const [key,max] of Object.entries({first_name:80,last_name:80,email:200,phone:64,fee_period:16,transferred_on:10})){
  data[key]=String(input[key]||'').trim();if(!data[key]||data[key].length>max)throw Error('Please check '+key.replaceAll('_',' ')+'.');
 }
 data.email=data.email.toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))throw Error('Please enter a valid email.');
 if(!/^[+()\d .\/-]{5,64}$/.test(data.phone))throw Error('Please enter a contact phone number.');
 data.age=Number(input.age);if(!Number.isInteger(data.age)||data.age<1||data.age>100)throw Error('Please enter your age.');
 data.amount_cents=Number(input.amount_cents);if(!Number.isSafeInteger(data.amount_cents)||data.amount_cents<=0||data.amount_cents>1000000)throw Error('Please enter the amount you transferred.');
 if(!periods().includes(data.fee_period))throw Error('Please select an available rookie quarter.');
 if(!rules.validDate(data.transferred_on)||data.transferred_on>rules.today())throw Error('Please enter the actual transfer date, not a future date.');
 if(input.version!==VERSION||input.membership_requested!==true||input.transfer_confirmed!==true||input.privacy_acknowledged!==true)throw Error('Please confirm your rookie registration, completed transfer and privacy information.');
 return {...data,version:VERSION,membership_requested:true,transfer_confirmed:true,privacy_acknowledged:true,confirmation_text:'I request rookie membership with the Uni Wien Emperors for the selected rookie quarter. I have already transferred the stated contribution. The club will verify payment and create or assign my member record. No website login or SEPA mandate is created by this registration.'};
}
module.exports={...sepa,TABLE,VERSION,periods,offers,validate,rules,workflows};
