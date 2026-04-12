import fs from "node:fs/promises";
import path from "node:path";
import sqlite3 from "sqlite3";
import { parse } from "csv-parse/sync";
import xlsx from "xlsx";

let db;
let dbFilePath;
const DB_SCHEMA_VERSION = 3;

const ROLE_PATTERNS = [
  { match: /kassenwart/i, role: "finance_admin" },
  { match: /technischer leiter|webseiten-administrator/i, role: "tech_admin" },
  { match: /jugendleiter|vorstandsmitglied/i, role: "admin" },
  { match: /coach|trainer/i, role: "coach" },
  { match: /video analyst/i, role: "staff" },
  { match: /spieler|athlet/i, role: "player" }
];

const POSITION_PATTERNS = [
  "QB", "RB", "FB", "WR", "TE", "OL", "DL", "LB", "DB", "CB", "S", "K", "P",
  "OT", "OG", "C", "DT", "DE", "NT", "ILB", "OLB"
];

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

function splitDisplayName(displayName) {
  const parts = String(displayName || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.slice(-1).join(" ")
  };
}

function toBool(value) {
  return ["true", "yes", "1"].includes(String(value || "").trim().toLowerCase());
}

function parseJerseyNumber(value) {
  const digits = String(value || "").replace(/[^0-9]/g, "");
  return digits ? Number(digits) : null;
}

function quarterFromDate(date = new Date()) {
  const month = date.getMonth() + 1;
  const quarter = Math.floor((month - 1) / 3) + 1;
  return `Q${quarter} ${date.getFullYear()}`;
}

function periodScore(periodToken) {
  const [quarterRaw, yearRaw] = String(periodToken || "").replace(" ", "_").split("_");
  const year = Number(yearRaw || 0);
  const quarter = Number(String(quarterRaw || "Q0").replace("Q", "")) || 0;
  return year * 10 + quarter;
}

function normalizePeriodToken(periodText) {
  return String(periodText || "").trim().replace(/\s+/g, " ").replace(" ", "_");
}

function quarterSequence(startToken, count) {
  const result = [];
  const [quarterRaw, yearRaw] = String(startToken || "Q1_2025").split("_");
  let quarter = Number(String(quarterRaw || "Q1").replace("Q", "")) || 1;
  let year = Number(yearRaw || 2025);
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

function collectImportPeriods(feeRows) {
  const periods = new Set();
  for (const row of feeRows) {
    for (const key of Object.keys(row || {})) {
      if (/^Q[1-4]\s+\d{4}$/i.test(String(key).trim())) {
        periods.add(normalizePeriodToken(key));
      }
    }
  }
  const current = normalizePeriodToken(quarterFromDate());
  quarterSequence(current, 4).forEach((period) => periods.add(period));
  return Array.from(periods).sort((left, right) => periodScore(left) - periodScore(right));
}

function mapFeeStatus(value, { treatBlankAsNotCollected = false } = {}) {
  const text = String(value || "").trim();
  const normalized = text.toLowerCase();
  if (!normalized) {
    return treatBlankAsNotCollected
      ? { status: "not_collected", paidCents: 0, note: null }
      : null;
  }
  if (["paid", "paid with fees", "paid rookie"].includes(normalized)) return { status: "paid", paidCents: 8250, note: null };
  if (["pending", "not paid"].includes(normalized)) return { status: "pending", paidCents: 0, note: null };
  if (["not collected", "not_collected", "notcollected"].includes(normalized)) return { status: "not_collected", paidCents: 0, note: null };
  if (normalized === "exempt") return { status: "exempt", paidCents: 0, note: null };
  if (normalized === "exit") return { status: "exit", paidCents: 0, note: null };
  if (normalized === "n/a") return { status: "not_applicable", paidCents: 0, note: null };
  return { status: "partial", paidCents: 0, note: null };
}

function normalizeFeeStatusForUpdate(value) {
  const normalized = String(value || "").trim().toLowerCase();
  const aliases = {
    paid: "paid",
    pending: "pending",
    "not paid": "pending",
    not_collected: "not_collected",
    "not collected": "not_collected",
    exempt: "exempt",
    exit: "exit",
    not_applicable: "not_applicable",
    "not applicable": "not_applicable",
    partial: "partial"
  };
  const status = aliases[normalized];
  if (!status) {
    throw new Error(`Unsupported fee status: ${value}`);
  }
  return status;
}

function normalizeCurrencyToCents(value, fieldLabel) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`${fieldLabel} must be a valid number.`);
  }
  if (numeric < 0) {
    throw new Error(`${fieldLabel} cannot be negative.`);
  }
  return Math.round(numeric * 100);
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

async function readClubeeWorkbook(filePath) {
  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return xlsx.utils.sheet_to_json(sheet, { defval: "" });
}

function parsePositions(rawPosition, rawClubeePositions) {
  const values = new Set();
  const addPosition = (value) => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return;
    const upper = trimmed.toUpperCase();
    if (POSITION_PATTERNS.includes(upper)) {
      values.add(upper);
      return;
    }
    if (/offensive tackle/i.test(trimmed)) values.add("OT");
    else if (/offensive guard/i.test(trimmed)) values.add("OG");
    else if (/center/i.test(trimmed)) values.add("C");
    else if (/offensive lineman/i.test(trimmed)) values.add("OL");
    else if (/defensive lineman/i.test(trimmed)) values.add("DL");
    else if (/linebacker/i.test(trimmed)) values.add("LB");
    else if (/defensive back/i.test(trimmed)) values.add("DB");
    else if (/corner/i.test(trimmed)) values.add("CB");
    else if (/safety/i.test(trimmed)) values.add("S");
    else if (/wide receiver/i.test(trimmed)) values.add("WR");
    else if (/tight end/i.test(trimmed)) values.add("TE");
    else if (/running back/i.test(trimmed)) values.add("RB");
    else if (/quarterback/i.test(trimmed)) values.add("QB");
    else if (/defensive end/i.test(trimmed)) values.add("DE");
    else if (/defensive tackle/i.test(trimmed)) values.add("DT");
    else if (/nose tackle/i.test(trimmed)) values.add("NT");
    else if (/outside linebacker/i.test(trimmed)) values.add("OLB");
    else if (/inside linebacker/i.test(trimmed)) values.add("ILB");
  };
  addPosition(rawPosition);
  String(rawClubeePositions || "").split(/\r?\n/).forEach(addPosition);
  return Array.from(values);
}

