const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || "69dd0fdd00336ea1b4b5";
const APPWRITE_DATABASE_ID = process.env.APPWRITE_DATABASE_ID || "69dd11140002e2b4254a";
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY || "";

const MEMBERS_COLLECTION_ID = process.env.APPWRITE_MEMBERS_COLLECTION_ID || "members";
const MEMBER_ROLES_COLLECTION_ID = process.env.APPWRITE_MEMBER_ROLES_COLLECTION_ID || "member_roles";
const PLAYER_PASSES_COLLECTION_ID = process.env.APPWRITE_PLAYER_PASSES_COLLECTION_ID || "player_passes";

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

  const total = Number(response.headers.get("content-range")?.split("/")?.[1] || 0);
  return { rows: Array.isArray(payload) ? payload : [], total };
}

async function supabaseFetchAll(table, select) {
  const all = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { rows } = await supabaseFetch(table, select, { limit, offset });
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

function toIso(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function uniqueRoles(rows) {
  return Array.from(new Set((Array.isArray(rows) ? rows : []).map((item) => String(item?.role_code || "").trim()).filter(Boolean)));
}

async function main() {
  console.log("Reading members from Supabase...");
  const members = await supabaseFetchAll(
    "members",
    "id,profile_id,first_name,last_name,display_name,email,positions_json,roles_json,jersey_number,membership_status,notes,invite_sent_at,deleted_at"
  );

  console.log("Reading member roles from Supabase...");
  const memberRoles = await supabaseFetchAll("member_roles", "profile_id,role_code");

  console.log("Reading player passes from Supabase...");
  const playerPasses = await supabaseFetchAll("player_passes", "member_id,pass_status,expires_on,federation_reference,notes,updated_at");

  const rolesByProfile = new Map();
  for (const row of memberRoles) {
    const profileId = String(row.profile_id || "").trim();
    if (!profileId) continue;
    const list = rolesByProfile.get(profileId) || [];
    list.push(row);
    rolesByProfile.set(profileId, list);
  }

  let migratedMembers = 0;
  for (const row of members) {
    const firstName = String(row.first_name || "").trim();
    const lastName = String(row.last_name || "").trim();
    const displayName = String(row.display_name || "").trim() || `${firstName} ${lastName}`.trim() || "Unknown member";
    const profileId = String(row.profile_id || "").trim();

    const roleRows = profileId ? (rolesByProfile.get(profileId) || []) : [];
    const rolesFromJoin = uniqueRoles(roleRows);
    const rolesFromInline = Array.isArray(row.roles_json) ? row.roles_json : [];
    const mergedRoles = Array.from(new Set([...rolesFromJoin, ...rolesFromInline].map((value) => String(value || "").trim()).filter(Boolean)));

    await upsertDocument(MEMBERS_COLLECTION_ID, row.id, {
      displayName,
      jerseyNumber: row.jersey_number === null || row.jersey_number === undefined ? null : Number(row.jersey_number),
      email: String(row.email || "").trim() || null,
      first_name: firstName || null,
      last_name: lastName || null,
      positions_json: JSON.stringify(Array.isArray(row.positions_json) ? row.positions_json : []),
      roles_json: JSON.stringify(mergedRoles),
      membership_status: String(row.membership_status || "pending").trim() || "pending",
      notes: String(row.notes || "").trim() || null,
      profile_id: profileId || null,
      invite_sent_at: toIso(row.invite_sent_at),
      deleted_at: toIso(row.deleted_at)
    });

    migratedMembers += 1;
    if (migratedMembers % 100 === 0) {
      console.log(`  Migrated members: ${migratedMembers}`);
    }
  }

  let migratedRoles = 0;
  for (const row of memberRoles) {
    const roleDocId = `${String(row.profile_id || "").trim()}-${String(row.role_code || "").trim()}`;
    await upsertDocument(MEMBER_ROLES_COLLECTION_ID, roleDocId, {
      profile_id: String(row.profile_id || "").trim(),
      role_code: String(row.role_code || "").trim() || "player"
    });
    migratedRoles += 1;
  }

  let migratedPasses = 0;
  for (const row of playerPasses) {
    const passDocId = String(row.member_id || "").trim() || `pass-${migratedPasses + 1}`;
    await upsertDocument(PLAYER_PASSES_COLLECTION_ID, passDocId, {
      member_id: String(row.member_id || "").trim(),
      pass_status: String(row.pass_status || "missing").trim() || "missing",
      expires_on: toIso(row.expires_on),
      federation_reference: String(row.federation_reference || "").trim() || null,
      notes: String(row.notes || "").trim() || null,
      updated_at: toIso(row.updated_at)
    });
    migratedPasses += 1;
  }

  console.log("Migration finished.");
  console.log(`Members migrated: ${migratedMembers}`);
  console.log(`Member roles migrated: ${migratedRoles}`);
  console.log(`Player passes migrated: ${migratedPasses}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
