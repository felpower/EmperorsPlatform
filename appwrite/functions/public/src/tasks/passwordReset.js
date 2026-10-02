// Anonymous "Forgot password?" request. Always answers ok:true so the endpoint
// cannot be used to find out which email addresses have an account.
const { parseBody, appwriteRequest, queryParam } = require("../shared/runtime");
const { sendAuthLinkEmail, getPrefs, ttlSeconds } = require("../shared/auth-links");

const THROTTLE_MS = Number(process.env.RESET_THROTTLE_SECONDS || 120) * 1000;

module.exports = async ({ req, res, log }) => {
  const body = parseBody(req);
  const email = String(body.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.json({ ok: false, error: "Please enter a valid email address." }, 400);
  }

  try {
    const list = await appwriteRequest(`/users?${queryParam({ method: "equal", attribute: "email", values: [email] })}`);
    if (!list.response.ok) throw new Error(list.payload?.message || "Could not search users.");
    const user = (list.payload?.users || []).find((entry) => String(entry?.email || "").toLowerCase() === email);
    if (!user || user.status === false) {
      log(`Password reset requested for unknown/blocked address.`);
      return res.json({ ok: true });
    }

    const prefs = await getPrefs(user.$id);
    const lastSent = Date.parse(String(prefs.authMailSentAt || ""));
    if (Number.isFinite(lastSent) && Date.now() - lastSent < THROTTLE_MS) {
      log(`Password reset throttled for ${user.$id}.`);
      return res.json({ ok: true, throttled: true });
    }

    // "kind" only changes the wording; anonymous requests always get the short reset TTL.
    const kind = body.kind === "invite" ? "invite" : "reset";
    await sendAuthLinkEmail({ userId: user.$id, email, name: user.name, kind, redirectTo: body.redirectTo, ttl: ttlSeconds("reset") });
    log(`Password ${kind} link mailed to user ${user.$id}.`);
    return res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not send reset email.";
    log(`Password reset failed: ${message}`);
    return res.json({ ok: false, error: "Could not send the reset email right now. Please try again later." }, 500);
  }
};