function parsePositionsInput(value) {
  return Array.from(new Set(String(value || "")
    .split(",")
    .map((entry) => entry.trim().toUpperCase())
    .filter(Boolean)));
}

function parseRoles(rawClubeePositions) {
  const roles = new Set(["player"]);
  const lines = String(rawClubeePositions || "").split(/\r?\n/);
  for (const line of lines) {
    for (const rule of ROLE_PATTERNS) {
      if (rule.match.test(line)) roles.add(rule.role);
    }
  }
  if (roles.has("admin")) {
    roles.add("coach");
    roles.add("player");
    roles.add("finance_admin");
    roles.add("tech_admin");
  }
  return Array.from(roles);
}

function parseRolesInput(value) {
  const roles = new Set(String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean));
  if (!roles.size) roles.add("player");
  return Array.from(roles);
}

function parseLicense(rawLicense) {
  const text = String(rawLicense || "").trim();
  if (!text) return { status: "missing", expiry: null, licenseName: "", note: "No license text in Clubee export." };
  const match = text.match(/^(.*?)\s*\(\d+\)\s*:?\s*Spielberechtigt bis\s+(\d{2}\/\d{2}\/\d{4})/i);
  if (!match) return { status: "pending", expiry: null, licenseName: text, note: text };
  const [, licenseName, expiryText] = match;
  const [day, month, year] = expiryText.split("/");
  const expiry = `${year}-${month}-${day}`;
  const expiryDate = new Date(`${expiry}T00:00:00`);
  const today = new Date();
  const diffDays = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const status = diffDays < 0 ? "expired" : diffDays <= 45 ? "expiring" : "valid";
  return { status, expiry, licenseName: licenseName.trim(), note: text };
}

function parseClubeePassRecord(row) {
  const firstName = String(row?.Vorname || "").trim();
  const lastName = String(row?.Nachname || "").trim();
  if (!firstName && !lastName) return null;

  const normalizedKey = normalizeFullName(firstName, lastName);
  if (!normalizedKey) return null;

  const license = parseLicense(row?.Lizenz);
  const docs = [
    { type: "application", value: String(row?.["Antragsformular Lizenz (ID43284)"] || "").trim() },
    { type: "medical", value: String(row?.["Ärztliches Attest (ID43286)"] || "").trim() },
    { type: "nada", value: String(row?.["NADA-Formular (ID43287)"] || "").trim() },
    { type: "identity", value: String(row?.["Identitätsnachweis (ID43288)"] || "").trim() },
    { type: "registration", value: String(row?.["Meldezettel (ID43289)"] || "").trim() },
    { type: "itc", value: String(row?.["ITC (ID43290)"] || "").trim() },
    { type: "education", value: String(row?.["Ausbildungsnachweis (ID43418)"] || "").trim() }
  ].filter((doc) => doc.value);

  return {
    firstName,
    lastName,
    normalizedKey,
    clubeeEmail: String(row?.["E-Mail"] || "").trim(),
    clubeePhone: String(row?.["Telefonnnummer"] || "").trim(),
    medicalStatus: String(row?.["Medizinische Untersuchung"] || "").trim(),
    passStatus: license.status,
    passExpiry: license.expiry,
    licenseName: license.licenseName,
    note: license.note,
    docs
  };
}

function capabilitySet(roles) {
  return Array.from(new Set((roles || []).filter(Boolean)));
}

function normalizePassStatusInput(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;
  if (["valid", "expiring"].includes(normalized)) return "valid";
  if (["expired"].includes(normalized)) return "expired";
  if (["missing", "pending", "unknown"].includes(normalized)) return "missing";
  return "missing";
}

function normalizePassExpiryInput(value) {
  if (value === undefined) return null;
  const normalized = String(value || "").trim();
  return normalized || null;
}

async function upsertPlayerPass(memberId, payload) {
  const passStatusProvided = Object.prototype.hasOwnProperty.call(payload, "passStatus");
  const passExpiryProvided = Object.prototype.hasOwnProperty.call(payload, "passExpiry");
  if (!passStatusProvided && !passExpiryProvided) {
    return;
  }

  const passStatus = normalizePassStatusInput(payload.passStatus) || "missing";
  const passExpiry = normalizePassExpiryInput(payload.passExpiry);

  await run(
    `
      insert into player_passes (
        member_id, pass_status, expiry_date, license_name, medical_status,
        docs_json, clubee_email, clubee_phone, note
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(member_id) do update set
        pass_status = excluded.pass_status,
        expiry_date = excluded.expiry_date
    `,
    [
      memberId,
      passStatus,
      passExpiry,
      null,
      null,
      "[]",
      null,
      null,
      null
    ]
  );
}

function normalizeMemberPayload(payload) {
  const payloadFirstName = String(payload.firstName || "").trim();
  const payloadLastName = String(payload.lastName || "").trim();
  const fallbackName = String(payload.name || payload.displayName || "").trim();
  const fromFallback = splitDisplayName(fallbackName);
  const firstName = payloadFirstName || fromFallback.firstName;
  const lastName = payloadLastName || fromFallback.lastName;
  const displayName = `${firstName} ${lastName}`.trim() || fallbackName;
  if (!displayName) {
    throw new Error("Member name is required.");
  }
  const membershipStatus = String(payload.membershipStatus || "pending").trim() || "pending";
  const roles = parseRolesInput(payload.roles);
  const positions = Array.isArray(payload.positions)
    ? Array.from(new Set(payload.positions.map((entry) => String(entry).trim().toUpperCase()).filter(Boolean)))
    : parsePositionsInput(payload.positions);
  const passStatus = Object.prototype.hasOwnProperty.call(payload, "passStatus")
    ? normalizePassStatusInput(payload.passStatus)
    : null;
  const passExpiry = Object.prototype.hasOwnProperty.call(payload, "passExpiry")
    ? normalizePassExpiryInput(payload.passExpiry)
    : null;
  return {
    normalizedKey: normalizeFullName(firstName, lastName || displayName),
    email: String(payload.email || "").trim(),
    firstName,
    lastName,
    displayName,
    positions,
    roles,
    jerseyNumber: payload.jerseyNumber === null || payload.jerseyNumber === "" ? null : Number(payload.jerseyNumber),
    active: membershipStatus === "active",
    rookie: Boolean(payload.rookie),
    inClubee: Boolean(payload.inClubee),
    membershipStatus,
    notes: String(payload.notes || "").trim(),
    passStatus,
    passExpiry
  };
}

