import fs from "node:fs";
import path from "node:path";

function loadEnvFileIfPresent(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    if (!key || process.env[key]) continue;
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

const cwd = process.cwd();
loadEnvFileIfPresent(path.join(cwd, ".env"));
loadEnvFileIfPresent(path.join(cwd, ".env.local"));

const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || "69dd0fdd00336ea1b4b5";
const APPWRITE_DATABASE_ID = process.env.APPWRITE_DATABASE_ID || "69dd11140002e2b4254a";
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY || "";

const MEMBERS_COLLECTION_ID = process.env.APPWRITE_MEMBERS_COLLECTION_ID || "members";
const FEES_COLLECTION_ID = process.env.APPWRITE_MEMBERSHIP_FEES_COLLECTION_ID || "membership_fees";

const argv = process.argv.slice(2);
const overwriteExisting = argv.includes("--overwrite") || String(process.env.OVERWRITE_EXISTING_IBAN || "").trim() === "1";
const dryRun = argv.includes("--dry-run") || String(process.env.DRY_RUN || "").trim() === "1";
const limit = Math.max(1, Number(process.env.BACKFILL_PAGE_LIMIT || 5000));

if (!APPWRITE_API_KEY) {
  throw new Error("APPWRITE_API_KEY is required.");
}

function normalizeUrl(base) {
  return String(base || "").trim().replace(/\/$/, "");
}

const appwriteBase = normalizeUrl(APPWRITE_ENDPOINT);

function normalizeIban(value) {
  return String(value || "").replace(/\s+/g, "").toUpperCase();
}

async function appwriteRequest(path, { method = "GET", body } = {}) {
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

  if (!response.ok) {
    const message = payload?.message || payload?.type || `HTTP ${response.status}`;
    throw new Error(`Appwrite ${method} ${path} failed: ${message}`);
  }

  return payload;
}

const limitQuery = encodeURIComponent(JSON.stringify({ method: "limit", values: [limit] }));

async function listAllRows(tableId) {
  const payload = await appwriteRequest(
    `/tablesdb/${encodeURIComponent(APPWRITE_DATABASE_ID)}/tables/${encodeURIComponent(tableId)}/rows?queries[0]=${limitQuery}`
  );
  return Array.isArray(payload?.rows) ? payload.rows : [];
}

async function listAllDocuments(collectionId) {
  const payload = await appwriteRequest(
    `/databases/${encodeURIComponent(APPWRITE_DATABASE_ID)}/collections/${encodeURIComponent(collectionId)}/documents?queries[0]=${limitQuery}`
  );
  return Array.isArray(payload?.documents) ? payload.documents : [];
}

async function listAppwriteRecords(resourceId) {
  try {
    const rows = await listAllRows(resourceId);
    return { records: rows, source: "tables" };
  } catch (tableError) {
    try {
      const documents = await listAllDocuments(resourceId);
      return { records: documents, source: "collections", tableError: String(tableError?.message || tableError) };
    } catch (documentError) {
      throw new Error(
        `Could not load ${resourceId}. Tables error: ${String(tableError?.message || tableError)} Legacy collections error: ${String(documentError?.message || documentError)}`
      );
    }
  }
}

function normalizeMember(member) {
  return {
    rowId: String(member?.$id || member?.id || "").trim(),
    legacyId: String(member?.id || member?.legacy_id || "").trim(),
    email: String(member?.email || "").trim().toLowerCase(),
    iban: normalizeIban(member?.iban)
  };
}

function normalizeFee(fee) {
  return {
    memberId: String(fee?.member_id || "").trim(),
    iban: normalizeIban(fee?.iban),
    fee_period: String(fee?.fee_period || "").trim(),
    season_label: String(fee?.season_label || "").trim(),
    due_date: String(fee?.due_date || "").trim(),
    created_at: String(fee?.created_at || fee?.$createdAt || "").trim(),
    updated_at: String(fee?.$updatedAt || "").trim()
  };
}

async function updateMemberIban(memberRowId, iban) {
  const id = encodeURIComponent(String(memberRowId || "").trim());
  const tableId = encodeURIComponent(MEMBERS_COLLECTION_ID);
  const dbId = encodeURIComponent(APPWRITE_DATABASE_ID);

  try {
    await appwriteRequest(
      `/tablesdb/${dbId}/tables/${tableId}/rows/${id}`,
      { method: "PATCH", body: { iban } }
    );
    return "tables";
  } catch (tableErrorRaw) {
    const tableError = String(tableErrorRaw?.message || tableErrorRaw);
    try {
      await appwriteRequest(
        `/tablesdb/${dbId}/tables/${tableId}/rows/${id}`,
        { method: "PATCH", body: { data: { iban } } }
      );
      return "tables-data-wrapper";
    } catch {
      await appwriteRequest(
        `/databases/${dbId}/collections/${tableId}/documents/${id}`,
        { method: "PATCH", body: { data: { iban } } }
      );
      return `collections-fallback-after:${tableError}`;
    }
  }
}

function memberKeys(member) {
  const keys = new Set();
  const canonicalId = String(member?.$id || "").trim();
  const legacyId = String(member?.id || "").trim();
  if (canonicalId) keys.add(canonicalId);
  if (legacyId) keys.add(legacyId);
  return [...keys];
}

function feeSortKey(fee) {
  return String(
    fee?.season_label ||
    fee?.fee_period ||
    fee?.due_date ||
    fee?.created_at ||
    fee?.$updatedAt ||
    fee?.$createdAt ||
    ""
  );
}

function pickLatestFeeWithIban(rows) {
  return [...rows]
    .filter((row) => normalizeIban(row?.iban))
    .sort((left, right) => feeSortKey(right).localeCompare(feeSortKey(left)))[0] || null;
}

async function main() {
  console.log("Loading members and fees from Appwrite...");
  const [membersPayload, feesPayload] = await Promise.all([
    listAppwriteRecords(MEMBERS_COLLECTION_ID),
    listAppwriteRecords(FEES_COLLECTION_ID)
  ]);
  const members = (membersPayload.records || []).map(normalizeMember).filter((row) => row.rowId);
  const fees = (feesPayload.records || []).map(normalizeFee).filter((row) => row.memberId);

  console.log(`Members source: ${membersPayload.source}`);
  console.log(`Fees source: ${feesPayload.source}`);
  if (membersPayload.tableError) {
    console.log(`Members table-read warning: ${membersPayload.tableError}`);
  }
  if (feesPayload.tableError) {
    console.log(`Fees table-read warning: ${feesPayload.tableError}`);
  }

  const feesByRawMemberId = new Map();
  for (const fee of fees) {
    const rawMemberId = String(fee.memberId || "").trim();
    if (!rawMemberId) continue;
    const list = feesByRawMemberId.get(rawMemberId) || [];
    list.push(fee);
    feesByRawMemberId.set(rawMemberId, list);
  }

  let eligible = 0;
  let matched = 0;
  let updated = 0;
  let skippedHasIban = 0;
  let skippedNoMatch = 0;
  let failed = 0;
  const updateModes = new Map();

  for (const member of members) {
    const canonicalMemberId = String(member.rowId || "").trim();
    if (!canonicalMemberId) continue;

    const existingIban = normalizeIban(member.iban);
    if (existingIban && !overwriteExisting) {
      skippedHasIban += 1;
      continue;
    }

    eligible += 1;

    const candidateFeeRows = [];
    for (const key of memberKeys({ $id: member.rowId, id: member.legacyId })) {
      const list = feesByRawMemberId.get(key);
      if (Array.isArray(list) && list.length) candidateFeeRows.push(...list);
    }

    const latest = pickLatestFeeWithIban(candidateFeeRows);
    const nextIban = normalizeIban(latest?.iban || "");

    if (!nextIban) {
      skippedNoMatch += 1;
      continue;
    }

    matched += 1;

    if (dryRun) {
      updated += 1;
      continue;
    }

    try {
      const mode = await updateMemberIban(canonicalMemberId, nextIban);
      updateModes.set(mode, (updateModes.get(mode) || 0) + 1);
      updated += 1;
    } catch (error) {
      failed += 1;
      console.error(`Failed member ${canonicalMemberId}: ${error?.message || error}`);
    }
  }

  console.log("IBAN backfill finished.");
  console.log(`Members total: ${members.length}`);
  console.log(`Members eligible: ${eligible}`);
  console.log(`Members matched from fees: ${matched}`);
  console.log(`Members updated: ${updated}${dryRun ? " (dry run)" : ""}`);
  console.log(`Members skipped (already had IBAN): ${skippedHasIban}`);
  console.log(`Members skipped (no matching fee IBAN): ${skippedNoMatch}`);
  console.log(`Members failed update: ${failed}`);
  if (!dryRun && updateModes.size) {
    console.log(`Update modes: ${JSON.stringify(Object.fromEntries(updateModes.entries()))}`);
  }

  if (dryRun) {
    console.log("Dry run mode enabled: no data was written.");
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
