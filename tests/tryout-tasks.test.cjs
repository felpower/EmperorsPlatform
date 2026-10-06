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
  } finally { Object.assign(runtime, original); global.fetch = oldFetch; for (const key of Object.keys(process.env)) if (!(key in oldEnv)) delete process.env[key]; Object.assign(process.env, oldEnv); delete require.cache[filename]; }
});
test("member conversion is restricted to admins server-side", () => {
  assert.deepEqual(require("../appwrite/functions/admin/src/auth").DEFAULT_TASK_ROLES.tryoutConvert, ["admin"]);
});