function parseJsonArray(text) {
  try {
    const parsed = JSON.parse(text || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function canonicalNameParts({ firstName, lastName, displayName }) {
  let first = String(firstName || "").trim();
  let last = String(lastName || "").trim();
  const display = String(displayName || "").trim();

  if (!first && !last) {
    const fromDisplay = splitDisplayName(display);
    first = fromDisplay.firstName;
    last = fromDisplay.lastName;
  } else if (!last && /\s+/.test(first)) {
    const split = splitDisplayName(first);
    first = split.firstName;
    last = split.lastName;
  } else if (!first && /\s+/.test(last)) {
    const split = splitDisplayName(last);
    first = split.firstName;
    last = split.lastName;
  }

  return {
    firstName: first,
    lastName: last
  };
}

function membershipRank(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "active") return 3;
  if (normalized === "pending") return 2;
  if (normalized === "inactive") return 1;
  return 0;
}

function memberQualityScore(member) {
  let score = 0;
  if (String(member.email || "").trim()) score += 5;
  if (member.jerseyNumber !== null && member.jerseyNumber !== undefined) score += 2;
  score += parseJsonArray(member.positionsJson).length;
  score += parseJsonArray(member.rolesJson).length;
  score += membershipRank(member.membershipStatus) * 2;
  if (String(member.notes || "").trim()) score += 1;
  return score;
}

async function deduplicateMembers() {
  const members = await all(`
    select
      id,
      first_name as firstName,
      last_name as lastName,
      display_name as displayName,
      normalized_key as normalizedKey,
      email,
      positions_json as positionsJson,
      roles_json as rolesJson,
      jersey_number as jerseyNumber,
      active,
      rookie,
      in_clubee as inClubee,
      membership_status as membershipStatus,
      deleted_at as deletedAt,
      notes
    from members
    where deleted_at is null
    order by id
  `);

  const grouped = new Map();
  for (const member of members) {
    const parts = canonicalNameParts(member);
    const key = normalizeFullName(parts.firstName, parts.lastName);
    if (!key || key === "|") continue;
    const entry = grouped.get(key) || [];
    entry.push({ ...member, canonicalFirstName: parts.firstName, canonicalLastName: parts.lastName, canonicalKey: key });
    grouped.set(key, entry);
  }

  const duplicateGroups = Array.from(grouped.values()).filter((group) => group.length > 1);
  if (!duplicateGroups.length) return 0;

  let mergedCount = 0;
  await run("begin transaction");
  try {
    for (const group of duplicateGroups) {
      const ordered = [...group].sort((left, right) => {
        const scoreDiff = memberQualityScore(right) - memberQualityScore(left);
        if (scoreDiff !== 0) return scoreDiff;
        return Number(left.id) - Number(right.id);
      });
      const keeper = ordered[0];
      const duplicates = ordered.slice(1);
      if (!duplicates.length) continue;

      const allPositions = new Set(parseJsonArray(keeper.positionsJson).map((value) => String(value || "").trim().toUpperCase()).filter(Boolean));
      const allRoles = new Set(parseJsonArray(keeper.rolesJson).map((value) => String(value || "").trim()).filter(Boolean));
      let bestEmail = String(keeper.email || "").trim();
      let bestJersey = keeper.jerseyNumber;
      let bestMembership = String(keeper.membershipStatus || "pending");
      let active = Boolean(keeper.active);
      let rookie = Boolean(keeper.rookie);
      let inClubee = Boolean(keeper.inClubee);
      const notes = new Set(String(keeper.notes || "").split(";").map((value) => value.trim()).filter(Boolean));

      for (const duplicate of duplicates) {
        parseJsonArray(duplicate.positionsJson)
          .map((value) => String(value || "").trim().toUpperCase())
          .filter(Boolean)
          .forEach((value) => allPositions.add(value));
        parseJsonArray(duplicate.rolesJson)
          .map((value) => String(value || "").trim())
          .filter(Boolean)
          .forEach((value) => allRoles.add(value));
        if (!bestEmail && String(duplicate.email || "").trim()) bestEmail = String(duplicate.email || "").trim();
        if ((bestJersey === null || bestJersey === undefined) && duplicate.jerseyNumber !== null && duplicate.jerseyNumber !== undefined) {
          bestJersey = duplicate.jerseyNumber;
        }
        if (membershipRank(duplicate.membershipStatus) > membershipRank(bestMembership)) {
          bestMembership = String(duplicate.membershipStatus || bestMembership);
        }
        active = active || Boolean(duplicate.active);
        rookie = rookie || Boolean(duplicate.rookie);
        inClubee = inClubee || Boolean(duplicate.inClubee);
        String(duplicate.notes || "")
          .split(";")
          .map((value) => value.trim())
          .filter(Boolean)
          .forEach((value) => notes.add(value));
      }

      await run(
        `
          update members
          set normalized_key = ?,
              first_name = ?,
              last_name = ?,
              display_name = ?,
              email = ?,
              positions_json = ?,
              roles_json = ?,
              jersey_number = ?,
              active = ?,
              rookie = ?,
              in_clubee = ?,
              membership_status = ?,
              notes = ?
          where id = ?
        `,
        [
          keeper.canonicalKey,
          keeper.canonicalFirstName,
          keeper.canonicalLastName,
          `${keeper.canonicalFirstName} ${keeper.canonicalLastName}`.trim(),
          bestEmail,
          JSON.stringify(Array.from(allPositions)),
          JSON.stringify(Array.from(allRoles.size ? allRoles : ["player"])),
          bestJersey,
          active ? 1 : 0,
          rookie ? 1 : 0,
          inClubee ? 1 : 0,
          bestMembership,
          Array.from(notes).join("; "),
          keeper.id
        ]
      );

      for (const duplicate of duplicates) {
        const duplicateId = Number(duplicate.id);
        const keeperId = Number(keeper.id);
        await run(
          `
            update membership_fees
            set member_id = ?
            where member_id = ?
              and not exists (
                select 1 from membership_fees existing
                where existing.member_id = ?
                  and existing.fee_period = membership_fees.fee_period
              )
          `,
          [keeperId, duplicateId, keeperId]
        );
        await run("delete from membership_fees where member_id = ?", [duplicateId]);

        const keeperPass = await get("select id from player_passes where member_id = ?", [keeperId]);
        const duplicatePass = await get("select id from player_passes where member_id = ?", [duplicateId]);
        if (duplicatePass) {
          if (!keeperPass) {
            await run("update player_passes set member_id = ? where member_id = ?", [keeperId, duplicateId]);
          } else {
            await run("delete from player_passes where member_id = ?", [duplicateId]);
          }
        }

        await run("delete from members where id = ?", [duplicateId]);
        mergedCount += 1;
      }
    }
    await run("commit");
  } catch (error) {
    await run("rollback");
    throw error;
  }

  return mergedCount;
}

async function recreateDatabase() {
  if (db) {
    await new Promise((resolve, reject) => db.close((error) => (error ? reject(error) : resolve())));
  }
  await fs.rm(dbFilePath, { force: true });
  db = new sqlite3.Database(dbFilePath);
}

async function createSchema() {
  await run(`create table if not exists app_meta (key text primary key, value text not null)`);
  await run(`
    create table if not exists members (
      id integer primary key autoincrement,
      normalized_key text not null unique,
      email text not null default '',
      first_name text,
      last_name text,
      display_name text not null,
      positions_json text not null default '[]',
      roles_json text not null default '[]',
      jersey_number integer,
      active integer not null default 1,
      rookie integer not null default 0,
      in_clubee integer not null default 0,
      membership_status text not null default 'pending',
      notes text,
      deleted_at text
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
  await run(`
    create table if not exists player_passes (
      id integer primary key autoincrement,
      member_id integer not null unique references members(id) on delete cascade,
      pass_status text not null,
      expiry_date text,
      license_name text,
      medical_status text,
      docs_json text not null default '[]',
      clubee_email text,
      clubee_phone text,
      note text
    )
  `);
  await run(`
    insert into app_meta(key, value) values ('schema_version', ?)
    on conflict(key) do update set value = excluded.value
  `, [String(DB_SCHEMA_VERSION)]);
}

async function ensureSoftDeleteColumn() {
  const columns = await all("pragma table_info(members)");
  const hasDeletedAt = columns.some((column) => String(column.name || "") === "deleted_at");
  if (!hasDeletedAt) {
    await run("alter table members add column deleted_at text");
  }
}

export async function initializeDatabase(dbPath) {
  dbFilePath = dbPath;
  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  db = new sqlite3.Database(dbPath);
  const metaExists = await get(`select name from sqlite_master where type = 'table' and name = 'app_meta'`);
  if (metaExists) {
    const versionRow = await get("select value from app_meta where key = 'schema_version'");
    if (Number(versionRow?.value || 0) !== DB_SCHEMA_VERSION) {
      await recreateDatabase();
    }
  }
  await createSchema();
  await ensureSoftDeleteColumn();
}

export async function ensureImported({ playerCsvPath, feesCsvPath, clubeeXlsxPath }) {
  const countRow = await get("select count(*) as count from members");
  if ((countRow?.count || 0) > 0) {
    await deduplicateMembers();
    await ensureFeeCoverage();
    return;
  }

  const playerRows = await readCsv(playerCsvPath);
  const feeRows = await readCsv(feesCsvPath);
  const clubeeRows = await readClubeeWorkbook(clubeeXlsxPath);
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
        positions: parsePositions(row.Position, ""),
        roles: ["player"],
        jerseyNumber: parseJerseyNumber(row["Jersey Number"]),
        active: toBool(row.Active),
        rookie: toBool(row.Rookie),
        inClubee: toBool(row["In Clubee"]),
        membershipStatus: toBool(row.Active) ? "active" : "inactive",
        notes: "",
        playerPass: null
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
        positions: [],
        roles: ["player"],
        jerseyNumber: null,
        active: false,
        rookie: false,
        inClubee: false,
        membershipStatus: "inactive",
        notes: "",
        playerPass: null
      });
    }
    const existing = members.get(normalizedKey);
    const email = String(row["E-Mail"] || "").trim();
    if (!existing.email && email) existing.email = email;
  }

  for (const row of clubeeRows) {
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
        positions: [],
        roles: ["player"],
        jerseyNumber: null,
        active: true,
        rookie: false,
        inClubee: true,
        membershipStatus: "active",
        notes: "",
        playerPass: null
      });
    }
    const existing = members.get(normalizedKey);
    const clubeePositions = String(row.Positionen || "");
    existing.positions = Array.from(new Set([...existing.positions, ...parsePositions("", clubeePositions)]));
    existing.roles = Array.from(new Set([...existing.roles, ...parseRoles(clubeePositions)]));
    existing.email = existing.email || String(row["E-Mail"] || "").trim();
    existing.jerseyNumber = existing.jerseyNumber ?? parseJerseyNumber(row.Trikotnummer);
    const license = parseLicense(row.Lizenz);
    const docs = [
      { type: "application", value: String(row["Antragsformular Lizenz (ID43284)"] || "").trim() },
      { type: "medical", value: String(row["Ärztliches Attest (ID43286)"] || "").trim() },
      { type: "nada", value: String(row["NADA-Formular (ID43287)"] || "").trim() },
      { type: "identity", value: String(row["Identitätsnachweis (ID43288)"] || "").trim() },
      { type: "registration", value: String(row["Meldezettel (ID43289)"] || "").trim() },
      { type: "itc", value: String(row["ITC (ID43290)"] || "").trim() },
      { type: "education", value: String(row["Ausbildungsnachweis (ID43418)"] || "").trim() }
    ].filter((doc) => doc.value);
    existing.playerPass = {
      status: license.status,
      expiryDate: license.expiry,
      licenseName: license.licenseName,
      medicalStatus: String(row["Medizinische Untersuchung"] || "").trim(),
      docs,
      clubeeEmail: String(row["E-Mail"] || "").trim(),
      clubeePhone: String(row["Telefonnnummer"] || "").trim(),
      note: license.note
    };
  }

  await run("begin transaction");
  try {
    for (const member of members.values()) {
      const result = await run(`
        insert into members (
          normalized_key, email, first_name, last_name, display_name, positions_json,
          roles_json, jersey_number, active, rookie, in_clubee, membership_status, notes
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        member.normalizedKey,
        member.email,
        member.firstName,
        member.lastName,
        member.displayName,
        JSON.stringify(member.positions),
        JSON.stringify(member.roles),
        member.jerseyNumber,
        member.active ? 1 : 0,
        member.rookie ? 1 : 0,
        member.inClubee ? 1 : 0,
        member.membershipStatus,
        member.notes
      ]);

      if (member.playerPass) {
        await run(`
          insert into player_passes (
            member_id, pass_status, expiry_date, license_name, medical_status,
            docs_json, clubee_email, clubee_phone, note
          ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          result.lastID,
          member.playerPass.status,
          member.playerPass.expiryDate,
          member.playerPass.licenseName,
          member.playerPass.medicalStatus,
          JSON.stringify(member.playerPass.docs),
          member.playerPass.clubeeEmail,
          member.playerPass.clubeePhone,
          member.playerPass.note
        ]);
      }
    }

    const periods = collectImportPeriods(feeRows);
    const currentPeriodScore = periodScore(normalizePeriodToken(quarterFromDate()));
    for (const row of feeRows) {
      const normalizedKey = normalizeFullName(row.Vorname, row.Nachname);
      const member = await get("select id from members where normalized_key = ?", [normalizedKey]);
      if (!member) continue;
      for (const period of periods) {
        const periodLabel = period.replace("_", " ");
        const fee = mapFeeStatus(row[periodLabel], {
          treatBlankAsNotCollected: periodScore(period) >= currentPeriodScore
        });
        if (!fee) continue;
        await run(`
          insert into membership_fees (
            member_id, season_label, fee_period, amount_cents, paid_cents,
            status, iban, mandate_id, sepa_link, status_note
          ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          member.id,
          period.split("_")[1],
          period,
          8250,
          fee.paidCents,
          fee.status,
          String(row.IBAN || "").trim() || null,
          String(row["Mandats-ID"] || "").trim() || null,
          String(row.SEPA || "").trim() || null,
          fee.note
        ]);
      }
    }
    await run("commit");
  } catch (error) {
    await run("rollback");
    throw error;
  }
  await deduplicateMembers();
}

