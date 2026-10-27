const { appwriteConfig, appwriteRequest, queryParam } = require('./runtime');
const DEFAULT_SUBJECT = 'Uni Wien Emperors Tryout \u2013 Anmeldung best\u00e4tigt';
function defaultBody(hasDate) { return `Hallo {{firstName}},

danke für deine Anmeldung zum Tryout der Uni Wien Emperors${hasDate ? " am {{tryoutDate}}" : ""}!

Du stehst auf unserer Liste – du musst dich nicht noch einmal anmelden.
Ca. eine Woche vor dem Tryout schicken wir dir alle Details per E-Mail:
- Uhrzeit und Treffpunkt
- Ort
- was du mitbringen sollst

Fragen? Antworte einfach auf diese E-Mail.

Sportliche Grüße
Uni Wien Emperors

---------- English version below ----------

Hi {{firstName}},

thanks for registering for the Uni Wien Emperors tryout${hasDate ? " on {{tryoutDateEn}}" : ""}!

You're on our list – no need to register again.
About one week before the tryout we'll email you all the details:
- Time and meeting point
- Location
- What to bring

Questions? Just reply to this email.

Best regards,
Uni Wien Emperors`; }
const allowed = new Set(['firstName','lastName','email','tryoutDate','tryoutDateEn']);
function validate(subject,body) {
  if(typeof subject!=='string'||!subject.trim()||subject.trim().length>255||/[\r\n]/.test(subject))throw Error('Enter a subject of at most 255 characters on one line.');
  if(typeof body!=='string'||!body.trim()||body.length>12000)throw Error('Enter a message of at most 12,000 characters.');
  for(const match of (subject+' '+body).matchAll(/{{(.*?)}}/g))if(!allowed.has(match[1]))throw Error('Unknown placeholder: '+match[0]);
  return {subject:subject.trim(),body:body.trim()};
}
async function load() {
  const table=String(process.env.APPWRITE_TRYOUT_SETTINGS_TABLE_ID || 'tryout_settings');
  const url=`/tablesdb/${encodeURIComponent(appwriteConfig().databaseId)}/tables/${encodeURIComponent(table)}/rows?${queryParam({method:'equal',attribute:'key',values:['tryout','confirmation_email']})}&${queryParam({method:'limit',values:[2]})}`;
  const {response,payload}=await appwriteRequest(url);
  if(!response.ok)throw Error('The automatic registration email settings could not be loaded.');
  const rows=payload.rows || [];
  const dateRow=rows.find(row=>row.key==='tryout')||rows.find(row=>row.tryout_date);
  const iso=String(dateRow?.tryout_date || '').slice(0,10);
  const date=new Date(`${iso}T12:00:00Z`);
  const valid=/^\d{4}-\d{2}-\d{2}$/.test(iso)&&!Number.isNaN(date.getTime());
  const values={tryoutDate:valid?new Intl.DateTimeFormat('de-AT',{weekday:'long',day:'numeric',month:'numeric',year:'numeric',timeZone:'UTC'}).format(date):'',tryoutDateEn:valid?new Intl.DateTimeFormat('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(date):''};
  const custom=rows.find(row=>row.key==='confirmation_email');
  return {subject:custom?.confirmation_subject||DEFAULT_SUBJECT,body:custom?.confirmation_body||defaultBody(valid),values,custom:Boolean(custom?.confirmation_body),updatedAt:custom?.$updatedAt||null};
}
function render(config,data) {
  const values={...config.values,firstName:String(data.first_name||''),lastName:String(data.last_name||''),email:String(data.email||'')};
  const fill=text=>String(text).replace(/{{(\w+)}}/g,(_,name)=>values[name]??'');
  return {subject:fill(config.subject).replace(/[\r\n]/g,' '),text:fill(config.body)};
}
module.exports={load,render,validate,defaultBody,DEFAULT_SUBJECT};
