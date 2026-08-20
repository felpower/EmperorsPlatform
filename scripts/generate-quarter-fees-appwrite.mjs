import { Client, Databases, Query, ID } from "node-appwrite";

const ENDPOINT = process.env.APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID || "69dd0fdd00336ea1b4b5";
const API_KEY = process.env.APPWRITE_API_KEY || "";
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || "69dd11140002e2b4254a";
const MEMBERS_COLLECTION_ID = process.env.APPWRITE_MEMBERS_COLLECTION_ID || "members";
const FEES_COLLECTION_ID = process.env.APPWRITE_MEMBERSHIP_FEES_COLLECTION_ID || "membership_fees";
const QUARTERS_AHEAD = Number(process.env.QUARTERS_AHEAD || 4);
const DEFAULT_AMOUNT_CENTS = Number(process.env.DEFAULT_FEE_AMOUNT_CENTS || 8250);
const DRY_RUN = String(process.env.DRY_RUN || "false").trim().toLowerCase() === "true";
const PAGE_SIZE = 100;

if (!API_KEY) {
  console.error("Missing APPWRITE_API_KEY environment variable. Set it before running this script.");
  process.exit(1);
}

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
const databases = new Databases(client);

async function listAllRows(collectionId) {
  const rows = [];
  let cursor = null;
  for (;;) {
    const queries = [Query.limit(PAGE_SIZE)];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const response = await databases.listDocuments(DATABASE_ID, collectionId, queries);
    const batch = response.documents || [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    cursor = batch[batch.length - 1].$id;
  }
  return rows;
}

async function createRow(collectionId, data) {
  return databases.createDocument(DATABASE_ID, collectionId, ID.unique(), data);
}

function currentQuarter(date = new Date()) {
  const month = date.getMonth() + 1;
  let year = date.getFullYear();
  let quarter;
  if (month === 1) {
    quarter = 4;
    year -= 1;
  } else if (month <= 4) {
    quarter = 1;
  } else if (month <= 7) {
    quarter = 2;
  } else if (month <= 10) {
    quarter = 3;
  } else {
    quarter = 4;
  }
  return { quarter, year };
}

function quarterSequence(startQuarter, startYear, count) {
  const result = [];
  let quarter = startQuarter;
  let year = startYear;
  for (let index = 0; index < count; index += 1) {
    result.push(`Q${quarter}_${year}`);
    quarter += 1;
    if (quarter > 4) {
      quarter = 1;
      year += 1;
    }
  }
  return result;
}

async function main() {
  const { quarter, year } = currentQuarter();
  const targetPeriods = quarterSequence(quarter, year, QUARTERS_AHEAD);
  console.log(`Target periods: ${targetPeriods.join(", ")}`);
  if (DRY_RUN) console.log("Running in DRY_RUN mode — no writes will be made.");

  const members = await listAllRows(MEMBERS_COLLECTION_ID);
  const eligibleMembers = members.filter((member) => {
    const status = String(member.membership_status || member.membershipStatus || "").trim().toLowerCase();
    if (status === "exited") return false;
    if (member.deleted_at || member.deletedAt) return false;
    let roles = [];
    try {
      roles = JSON.parse(member.roles_json || member.rolesJson || "[]");
    } catch {
      roles = [];
    }
    return Array.isArray(roles) && roles.includes("player");
  });
  console.log(`Members: ${members.length} total, ${eligibleMembers.length} eligible (player role, not deleted, not exited), ${members.length - eligibleMembers.length} skipped.`);

  const existingFees = await listAllRows(FEES_COLLECTION_ID);
  const existingKeys = new Set(existingFees.map((row) => `${row.member_id}:${row.fee_period}`));

  const lastKnownIban = new Map();
  const sortedByPeriod = [...existingFees].sort((left, right) => String(left.fee_period).localeCompare(String(right.fee_period)));
  for (const row of sortedByPeriod) {
    const iban = String(row.iban || "").trim();
    if (iban) lastKnownIban.set(String(row.member_id), iban);
  }

  let created = 0;
  for (const member of eligibleMembers) {
    const memberId = String(member.$id || member.id);
    const memberIban = String(member.iban || "").trim() || lastKnownIban.get(memberId) || null;
    for (const period of targetPeriods) {
      const key = `${memberId}:${period}`;
      if (existingKeys.has(key)) continue;

      const payload = {
        member_id: memberId,
        season_label: period.split("_")[1],
        fee_period: period,
        amount_cents: DEFAULT_AMOUNT_CENTS,
        paid_cents: 0,
        status: "not_collected",
        iban: memberIban,
        status_note: null
      };

      if (DRY_RUN) {
        console.log(`[dry-run] would create ${key}`);
      } else {
        await createRow(FEES_COLLECTION_ID, payload);
      }
      created += 1;
    }
  }

  console.log(`${DRY_RUN ? "Would create" : "Created"} ${created} fee row(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
