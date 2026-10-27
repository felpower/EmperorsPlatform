const test = require("node:test");
const assert = require("node:assert/strict");
const runtime = require("../appwrite/functions/admin/src/shared/runtime");
const tasksPath = "../appwrite/functions/admin/src/tasks/";
const result = (payload, status = 200) => ({ response: { ok: status < 400, status }, payload });
const context = (body) => ({ req: { body }, res: { json: (payload, status = 200) => ({ ...payload, httpStatus: status }) }, log() {} });

test("conversion retries linking without creating a duplicate member", async () => {
  const original = { ...runtime };
  const row = { $id: "submission-one", first_name: "Test", last_name: "Player", email: "test@example.invalid", contact_consent: true, status: "attended" };
  const members = new Map(); let createCount = 0, linkCount = 0;
  runtime.appwriteConfig = () => ({ databaseId: "test", membersCollectionId: "members" });
  runtime.appwriteRequest = async (path, options = {}) => {
    if (path.includes("tryout_registrations")) {
      if (options.method === "PATCH") { linkCount++; if (linkCount === 1) return result({ message: "database temporarily unavailable" }, 500); Object.assign(row, options.body.data); }
      return result(row);
    }
    if (path.includes("?")) return result({ documents: [...members.values()] });
    if (options.method === "POST") { createCount++; const member = { $id: options.body.documentId, ...options.body.data }; members.set(member.$id, member); return result(member); }
    return members.has(path.split("/").at(-1)) ? result(members.get(path.split("/").at(-1))) : result({}, 404);
  };
  const filename = require.resolve(tasksPath + "tryoutConvert"); delete require.cache[filename];
  try {
    const convert = require(filename);
    const first = await convert(context({ submissionId: row.$id })); assert.equal(first.ok, false); assert.match(first.error, /linking/);
    const retry = await convert(context({ submissionId: row.$id })); assert.equal(retry.ok, true); assert.equal(createCount, 1); assert.equal(row.status, "joined");
    const again = await convert(context({ submissionId: row.$id })); assert.equal(again.ok, true); assert.equal(createCount, 1);
  } finally { Object.assign(runtime, original); delete require.cache[filename]; }
});
test("conversion rejects registrations that have not attended and exited matching members", async () => {
  const original = { ...runtime }; let attended = false;
  runtime.appwriteConfig = () => ({ databaseId: "test", membersCollectionId: "members" });
  runtime.appwriteRequest = async (path) => path.includes("tryout_registrations") ? result({ $id: "one", email: "a@example.invalid", contact_consent: true, status: attended ? "attended" : "invited" })
    : result({ documents: [{ $id: "member", email: "a@example.invalid", membership_status: "exited" }] });
  const filename = require.resolve(tasksPath + "tryoutConvert"); delete require.cache[filename];
  try {
    const convert = require(filename);
    assert.equal((await convert(context({ submissionId: "one" }))).httpStatus, 400);
    attended = true; assert.equal((await convert(context({ submissionId: "one" }))).httpStatus, 409);
  } finally { Object.assign(runtime, original); delete require.cache[filename]; }
});
test("mail success and database failure are reported separately, joined participants are not downgraded", async () => {
  const original = { ...runtime }, oldFetch = global.fetch, oldEnv = { ...process.env };
  Object.assign(process.env, { MAILGUN_API_KEY: "test", MAILGUN_DOMAIN: "example.invalid", MAILGUN_FROM_EMAIL: "test@example.invalid" });
  runtime.appwriteConfig = () => ({ databaseId: "test" });
  let mailCalls = 0, patchCalls = 0;
  global.fetch = async () => { mailCalls++; return { ok: true, json: async () => ({ id: "test-message" }) }; };
  runtime.appwriteRequest = async (path, options = {}) => {
    if (options.method === "PATCH") { patchCalls++; return result({ message: "schema update failed" }, 500); }
    return result({ email: path.endsWith("joined") ? "joined@example.invalid" : "new@example.invalid", status: path.endsWith("joined") ? "joined" : "new" });
  };
  const filename = require.resolve(tasksPath + "tryoutEmail"); delete require.cache[filename];
  try {
    const send = require(filename);
    const response = await send(context({ subject: "Test", bodyTemplate: "Hello {{firstName}}", recipients: [{ id: "new", email: "new@example.invalid" }, { id: "joined", email: "joined@example.invalid" }] }));
    assert.equal(response.ok, true); assert.equal(response.sentCount, 2); assert.equal(response.failedCount, 0);
    assert.equal(response.statusFailures.length, 1); assert.match(response.statusFailures[0].reason, /schema/);
    assert.equal(mailCalls, 2); assert.equal(patchCalls, 1);
    assert.equal(response.sent[0].messageId, "test-message"); assert.equal(response.sent[0].deliveryStatus, "accepted");
  } finally { Object.assign(runtime, original); global.fetch = oldFetch; for (const key of Object.keys(process.env)) if (!(key in oldEnv)) delete process.env[key]; Object.assign(process.env, oldEnv); delete require.cache[filename]; }
});
test("member conversion is restricted to admins server-side", () => {
  assert.deepEqual(require("../appwrite/functions/admin/src/auth").DEFAULT_TASK_ROLES.tryoutConvert, ["admin"]);
});

