import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import xlsx from "xlsx";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT || 4173);
const SEPA_GENERATOR_DIR = "C:\\Projekte\\UniWien-SEPAs";
const SEPA_GENERATOR_SCRIPT = path.join(SEPA_GENERATOR_DIR, "sepa_generator.py");
const SEPA_GENERATOR_INPUT_CSV = path.join(SEPA_GENERATOR_DIR, "Mitgliedsbeiträge Quartale bezahlt - Sheet1.csv");
const SUPABASE_URL = process.env.SUPABASE_URL || "https://qggypwdmfrkhehmspvsr.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
const CORS_ORIGIN = String(process.env.CORS_ORIGIN || "").trim();
const ENABLE_LOCAL_DB = String(process.env.ENABLE_LOCAL_DB || (process.env.RENDER ? "false" : "true")).toLowerCase() !== "false";
const SERVE_STATIC_FRONTEND = String(process.env.SERVE_STATIC_FRONTEND || (process.env.RENDER ? "false" : "true")).toLowerCase() !== "false";
const CLUBEE_XLSX_PATH = String(process.env.CLUBEE_XLSX_PATH || path.join(__dirname, "assets", "uni-wien-emperors_dfcbbd998dee66426d1889d1fd42cc61.xlsx")).trim();

let localDbApi = null;
let localDbUnavailableReason = "";

async function initializeOptionalLocalDatabase() {
  if (!ENABLE_LOCAL_DB) {
    localDbUnavailableReason = "ENABLE_LOCAL_DB is disabled for this deployment.";
    return;
  }

  try {
    const dbModule = await import("./src/server/db-v2.mjs");
    await dbModule.initializeDatabase(path.join(__dirname, "data", "emperors.db"));
    await dbModule.ensureImported({
      clubeeXlsxPath: CLUBEE_XLSX_PATH,
      feesCsvPath: path.join(__dirname, "membership-fees.csv"),
      playerCsvPath: path.join(__dirname, "player-list.csv")
    });
    localDbApi = dbModule;
  } catch (error) {
    localDbUnavailableReason = error instanceof Error ? error.message : "Unknown local DB initialization error.";
    console.warn(`[local-db] disabled: ${localDbUnavailableReason}`);
    localDbApi = null;
  }
}

function requireLocalDb(res, featureLabel = "This endpoint") {
  if (localDbApi) return true;
  res.status(503).json({
    error: `${featureLabel} is unavailable on this deployment. ${localDbUnavailableReason || "Local SQLite module is not available."}`
  });
  return false;
}

function hasSupabaseAdminConfig() {
  return Boolean(String(SUPABASE_URL || "").trim() && String(SUPABASE_SERVICE_ROLE_KEY || "").trim());
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

function parseClubeeLicense(rawLicense) {
  const text = String(rawLicense || "").trim();
  if (!text) {
    return { passStatus: "missing", passExpiry: null, licenseName: "", note: "No license text in Clubee export." };
  }
  const match = text.match(/^(.*?)\s*\(\d+\)\s*:?\s*Spielberechtigt bis\s+(\d{2}\/\d{2}\/\d{4})/i);
  if (!match) return { passStatus: "missing", passExpiry: null, licenseName: text, note: text };
  const [, licenseName, expiryText] = match;
  const [day, month, year] = expiryText.split("/");
  const passExpiry = `${year}-${month}-${day}`;
  const expiryDate = new Date(`${passExpiry}T00:00:00`);
  const diffDays = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const passStatus = diffDays < 0 ? "expired" : "valid";
  return {
    passStatus,
    passExpiry,
    licenseName: String(licenseName || "").trim(),
    note: text
  };
}

function parseClubeePassRecord(row) {
  const firstName = String(row?.Vorname || "").trim();
  const lastName = String(row?.Nachname || "").trim();
  if (!firstName && !lastName) return null;
  const normalizedKey = normalizeFullName(firstName, lastName);
  if (!normalizedKey) return null;
  const license = parseClubeeLicense(row?.Lizenz);
  return {
    firstName,
    lastName,
    normalizedKey,
    passStatus: license.passStatus,
    passExpiry: license.passExpiry,
    licenseName: license.licenseName,
    note: license.note
  };
}

function readClubeeWorkbook(filePath) {
  const workbook = xlsx.readFile(filePath);
  const firstSheet = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheet];
  return xlsx.utils.sheet_to_json(sheet, { defval: "" });
}

