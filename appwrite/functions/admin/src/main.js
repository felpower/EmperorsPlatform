// emperors-admin - signed-in tasks (execute permission: users), role-checked in src/auth.js.
//   task "invite"       create/find auth user, send invite link   (was CreateAuthAccount)
//   task "passSync"     Clubee XLSX pass sync preview/apply       (was PassSyncFunction)
//   task "sepaExport"   SEPA XML export                           (was SepaExport)
//   task "tryoutEmail"  emails to tryout registrants              (was TryoutEmail)
//   task "setPassword"  set own password after invite/reset link  (new)
const { parseBody, applyEnvDefaults } = require("./shared/runtime");
const { authorize } = require("./auth");

const TASKS = {
  invite: () => require("./tasks/invite"),
  passSync: () => require("./tasks/passSync"),
  sepaExport: () => require("./tasks/sepaExport"),
  tryoutEmail: () => require("./tasks/tryoutEmail"),
  setPassword: () => require("./tasks/setPassword")
};

// Older frontends send no "task" field - infer it from the payload shape.
// (passSync keeps its own "action": "preview" | "apply" field, hence "task" for routing.)
function resolveTask(body) {
  const explicit = String(body.task || "").trim();
  if (explicit) return explicit;
  if (body.feePeriod !== undefined) return "sepaExport";
  if (body.fileBase64 !== undefined) return "passSync";
  if (body.bodyTemplate !== undefined && Array.isArray(body.recipients)) return "tryoutEmail";
  if (body.email !== undefined) return "invite";
  return "";
}

module.exports = async (context) => {
  const { req, res, log } = context;
  applyEnvDefaults(req);
  const body = parseBody(req);
  const task = resolveTask(body);
  const loader = Object.prototype.hasOwnProperty.call(TASKS, task) ? TASKS[task] : null;
  if (!loader) {
    log(`Unknown task "${task}".`);
    return res.json({ ok: false, error: `Unknown task "${task}". Expected one of: ${Object.keys(TASKS).join(", ")}.` }, 400);
  }

  let access;
  try {
    access = await authorize(req, task);
  } catch (error) {
    log(`Role check failed for ${task}: ${error instanceof Error ? error.message : error}`);
    return res.json({ ok: false, error: "Could not verify your permissions. Please try again." }, 500);
  }
  if (!access.ok) {
    log(`Denied ${task} for user ${access.userId || "(anonymous)"} with roles [${(access.roles || []).join(", ")}].`);
    return res.json({ ok: false, error: access.error }, access.status);
  }
  return loader()(context);
};
