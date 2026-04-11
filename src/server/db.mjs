import fs from "node:fs/promises";
import path from "node:path";
import sqlite3 from "sqlite3";
import { parse } from "csv-parse/sync";

let db;

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) reject(error);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) reject(error);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(rows);
    });
  });
}

function normalizeNamePart(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeFullName(firstName, lastName) {
  return `${normalizeNamePart(firstName)}|${normalizeNamePart(lastName)}`;
}

function toBool(value) {
  return ["true", "yes", "1"].includes(String(value || "").trim().toLowerCase());
}

function parseJerseyNumber(value) {
  const digits = String(value || "").replace(/[^0-9]/g, "");
  return digits ? Number(digits) : null;
}

function mapFeeStatus(value) {
  const text = String(value || "").trim();
  const normalized = text.toLowerCase();
  if (!normalized) return null;
  if (["paid", "paid with fees", "paid rookie"].includes(normalized)) {
    return { status: "paid", paidCents: 8250, note: text };
  }
  if (["pending", "not paid"].includes(normalized)) {
    return { status: "pending", paidCents: 0, note: text };
  }
  if (normalized === "exempt") {
    return { status: "exempt", paidCents: 0, note: text };
  }
  if (normalized === "exit") {
    return { status: "exit", paidCents: 0, note: text };
  }
  if (normalized === "n/a") {
    return { status: "not_applicable", paidCents: 0, note: text };
  }
  return { status: "partial", paidCents: 0, note: text };
}

function decodeBuffer(buffer) {
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  if (utf8.includes("Ã") || utf8.includes("â")) {
    return new TextDecoder("windows-1252").decode(buffer);
  }
  return utf8;
}

async function readCsv(filePath) {
  const buffer = await fs.readFile(filePath);
  const text = decodeBuffer(buffer);
  return parse(text, {
    bom: true,
    columns: true,
    relax_column_count: true,
    skip_empty_lines: true
  });
}

export async function initializeDatabase(dbPath) {
  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  db = new sqlite3.Database(dbPath);

  await run(`
    create table if not exists members (
      id integer primary key autoincrement,
      normalized_key text not null unique,
      email text not null default '',
      first_name text,
      last_name text,
      display_name text not null,
      position text,
      jersey_number integer,
      active integer not null default 1,
      rookie integer not null default 0,
      in_clubee integer not null default 0,
      membership_status text not null default 'pending',
      notes text
    )
  `);

  await run(`
    create table if not exists membership_fees (
      id integer primary key autoincrement,
      member_id integer not null references members(id) on delete cascade,
      season_label text not null,
      fee_period text not null,
      amount_cents integer not null,
      paid_cents integer not null default 0,
      status text not null,
      iban text,
      mandate_id text,
      sepa_link text,
      status_note text,
      unique(member_id, fee_period)
    )
  `);
}

export async function ensureImported({ playerCsvPath, feesCsvPath }) {
  const countRow = await get("select count(*) as count from members");
  if ((countRow?.count || 0) > 0) return;

  const playerRows = await readCsv(playerCsvPath);
  const feeRows = await readCsv(feesCsvPath);
  const members = new Map();

  for (const row of playerRows) {
    const firstName = String(row["First Name"] || "").trim();
    const lastName = String(row["Last Name"] || "").trim();
    if (!firstName && !lastName) continue;

    const normalizedKey = normalizeFullName(firstName, lastName);
    if (!members.has(normalizedKey)) {
      members.set(normalizedKey, {
        normalizedKey,
        email: "",
        firstName,
        lastName,
        displayName: `${firstName} ${lastName}`.trim(),
        position: String(row.Position || "").trim(),
        jerseyNumber: parseJerseyNumber(row["Jersey Number"]),
        active: toBool(row.Active),
        rookie: toBool(row.Rookie),
        inClubee: toBool(row["In Clubee"]),
        membershipStatus: toBool(row.Active) ? "active" : "inactive",
        notes: String(row["Column 1"] || "").trim()
      });
    }
  }

  for (const row of feeRows) {
    const firstName = String(row.Vorname || "").trim();
    const lastName = String(row.Nachname || "").trim();
    if (!firstName && !lastName) continue;

    const normalizedKey = normalizeFullName(firstName, lastName);
    if (!members.has(normalizedKey)) {
      members.set(normalizedKey, {
        normalizedKey,
        email: "",
        firstName,
        lastName,
        displayName: `${firstName} ${lastName}`.trim(),
        position: "",
        jerseyNumber: null,
        active: false,
        rookie: false,
        inClubee: false,
        membershipStatus: "inactive",
        notes: ""
      });
    }

    const existing = members.get(normalizedKey);
    const email = String(row["E-Mail"] || "").trim();
    const description = String(row["Beschreibung (Deutsch)"] || "").trim();
    if (!existing.email && email) existing.email = email;
    if (description) {
      existing.notes = existing.notes ? `${existing.notes}; ${description}` : description;
    }
  }

  await run("begin transaction");
  try {
    for (const member of members.values()) {
      await run(
        `
          insert into members (
            normalized_key, email, first_name, last_name, display_name, position,
            jersey_number, active, rookie, in_clubee, membership_status, notes
          ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          member.normalizedKey,
          member.email,
          member.firstName,
          member.lastName,
          member.displayName,
          member.position,
          member.jerseyNumber,
          member.active ? 1 : 0,
          member.rookie ? 1 : 0,
          member.inClubee ? 1 : 0,
          member.membershipStatus,
          member.notes
        ]
      );
    }

    const periods = ["Q1 2025", "Q2 2025", "Q3 2025", "Q4 2025", "Q1 2026", "Q2 2026"];
    for (const row of feeRows) {
      const normalizedKey = normalizeFullName(row.Vorname, row.Nachname);
      const member = await get("select id from members where normalized_key = ?", [normalizedKey]);
      if (!member) continue;

      for (const period of periods) {
        const fee = mapFeeStatus(row[period]);
        if (!fee) continue;

        await run(
          `
            insert into membership_fees (
              member_id, season_label, fee_period, amount_cents, paid_cents,
              status, iban, mandate_id, sepa_link, status_note
            ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            member.id,
            period.split(" ")[1],
            period.replace(" ", "_"),
            8250,
            fee.paidCents,
            fee.status,
            String(row.IBAN || "").trim() || null,
            String(row["Mandats-ID"] || "").trim() || null,
            String(row.SEPA || "").trim() || null,
            fee.note
          ]
        );
      }
    }

    await run("commit");
  } catch (error) {
    await run("rollback");
    throw error;
  }
}