export async function syncClubeePassData({ clubeeXlsxPath }) {
  const preview = await previewClubeePassSync({ clubeeXlsxPath });
  const selectedMemberIds = preview.changes.map((change) => Number(change.memberId));
  const result = await applyClubeePassSync({ clubeeXlsxPath, memberIds: selectedMemberIds });
  return {
    processedRows: preview.processedRows,
    matchedRows: preview.matchedRows,
    unmatchedRows: preview.unmatchedRows,
    createdPasses: result.createdPasses,
    updatedPasses: result.updatedPasses,
    unmatchedNames: preview.unmatchedNames
  };
}

async function buildClubeePassSyncPlan({ clubeeXlsxPath }) {
  if (!clubeeXlsxPath) {
    throw new Error("clubeeXlsxPath is required.");
  }

  const clubeeRows = await readClubeeWorkbook(clubeeXlsxPath);
  const members = await all(`
    select
      m.id,
      m.normalized_key as normalizedKey,
      m.first_name as firstName,
      m.last_name as lastName,
      m.display_name as displayName,
      m.email,
      m.in_clubee as inClubee,
      pp.id as passId,
      pp.pass_status as passStatus,
      pp.expiry_date as passExpiry,
      pp.license_name as licenseName,
      pp.medical_status as medicalStatus,
      pp.docs_json as docsJson,
      pp.clubee_email as clubeeEmail,
      pp.clubee_phone as clubeePhone,
      pp.note as note
    from members m
    left join player_passes pp on pp.member_id = m.id
    where m.deleted_at is null
  `);

  const memberByKey = new Map(members.map((member) => [String(member.normalizedKey || ""), member]));
  const changes = [];
  let processedRows = 0;
  let matchedRows = 0;
  let unmatchedRows = 0;
  const unmatchedNames = [];

  for (const row of clubeeRows) {
    const record = parseClubeePassRecord(row);
    if (!record) continue;
    processedRows += 1;

    const member = memberByKey.get(record.normalizedKey);
    if (!member) {
      unmatchedRows += 1;
      unmatchedNames.push(`${record.firstName} ${record.lastName}`.trim());
      continue;
    }

    matchedRows += 1;

    const currentDocsJson = JSON.stringify(parseJsonArray(member.docsJson || "[]"));
    const nextDocsJson = JSON.stringify(record.docs);
    const fieldChanges = [];

    if (!Number(member.inClubee)) {
      fieldChanges.push({ field: "in_clubee", current: "0", next: "1" });
    }
    if (String(member.passStatus || "") !== String(record.passStatus || "")) {
      fieldChanges.push({ field: "pass_status", current: member.passStatus || "", next: record.passStatus || "" });
    }
    if (String(member.passExpiry || "") !== String(record.passExpiry || "")) {
      fieldChanges.push({ field: "expiry_date", current: member.passExpiry || "", next: record.passExpiry || "" });
    }
    if (String(member.licenseName || "") !== String(record.licenseName || "")) {
      fieldChanges.push({ field: "license_name", current: member.licenseName || "", next: record.licenseName || "" });
    }
    if (String(member.medicalStatus || "") !== String(record.medicalStatus || "")) {
      fieldChanges.push({ field: "medical_status", current: member.medicalStatus || "", next: record.medicalStatus || "" });
    }
    if (currentDocsJson !== nextDocsJson) {
      fieldChanges.push({ field: "docs_json", current: currentDocsJson, next: nextDocsJson });
    }
    if (String(member.clubeeEmail || "") !== String(record.clubeeEmail || "")) {
      fieldChanges.push({ field: "clubee_email", current: member.clubeeEmail || "", next: record.clubeeEmail || "" });
    }
    if (String(member.clubeePhone || "") !== String(record.clubeePhone || "")) {
      fieldChanges.push({ field: "clubee_phone", current: member.clubeePhone || "", next: record.clubeePhone || "" });
    }
    if (String(member.note || "") !== String(record.note || "")) {
      fieldChanges.push({ field: "note", current: member.note || "", next: record.note || "" });
    }

    if (!fieldChanges.length) continue;

    changes.push({
      memberId: Number(member.id),
      memberName: String(member.displayName || `${member.firstName || ""} ${member.lastName || ""}`).trim(),
      memberEmail: String(member.email || "").trim(),
      existingPass: Boolean(member.passId),
      fieldChanges,
      proposed: {
        passStatus: record.passStatus,
        passExpiry: record.passExpiry,
        licenseName: record.licenseName,
        medicalStatus: record.medicalStatus,
        docsJson: nextDocsJson,
        clubeeEmail: record.clubeeEmail,
        clubeePhone: record.clubeePhone,
        note: record.note
      }
    });
  }

  const createdPasses = changes.filter((change) => !change.existingPass).length;
  const updatedPasses = changes.filter((change) => change.existingPass).length;

  return {
    processedRows,
    matchedRows,
    unmatchedRows,
    createdPasses,
    updatedPasses,
    unmatchedNames: unmatchedNames.slice(0, 20),
    changes
  };
}

