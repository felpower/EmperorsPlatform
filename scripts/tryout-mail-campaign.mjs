// Controlled operator send: prepare first, --send once, --check for delivery.
// Recipient snapshots and message IDs stay in ignored migration-reports/.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { request, listAll, env, ENDPOINT, PROJECT_ID, DATABASE_ID } from './lib/appwrite-admin.mjs';
const campaignId = process.argv.find(x => x.startsWith('--campaign='))?.split('=')[1];
if (!/^[a-zA-Z0-9_-]{1,80}$/.test(campaignId || '')) throw Error('Supply --campaign=<unique-name>.');
const filename = `migration-reports/${campaignId}.json`;
const variables = (await request('/functions/emperors-admin/variables')).variables;
for (const item of variables) if (item.value) process.env[item.key] = item.value;
Object.assign(process.env, { APPWRITE_ENDPOINT: ENDPOINT, APPWRITE_PROJECT_ID: PROJECT_ID, APPWRITE_DATABASE_ID: DATABASE_ID, APPWRITE_API_KEY: env('APPWRITE_API_KEY') });
const base = (process.env.MAILGUN_API_BASE_URL || 'https://api.eu.mailgun.net').replace(/\/$/, '');
const domain = encodeURIComponent(process.env.MAILGUN_DOMAIN);
const headers = { Authorization: 'Basic ' + Buffer.from('api:' + process.env.MAILGUN_API_KEY).toString('base64') };
async function provider(path) {
  const response = await fetch(base + path, { headers });
  if (!response.ok) { const error = new Error(`Mailgun read failed (${response.status}).`); error.status = response.status; throw error; }
  return response.json();
}
const save = () => { fs.mkdirSync('migration-reports', { recursive: true }); fs.writeFileSync(filename + '.tmp', JSON.stringify(report, null, 2)); fs.renameSync(filename + '.tmp', filename); };
let report;
if (fs.existsSync(filename)) report = JSON.parse(fs.readFileSync(filename, 'utf8'));
else {
  if (process.argv.includes('--check')) throw Error('Campaign report does not exist.');
  const source = fs.readFileSync('app.bundle.js', 'utf8');
  const template = source.match(/const DEFAULT_TRYOUT_EMAIL_BODY = `([\s\S]*?)`;/)[1];
  const settings = await listAll(`/databases/${DATABASE_ID}/collections/tryout_settings/documents`, 'documents');
  const date = String(settings.find(x => x.key === 'tryout')?.tryout_date || settings[0]?.tryout_date).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < new Date().toISOString().slice(0, 10)) throw Error('Invalid or past tryout date.');
  const parsed = new Date(date + 'T12:00:00Z');
  const de = new Intl.DateTimeFormat('de-AT', { weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Vienna' }).format(parsed);
  const en = new Intl.DateTimeFormat('en-GB', { weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Vienna' }).format(parsed);
  const rows = await listAll(`/databases/${DATABASE_ID}/collections/tryout_registrations/documents`, 'documents');
  report = { campaignId, preparedAt: new Date().toISOString(), date, subject:'Uni Wien Emperors Tryout – Einladung', bodyTemplate:template.replaceAll('{{tryoutDate}}',de).replaceAll('{{tryoutDateEn}}',en), recipients:rows.filter(x => x.status === 'new').map(x => ({ id:x.$id,email:x.email,firstName:x.first_name,lastName:x.last_name })), outcomes:[] };
  save();
}
if (process.argv.includes('--check')) {
  const events = [];
  let next = `${base}/v3/${domain}/events?tags=${encodeURIComponent(campaignId)}&begin=${encodeURIComponent(new Date(report.preparedAt).toUTCString())}&ascending=yes&limit=300`;
  for (let i=0; next && i<20; i++) {
    const response = await fetch(next, { headers });
    if (!response.ok) throw Error(`Delivery log read failed (${response.status}).`);
    const page = await response.json(); events.push(...(page.items || []));
    next = page.items?.length ? page.paging?.next : null;
  }
  report.deliveryCheckedAt = new Date().toISOString();
  report.delivery = report.outcomes.flatMap(x => x.result?.sent || []).filter(x=>!x.duplicate).map(x => {
    const hits = events.filter(e => e.message?.headers?.['message-id']?.replace(/[<>]/g,'') === x.messageId?.replace(/[<>]/g,''));
    const delivered = hits.find(e=>e.event==='delivered');
    const failure = hits.filter(e=>e.event==='failed').sort((a,b)=>b.timestamp-a.timestamp)[0];
    return { email:x.email,messageId:x.messageId,status:delivered?'delivered':failure?`${failure.severity || 'unknown'} failure`:'pending',reason:failure?.['delivery-status']?.description };
  });
  save(); console.log(JSON.stringify({ campaignId, counts:report.delivery.reduce((a,x)=>(a[x.status]=(a[x.status]||0)+1,a),{}), problems:report.delivery.filter(x=>x.status!=='delivered') },null,2));
} else if (process.argv.includes('--retry-rejected')) {
  if(report.outcomes.some(x=>x.state==='uncertain')) throw Error('Resolve uncertain outcomes before retrying.');
  const accepted=new Set(report.outcomes.flatMap(x=>x.result?.sent || []).map(x=>x.email.toLowerCase()));
  const failedEmails=new Set(report.outcomes.flatMap(x=>x.result?.failed || []).map(x=>x.email.toLowerCase()));
  const recipients=report.recipients.filter(x=>failedEmails.has(x.email.toLowerCase())&&!accepted.has(x.email.toLowerCase()));
  const send=createRequire(import.meta.url)('../appwrite/functions/admin/src/tasks/tryoutEmail.js');
  for(const recipient of recipients) {
    const entry={recipients:[recipient],startedAt:new Date().toISOString(),state:'uncertain',retry:true};report.outcomes.push(entry);save();
    entry.result=await send({req:{body:{...report,recipients:[recipient]}},res:{json:payload=>payload},log(){}});
    entry.state=entry.result.ok&&!entry.result.uncertain?.length?'finished':'uncertain';save();
    console.log(JSON.stringify({accepted:entry.result.sentCount,failed:entry.result.failedCount,uncertain:entry.result.uncertain?.length}));
    if(entry.state==='uncertain'||entry.result.failedCount)throw Error('Retry stopped; inspect result before continuing.');
  }
} else if (process.argv.includes('--send')) {
  if (report.outcomes.length) throw Error('Campaign has already started. Check report/provider; never blindly resend.');
  const suppressed = new Set();
  for (const kind of ['bounces','unsubscribes','complaints']) {
    let path = `/v3/${domain}/${kind}?limit=1000`;
    for (let i=0; path && i<20; i++) {
      let page;
      try { page=await provider(path); }
      catch(error) {
        if (![401,403].includes(error.status)) throw error;
        report.suppressionPreflight = { status:'read-permission-unavailable', checkedAt:new Date().toISOString(), note:'Provider suppression enforcement remains enabled; no override is sent.' };
        save(); console.log(`Cannot read ${kind}; Mailgun will still enforce its suppression list.`); break;
      }
      for(const x of page.items || []) suppressed.add(String(x.address).toLowerCase());
      const next=page.paging?.next;
      path=page.items?.length && next ? new URL(next).pathname+new URL(next).search : null;
    }
  }
  const invalid=report.recipients.filter(x=>!/^\S+@\S+\.\S+$/.test(x.email || '') || suppressed.has(x.email.toLowerCase()));
  if(invalid.length) throw Error(`${invalid.length} invalid or suppressed recipients; review before sending.`);
  const groups = new Map();
  for(const x of report.recipients) { const key=x.email.trim().toLowerCase(); if(!groups.has(key))groups.set(key,[]);groups.get(key).push(x); }
  const send=createRequire(import.meta.url)('../appwrite/functions/admin/src/tasks/tryoutEmail.js');
  for(const recipients of groups.values()) {
    const entry={ recipients, startedAt:new Date().toISOString(), state:'uncertain' };report.outcomes.push(entry);save();
    entry.result=await send({req:{body:{...report,recipients}},res:{json:(payload,status=200)=>({...payload,httpStatus:status})},log(){} });
    entry.state=entry.result.ok && !entry.result.uncertain?.length ? 'finished' : 'uncertain';save();
    console.log(JSON.stringify({ processed:report.outcomes.length,total:groups.size,accepted:entry.result.sentCount,failed:entry.result.failedCount,uncertain:entry.result.uncertain?.length,statusFailures:entry.result.statusFailures?.length }));
    if(entry.state==='uncertain') throw Error('Stopped after an uncertain outcome; inspect report and Mailgun before proceeding.');
  }
} else {
  console.log(JSON.stringify({campaignId,date:report.date,registrations:report.recipients.length,uniqueAddresses:new Set(report.recipients.map(x=>x.email.trim().toLowerCase())).size,subject:report.subject,body:report.bodyTemplate},null,2));
}