export async function getBootstrapData() {
  const members = await all(`
    select
      id,
      display_name as name,
      email,
      position,
      jersey_number as jerseyNumber,
      active,
      rookie,
      in_clubee as inClubee,
      membership_status as membershipStatus,
      notes
    from members
    order by last_name, first_name
  `);

  const fees = await all(`
    select
      id,
      member_id as memberId,
      season_label as season,
      fee_period as feePeriod,
      amount_cents as amountCents,
      paid_cents as paidCents,
      status,
      status_note as note
    from membership_fees
    order by season_label, fee_period, member_id
  `);

  const latestFeeStatus = new Map();
  for (const fee of fees) {
    latestFeeStatus.set(fee.memberId, fee.status);
  }

  return {
    source: "local-sqlite",
    members: members.map((member) => ({
      ...member,
      active: Boolean(member.active),
      rookie: Boolean(member.rookie),
      inClubee: Boolean(member.inClubee),
      roles: ["player"],
      passStatus: "unknown",
      passExpiry: "2026-12-31",
      feeStatus: latestFeeStatus.get(member.id) || "pending",
      lastInviteResponse: "pending"
    })),
    fees: fees.map((fee) => ({
      id: fee.id,
      memberId: fee.memberId,
      season: fee.season,
      feePeriod: fee.feePeriod,
      amount: Math.round((fee.amountCents || 0) / 100),
      paidAmount: Math.round((fee.paidCents || 0) / 100),
      status: fee.status,
      note: fee.note || ""
    })),
    events: [],
    invites: []
  };
}

export async function closeDatabase() {
  if (!db) return;
  await new Promise((resolve, reject) => {
    db.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}