test('automatic registration template renders saved wording and personal/date placeholders',async()=>{
  const helper=require('../appwrite/functions/public/src/shared/tryout-confirmation');
  assert.equal(helper.DEFAULT_SUBJECT,'Uni Wien Emperors Tryout \u2013 Anmeldung best\u00e4tigt');
  const result=helper.render({subject:'Welcome {{firstName}}',body:'Hi {{firstName}} {{lastName}}, {{tryoutDateEn}}; {{email}}',values:{tryoutDateEn:'Tuesday, 27 October 2026'}},{first_name:'Rookie',last_name:'Example',email:'r@example.invalid'});
  assert.equal(result.subject,'Welcome Rookie');assert.match(result.text,/Rookie Example, Tuesday/);assert.match(result.text,/r@example.invalid/);
  assert.throws(()=>helper.validate('Subject\ninjection','Text'),/one line/);
  assert.throws(()=>helper.validate('Subject','Hi {{unknown}}'),/Unknown placeholder/);
});
test('new tryout registrations use configured confirmation; duplicate registrations do not send again',async()=>{
  const runtime=require('../appwrite/functions/public/src/shared/runtime'),mailgun=require('../appwrite/functions/public/src/shared/mailgun'),helper=require('../appwrite/functions/public/src/shared/tryout-confirmation');
  const oldRuntime={...runtime},oldMail={...mailgun},oldLoad=helper.load;let existing=false,sends=0;
  runtime.appwriteConfig=()=>({databaseId:'test'});
  runtime.appwriteRequest=async(path,options={})=>{
    if(options.method==='POST')return result({$id:'new-person'});
    if(options.method==='PATCH')return result({});
    return result({rows:existing?[{$id:'old-person',email:'rookie@example.invalid',phone:'',tryout_cycle:'next'}]:[]});
  };
  helper.load=async()=>({subject:'Today: {{firstName}}',body:'Meet at 19:30 today, {{firstName}}.',values:{}});
  mailgun.isMailgunConfigured=()=>true;mailgun.sendMailgun=async message=>{sends++;assert.equal(message.subject,'Today: Rookie');assert.match(message.text,/19:30 today, Rookie/);return 'accepted';};
  const file=require.resolve('../appwrite/functions/public/src/tasks/tryoutRegister');delete require.cache[file];
  try{
    const task=require(file),body={registration:{first_name:'Rookie',last_name:'Example',email:'rookie@example.invalid',contact_consent:true}};
    const response=await task({...context(body),log(){}});assert.equal(response.ok,true);assert.equal(response.emailed,true);
    existing=true;const duplicate=await task({...context(body),log(){}});assert.equal(duplicate.duplicate,true);assert.equal(duplicate.emailed,false);assert.equal(sends,1);
    existing=false;helper.load=async()=>{throw Error('Settings unavailable');};
    const failed=await task({...context(body),log(){}});assert.equal(failed.ok,true);assert.equal(failed.emailed,false);assert.equal(sends,1);
  }finally{Object.assign(runtime,oldRuntime);Object.assign(mailgun,oldMail);helper.load=oldLoad;delete require.cache[file];}
});
test('automatic confirmation editing is admin-only and saving validates before any write',async()=>{
  assert.deepEqual(require('../appwrite/functions/admin/src/auth').DEFAULT_TASK_ROLES.tryoutConfirmation,['admin']);
  const task=require('../appwrite/functions/admin/src/tasks/tryoutConfirmation');
  const response=await task(context({action:'save',subject:'',body:'hello'}));assert.equal(response.httpStatus,400);
});

test('saving the automatic template writes only its settings document and never sends a message',async()=>{
  const runtime=require('../appwrite/functions/admin/src/shared/runtime'),original={...runtime},writes=[];
  runtime.appwriteConfig=()=>({databaseId:'test'});
  runtime.appwriteRequest=async(path,options)=>{writes.push({path,...options});return options.method==='PATCH'?result({},404):result({$updatedAt:'2026-10-27T12:00:00Z'});};
  const filename=require.resolve('../appwrite/functions/admin/src/tasks/tryoutConfirmation');delete require.cache[filename];
  try {
    const task=require(filename),saved=await task(context({action:'save',subject:'New instructions',body:'Hi {{firstName}}, see you today at 19:30.'}));
    assert.equal(saved.ok,true);assert.equal(writes.length,2);
    assert.ok(writes.every(write=>write.path.includes('/tryout_settings/documents')));
    assert.equal(writes[1].body.documentId,'confirmation-email');
    assert.equal(writes[1].body.data.key,'confirmation_email');
    assert.equal(writes[1].body.data.confirmation_subject,'New instructions');
    assert.equal(writes[1].body.data.tryout_date,undefined);
  }finally{Object.assign(runtime,original);delete require.cache[filename];}
});