export async function previewClubeePassSync({ clubeeXlsxPath }) {
  return buildClubeePassSyncPlan({ clubeeXlsxPath });
}

export async function applyClubeePassSync({ clubeeXlsxPath, memberIds }) {
  const plan = await buildClubeePassSyncPlan({ clubeeXlsxPath });
  const selectedSet = new Set(
    (Array.isArray(memberIds) ? memberIds : [])
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0)
  );
  const selectedChanges = selectedSet.size
    ? plan.changes.filter((change) => selectedSet.has(Number(change.memberId)))
    : [];

  await run("begin transaction");
  try {
    for (const change of selectedChanges) {
      await run("update members set in_clubee = 1 where id = ?", [change.memberId]);
      await run(
        `
          insert into player_passes (
            member_id, pass_status, expiry_date, license_name, medical_status,
            docs_json, clubee_email, clubee_phone, note
          ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
          on conflict(member_id) do update set
            pass_status = excluded.pass_status,
            expiry_date = excluded.expiry_date,
            license_name = excluded.license_name,
            medical_status = excluded.medical_status,
            docs_json = excluded.docs_json,
            clubee_email = excluded.clubee_email,
            clubee_phone = excluded.clubee_phone,
            note = excluded.note
        `,
        [
          change.memberId,
          change.proposed.passStatus,
          change.proposed.passExpiry,
          change.proposed.licenseName,
          change.proposed.medicalStatus,
          change.proposed.docsJson,
          change.proposed.clubeeEmail,
          change.proposed.clubeePhone,
          change.proposed.note
        ]
      );
    }

    await run("commit");
  } catch (error) {
    await run("rollback");
    throw error;
  }

  return {
    selectedCount: selectedChanges.length,
    skippedCount: Math.max(0, plan.changes.length - selectedChanges.length),
    appliedCount: selectedChanges.length,
    createdPasses: selectedChanges.filter((change) => !change.existingPass).length,
    updatedPasses: selectedChanges.filter((change) => change.existingPass).length,
    processedRows: plan.processedRows,
    matchedRows: plan.matchedRows,
    unmatchedRows: plan.unmatchedRows,
    unmatchedNames: plan.unmatchedNames
  };
}

