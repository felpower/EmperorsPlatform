import path from "node:path";
import crypto from "node:crypto";
import sqlite3 from "sqlite3";

function getEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function openDatabase(filePath) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(filePath, sqlite3.OPEN_READONLY, (error) => {
      if (error) reject(error);
      else resolve(db);
    });
  });
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(rows || []);
    });
  });
}

function closeDatabase(db) {
  return new Promise((resolve, reject) => {
    db.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function parseJsonArray(value, fallback = []) {
  if (Array.isArray(value)) return value;
  const text = String(value || "").trim();
  if (!text) return fallback;
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function normalizeText(value) {
  return String(value || "").trim();
}

function mapMembershipStatus(member) {
  const explicit = normalizeText(member.membership_status).toLowerCase();
  if (["active", "pending", "inactive"].includes(explicit)) return explicit;
  return Number(member.active) ? "active" : "inactive";
}

function mapFeeStatus(fee) {
  const explicit = normalizeText(fee.status).toLowerCase();
  const allowed = new Set(["paid", "partial", "pending", "not_collected", "exempt", "exit", "not_applicable"]);
  if (allowed.has(explicit)) return explicit;

  const paid = Number(fee.paid_cents || 0);
  const amount = Number(fee.amount_cents || 0);
  if (amount > 0 && paid >= amount) return "paid";
  if (paid > 0) return "partial";
  return "pending";
}

async function supabaseRequest({ baseUrl, serviceRoleKey, method, endpoint, body }) {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers: {
      "apikey": serviceRoleKey,
      "Authorization": `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase request failed (${response.status}) ${method} ${endpoint}: ${text}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function batchInsert({ baseUrl, serviceRoleKey, endpoint, rows, batchSize = 500 }) {
  for (let index = 0; index < rows.length; index += batchSize) {
    const chunk = rows.slice(index, index + batchSize);
    await supabaseRequest({
      baseUrl,
      serviceRoleKey,
      method: "POST",
      endpoint,
      body: chunk
    });
  }
}

async function clearSupabaseData({ baseUrl, serviceRoleKey }) {
  await supabaseRequest({
    baseUrl,
    serviceRoleKey,
    method: "DELETE",
    endpoint: "/membership_fees?id=not.is.null"
  });

  await supabaseRequest({
    baseUrl,
    serviceRoleKey,
    method: "DELETE",
    endpoint: "/members?id=not.is.null"
  });
}

async function relinkProfiles({ baseUrl, serviceRoleKey }) {
  const profiles = await supabaseRequest({
    baseUrl,
    serviceRoleKey,
    method: "GET",
    endpoint: "/profiles?select=id,email"
  });

  const members = await supabaseRequest({
    baseUrl,
    serviceRoleKey,
    method: "GET",
    endpoint: "/members?select=id,email,profile_id"
  });

  const emailToProfileId = new Map();
  for (const profile of profiles || []) {
    const email = normalizeText(profile.email).toLowerCase();
    if (email) {
      emailToProfileId.set(email, profile.id);
    }
  }

  for (const member of members || []) {
    if (member.profile_id) continue;
    const email = normalizeText(member.email).toLowerCase();
    const profileId = emailToProfileId.get(email);
    if (!profileId) continue;

    await supabaseRequest({
      baseUrl,
      serviceRoleKey,
      method: "PATCH",
      endpoint: `/members?id=eq.${encodeURIComponent(member.id)}`,
      body: { profile_id: profileId }
    });
  }
}

async function main() {
  const supabaseUrlRaw = getEnv("SUPABASE_URL").replace(/\/$/, "");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const dbPath = process.argv[2] || path.join(process.cwd(), "data", "emperors.db");

  const baseUrl = `${supabaseUrlRaw}/rest/v1`;
  const db = await openDatabase(dbPath);

  try {
    const members = await all(db, `
      select
        id,
        first_name,
        last_name,
        display_name,
        email,
        positions_json,
        roles_json,
        jersey_number,
        membership_status,
        active,
        notes,
        deleted_at
      from members
    `);

    const memberIdMap = new Map();
    const memberRows = members.map((member) => {
      const memberId = crypto.randomUUID();
      memberIdMap.set(Number(member.id), memberId);

      return {
        id: memberId,
        first_name: normalizeText(member.first_name) || null,
        last_name: normalizeText(member.last_name) || null,
        display_name: normalizeText(member.display_name),
        email: normalizeText(member.email),
        positions_json: parseJsonArray(member.positions_json, []),
        roles_json: parseJsonArray(member.roles_json, ["player"]),
        jersey_number: member.jersey_number == null ? null : Number(member.jersey_number),
        membership_status: mapMembershipStatus(member),
        notes: normalizeText(member.notes) || null,
        deleted_at: normalizeText(member.deleted_at) || null
      };
    });

    const fees = await all(db, `
      select
        id,
        member_id,
        season_label,
        fee_period,
        amount_cents,
        paid_cents,
        status,
        iban,
        status_note
      from membership_fees
    `);

    const feeRows = fees
      .filter((fee) => memberIdMap.has(Number(fee.member_id)))
      .map((fee) => ({
        id: crypto.randomUUID(),
        member_id: memberIdMap.get(Number(fee.member_id)),
        season_label: normalizeText(fee.season_label),
        fee_period: normalizeText(fee.fee_period) || normalizeText(fee.season_label),
        amount_cents: Number(fee.amount_cents || 0),
        paid_cents: Number(fee.paid_cents || 0),
        status: mapFeeStatus(fee),
        iban: normalizeText(fee.iban) || null,
        status_note: normalizeText(fee.status_note) || null
      }));

    console.log(`Found ${memberRows.length} members and ${feeRows.length} fees in ${dbPath}`);
    console.log("Clearing current Supabase members and fees...");
    await clearSupabaseData({ baseUrl, serviceRoleKey });

    console.log("Importing members...");
    await batchInsert({
      baseUrl,
      serviceRoleKey,
      endpoint: "/members",
      rows: memberRows
    });

    console.log("Importing membership fees...");
    await batchInsert({
      baseUrl,
      serviceRoleKey,
      endpoint: "/membership_fees",
      rows: feeRows
    });

    await relinkProfiles({ baseUrl, serviceRoleKey });

    console.log("Import complete.");
  } finally {
    await closeDatabase(db);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