function readClubeeWorkbookFromBuffer(buffer) {
  const workbook = xlsx.read(buffer, { type: "buffer" });
  const firstSheet = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheet];
  return xlsx.utils.sheet_to_json(sheet, { defval: "" });
}

function decodeBase64FilePayload(fileBase64) {
  const raw = String(fileBase64 || "").trim();
  if (!raw) return null;
  const cleaned = raw.replace(/^data:.*;base64,/, "");
  const buffer = Buffer.from(cleaned, "base64");
  if (!buffer.length) {
    throw new Error("Uploaded file payload is empty.");
  }
  if (buffer.length > 15 * 1024 * 1024) {
    throw new Error("Uploaded Clubee file is too large (max 15MB).");
  }
  return buffer;
}

async function loadSupabaseMembersAndPasses() {
  if (!hasSupabaseAdminConfig()) {
    throw new Error("Supabase admin config is missing on the server.");
  }

  const membersResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/members?select=${encodeURIComponent("id,first_name,last_name,display_name,email")}`,
    { method: "GET", headers: supabaseAdminHeaders() }
  );
  const membersPayload = await membersResponse.json().catch(() => []);
  if (!membersResponse.ok) {
    const message = membersPayload?.message || membersPayload?.error || `Could not fetch members (${membersResponse.status}).`;
    throw new Error(message);
  }

  const passesResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/player_passes?select=${encodeURIComponent("member_id,pass_status,expires_on,federation_reference,notes")}`,
    { method: "GET", headers: supabaseAdminHeaders() }
  );
  const passesPayload = await passesResponse.json().catch(() => []);
  if (!passesResponse.ok) {
    const message = passesPayload?.message || passesPayload?.error || `Could not fetch player passes (${passesResponse.status}).`;
    throw new Error(message);
  }

  const members = Array.isArray(membersPayload) ? membersPayload : [];
  const passes = Array.isArray(passesPayload) ? passesPayload : [];
  return { members, passes };
}

async function buildSupabaseClubeePassSyncPlan({ clubeeRows, sourceLabel, sourceMtimeMs } = {}) {
  let rows = Array.isArray(clubeeRows) ? clubeeRows : null;
  let finalSourceLabel = String(sourceLabel || "").trim();
  let finalSourceMtimeMs = Number(sourceMtimeMs || 0);

  if (!rows) {
    let stats;
    try {
      stats = await fs.stat(CLUBEE_XLSX_PATH);
    } catch {
      throw new Error(`Clubee export file was not found at ${CLUBEE_XLSX_PATH}.`);
    }
    rows = readClubeeWorkbook(CLUBEE_XLSX_PATH);
    finalSourceLabel = finalSourceLabel || CLUBEE_XLSX_PATH;
    finalSourceMtimeMs = finalSourceMtimeMs || Number(stats.mtimeMs || 0);
  }

  const clubeeRowsLocal = rows;
  const { members, passes } = await loadSupabaseMembersAndPasses();

  const memberByKey = new Map();
  members.forEach((member) => {
    const key = normalizeFullName(member?.first_name || "", member?.last_name || "");
    if (!key || key === "|") return;
    memberByKey.set(key, member);
  });

  const passByMemberId = new Map();
  passes.forEach((pass) => {
    passByMemberId.set(String(pass?.member_id || ""), pass);
  });

  const changes = [];
  let processedRows = 0;
  let matchedRows = 0;
  let unmatchedRows = 0;
  const unmatchedNames = [];

  for (const row of clubeeRowsLocal) {
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

    const currentPass = passByMemberId.get(String(member.id || ""));
    const currentStatus = String(currentPass?.pass_status || "");
    const currentExpiry = String(currentPass?.expires_on || "");
    const currentLicense = String(currentPass?.federation_reference || "");
    const currentNote = String(currentPass?.notes || "");

    const fieldChanges = [];
    if (currentStatus !== String(record.passStatus || "")) {
      fieldChanges.push({ field: "pass_status", current: currentStatus, next: String(record.passStatus || "") });
    }
    if (currentExpiry !== String(record.passExpiry || "")) {
      fieldChanges.push({ field: "expiry_date", current: currentExpiry, next: String(record.passExpiry || "") });
    }
    if (currentLicense !== String(record.licenseName || "")) {
      fieldChanges.push({ field: "license_name", current: currentLicense, next: String(record.licenseName || "") });
    }
    if (currentNote !== String(record.note || "")) {
      fieldChanges.push({ field: "note", current: currentNote, next: String(record.note || "") });
    }
    if (!fieldChanges.length) continue;

    changes.push({
      memberId: Number(member.id),
      memberName: String(member.display_name || `${member.first_name || ""} ${member.last_name || ""}`).trim(),
      memberEmail: String(member.email || "").trim(),
      existingPass: Boolean(currentPass),
      fieldChanges,
      proposed: {
        passStatus: String(record.passStatus || "missing"),
        passExpiry: String(record.passExpiry || "") || null,
        licenseName: String(record.licenseName || ""),
        note: String(record.note || "")
      }
    });
  }

  return {
    sourceFilePath: finalSourceLabel || CLUBEE_XLSX_PATH,
    sourceMtimeMs: finalSourceMtimeMs,
    processedRows,
    matchedRows,
    unmatchedRows,
    createdPasses: changes.filter((entry) => !entry.existingPass).length,
    updatedPasses: changes.filter((entry) => entry.existingPass).length,
    unmatchedNames: unmatchedNames.slice(0, 20),
    changes
  };
}

