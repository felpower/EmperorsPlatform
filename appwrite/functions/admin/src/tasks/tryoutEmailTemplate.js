// Branded HTML for tryout emails (same look as the invite/reset emails).
// Deliverability: table layout with inline styles, no images, no hidden text,
// every link shows its own URL as text, plain-text part is sent alongside,
// and the footer says why the recipient gets this mail.

const C = {
  page: "#f4f1e8", card: "#ffffff", border: "#e6ddc7", header: "#123127", gold: "#d7ab39",
  text: "#17211d", muted: "#5c6770", soft: "#73808a", link: "#166d94", footer: "#fcfaf5", rule: "#ece4cf", box: "#f8f5ec"
};

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll("\"", "&quot;").replaceAll("'", "&#39;");

// Escape first, then turn URLs and email addresses into links whose text is the target itself.
function inline(text) {
  return escapeHtml(text)
    .replace(/\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)]/g, (url) => `<a href="${url}" style="color:${C.link}; text-decoration:underline;">${url}</a>`)
    .replace(/(^|[\s(])([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, (m, pre, mail) => `${pre}<a href="mailto:${mail}" style="color:${C.link}; text-decoration:underline;">${mail}</a>`);
}

const P = `margin:0 0 16px; font-size:16px; line-height:1.7; color:${C.text};`;
const isBullet = (line) => /^\s*[-•*]\s+/.test(line);
const detailMatch = (line) => line.match(/^\s*([^:\n]{2,24}):\s+(.+)$/);

function renderBlock(lines) {
  // "---------- English version below ----------" becomes a labelled divider.
  const divider = lines.length === 1 && lines[0].match(/^\s*-{3,}\s*(.*?)\s*-{3,}\s*$/);
  if (divider) {
    const label = divider[1] ? `<span style="display:inline-block; padding:0 10px; background:${C.card}; font-size:12px; letter-spacing:1.4px; text-transform:uppercase; color:${C.soft};">${escapeHtml(divider[1])}</span>` : "";
    return `<div style="margin:28px 0 24px; border-top:1px solid ${C.rule}; text-align:center; line-height:0;">${label}</div>`;
  }
  if (lines.every(isBullet)) {
    const items = lines.map((line) => `<li style="margin:0 0 6px;">${inline(line.replace(/^\s*[-•*]\s+/, ""))}</li>`).join("");
    return `<ul style="margin:0 0 16px; padding-left:22px; font-size:16px; line-height:1.6; color:${C.text};">${items}</ul>`;
  }
  // A heading line followed by bullets ("Bitte bring mit:" + "- ...").
  if (lines.length > 1 && !isBullet(lines[0]) && lines.slice(1).every(isBullet)) {
    return `<p style="${P} margin-bottom:8px;"><strong>${inline(lines[0])}</strong></p>${renderBlock(lines.slice(1))}`;
  }
  // "Datum: ..." / "Ort: ..." lines become a highlighted details box.
  if (lines.length >= 2 && lines.every((line) => detailMatch(line))) {
    const rows = lines.map((line) => {
      const [, label, value] = detailMatch(line);
      return `<tr><td style="padding:6px 16px 6px 0; font-size:14px; font-weight:700; color:${C.muted}; white-space:nowrap; vertical-align:top;">${escapeHtml(label)}</td><td style="padding:6px 0; font-size:16px; line-height:1.5; color:${C.text};">${inline(value)}</td></tr>`;
    }).join("");
    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 20px; background:${C.box}; border-left:4px solid ${C.gold}; border-radius:12px;"><tr><td style="padding:14px 18px;"><table role="presentation" cellspacing="0" cellpadding="0">${rows}</table></td></tr></table>`;
  }
  return `<p style="${P}">${lines.map(inline).join("<br>")}</p>`;
}

function renderBody(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((block) => block.split("\n").filter((line) => line.trim()))
    .filter((lines) => lines.length)
    .map(renderBlock)
    .join("\n");
}

const FOOTER_TEXT = "Du erhältst diese E-Mail, weil du dich auf emperors.page für ein Tryout der Uni Wien Emperors angemeldet hast. Fragen? Antworte einfach auf diese E-Mail.";
const FOOTER_TEXT_EN = "You are receiving this email because you registered for a Uni Wien Emperors tryout on emperors.page. Questions? Just reply to this email.";

function renderTryoutEmail({ subject, text }) {
  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0; padding:0; background:${C.page}; color:${C.text}; font-family:Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${C.page}; padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px; background:${C.card}; border-radius:20px; overflow:hidden; border:1px solid ${C.border};">
            <tr>
              <td style="background:${C.header}; padding:0; color:#ffffff;">
                <div style="height:6px; background:${C.gold};"></div>
                <div style="padding:28px 32px 30px;">
                  <p style="margin:0 0 8px; font-size:12px; letter-spacing:1.8px; text-transform:uppercase; color:#d8e4de;">Uni Wien Emperors &middot; Tryout</p>
                  <h1 style="margin:0; font-size:26px; line-height:1.25; color:#ffffff;">${escapeHtml(subject)}</h1>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 32px 16px;">
${renderBody(text)}
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px; border-top:1px solid ${C.rule}; background:${C.footer};">
                <p style="margin:0 0 6px; font-size:12px; line-height:1.7; color:${C.soft};">${escapeHtml(FOOTER_TEXT)}</p>
                <p style="margin:0 0 6px; font-size:12px; line-height:1.7; color:${C.soft};">${escapeHtml(FOOTER_TEXT_EN)}</p>
                <p style="margin:0; font-size:12px; line-height:1.7; color:${C.soft};">Uni Wien Emperors &middot; American Football an der Universit&auml;t Wien &middot; <a href="https://emperors.page" style="color:${C.soft}; text-decoration:underline;">https://emperors.page</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function plainTextFooter() {
  return `\n\n--\n${FOOTER_TEXT}\n${FOOTER_TEXT_EN}\nUni Wien Emperors – https://emperors.page`;
}

module.exports = { renderTryoutEmail, plainTextFooter, renderBody };
