// Sets the password of the CALLING user after they signed in with a one-time
// invite/reset link (see shared/auth-links.js). Only allowed while the link's
// pwSetupUntil window in the user's prefs is open; the window is closed afterwards.
const { parseBody, header, appwriteRequest } = require("../shared/runtime");
const { getPrefs, mergePrefs } = require("../shared/auth-links");

module.exports = async ({ req, res, log }) => {
  const userId = header(req, "x-appwrite-user-id");
  if (!userId) return res.json({ ok: false, error: "Open the link from your email first." }, 401);

  const body = parseBody(req);
  const password = String(body.password || "");
  if (password.length < 8) return res.json({ ok: false, error: "The password must be at least 8 characters long." }, 400);
  if (password.length > 256) return res.json({ ok: false, error: "The password is too long." }, 400);

  try {
    const prefs = await getPrefs(userId);
    const until = Date.parse(String(prefs.pwSetupUntil || ""));
    if (!Number.isFinite(until) || until < Date.now()) {
      return res.json({ ok: false, error: "This password link has expired. Please request a new one." }, 403);
    }

    const result = await appwriteRequest(`/users/${encodeURIComponent(userId)}/password`, {
      method: "PATCH",
      body: { password }
    });
    if (!result.response.ok) {
      return res.json({ ok: false, error: String(result.payload?.message || "Could not set the password.") }, 400);
    }

    await mergePrefs(userId, { pwSetupUntil: null });
    log(`Password set for user ${userId}.`);
    return res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not set the password.";
    log(`setPassword failed: ${message}`);
    return res.json({ ok: false, error: message }, 500);
  }
};