async function previewSupabaseClubeePassSync(options = {}) {
  return buildSupabaseClubeePassSyncPlan(options);
}

async function applySupabaseClubeePassSync({ memberIds, clubeeRows, sourceLabel, sourceMtimeMs } = {}) {
  const plan = await buildSupabaseClubeePassSyncPlan({ clubeeRows, sourceLabel, sourceMtimeMs });
  const selectedSet = new Set(
    (Array.isArray(memberIds) ? memberIds : [])
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0)
  );
  const selected = selectedSet.size
    ? plan.changes.filter((change) => selectedSet.has(Number(change.memberId)))
    : [];

  if (selected.length) {
    const rows = selected.map((change) => ({
      member_id: change.memberId,
      pass_status: change.proposed.passStatus,
      expires_on: change.proposed.passExpiry,
      federation_reference: change.proposed.licenseName || null,
      notes: change.proposed.note || null
    }));

    const upsertResponse = await fetch(`${SUPABASE_URL}/rest/v1/player_passes?on_conflict=member_id`, {
      method: "POST",
      headers: supabaseAdminHeaders({
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal"
      }),
      body: JSON.stringify(rows)
    });

    if (!upsertResponse.ok) {
      const payload = await upsertResponse.json().catch(() => ({}));
      const message = payload?.message || payload?.error || `Could not apply Clubee pass sync (${upsertResponse.status}).`;
      throw new Error(message);
    }
  }

  return {
    selectedCount: selected.length,
    skippedCount: Math.max(0, plan.changes.length - selected.length),
    appliedCount: selected.length,
    createdPasses: selected.filter((entry) => !entry.existingPass).length,
    updatedPasses: selected.filter((entry) => entry.existingPass).length,
    processedRows: plan.processedRows,
    matchedRows: plan.matchedRows,
    unmatchedRows: plan.unmatchedRows,
    unmatchedNames: plan.unmatchedNames
  };
}

function supabaseAdminHeaders(extra = {}) {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    ...extra
  };
}

function resolvePublicSiteUrl(req) {
  const configured = String(process.env.PUBLIC_SITE_URL || "").trim();
  if (configured) return configured.replace(/\/$/, "");
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const protocol = forwardedProto || req.protocol || "https";
  const host = req.get("host") || "localhost:4173";
  return `${protocol}://${host}`;
}