export async function ensureFeeCoverage() {
  const members = await all("select id from members");
  if (!members.length) return;

  const targetPeriods = quarterSequence(normalizePeriodToken(quarterFromDate()), 4);
  const existingRows = await all("select member_id as memberId, fee_period as feePeriod from membership_fees");
  const existing = new Set(existingRows.map((row) => `${row.memberId}:${row.feePeriod}`));
  const lastKnownIbanRows = await all(`
    select member_id as memberId, fee_period as feePeriod, iban
    from membership_fees
    where trim(coalesce(iban, '')) <> ''
    order by member_id, fee_period desc
  `);
  const lastKnownIban = new Map();
  for (const row of lastKnownIbanRows) {
    const memberKey = String(row.memberId);
    if (!lastKnownIban.has(memberKey)) {
      lastKnownIban.set(memberKey, String(row.iban || "").trim());
    }
  }

  await run("begin transaction");
  try {
    for (const member of members) {
      const memberIban = lastKnownIban.get(String(member.id)) || null;
      for (const feePeriod of targetPeriods) {
        const key = `${member.id}:${feePeriod}`;
        if (existing.has(key)) continue;
        await run(
          `
            insert into membership_fees (
              member_id, season_label, fee_period, amount_cents, paid_cents,
              status, iban, status_note
            ) values (?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            member.id,
            feePeriod.split("_")[1],
            feePeriod,
            8250,
            0,
            "not_collected",
            memberIban,
            null
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

export async function bulkUpdateFeeStatus({ feePeriod, status, memberIds }) {
  const normalizedPeriod = normalizePeriodToken(feePeriod);
  if (!normalizedPeriod) {
    throw new Error("Fee period is required.");
  }
  const normalizedStatus = normalizeFeeStatusForUpdate(status);
  const normalizedMemberIds = Array.from(
    new Set((Array.isArray(memberIds) ? memberIds : []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))
  );
  if (!normalizedMemberIds.length) {
    throw new Error("Select at least one member.");
  }

  const placeholders = normalizedMemberIds.map(() => "?").join(", ");
  const paidCentsSql = normalizedStatus === "paid" ? "amount_cents" : normalizedStatus === "partial" ? "paid_cents" : "0";

  const result = await run(
    `
      update membership_fees
      set status = ?,
          paid_cents = ${paidCentsSql}
      where fee_period = ?
        and member_id in (${placeholders})
    `,
    [normalizedStatus, normalizedPeriod, ...normalizedMemberIds]
  );

  return result?.changes || 0;
}

export async function updateFeeRecord(feeId, payload) {
  const normalizedFeeId = Number(feeId);
  if (!Number.isFinite(normalizedFeeId) || normalizedFeeId <= 0) {
    throw new Error("Valid fee id is required.");
  }

  const existing = await get(
    "select id, amount_cents as amountCents, iban from membership_fees where id = ?",
    [normalizedFeeId]
  );
  if (!existing) {
    throw new Error("Fee record not found.");
  }

  const status = normalizeFeeStatusForUpdate(payload.status);
  const amountCents = normalizeCurrencyToCents(payload.amount, "Fee amount");
  let paidCents = normalizeCurrencyToCents(payload.paidAmount, "Paid amount");

  if (status === "paid") {
    paidCents = amountCents;
  } else if (["pending", "not_collected", "exempt", "exit", "not_applicable"].includes(status)) {
    paidCents = 0;
  }

  if (status === "partial" && paidCents >= amountCents) {
    throw new Error("For partial status, paid amount must be lower than full amount.");
  }

  if (paidCents > amountCents) {
    throw new Error("Paid amount cannot be greater than fee amount.");
  }

  const note = String(payload.note || "").trim();
  const storedNote = note || null;
  const nextIban = Object.prototype.hasOwnProperty.call(payload, "iban")
    ? (String(payload.iban || "").trim() || null)
    : (existing.iban || null);
  await run(
    `
      update membership_fees
      set status = ?,
          amount_cents = ?,
          paid_cents = ?,
          iban = ?,
          status_note = ?
      where id = ?
    `,
    [status, amountCents, paidCents, nextIban, storedNote, normalizedFeeId]
  );
}

async function getMembersWithPasses() {
  return all(`
    select
      m.id,
      m.display_name as name,
      m.first_name as firstName,
      m.last_name as lastName,
      m.email,
      m.positions_json as positionsJson,
      m.roles_json as rolesJson,
      m.jersey_number as jerseyNumber,
      m.active,
      m.rookie,
      m.in_clubee as inClubee,
      m.membership_status as membershipStatus,
      m.deleted_at as deletedAt,
      m.notes,
      pp.pass_status as passStatus,
      pp.expiry_date as passExpiry,
      pp.license_name as licenseName,
      pp.note as passNote
    from members m
    left join player_passes pp on pp.member_id = m.id
    order by m.last_name, m.first_name, m.display_name
  `);
}

async function getFeeRows() {
  return all(`
    select
      id,
      member_id as memberId,
      season_label as season,
      fee_period as feePeriod,
      amount_cents as amountCents,
      paid_cents as paidCents,
      status,
      iban,
      status_note as note
    from membership_fees
    order by season_label, fee_period, member_id
  `);
}

export async function createMember(payload) {
  const member = normalizeMemberPayload(payload);
  const existing = await get("select id from members where normalized_key = ?", [member.normalizedKey]);
  if (existing) {
    throw new Error("A member with that name already exists.");
  }
  await run("begin transaction");
  try {
    const insertResult = await run(`
      insert into members (
        normalized_key, email, first_name, last_name, display_name, positions_json,
        roles_json, jersey_number, active, rookie, in_clubee, membership_status, notes, deleted_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      member.normalizedKey,
      member.email,
      member.firstName,
      member.lastName,
      member.displayName,
      JSON.stringify(member.positions),
      JSON.stringify(member.roles),
      member.jerseyNumber,
      member.active ? 1 : 0,
      member.rookie ? 1 : 0,
      member.inClubee ? 1 : 0,
      member.membershipStatus,
      member.notes,
      null
    ]);

    await upsertPlayerPass(insertResult.lastID, member);
    await run("commit");
  } catch (error) {
    await run("rollback");
    throw error;
  }
}

export async function updateMember(memberId, payload) {
  const member = normalizeMemberPayload(payload);
  const existing = await get("select id from members where id = ?", [memberId]);
  if (!existing) {
    throw new Error("Member not found.");
  }
  const duplicate = await get("select id from members where normalized_key = ? and id <> ?", [member.normalizedKey, memberId]);
  if (duplicate) {
    throw new Error("Another member already uses that name.");
  }
  await run("begin transaction");
  try {
    await run(`
      update members
      set normalized_key = ?, email = ?, first_name = ?, last_name = ?, display_name = ?,
          positions_json = ?, roles_json = ?, jersey_number = ?, active = ?, rookie = ?,
          in_clubee = ?, membership_status = ?, notes = ?
      where id = ?
    `, [
      member.normalizedKey,
      member.email,
      member.firstName,
      member.lastName,
      member.displayName,
      JSON.stringify(member.positions),
      JSON.stringify(member.roles),
      member.jerseyNumber,
      member.active ? 1 : 0,
      member.rookie ? 1 : 0,
      member.inClubee ? 1 : 0,
      member.membershipStatus,
      member.notes,
      memberId
    ]);

    await upsertPlayerPass(memberId, member);
    await run("commit");
  } catch (error) {
    await run("rollback");
    throw error;
  }
}

export async function deleteMember(memberId) {
  const existing = await get("select id, deleted_at as deletedAt from members where id = ?", [memberId]);
  if (!existing) {
    throw new Error("Member not found.");
  }
  if (existing.deletedAt) {
    return;
  }
  await run("update members set deleted_at = datetime('now') where id = ?", [memberId]);
}

export async function undeleteMember(memberId) {
  const existing = await get("select id from members where id = ?", [memberId]);
  if (!existing) {
    throw new Error("Member not found.");
  }
  await run("update members set deleted_at = null where id = ?", [memberId]);
}

export async function mergeMembers({ keepMemberId, removeMemberId, firstName, lastName }) {
  const keepId = Number(keepMemberId);
  const removeId = Number(removeMemberId);
  if (!Number.isFinite(keepId) || !Number.isFinite(removeId) || keepId <= 0 || removeId <= 0) {
    throw new Error("Valid keep/remove member ids are required.");
  }
  if (keepId === removeId) {
    throw new Error("Keep and remove member ids must differ.");
  }

  const keep = await get(
    `
      select id, first_name as firstName, last_name as lastName, display_name as displayName,
             normalized_key as normalizedKey, email, positions_json as positionsJson, roles_json as rolesJson,
             jersey_number as jerseyNumber, active, rookie, in_clubee as inClubee,
             membership_status as membershipStatus, notes
      from members where id = ?
    `,
    [keepId]
  );
  const remove = await get(
    `
      select id, first_name as firstName, last_name as lastName, display_name as displayName,
             normalized_key as normalizedKey, email, positions_json as positionsJson, roles_json as rolesJson,
             jersey_number as jerseyNumber, active, rookie, in_clubee as inClubee,
             membership_status as membershipStatus, notes
      from members where id = ?
    `,
    [removeId]
  );
  if (!keep || !remove) {
    throw new Error("Both keep/remove members must exist.");
  }

  const mergedFirstName = String(firstName || keep.firstName || remove.firstName || "").trim();
  const mergedLastName = String(lastName || keep.lastName || remove.lastName || "").trim();
  const mergedDisplayName = `${mergedFirstName} ${mergedLastName}`.trim() || String(keep.displayName || remove.displayName || "").trim();
  if (!mergedDisplayName) {
    throw new Error("Merged member requires a name.");
  }
  const normalizedKey = normalizeFullName(mergedFirstName, mergedLastName || mergedDisplayName);

  const conflicting = await get("select id from members where normalized_key = ? and id not in (?, ?)", [normalizedKey, keepId, removeId]);
  if (conflicting) {
    throw new Error("Merged name conflicts with another member.");
  }

  const mergedEmail = String(keep.email || "").trim() || String(remove.email || "").trim();
  const mergedPositions = Array.from(
    new Set([
      ...parseJsonArray(keep.positionsJson).map((value) => String(value || "").trim().toUpperCase()),
      ...parseJsonArray(remove.positionsJson).map((value) => String(value || "").trim().toUpperCase())
    ].filter(Boolean))
  );
  const mergedRoles = Array.from(
    new Set([
      ...parseJsonArray(keep.rolesJson).map((value) => String(value || "").trim()),
      ...parseJsonArray(remove.rolesJson).map((value) => String(value || "").trim())
    ].filter(Boolean))
  );
  const mergedJersey = keep.jerseyNumber ?? remove.jerseyNumber ?? null;
  const mergedActive = Boolean(keep.active) || Boolean(remove.active);
  const mergedRookie = Boolean(keep.rookie) || Boolean(remove.rookie);
  const mergedInClubee = Boolean(keep.inClubee) || Boolean(remove.inClubee);
  const mergedMembership = membershipRank(keep.membershipStatus) >= membershipRank(remove.membershipStatus)
    ? keep.membershipStatus
    : remove.membershipStatus;
  const mergedNotes = Array.from(
    new Set(
      `${keep.notes || ""};${remove.notes || ""}`
        .split(";")
        .map((value) => value.trim())
        .filter(Boolean)
    )
  ).join("; ");

  await run("begin transaction");
  try {
    await run(
      "update members set normalized_key = normalized_key || '#merged' || id where id = ?",
      [removeId]
    );

    await run(
      `
        update members
        set normalized_key = ?,
            first_name = ?,
            last_name = ?,
            display_name = ?,
            email = ?,
            positions_json = ?,
            roles_json = ?,
            jersey_number = ?,
            active = ?,
            rookie = ?,
            in_clubee = ?,
            membership_status = ?,
            notes = ?
        where id = ?
      `,
      [
        normalizedKey,
        mergedFirstName,
        mergedLastName,
        mergedDisplayName,
        mergedEmail,
        JSON.stringify(mergedPositions),
        JSON.stringify(mergedRoles.length ? mergedRoles : ["player"]),
        mergedJersey,
        mergedActive ? 1 : 0,
        mergedRookie ? 1 : 0,
        mergedInClubee ? 1 : 0,
        mergedMembership,
        mergedNotes,
        keepId
      ]
    );

    await run(
      `
        update membership_fees
        set member_id = ?
        where member_id = ?
          and not exists (
            select 1 from membership_fees existing
            where existing.member_id = ?
              and existing.fee_period = membership_fees.fee_period
          )
      `,
      [keepId, removeId, keepId]
    );
    await run("delete from membership_fees where member_id = ?", [removeId]);

    const keepPass = await get("select id from player_passes where member_id = ?", [keepId]);
    const removePass = await get("select id from player_passes where member_id = ?", [removeId]);
    if (removePass) {
      if (!keepPass) {
        await run("update player_passes set member_id = ? where member_id = ?", [keepId, removeId]);
      } else {
        await run("delete from player_passes where member_id = ?", [removeId]);
      }
    }

    await run("delete from members where id = ?", [removeId]);
    await run("commit");
  } catch (error) {
    await run("rollback");
    throw error;
  }
}

export async function getBootstrapData() {
  const members = await getMembersWithPasses();
  const fees = await getFeeRows();

  const latestFeeStatus = new Map();
  for (const fee of fees) latestFeeStatus.set(fee.memberId, fee.status);

  return {
    source: "local-sqlite",
    permissionsModel: {
      note: "Admins inherit all coach/player/finance/tech capabilities.",
      restrictedAreas: {
        fees: ["admin"],
        playerPasses: ["admin", "coach", "tech_admin"]
      }
    },
    members: members.map((member) => {
      const roles = capabilitySet(JSON.parse(member.rolesJson || "[]"));
      return {
        id: member.id,
        name: member.name,
        firstName: member.firstName || "",
        lastName: member.lastName || "",
        email: member.email,
        positions: JSON.parse(member.positionsJson || "[]"),
        roles,
        jerseyNumber: member.jerseyNumber,
        active: Boolean(member.active),
        rookie: Boolean(member.rookie),
        inClubee: Boolean(member.inClubee),
        membershipStatus: member.membershipStatus,
        deletedAt: member.deletedAt || null,
        passStatus: member.passStatus || "missing",
        passExpiry: member.passExpiry || "",
        passNote: member.passNote || "",
        licenseName: member.licenseName || "",
        feeStatus: latestFeeStatus.get(member.id) || "pending",
        notes: member.notes || "",
        lastInviteResponse: "pending"
      };
    }),
    fees: fees.map((fee) => ({
      id: fee.id,
      memberId: fee.memberId,
      season: fee.season,
      feePeriod: fee.feePeriod,
      amount: Number(((fee.amountCents || 0) / 100).toFixed(2)),
      paidAmount: Number(((fee.paidCents || 0) / 100).toFixed(2)),
      status: fee.status,
      iban: fee.iban || "",
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
