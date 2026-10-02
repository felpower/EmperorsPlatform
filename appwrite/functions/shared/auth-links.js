// Invite / password-reset links sent through Mailgun instead of Appwrite's
// built-in recovery email (custom SMTP + custom templates are Pro-only).
//
// Flow: the server creates a one-time login token (POST /users/{id}/tokens) and
// mails a link  <site>/recovery?mode=token&userId=..&secret=..  The frontend turns
// it into a session (account.createSession) and calls the admin function task
// "setPassword", which is only allowed while prefs.pwSetupUntil is in the future.
//
// SOURCE OF TRUTH: appwrite/functions/shared/ (see runtime.js)
const fs = require("fs");
const path = require("path");
const { appwriteRequest } = require("./runtime");
const { sendMailgun } = require("./mailgun");

const DEFAULT_ALLOWED_HOSTS = ["emperors.page", "www.emperors.page", "localhost", "127.0.0.1"];

function ttlSeconds(kind) {
  const raw = kind === "invite"
    ? process.env.INVITE_LINK_TTL_SECONDS || 3 * 24 * 3600
    : process.env.RESET_LINK_TTL_SECONDS || 3600;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 60 ? Math.floor(value) : 3600;
}

function allowedHosts() {
  const configured = String(process.env.AUTH_LINK_ALLOWED_HOSTS || "")
    .split(",").map((entry) => entry.trim().toLowerCase()).filter(Boolean);
  return configured.length ? configured : DEFAULT_ALLOWED_HOSTS;
}

// Only ever mail links that point at our own site.
function resolveRecoveryUrl(redirectTo) {
  const fallback = String(process.env.PUBLIC_SITE_URL || "https://emperors.page/recovery").trim();
  for (const candidate of [redirectTo, fallback]) {
    try {
      const url = new URL(String(candidate || "").trim());
      if (!/^https?:$/.test(url.protocol)) continue;
      if (!allowedHosts().includes(url.hostname.toLowerCase())) continue;
      if (!/recovery/i.test(url.pathname)) url.pathname = "/recovery";
      url.search = "";
      url.hash = "";
      return url;
    } catch {
      // try next candidate
    }
  }
  throw new Error("No allowed recovery URL (check PUBLIC_SITE_URL / AUTH_LINK_ALLOWED_HOSTS).");
}

async function getPrefs(userId) {
  const result = await appwriteRequest(`/users/${encodeURIComponent(userId)}/prefs`);
  if (!result.response.ok) throw new Error(result.payload?.message || "Could not read user prefs.");
  return result.payload && typeof result.payload === "object" ? result.payload : {};
}

async function mergePrefs(userId, patch) {
  const current = await getPrefs(userId);
  const next = { ...current, ...patch };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined) delete next[key];
  }
  const result = await appwriteRequest(`/users/${encodeURIComponent(userId)}/prefs`, {
    method: "PATCH",
    body: { prefs: next }
  });
  if (!result.response.ok) throw new Error(result.payload?.message || "Could not update user prefs.");
  return next;
}

async function createLoginToken(userId, expire) {
  let lastMessage = "";
  for (const length of [64, 32]) {
    const result = await appwriteRequest(`/users/${encodeURIComponent(userId)}/tokens`, {
      method: "POST",
      body: { length, expire }
    });
    if (result.response.ok && result.payload?.secret) return result.payload;
    lastMessage = String(result.payload?.message || `status ${result.response.status}`);
  }
  throw new Error(`Could not create login token: ${lastMessage}`);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;").replaceAll("'", "&#39;");
}

function renderTemplate(kind, { actionUrl, email, name }) {
  const file = path.join(__dirname, "templates", kind === "invite" ? "invite.html" : "recovery.html");
  const template = fs.readFileSync(file, "utf8");
  return template
    .replaceAll("[[APPWRITE_ACTION_URL]]", escapeHtml(actionUrl))
    .replaceAll("[[APPWRITE_USER_EMAIL]]", escapeHtml(email))
    .replaceAll("[[APPWRITE_USER_NAME_OR_FALLBACK]]", escapeHtml(name || "there"));
}

function emailSubject(kind) {
  return kind === "invite"
    ? String(process.env.INVITE_EMAIL_SUBJECT || "Set your Uni Wien Emperors password")
    : String(process.env.RESET_EMAIL_SUBJECT || "Reset your Uni Wien Emperors password");
}

function emailText(kind, { actionUrl, email, name, expire }) {
  const intro = kind === "invite"
    ? "You have been invited to the Uni Wien Emperors platform. Set your password with this link:"
    : "Someone (hopefully you) asked to reset the password of your Uni Wien Emperors account. Set a new password with this link:";
  return [
    `Hello ${name || "there"},`,
    "",
    intro,
    actionUrl,
    "",
    `This link is for ${email} and is valid until ${expire}.`,
    kind === "invite" ? "" : "If you did not request this, you can ignore this email.",
    "",
    "Uni Wien Emperors Team Operations"
  ].join("\n");
}

// kind: "invite" | "reset"
async function sendAuthLinkEmail({ userId, email, name, kind, redirectTo, ttl: ttlOverride }) {
  const ttl = Number.isFinite(ttlOverride) && ttlOverride >= 60 ? Math.floor(ttlOverride) : ttlSeconds(kind);
  const token = await createLoginToken(userId, ttl);
  const expire = String(token.expire || new Date(Date.now() + ttl * 1000).toISOString());

  const url = resolveRecoveryUrl(redirectTo);
  url.searchParams.set("mode", "token");
  url.searchParams.set("kind", kind);
  url.searchParams.set("userId", userId);
  url.searchParams.set("secret", String(token.secret));
  url.searchParams.set("email", email);
  const actionUrl = url.toString();

  await mergePrefs(userId, { pwSetupUntil: expire, authMailSentAt: new Date().toISOString() });
  const messageId = await sendMailgun({
    to: email,
    from: String(process.env.AUTH_FROM_EMAIL || "").trim() || undefined,
    replyTo: String(process.env.AUTH_REPLY_TO_EMAIL || "").trim() || undefined,
    subject: emailSubject(kind),
    text: emailText(kind, { actionUrl, email, name, expire }),
    html: renderTemplate(kind, { actionUrl, email, name })
  });
  return { expire, messageId };
}

function authEmailMode() {
  const mode = String(process.env.AUTH_EMAIL_MODE || "mailgun").trim().toLowerCase();
  return mode === "appwrite" ? "appwrite" : "mailgun";
}

module.exports = { sendAuthLinkEmail, getPrefs, mergePrefs, resolveRecoveryUrl, authEmailMode, ttlSeconds };