async function sendSupabaseInvite({ email, fullName, roles, memberId, req }) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server to send invites.");
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/invite`, {
    method: "POST",
    headers: supabaseAdminHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      email,
      data: {
        full_name: fullName,
        roles: Array.isArray(roles) ? roles : [],
        member_id: memberId ? String(memberId) : ""
      },
      redirectTo: `${resolvePublicSiteUrl(req)}/#recovery`
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorText = `${payload?.msg || payload?.error_description || payload?.error || ""}`.toLowerCase();
    if (response.status === 429 || errorText.includes("rate limit")) {
      throw new Error("Supabase email rate limit exceeded. Configure a custom SMTP provider in Supabase Auth, or wait and try again later.");
    }
    throw new Error(payload?.msg || payload?.error_description || payload?.error || `Invite failed (${response.status}).`);
  }
  return payload;
}

async function fetchSupabaseMemberForInvite(memberId) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server to send invites.");
  }

  const encodedId = encodeURIComponent(String(memberId || "").trim());
  const baseSelect = "id,email,display_name,first_name,last_name,roles_json,profile_id";
  const preferredSelect = `${baseSelect},invite_sent_at`;

  const requestMember = async (selectClause) => {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${encodedId}&select=${encodeURIComponent(selectClause)}`, {
      method: "GET",
      headers: supabaseAdminHeaders()
    });
    const payload = await response.json().catch(() => []);
    return { response, payload };
  };

  let result = await requestMember(preferredSelect);
  if (!result.response.ok) {
    const errorText = JSON.stringify(result.payload || {});
    if (/invite_sent_at/i.test(errorText)) {
      result = await requestMember(baseSelect);
    }
  }

  if (!result.response.ok) {
    const message = result.payload?.message || result.payload?.error || `Could not load member (${result.response.status}).`;
    throw new Error(message);
  }

  const rows = Array.isArray(result.payload) ? result.payload : [];
  return rows[0] || null;
}

async function markSupabaseMemberInviteSent(memberId) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return;

  const encodedId = encodeURIComponent(String(memberId || "").trim());
  const response = await fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${encodedId}`, {
    method: "PATCH",
    headers: supabaseAdminHeaders({
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    }),
    body: JSON.stringify({ invite_sent_at: new Date().toISOString() })
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const text = JSON.stringify(payload || {});
    if (/invite_sent_at/i.test(text)) {
      return;
    }
    const message = payload?.message || payload?.error || `Could not update invite status (${response.status}).`;
    throw new Error(message);
  }
}

function isValidFeePeriodToken(period) {
  return /^Q[1-4]_\d{4}$/.test(String(period || ""));
}

function feePeriodToSheetLabel(period) {
  return String(period || "").replace("_", " ");
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function sepaStatusCellValue(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (!normalized) return "";
  if (normalized === "paid") return "Paid";
  if (normalized === "exempt") return "Exempt";
  if (normalized === "exit") return "Exit";
  if (normalized === "not_applicable") return "Exempt";
  // Pending / partial / not_collected should be debited by the script, so keep them empty.
  return "";
}

async function prepareSepaGeneratorInput(periodToken) {
  if (!localDbApi) {
    throw new Error(`SEPA export requires local database mode. ${localDbUnavailableReason || "Local DB unavailable."}`);
  }
  const bootstrap = await localDbApi.getBootstrapData();
  const members = Array.isArray(bootstrap?.members) ? bootstrap.members : [];
  const fees = Array.isArray(bootstrap?.fees) ? bootstrap.fees : [];
  const periodFees = fees.filter((fee) => String(fee?.feePeriod || "") === periodToken);
  if (!periodFees.length) {
    throw new Error(`No fee rows found for ${periodToken}.`);
  }

  const feeByMemberId = new Map();
  periodFees.forEach((fee) => {
    feeByMemberId.set(String(fee.memberId), fee);
  });

  const periodLabel = feePeriodToSheetLabel(periodToken);
  const header = ["Vorname", "Nachname", "IBAN", "Mandats-ID", "Q2 2026"];
  const rows = [header];

  members.forEach((member) => {
    const fee = feeByMemberId.get(String(member.id));
    if (!fee) return;
    rows.push([
      String(member.firstName || "").trim(),
      String(member.lastName || "").trim(),
      String(fee.iban || "").trim(),
      String(member.id || "").trim(),
      sepaStatusCellValue(fee.status)
    ]);
  });

  const csvContent = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  await fs.writeFile(SEPA_GENERATOR_INPUT_CSV, csvContent, "utf-8");

  return {
    periodLabel,
    rowCount: rows.length - 1
  };
}

function runProcess(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const processHandle = spawn(command, args, {
      cwd,
      shell: false,
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
        PYTHONUTF8: "1"
      }
    });
    let stdout = "";
    let stderr = "";
    processHandle.stdout.on("data", (chunk) => {
      stdout += String(chunk || "");
    });
    processHandle.stderr.on("data", (chunk) => {
      stderr += String(chunk || "");
    });
    processHandle.on("error", (error) => {
      reject(error);
    });
    processHandle.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(stderr || stdout || `Command failed with exit code ${code}`));
      }
    });
  });
}

