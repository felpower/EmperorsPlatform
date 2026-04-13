const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || "69dd0fdd00336ea1b4b5";
const APPWRITE_DATABASE_ID = process.env.APPWRITE_DATABASE_ID || "69dd11140002e2b4254a";
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY || "";

const FEES_COLLECTION_ID = process.env.APPWRITE_MEMBERSHIP_FEES_COLLECTION_ID || "membership_fees";

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

function toIsoDateOrNull(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizeStatus(value) {
  const normalized = String(value || "pending").trim().toLowerCase();
  const allowed = new Set(["paid", "partial", "pending", "not_collected", "exempt", "exit", "not_applicable"]);
  return allowed.has(normalized) ? normalized : "pending";
}

async function main() {
  console.log("Reading membership fees from Supabase...");
  const rows = await supabaseFetchAll(
    "membership_fees",
    "id,member_id,fee_period,season_label,amount_cents,paid_cents,status,iban,status_note,due_date,created_at"
  );

  let migrated = 0;
  for (const row of rows) {
    await upsertDocument(FEES_COLLECTION_ID, row.id, {
      member_id: String(row.member_id || "").trim(),
      fee_period: String(row.fee_period || "").trim(),
      season_label: String(row.season_label || "").trim(),
      amount_cents: Math.max(0, Number(row.amount_cents || 0)),
      paid_cents: Math.max(0, Number(row.paid_cents || 0)),
      status: normalizeStatus(row.status),
      iban: String(row.iban || "").trim() || null,
      status_note: String(row.status_note || "").trim() || null,
      due_date: toIsoDateOrNull(row.due_date),
      created_at: toIsoDateOrNull(row.created_at)
    });

    migrated += 1;
    if (migrated % 100 === 0) {
      console.log(`  Migrated fees: ${migrated}`);
    }
  }

  console.log("Fees migration finished.");
  console.log(`Fees migrated: ${migrated}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
