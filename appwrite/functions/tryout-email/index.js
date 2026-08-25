module.exports = async ({ req, res, log }) => {
  const mailgunApiKey = String(process.env.MAILGUN_API_KEY || "").trim();
  const mailgunDomain = String(process.env.MAILGUN_DOMAIN || "").trim();
  const mailgunFromEmail = String(process.env.MAILGUN_FROM_EMAIL || process.env.CONTACT_FROM_EMAIL || "").trim();
  const mailgunApiBaseUrl = String(process.env.MAILGUN_API_BASE_URL || "https://api.eu.mailgun.net").trim().replace(/\/+$/, "");

  const parseBody = () => {
    try {
      if (!req || req.body === undefined || req.body === null) return {};
      if (typeof req.body === "string") {
        return req.body.trim() ? JSON.parse(req.body) : {};
      }
      if (typeof req.body === "object") return req.body;
      return {};
    } catch {
      return {};
    }
  };

  const isEmailAddress = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

  const fail = (message, status = 400) => {
    const error = String(message || "Could not send tryout emails.").trim();
    log(`Tryout email failed: ${error}`);
    return res.json({ ok: false, error }, status);
  };

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");

  const fillTemplate = (template, recipient) => {
    return String(template || "")
      .replaceAll("{{firstName}}", String(recipient.firstName || "").trim())
      .replaceAll("{{lastName}}", String(recipient.lastName || "").trim())
      .replaceAll("{{email}}", String(recipient.email || "").trim());
  };

  const bodyHtml = (text) => `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#151b1c;white-space:pre-wrap;">${escapeHtml(text)}</div>
  `;

  const sendViaMailgun = async (recipientEmail, subject, text) => {
    const form = new FormData();
    form.set("from", mailgunFromEmail);
    form.set("to", recipientEmail);
    form.set("subject", subject);
    form.set("text", text);
    form.set("html", bodyHtml(text));

    const response = await fetch(`${mailgunApiBaseUrl}/v3/${encodeURIComponent(mailgunDomain)}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${mailgunApiKey}`).toString("base64")}`
      },
      body: form
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(String(payload?.message || `Mailgun failed (${response.status}).`));
    }
    return String(payload?.id || "");
  };

  try {
    if (!mailgunApiKey || !mailgunDomain || !mailgunFromEmail) {
      return fail("MAILGUN_API_KEY, MAILGUN_DOMAIN, and MAILGUN_FROM_EMAIL must be configured for this function.", 500);
    }

    const body = parseBody();
    const subjectTemplate = String(body.subject || "").trim();
    const bodyTemplate = String(body.bodyTemplate || "").trim();
    const recipients = Array.isArray(body.recipients) ? body.recipients : [];

    if (!subjectTemplate) return fail("subject is required.");
    if (!bodyTemplate) return fail("bodyTemplate is required.");
    if (!recipients.length) return fail("recipients must be a non-empty array.");
    if (recipients.length > 300) return fail("Too many recipients in one send (max 300).");

    const sent = [];
    const failed = [];

    for (const recipient of recipients) {
      const email = String(recipient?.email || "").trim();
      const id = String(recipient?.id || "").trim();
      if (!isEmailAddress(email)) {
        failed.push({ id, email, reason: "Invalid or missing email address." });
        continue;
      }
      try {
        await sendViaMailgun(
          email,
          fillTemplate(subjectTemplate, recipient),
          fillTemplate(bodyTemplate, recipient)
        );
        sent.push({ id, email });
      } catch (error) {
        failed.push({ id, email, reason: error instanceof Error ? error.message : "Unknown send error." });
      }
    }

    log(`Tryout email batch: ${sent.length} sent, ${failed.length} failed.`);
    return res.json({
      ok: true,
      sentCount: sent.length,
      failedCount: failed.length,
      sent,
      failed
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unknown tryout email error.", 500);
  }
};