async function runSepaGenerator() {
  try {
    await runProcess("py", ["-3", SEPA_GENERATOR_SCRIPT], SEPA_GENERATOR_DIR);
  } catch {
    await runProcess("python", [SEPA_GENERATOR_SCRIPT], SEPA_GENERATOR_DIR);
  }
}

async function latestXmlFilePath(directoryPath) {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  const xmlFiles = entries.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".xml"));
  if (!xmlFiles.length) {
    throw new Error("No XML file was generated.");
  }
  const withStats = await Promise.all(xmlFiles.map(async (entry) => {
    const fullPath = path.join(directoryPath, entry.name);
    const stat = await fs.stat(fullPath);
    return { fullPath, mtimeMs: stat.mtimeMs, name: entry.name };
  }));
  withStats.sort((left, right) => right.mtimeMs - left.mtimeMs);
  return withStats[0];
}

await initializeOptionalLocalDatabase();

app.use(express.json({ limit: "20mb" }));
app.use((req, res, next) => {
  const requestOrigin = String(req.headers.origin || "").trim();
  if (CORS_ORIGIN) {
    if (CORS_ORIGIN === "*") {
      res.setHeader("Access-Control-Allow-Origin", "*");
    } else {
      const allowed = CORS_ORIGIN
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      if (requestOrigin && allowed.includes(requestOrigin)) {
        res.setHeader("Access-Control-Allow-Origin", requestOrigin);
      }
    }
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});
if (SERVE_STATIC_FRONTEND) {
  app.use(express.static(__dirname));
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/healthz", (_req, res) => {
  res.status(200).send("ok");
});

app.get("/api/bootstrap", async (_req, res) => {
  try {
    if (!requireLocalDb(res, "Bootstrap API")) return;
    const data = await localDbApi.getBootstrapData();
    res.json(data);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown bootstrap error"
    });
  }
});

app.post("/api/passes/sync-clubee", async (req, res) => {
  try {
    const body = req.body || {};
    const uploadedBuffer = decodeBase64FilePayload(body.fileBase64);
    const uploadedRows = uploadedBuffer ? readClubeeWorkbookFromBuffer(uploadedBuffer) : null;
    const sourceLabel = uploadedBuffer ? String(body.fileName || "uploaded-clubee.xlsx") : CLUBEE_XLSX_PATH;
    const sourceMtimeMs = uploadedBuffer ? Date.now() : undefined;

    let preview;
    if (localDbApi?.previewClubeePassSync) {
      if (uploadedBuffer) {
        const tempPath = path.join(__dirname, "data", `clubee-upload-${Date.now()}.xlsx`);
        await fs.writeFile(tempPath, uploadedBuffer);
        try {
          preview = await localDbApi.previewClubeePassSync({ clubeeXlsxPath: tempPath });
        } finally {
          await fs.rm(tempPath, { force: true });
        }
      } else {
        preview = await localDbApi.previewClubeePassSync({ clubeeXlsxPath: CLUBEE_XLSX_PATH });
      }
    } else if (hasSupabaseAdminConfig()) {
      preview = await previewSupabaseClubeePassSync({ clubeeRows: uploadedRows, sourceLabel, sourceMtimeMs });
    } else {
      res.status(503).json({ error: "Clubee sync API is unavailable. Configure local DB or Supabase service-role settings on the server." });
      return;
    }
    res.json({
      warning: "This endpoint is preview-only now. Use /api/passes/sync-clubee/apply to commit.",
      preview
    });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Could not build pass sync preview from Clubee export."
    });
  }
});

