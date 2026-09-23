// One-off migration: members who are coaches/staff but NOT players get
// membership_status "coach" (= no club membership). Coach+player stays as is.
//
//   node scripts/migrate-coach-membership.mjs --dry-run  -> only print what would change
//   node scripts/migrate-coach-membership.mjs            -> apply
//
// Roles are taken from member_roles (via profile_id) and fall back to members.roles_json,
// the same way the app resolves them. Deleted and exited members are left untouched.
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

const ROLES_COLLECTION_ID = env("APPWRITE_MEMBER_ROLES_COLLECTION_ID", "member_roles");

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

async function listAll(collectionId) {
  const rows = [];
  let cursor = null;
  for (;;) {
    const queries = [JSON.stringify({ method: "limit", values: [100] })];
    if (cursor) queries.push(JSON.stringify({ method: "cursorAfter", values: [cursor] }));
    const qs = queries.map((query) => `queries[]=${encodeURIComponent(query)}`).join("&");
    const page = await request(`/databases/${DATABASE_ID}/collections/${collectionId}/documents?${qs}`);
    const documents = page.documents || [];
    rows.push(...documents);
    if (documents.length < 100) break;
    cursor = documents[documents.length - 1].$id;
  }
  return rows;
}

function parseRoles(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function main() {
  console.log(`${DRY_RUN ? "[dry-run] " : ""}Appwrite ${ENDPOINT} / project ${PROJECT_ID} / ${COLLECTION_ID}`);
  const [members, roleRows] = await Promise.all([listAll(COLLECTION_ID), listAll(ROLES_COLLECTION_ID)]);
  const rolesByProfile = new Map();
  for (const row of roleRows) {
    const profileId = String(row.profile_id || "").trim();
    if (!profileId) continue;
    if (!rolesByProfile.has(profileId)) rolesByProfile.set(profileId, []);
    rolesByProfile.get(profileId).push(String(row.role_code || "").trim().toLowerCase());
  }

  const summary = { changed: 0, coachAndPlayer: 0, alreadyCoach: 0, skipped: 0, failed: 0 };
  for (const member of members) {
    const name = member.displayName || `${member.first_name || ""} ${member.last_name || ""}`.trim() || member.$id;
    const profileRoles = rolesByProfile.get(String(member.profile_id || "").trim());
    const roles = (profileRoles && profileRoles.length ? profileRoles : parseRoles(member.roles_json)).map((role) => String(role).toLowerCase());
    const status = String(member.membership_status || "").trim().toLowerCase();
    const isCoach = roles.includes("coach");
    if (!isCoach) continue;
    if (roles.includes("player")) {
      summary.coachAndPlayer += 1;
      console.log(`  coach + player, stays ${status || "(empty)"}: ${name}`);
      continue;
    }
    if (status === "coach") {
      summary.alreadyCoach += 1;
      continue;
    }
    if (member.deleted_at || status === "exited") {
      summary.skipped += 1;
      console.log(`  skipped (${member.deleted_at ? "deleted" : "exited"}): ${name}`);
      continue;
    }
    if (DRY_RUN) {
      summary.changed += 1;
      console.log(`  [dry-run] ${name}: ${status || "(empty)"} -> coach   roles: ${roles.join(", ")}`);
      continue;
    }
    try {
      await request(`${collectionPath}/documents/${member.$id}`, { method: "PATCH", body: { data: { membership_status: "coach" } } });
      summary.changed += 1;
      console.log(`  updated ${name}: ${status || "(empty)"} -> coach`);
    } catch (error) {
      summary.failed += 1;
      console.error(`  FAILED ${name}: ${error.message}`);
    }
  }

  console.log("");
  console.log(`${DRY_RUN ? "Would change" : "Changed"} to coach: ${summary.changed}, coach+player (unchanged): ${summary.coachAndPlayer}, already coach: ${summary.alreadyCoach}, skipped: ${summary.skipped}, failed: ${summary.failed}`);
  if (summary.failed) process.exit(1);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
