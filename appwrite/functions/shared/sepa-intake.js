const crypto = require('node:crypto');
const { appwriteConfig, appwriteRequest, queryParam } = require('./runtime');
const TABLE = 'sepa_submissions';
const MAX_PDF_BYTES = 2 * 1024 * 1024;
const path = collection => `/databases/${encodeURIComponent(appwriteConfig().databaseId)}/collections/${encodeURIComponent(collection)}/documents`;
async function checked(url, options) {
  const { response, payload } = await appwriteRequest(url, options);
  if (!response.ok) { const error = new Error(payload.message || 'Database request failed.'); error.status = response.status; throw error; }
  return payload;
}
async function list(collection, queries = [], limit = 100) {
  const result = await checked(`${path(collection)}?${[...queries,{method:'limit',values:[limit]}].map(queryParam).join('&')}`);
  if (Number(result.total || 0) > limit) throw new Error('This overview exceeds its read limit. Please contact the administrator.');
  return result.documents || [];
}
function nameKey(first,last) { return [first,last].map(value=>String(value||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'')).join('|'); }
function validIban(input) {
  const iban = String(input || '').replace(/\s/g,'').toUpperCase();
  const lengths={AT:20,DE:22,LU:20,IT:27,FR:27,LT:20,NL:18,BE:16,CH:21,GB:22,IE:22,ES:24,PT:25,PL:28,CZ:24,SK:24,HU:28,SI:19,HR:21,RO:24,BG:22,DK:18,SE:24,NO:15,FI:18,EE:20,LV:21,GR:27,CY:28,MT:31,IS:26,LI:21,MC:27,SM:27,AD:24,VA:22,GI:23,AL:28,BA:20,ME:22,MK:19,RS:22,MD:24,UA:29,XK:20,TR:26};
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban) || (!lengths[iban.slice(0,2)] || iban.length!==lengths[iban.slice(0,2)])) return false;
  let remainder=0;
  for(const char of iban.slice(4)+iban.slice(0,4)) for(const digit of (/[A-Z]/.test(char)?String(char.charCodeAt(0)-55):char)) remainder=(remainder*10+Number(digit))%97;
  return remainder===1;
}
function isoDate(value) { try { return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && new Date(`${value}T12:00:00Z`).toISOString().slice(0,10)===value; } catch { return false; } }
function validate(input) {
  const data={};
  for(const [key,max] of Object.entries({first_name:80,last_name:80,email:200,account_holder:160,joined_on:10,signed_on:10})) {
    data[key]=String(input[key] || '').trim(); if (!data[key] || data[key].length>max) throw Error(`Please check ${key.replaceAll('_',' ')}.`);
  }
  if (/^\d{4}-\d{2}$/.test(data.joined_on)) data.joined_on+='-01';
  data.email=data.email.toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))throw Error('Please enter a valid contact email.');
  data.iban=String(input.iban || '').replace(/\s/g,'').toUpperCase();
  if(!validIban(data.iban))throw Error('Please check the IBAN, including its check digits.');
  if(!isoDate(data.joined_on)||!isoDate(data.signed_on))throw Error('Please enter valid joining and signature dates.');
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Vienna'}).format(new Date());
  if(data.signed_on>today)throw Error('The signature date cannot be in the future.');
  if(input.confirm_signed!==true || input.privacy_acknowledged!==true)throw Error('Please confirm the signed mandate and privacy information.');
  data.confirm_signed=true;data.privacy_acknowledged=true;
  if (input.membership_confirmation_version !== undefined) {
    if (input.membership_confirmation_version !== '2026-10-29' || input.membership_confirmed !== true) throw Error('Please confirm the membership and contribution information.');
    data.membership_confirmed=true;
    data.membership_confirmation_version='2026-10-29';
    data.membership_confirmation_text='I confirm that I am joining the Uni Wien Emperors as a member from the date I submit this form and agree to pay the applicable membership contributions. These may be collected in accordance with the signed SEPA mandate. The club will notify me via WhatsApp of the amount and collection date before each debit.';
  }
  if (input.collection_agreement_version !== undefined) {
    if (input.collection_agreement_version !== '2026-10-29-v1' || input.collection_agreed !== true) throw Error('Please ask the account holder to confirm the collection schedule and seven-day notice period.');
    data.collection_agreed=true;
    data.collection_agreement_version='2026-10-29-v1';
    data.collection_agreement_text='As the account holder, I agree to the collection schedule above and to a pre-notification period of at least seven calendar days instead of the usual fourteen calendar days. I will receive advance notice of the actual amount and collection date before each debit.';
    data.collection_schedule='Q1 February-April: 10 February; Q2 May-July: 10 May; Q3 August-October: 10 August; Q4 November-January: 10 November. Next bank business day if needed. Notify the account holder of actual amount and date at least seven calendar days before each debit, including schedule changes. Normally via WhatsApp; contact Finance to arrange another channel if needed.';
  }
  return data;
}
let rosterCache=null;
async function matchingMember(data) {
  if(!rosterCache || Date.now()-rosterCache.at>300000)rosterCache={at:Date.now(),rows:await list('members', [{method:'select',values:['$id','first_name','last_name','deleted_at']}],5000)};
  const matches=rosterCache.rows.filter(row=>!row.deleted_at && nameKey(row.first_name,row.last_name)===nameKey(data.first_name,data.last_name));
  return matches.length===1?matches[0].$id:null;
}
function storedPayload(row) { return JSON.parse(row.payload); }
module.exports={TABLE,MAX_PDF_BYTES,path,checked,list,nameKey,validIban,isoDate,validate,matchingMember,storedPayload,hash:value=>crypto.createHash('sha256').update(value).digest('hex')};
