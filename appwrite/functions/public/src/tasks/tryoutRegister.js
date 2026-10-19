// Tryout registration from the website (replaces the direct table insert).
// - Detects repeat registrations (same e-mail, or same phone number) for the current tryout
//   cycle and updates the existing entry instead of creating another one.
// - Sends a confirmation e-mail for new registrations: "you are on the list, no need to sign up
//   again, we will send the details about a week before the tryout".
const { parseBody, appwriteConfig, appwriteRequest, queryParam } = require("../shared/runtime");
const { sendMailgun, isMailgunConfigured } = require("../shared/mailgun");
const { renderTryoutEmail, plainTextFooter } = require("./tryoutEmailTemplate");

const TABLE = String(process.env.APPWRITE_TRYOUT_REGISTRATIONS_COLLECTION_ID || "tryout_registrations").trim();
const SETTINGS = String(process.env.APPWRITE_TRYOUT_SETTINGS_TABLE_ID || "tryout_settings").trim();
const REPLY_TO = String(process.env.TRYOUT_REPLY_TO_EMAIL || "p.felbauer@emperors.at").trim();
const TEXT_FIELDS = { first_name: 80, last_name: 80, email: 200, phone: 40, uni_wien_student: 40, study_program: 200, previous_football_experience: 80, football_experience_details: 2000, other_sports: 500, preferred_position: 80, availability_notes: 2000, referred_by: 120 };
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const phoneKey = (v) => String(v || "").replace(/[^0-9]/g, "").replace(/^00/, "").replace(/^0/, "43").slice(-12);

function clean(input) {
  const out = {};
  Object.entries(TEXT_FIELDS).forEach(([key, max]) => { const v = String(input?.[key] ?? "").trim().slice(0, max); if (v) out[key] = v; });
  ["age", "height_cm", "weight_kg"].forEach((key) => { const n = Math.round(Number(input?.[key])); if (Number.isFinite(n) && n > 0 && n < 400) out[key] = n; });
  out.email = String(out.email || "").toLowerCase();
  out.contact_consent = input?.contact_consent === true;
  return out;
}

const rowsPath = () => `/tablesdb/${encodeURIComponent(appwriteConfig().databaseId)}/tables/${encodeURIComponent(TABLE)}/rows`;

async function findExisting(data) {
  // Appwrite's equal() is case/format-sensitive, so compare e-mail and phone here
  // (one tryout cycle has at most a few hundred rows).
  const select = queryParam({ method: "select", values: ["$id", "email", "phone", "tryout_cycle"] });
  const { response, payload } = await appwriteRequest(`${rowsPath()}?${queryParam({ method: "equal", attribute: "tryout_cycle", values: ["next"] })}&${select}&${queryParam({ method: "limit", values: [1000] })}`);
  if (!response.ok) throw new Error(payload?.message || `HTTP ${response.status}`);
  const key = phoneKey(data.phone);
  return (payload.rows || []).find((row) => String(row.email || "").trim().toLowerCase() === data.email || (key.length >= 8 && phoneKey(row.phone) === key)) || null;
}

async function tryoutDateText() {
  const { response, payload } = await appwriteRequest(`/tablesdb/${encodeURIComponent(appwriteConfig().databaseId)}/tables/${encodeURIComponent(SETTINGS)}/rows?${queryParam({ method: "limit", values: [5] })}`);
  const row = response.ok ? (payload.rows || []).find((r) => r.tryout_date) : null;
  const iso = String(row?.tryout_date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return { de: "", en: "" };
  const date = new Date(`${iso}T12:00:00Z`);
  return {
    de: new Intl.DateTimeFormat("de-AT", { weekday: "long", day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC" }).format(date),
    en: new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date)
  };
}

async function sendConfirmation(data, log) {
  if (!isMailgunConfigured()) return false;
  const when = await tryoutDateText().catch(() => ({ de: "", en: "" }));
  const subject = "Uni Wien Emperors Tryout – Anmeldung bestätigt";
  const text = `Hallo ${data.first_name},

danke für deine Anmeldung zum Tryout der Uni Wien Emperors${when.de ? ` am ${when.de}` : ""}!

Du stehst auf unserer Liste – du musst dich nicht noch einmal anmelden.
Ca. eine Woche vor dem Tryout schicken wir dir alle Details per E-Mail:
- Uhrzeit und Treffpunkt
- Ort
- was du mitbringen sollst

Fragen? Antworte einfach auf diese E-Mail.

Sportliche Grüße
Uni Wien Emperors

---------- English version below ----------

Hi ${data.first_name},

thanks for registering for the Uni Wien Emperors tryout${when.en ? ` on ${when.en}` : ""}!

You're on our list – no need to register again.
About one week before the tryout we'll email you all the details:
- Time and meeting point
- Location
- What to bring

Questions? Just reply to this email.

Best regards,
Uni Wien Emperors`;
  try {
    await sendMailgun({ to: data.email, subject, text: `${text}${plainTextFooter()}`, html: renderTryoutEmail({ subject, text }), replyTo: REPLY_TO });
    return true;
  } catch (error) {
    log(`tryoutRegister: confirmation mail failed ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

module.exports = async ({ req, res, log }) => {
  const body = parseBody(req);
  const data = clean(body.registration || {});
  if (!data.first_name || !data.last_name) return res.json({ ok: false, error: "Please enter your first and last name." }, 400);
  if (!isEmail(data.email)) return res.json({ ok: false, error: "Please enter a valid email address." }, 400);
  if (!data.contact_consent) return res.json({ ok: false, error: "Please confirm that we may contact you about tryouts." }, 400);
  try {
    const existing = await findExisting(data);
    if (existing) {
      // Keep the original entry (status, date) and only fill in / refresh the answers.
      const patch = Object.fromEntries(Object.entries(data).filter(([key, value]) => key !== "contact_consent" && value !== "" && value !== undefined));
      await appwriteRequest(`${rowsPath()}/${encodeURIComponent(existing.$id)}`, { method: "PATCH", body: { data: patch } });
      return res.json({ ok: true, duplicate: true, emailed: false });
    }
    const row = { ...data, tryout_cycle: "next", status: "new", source: "website", submitted_at: new Date().toISOString() };
    const { response, payload } = await appwriteRequest(rowsPath(), { method: "POST", body: { rowId: "unique()", data: row } });
    if (!response.ok) throw new Error(payload?.message || `HTTP ${response.status}`);
    const emailed = await sendConfirmation(data, log);
    return res.json({ ok: true, duplicate: false, emailed, id: payload.$id });
  } catch (error) {
    log(`tryoutRegister failed: ${error instanceof Error ? error.message : error}`);
    return res.json({ ok: false, error: "Your registration could not be saved. Please try again in a moment." }, 500);
  }
};
