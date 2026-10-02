// SOURCE OF TRUTH: appwrite/functions/shared/ (see runtime.js)

function mailgunConfig() {
  return {
    apiKey: String(process.env.MAILGUN_API_KEY || "").trim(),
    domain: String(process.env.MAILGUN_DOMAIN || "").trim(),
    fromEmail: String(process.env.MAILGUN_FROM_EMAIL || process.env.CONTACT_FROM_EMAIL || "").trim(),
    apiBaseUrl: String(process.env.MAILGUN_API_BASE_URL || "https://api.eu.mailgun.net").trim().replace(/\/+$/, "")
  };
}

function isMailgunConfigured() {
  const config = mailgunConfig();
  return Boolean(config.apiKey && config.domain && config.fromEmail);
}

async function sendMailgun({ to, subject, text, html, replyTo, from }) {
  const config = mailgunConfig();
  if (!config.apiKey || !config.domain || !config.fromEmail) {
    throw new Error("MAILGUN_API_KEY, MAILGUN_DOMAIN and MAILGUN_FROM_EMAIL must be configured.");
  }
  const form = new FormData();
  form.set("from", from || config.fromEmail);
  form.set("to", to);
  if (replyTo) form.set("h:Reply-To", replyTo);
  form.set("subject", subject);
  if (text) form.set("text", text);
  if (html) form.set("html", html);

  const response = await fetch(`${config.apiBaseUrl}/v3/${encodeURIComponent(config.domain)}/messages`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`api:${config.apiKey}`).toString("base64")}` },
    body: form
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(payload?.message || `Mailgun failed (${response.status}).`));
  }
  return String(payload?.id || "");
}

module.exports = { mailgunConfig, isMailgunConfigured, sendMailgun };
