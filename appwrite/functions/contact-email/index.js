const CONTACT_SUBJECT_TYPE_LABELS = {
  general: "General Question",
  sponsorship: "Sponsorship Inquiry",
  partnership: "Partnership / Collaboration",
  tryout: "Tryout / Joining the Team",
  game_event: "Game or Event Request",
  media: "Media / Press Request",
  website: "Website or Data Issue",
  other: "Other"
};

module.exports = async ({ req, res, log }) => {
  const recipientEmail = String(process.env.CONTACT_RECIPIENT_EMAIL || "p.felbauer@emperors.at").trim();
  const subjectPrefix = String(process.env.CONTACT_SUBJECT_PREFIX || "Emperors Contact").trim();
  const resendApiKey = String(process.env.RESEND_API_KEY || "").trim();
  const resendFromEmail = String(process.env.RESEND_FROM_EMAIL || process.env.CONTACT_FROM_EMAIL || recipientEmail).trim();
  const webhookUrl = String(process.env.CONTACT_WEBHOOK_URL || "").trim();

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

  const clampText = (value, maxLength) => {
    const text = String(value || "").trim();
    return text.length > maxLength ? text.slice(0, maxLength) : text;
  };

  const isEmailAddress = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

  const fail = (message, status = 400) => {
    const error = String(message || "Could not send contact message.").trim();
    log(`Contact email failed: ${error}`);
    return res.json({ ok: false, error }, status);
  };

  const formError = (message, statusCode = 400) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
  };

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");

  const topicLabel = (value) => CONTACT_SUBJECT_TYPE_LABELS[String(value || "").trim()] || "General Question";

  const normalizeSubmission = (input) => {
    const body = input && typeof input === "object" ? input : {};
    if (String(body.website || "").trim()) {
      return { bot: true };
    }

    const subjectType = clampText(body.subjectType, 80);
    const subject = clampText(body.subject, 140);
    const message = clampText(body.message, 4000);
    const senderName = clampText(body.senderName, 120);
    const senderEmail = clampText(body.senderEmail, 320).toLowerCase();
    const pageUrl = clampText(body.pageUrl, 500);

    if (!senderEmail) throw formError("Please enter your email address.");
    if (!isEmailAddress(senderEmail)) throw formError("Please enter a valid email address.");
    if (!Object.prototype.hasOwnProperty.call(CONTACT_SUBJECT_TYPE_LABELS, subjectType)) {
      throw formError("Please select a valid topic.");
    }
    if (subject.length < 3) throw formError("Please add a short subject.");
    if (message.length < 10) throw formError("Please add a message with a little more detail.");

    return {
      bot: false,
      subjectType,
      subject,
      message,
      senderName,
      senderEmail,
      pageUrl,
      submittedAt: new Date().toISOString()
    };
  };

  const notificationSubject = (submission) => {
    return `[${subjectPrefix}] ${topicLabel(submission.subjectType)}: ${submission.subject}`.slice(0, 220);
  };

  const notificationText = (submission) => {
    return [
      "New Uni Wien Emperors contact form submission",
      "",
      `Topic: ${topicLabel(submission.subjectType)}`,
      `Subject: ${submission.subject}`,
      `From: ${submission.senderName || "Not provided"} <${submission.senderEmail}>`,
      `Submitted: ${submission.submittedAt}`,
      submission.pageUrl ? `Page: ${submission.pageUrl}` : "",
      "",
      "Message:",
      submission.message
    ].filter((line) => line !== "").join("\n");
  };

  const notificationHtml = (submission) => {
    const rows = [
      ["Topic", topicLabel(submission.subjectType)],
      ["Subject", submission.subject],
      ["From", `${submission.senderName || "Not provided"} <${submission.senderEmail}>`],
      ["Submitted", submission.submittedAt],
      ["Page", submission.pageUrl || "-"]
    ];

    return `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#151b1c;">
        <h2 style="margin:0 0 16px;">New Uni Wien Emperors contact message</h2>
        <table style="border-collapse:collapse;margin-bottom:18px;">
          ${rows.map(([label, value]) => `
            <tr>
              <th style="text-align:left;padding:6px 12px 6px 0;color:#5b676c;">${escapeHtml(label)}</th>
              <td style="padding:6px 0;">${escapeHtml(value)}</td>
            </tr>
          `).join("")}
        </table>
        <div style="white-space:pre-wrap;border-left:4px solid #f6c316;padding:12px 16px;background:#f8fafb;">${escapeHtml(submission.message)}</div>
      </div>
    `;
  };

  const sendViaResend = async (submission) => {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: resendFromEmail,
        to: [recipientEmail],
        reply_to: submission.senderEmail,
        subject: notificationSubject(submission),
        text: notificationText(submission),
        html: notificationHtml(submission)
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(String(payload?.message || payload?.error || `Resend failed (${response.status}).`));
    }
    return { provider: "resend", id: String(payload?.id || "") };
  };

  const sendViaWebhook = async (submission) => {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientEmail,
        subject: notificationSubject(submission),
        text: notificationText(submission),
        html: notificationHtml(submission),
        submission
      })
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Webhook failed (${response.status}): ${text || "Request was rejected."}`);
    }
    return { provider: "webhook" };
  };

  try {
    if (!recipientEmail || !isEmailAddress(recipientEmail)) {
      return fail("CONTACT_RECIPIENT_EMAIL is missing or invalid.", 500);
    }

    const body = parseBody();
    const submission = normalizeSubmission(body.contact && typeof body.contact === "object" ? body.contact : body);
    if (submission.bot) {
      return res.json({ ok: true, ignored: true });
    }

    let delivery = null;
    if (resendApiKey) {
      delivery = await sendViaResend(submission);
    } else if (webhookUrl) {
      delivery = await sendViaWebhook(submission);
    } else {
      return fail("Contact email delivery is not configured. Set RESEND_API_KEY or CONTACT_WEBHOOK_URL.", 500);
    }

    log(`Contact email sent to ${recipientEmail} via ${delivery.provider}.`);
    return res.json({
      ok: true,
      recipientEmail,
      provider: delivery.provider,
      id: delivery.id || ""
    });
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Unknown contact email error.",
      Number(error?.statusCode || 500)
    );
  }
};