app.post("/api/passes/sync-clubee/preview", async (_req, res) => {
  try {
    const body = _req.body || {};
    const uploadedBuffer = decodeBase64FilePayload(body.fileBase64);
    const uploadedRows = uploadedBuffer ? readClubeeWorkbookFromBuffer(uploadedBuffer) : null;
    const sourceLabel = uploadedBuffer ? String(body.fileName || "uploaded-clubee.xlsx") : CLUBEE_XLSX_PATH;
    const sourceMtimeMs = uploadedBuffer ? Date.now() : undefined;

    let preview;
    if (localDbApi?.previewClubeePassSync) {
      if (uploadedBuffer) {
        const tempPath = path.join(__dirname, "data", `clubee-upload-${Date.now()}.xlsx`);
        await fs.writeFile(tempPath, uploadedBuffer);
        try {
          preview = await localDbApi.previewClubeePassSync({ clubeeXlsxPath: tempPath });
        } finally {
          await fs.rm(tempPath, { force: true });
        }
      } else {
        preview = await localDbApi.previewClubeePassSync({ clubeeXlsxPath: CLUBEE_XLSX_PATH });
      }
    } else if (hasSupabaseAdminConfig()) {
      preview = await previewSupabaseClubeePassSync({ clubeeRows: uploadedRows, sourceLabel, sourceMtimeMs });
    } else {
      res.status(503).json({ error: "Clubee sync preview is unavailable. Configure local DB or Supabase service-role settings on the server." });
      return;
    }
    res.json({ preview });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Could not build pass sync preview from Clubee export."
    });
  }
});

app.post("/api/passes/sync-clubee/apply", async (req, res) => {
  try {
    const body = req.body || {};
    const uploadedBuffer = decodeBase64FilePayload(body.fileBase64);
    const uploadedRows = uploadedBuffer ? readClubeeWorkbookFromBuffer(uploadedBuffer) : null;
    const sourceLabel = uploadedBuffer ? String(body.fileName || "uploaded-clubee.xlsx") : CLUBEE_XLSX_PATH;
    const sourceMtimeMs = uploadedBuffer ? Date.now() : undefined;
    const memberIds = Array.isArray(body.memberIds) ? body.memberIds : [];
    if (localDbApi?.applyClubeePassSync && localDbApi?.getBootstrapData) {
      let applySummary;
      if (uploadedBuffer) {
        const tempPath = path.join(__dirname, "data", `clubee-upload-${Date.now()}.xlsx`);
        await fs.writeFile(tempPath, uploadedBuffer);
        try {
          applySummary = await localDbApi.applyClubeePassSync({ clubeeXlsxPath: tempPath, memberIds });
        } finally {
          await fs.rm(tempPath, { force: true });
        }
      } else {
        applySummary = await localDbApi.applyClubeePassSync({ clubeeXlsxPath: CLUBEE_XLSX_PATH, memberIds });
      }
      const data = await localDbApi.getBootstrapData();
      data.passSyncApply = applySummary;
      res.json(data);
      return;
    }

    if (hasSupabaseAdminConfig()) {
      const applySummary = await applySupabaseClubeePassSync({ memberIds, clubeeRows: uploadedRows, sourceLabel, sourceMtimeMs });
      res.json({ passSyncApply: applySummary });
      return;
    }

    res.status(503).json({ error: "Clubee sync apply is unavailable. Configure local DB or Supabase service-role settings on the server." });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Could not apply pass sync from Clubee export."
    });
  }
});

