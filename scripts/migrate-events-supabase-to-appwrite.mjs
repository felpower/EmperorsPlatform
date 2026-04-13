const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || "69dd0fdd00336ea1b4b5";
const APPWRITE_DATABASE_ID = process.env.APPWRITE_DATABASE_ID || "69dd11140002e2b4254a";
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY || "";

const EVENTS_COLLECTION_ID = process.env.APPWRITE_EVENTS_COLLECTION_ID || "events";
const RECIPIENTS_COLLECTION_ID = process.env.APPWRITE_EVENT_RECIPIENTS_COLLECTION_ID || "event_recipients";
const INVITES_COLLECTION_ID = process.env.APPWRITE_INVITES_COLLECTION_ID || "invites";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

if (!APPWRITE_API_KEY) {
  throw new Error("APPWRITE_API_KEY is required.");
}

function normalizeUrl(base) {
  return String(base || "").trim().replace(/\/$/, "");
}

const supabaseBase = normalizeUrl(SUPABASE_URL);
const appwriteBase = normalizeUrl(APPWRITE_ENDPOINT);

function isValidDocId(value) {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/.test(String(value || ""));
}

function toAppwriteId(prefix, rawValue) {
  const raw = String(rawValue || "").trim();
  if (isValidDocId(raw)) return raw;
  const stripped = raw.replace(/[^A-Za-z0-9._-]/g, "");
  if (isValidDocId(stripped)) return stripped.slice(0, 36);
  const compactPrefix = String(prefix || "doc").replace(/[^A-Za-z0-9._-]/g, "").slice(0, 8) || "doc";
  const stamp = Date.now().toString(36).slice(-6);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${compactPrefix}-${stamp}-${rand}`.slice(0, 36);
}

async function supabaseFetch(table, select, { limit = 1000, offset = 0 } = {}) {
  const query = new URLSearchParams();
  query.set("select", select);
  query.set("limit", String(limit));
  query.set("offset", String(offset));

  const response = await fetch(`${supabaseBase}/rest/v1/${table}?${query.toString()}`, {
    method: "GET",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: "count=exact"
    }
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : [];

  if (!response.ok) {
    const message = payload?.message || payload?.hint || `HTTP ${response.status}`;
    throw new Error(`Supabase read failed for ${table}: ${message}`);
  }

  return Array.isArray(payload) ? payload : [];
}

async function supabaseFetchAll(table, select) {
  const all = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const rows = await supabaseFetch(table, select, { limit, offset });
    all.push(...rows);
    if (rows.length < limit) break;
    offset += limit;
  }

  return all;
}

async function appwriteRequest(path, { method = "GET", body, tolerateNotFound = false } = {}) {
  const response = await fetch(`${appwriteBase}${path}`, {
    method,
    headers: {
      "X-Appwrite-Project": APPWRITE_PROJECT_ID,
      "X-Appwrite-Key": APPWRITE_API_KEY,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (tolerateNotFound && response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const message = payload?.message || payload?.type || `HTTP ${response.status}`;
    throw new Error(`Appwrite ${method} ${path} failed: ${message}`);
  }

  return payload;
}

async function upsertDocument(collectionId, documentId, data) {
  const safeId = toAppwriteId(collectionId, documentId);
  const path = `/databases/${APPWRITE_DATABASE_ID}/collections/${collectionId}/documents/${safeId}`;
  const existing = await appwriteRequest(path, { method: "GET", tolerateNotFound: true });

  if (existing) {
    return appwriteRequest(path, {
      method: "PATCH",
      body: { data }
    });
  }

  return appwriteRequest(`/databases/${APPWRITE_DATABASE_ID}/collections/${collectionId}/documents`, {
    method: "POST",
    body: {
      documentId: safeId,
      data
    }
  });
}

function toIsoOrNull(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizeEventType(value) {
  const normalized = String(value || "practice").trim().toLowerCase();
  const allowed = new Set(["practice", "game", "meeting"]);
  return allowed.has(normalized) ? normalized : "practice";
}

function normalizeResponse(value) {
  const normalized = String(value || "pending").trim().toLowerCase();
  const allowed = new Set(["pending", "confirmed", "maybe", "declined"]);
  return allowed.has(normalized) ? normalized : "pending";
}

function normalizeChannel(value) {
  const normalized = String(value || "email").trim().toLowerCase();
  return normalized === "push" ? "push" : "email";
}

async function main() {
  console.log("Reading events from Supabase...");
  const events = await supabaseFetchAll(
    "events",
    "id,title,event_type,starts_at,location,notes,created_by,created_at"
  );

  console.log("Reading event recipients from Supabase...");
  const recipients = await supabaseFetchAll(
    "event_recipients",
    "event_id,member_id,response,responded_at"
  );

  console.log("Reading invites from Supabase...");
  const invites = await supabaseFetchAll(
    "invites",
    "id,event_id,channel,sent_by,sent_at,recipient_count"
  );

  let migratedEvents = 0;
  for (const row of events) {
    await upsertDocument(EVENTS_COLLECTION_ID, row.id, {
      title: String(row.title || "").trim() || "Untitled event",
      event_type: normalizeEventType(row.event_type),
      starts_at: toIsoOrNull(row.starts_at) || new Date().toISOString(),
      location: String(row.location || "").trim() || null,
      notes: String(row.notes || "").trim() || null,
      created_by: String(row.created_by || "").trim() || null,
      created_at: toIsoOrNull(row.created_at)
    });
    migratedEvents += 1;
  }

  let migratedRecipients = 0;
  for (const row of recipients) {
    const docId = `${String(row.event_id || "").trim()}-${String(row.member_id || "").trim()}`;
    await upsertDocument(RECIPIENTS_COLLECTION_ID, docId, {
      event_id: String(row.event_id || "").trim(),
      member_id: String(row.member_id || "").trim(),
      response: normalizeResponse(row.response),
      responded_at: toIsoOrNull(row.responded_at)
    });
    migratedRecipients += 1;
  }

  let migratedInvites = 0;
  for (const row of invites) {
    await upsertDocument(INVITES_COLLECTION_ID, row.id, {
      event_id: String(row.event_id || "").trim(),
      channel: normalizeChannel(row.channel),
      sent_by: String(row.sent_by || "").trim() || null,
      sent_at: toIsoOrNull(row.sent_at),
      recipient_count: Math.max(0, Number(row.recipient_count || 0))
    });
    migratedInvites += 1;
  }

  console.log("Events migration finished.");
  console.log(`Events migrated: ${migratedEvents}`);
  console.log(`Event recipients migrated: ${migratedRecipients}`);
  console.log(`Invites migrated: ${migratedInvites}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
