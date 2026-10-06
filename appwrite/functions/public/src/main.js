// emperors-public - anonymous-callable tasks (execute permission: any).
//   task "contact"        contact form email          (was ContactEmail)
//   task "log"            client diagnostics          (was LogClientEvent)
//   task "passwordReset"  Mailgun password reset link (new, replaces Appwrite recovery email)
//   task "roster"         public roster (only public member fields; members table is not public)
const { parseBody, applyEnvDefaults } = require("./shared/runtime");

const TASKS = {
  contact: () => require("./tasks/contact"),
  log: () => require("./tasks/log"),
  passwordReset: () => require("./tasks/passwordReset"),
  roster: () => require("./tasks/roster")
};

// Older frontends send no "task" field - infer it from the payload shape.
function resolveTask(body) {
  const explicit = String(body.task || "").trim();
  if (explicit) return explicit;
  if (body.contact && typeof body.contact === "object") return "contact";
  if (body.senderEmail) return "contact";
  if (body.event && typeof body.event === "object") return "log";
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
  return loader()(context);
};
