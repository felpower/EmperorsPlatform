// One-off migration: adds the membership date attributes to the Appwrite
// `members` collection (if missing) and back-fills dates for existing members.
//
//   node scripts/migrate-membership-dates.mjs            -> apply
//   node scripts/migrate-membership-dates.mjs --dry-run  -> only print what would change
//
// Existing (non-empty) date values are never overwritten.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.resolve(scriptDir, "..", ".env");
const fileEnv = {};
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const index = line.indexOf("=");
    if (index <= 0) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1);
    if (key) fileEnv[key] = value;
  }
}
const env = (key, fallback = "") => process.env[key] || fileEnv[key] || fallback;

const ENDPOINT = env("APPWRITE_ENDPOINT", "https://fra.cloud.appwrite.io/v1").replace(/\/$/, "");
const PROJECT_ID = env("APPWRITE_PROJECT_ID", "69dd0fdd00336ea1b4b5");
const DATABASE_ID = env("APPWRITE_DATABASE_ID", "69dd11140002e2b4254a");
const COLLECTION_ID = env("APPWRITE_MEMBERS_COLLECTION_ID", "members");
const API_KEY = env("APPWRITE_API_KEY");
const DRY_RUN = process.argv.includes("--dry-run");

if (!API_KEY) {
  console.error("APPWRITE_API_KEY is missing (.env or environment).");
  process.exit(1);
}

const DATE_ATTRIBUTES = [
  "membership_active_since",
  "membership_pending_since",
  "membership_inactive_from",
  "membership_inactive_until",
  "membership_exited_on"
];

// Default dates per status. Pending intentionally gets no date.
const DEFAULTS_BY_STATUS = {
  active: { membership_active_since: "2026-08-01" },
  inactive: { membership_inactive_from: "2026-08-01", membership_inactive_until: "9999-12-31" },
  exited: { membership_exited_on: "2026-07-31" },
  pending: {}
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(apiPath, { method = "GET", body } = {}) {
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(`${ENDPOINT}${apiPath}`, {
      method,
      headers: {
        "X-Appwrite-Project": PROJECT_ID,
        "X-Appwrite-Key": API_KEY,
        "Content-Type": "application/json"
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};
    if (response.status === 429 && attempt < 6) {
      await sleep(1000 * attempt);
      continue;
    }
    if (!response.ok) {
      throw new Error(`${method} ${apiPath} failed (${response.status}): ${payload?.message || payload?.type || text}`);
    }
    return payload;
  }
}

const collectionPath = `/databases/${DATABASE_ID}/collections/${COLLECTION_ID}`;

async function ensureAttributes() {
  const collection = await request(collectionPath);
  const existing = new Map((collection.attributes || []).map((attribute) => [attribute.key, attribute]));
  for (const key of DATE_ATTRIBUTES) {
    if (existing.has(key)) {
      console.log(`Attribute exists: ${key}`);
      continue;
    }
    if (DRY_RUN) {
      console.log(`[dry-run] Would create attribute: ${key} (string, size 10)`);
      continue;
    }
    await request(`${collectionPath}/attributes/string`, {
      method: "POST",
      body: { key, size: 10, required: false, array: false }
    });
    console.log(`Created attribute: ${key}`);
  }
  if (DRY_RUN) return;

  // Appwrite creates attributes asynchronously - wait until all are usable.
  for (let i = 0; i < 60; i += 1) {
    const current = await request(collectionPath);
    const states = DATE_ATTRIBUTES.map((key) => (current.attributes || []).find((attribute) => attribute.key === key)?.status || "missing");
    if (states.some((state) => state === "failed" || state === "stuck")) {
      throw new Error(`Attribute creation failed: ${DATE_ATTRIBUTES.map((key, index) => `${key}=${states[index]}`).join(", ")}`);
    }
    if (states.every((state) => state === "available")) return;
    await sleep(2000);
  }
  throw new Error("Timed out waiting for attributes to become available.");
}

async function listAllMembers() {
  const members = [];
  let cursor = null;
  for (;;) {
    const queries = [JSON.stringify({ method: "limit", values: [100] })];
    if (cursor) queries.push(JSON.stringify({ method: "cursorAfter", values: [cursor] }));
    const qs = queries.map((query) => `queries[]=${encodeURIComponent(query)}`).join("&");
    const page = await request(`${collectionPath}/documents?${qs}`);
    const documents = page.documents || [];
    members.push(...documents);
    if (documents.length < 100) break;
    cursor = documents[documents.length - 1].$id;
  }
  return members;
}

async function main() {
  console.log(`${DRY_RUN ? "[dry-run] " : ""}Appwrite ${ENDPOINT} / project ${PROJECT_ID} / ${COLLECTION_ID}`);
  await ensureAttributes();

  const members = await listAllMembers();
  const summary = { updated: 0, alreadySet: 0, pendingSkipped: 0, unknownStatus: 0, failed: 0 };
  const byStatus = {};

  for (const member of members) {
    const status = String(member.membership_status || "").trim().toLowerCase();
    byStatus[status || "(empty)"] = (byStatus[status || "(empty)"] || 0) + 1;
    const name = member.displayName || `${member.first_name || ""} ${member.last_name || ""}`.trim() || member.$id;

    if (status === "pending") {
      summary.pendingSkipped += 1;
      console.log(`  pending (no date set): ${name}`);
      continue;
    }
    const defaults = DEFAULTS_BY_STATUS[status];
    if (!defaults) {
      summary.unknownStatus += 1;
      console.log(`  unknown status "${member.membership_status ?? ""}", skipped: ${name}`);
      continue;
    }

    const patch = {};
    for (const [key, value] of Object.entries(defaults)) {
      if (!String(member[key] || "").trim()) patch[key] = value;
    }
    if (!Object.keys(patch).length) {
      summary.alreadySet += 1;
      continue;
    }

    if (DRY_RUN) {
      console.log(`  [dry-run] ${name} (${status}): ${JSON.stringify(patch)}`);
      summary.updated += 1;
      continue;
    }
    try {
      await request(`${collectionPath}/documents/${member.$id}`, { method: "PATCH", body: { data: patch } });
      summary.updated += 1;
      console.log(`  updated ${name} (${status}): ${JSON.stringify(patch)}`);
    } catch (error) {
      summary.failed += 1;
      console.error(`  FAILED ${name}: ${error.message}`);
    }
  }

  console.log("");
  console.log(`Members by status: ${JSON.stringify(byStatus)}`);
  console.log(`${DRY_RUN ? "Would update" : "Updated"}: ${summary.updated}, already set: ${summary.alreadySet}, pending (skipped): ${summary.pendingSkipped}, unknown status: ${summary.unknownStatus}, failed: ${summary.failed}`);
  if (summary.failed) process.exit(1);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