app.post("/api/auth/invites", async (req, res) => {
  try {
    const body = req.body || {};
    const requestedMemberId = String(body.memberId || "").trim();
    let email = String(body.email || "").trim();
    let fullName = String(body.fullName || "").trim();
    let roles = Array.isArray(body.roles) ? body.roles.map((role) => String(role || "").trim()).filter(Boolean) : [];
    let memberId = requestedMemberId;

    if (requestedMemberId) {
      const member = await fetchSupabaseMemberForInvite(requestedMemberId);
      if (!member) {
        res.status(404).json({ error: "Member not found." });
        return;
      }

      if (member.invite_sent_at) {
        res.status(409).json({
          error: `You already invited this member on ${new Date(member.invite_sent_at).toLocaleString("de-AT")}.`
        });
        return;
      }

      if (member.profile_id) {
        res.status(409).json({ error: "This member already activated their account." });
        return;
      }

      email = email || String(member.email || "").trim();
      fullName = fullName || String(member.display_name || `${member.first_name || ""} ${member.last_name || ""}`.trim()).trim();
      if (!roles.length) {
        roles = Array.isArray(member.roles_json) ? member.roles_json.map((role) => String(role || "").trim()).filter(Boolean) : ["player"];
      }
      memberId = String(member.id);
    }

    if (!email) {
      res.status(400).json({ error: "Email is required." });
      return;
    }

    if (!fullName) {
      fullName = email.split("@")[0] || email;
    }

    const invite = await sendSupabaseInvite({ email, fullName, roles: roles.length ? roles : ["player"], memberId, req });
    if (memberId) {
      await markSupabaseMemberInviteSent(memberId);
    }
    res.json({ ok: true, email, fullName, roles: roles.length ? roles : ["player"], invite, memberId: memberId || null });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Could not send invitation."
    });
  }
});

app.post("/api/members", async (req, res) => {
  try {
    if (!requireLocalDb(res, "Member create API")) return;
    await localDbApi.createMember(req.body || {});
    res.status(201).json(await localDbApi.getBootstrapData());
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Unknown member create error"
    });
  }
});

app.put("/api/members/:memberId", async (req, res) => {
  try {
    if (!requireLocalDb(res, "Member update API")) return;
    await localDbApi.updateMember(Number(req.params.memberId), req.body || {});
    res.json(await localDbApi.getBootstrapData());
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Unknown member update error"
    });
  }
});

app.delete("/api/members/:memberId", async (req, res) => {
  try {
    if (!requireLocalDb(res, "Member delete API")) return;
    await localDbApi.deleteMember(Number(req.params.memberId));
    res.json(await localDbApi.getBootstrapData());
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Unknown member delete error"
    });
  }
});

app.post("/api/members/:memberId/undelete", async (req, res) => {
  try {
    if (!requireLocalDb(res, "Member undelete API")) return;
    await localDbApi.undeleteMember(Number(req.params.memberId));
    res.json(await localDbApi.getBootstrapData());
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Unknown member undelete error"
    });
  }
});

app.post("/api/members/merge", async (req, res) => {
  try {
    if (!requireLocalDb(res, "Member merge API")) return;
    await localDbApi.mergeMembers(req.body || {});
    res.json(await localDbApi.getBootstrapData());
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Unknown member merge error"
    });
  }
});

app.post("/api/fees/bulk-status", async (req, res) => {
  try {
    if (!requireLocalDb(res, "Fees bulk status API")) return;
    await localDbApi.bulkUpdateFeeStatus(req.body || {});
    res.json(await localDbApi.getBootstrapData());
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Unknown fee update error"
    });
  }
});

app.put("/api/fees/:feeId", async (req, res) => {
  try {
    if (!requireLocalDb(res, "Fee update API")) return;
    await localDbApi.updateFeeRecord(Number(req.params.feeId), req.body || {});
    res.json(await localDbApi.getBootstrapData());
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Unknown fee row update error"
    });
  }
});

app.get("/api/fees/export-sepa-xml", async (req, res) => {
  try {
    const requestedPeriod = String(req.query.period || "").trim();
    const periodToken = isValidFeePeriodToken(requestedPeriod) ? requestedPeriod : "";
    if (!periodToken) {
      res.status(400).json({ error: "A valid quarter is required (example: Q2_2026)." });
      return;
    }

    await prepareSepaGeneratorInput(periodToken);
    await runSepaGenerator();
    const latest = await latestXmlFilePath(SEPA_GENERATOR_DIR);
    const downloadName = `SEPA_Lastschrift_${periodToken}.xml`;
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
    res.sendFile(latest.fullPath);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Could not generate SEPA XML."
    });
  }
});

app.listen(port, () => {
  console.log(`Emperors local server running at http://localhost:${port}`);
});

process.on("SIGINT", async () => {
  if (localDbApi?.closeDatabase) {
    await localDbApi.closeDatabase();
  }
  process.exit(0);
});
