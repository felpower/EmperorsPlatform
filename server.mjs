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
const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || "69dd0fdd00336ea1b4b5";
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY || "";
const APPWRITE_DATABASE_ID = process.env.APPWRITE_DATABASE_ID || "69dd11140002e2b4254a";
const APPWRITE_MEMBERS_COLLECTION_ID = process.env.APPWRITE_MEMBERS_COLLECTION_ID || "members";
const APPWRITE_MEMBERSHIP_FEES_COLLECTION_ID = process.env.APPWRITE_MEMBERSHIP_FEES_COLLECTION_ID || "membership_fees";
const CORS_ORIGIN = String(process.env.CORS_ORIGIN || "").trim();
const ENABLE_LOCAL_DB = String(process.env.ENABLE_LOCAL_DB || "true").toLowerCase() !== "false";
const SERVE_STATIC_FRONTEND = String(process.env.SERVE_STATIC_FRONTEND || "true").toLowerCase() !== "false";
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

function resolvePublicSiteUrl(req) {
  const configured = String(process.env.PUBLIC_SITE_URL || "").trim();
  if (configured) return configured.replace(/\/$/, "");
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const protocol = forwardedProto || req.protocol || "https";
  const host = req.get("host") || "localhost:4173";
  return `${protocol}://${host}`;
}

function hasAppwriteAdminConfig() {
  return Boolean(
    String(APPWRITE_ENDPOINT || "").trim() &&
    String(APPWRITE_PROJECT_ID || "").trim() &&
    String(APPWRITE_API_KEY || "").trim() &&
    String(APPWRITE_DATABASE_ID || "").trim()
  );
}

function appwriteAdminHeaders(extra = {}) {
  return {
    "X-Appwrite-Project": APPWRITE_PROJECT_ID,
    "X-Appwrite-Key": APPWRITE_API_KEY,
    "Content-Type": "application/json",
    ...extra
  };
}

function appwriteApi(pathname) {
  const base = String(APPWRITE_ENDPOINT || "").trim().replace(/\/$/, "");
  return `${base}${pathname}`;
}

async function appwriteAdminRequest(pathname, { method = "GET", body, tolerateStatus = [] } = {}) {
  const response = await fetch(appwriteApi(pathname), {
    method,
    headers: appwriteAdminHeaders(),
    body: body ? JSON.stringify(body) : undefined
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok && !tolerateStatus.includes(response.status)) {
    const message = payload?.message || payload?.type || `Request failed (${response.status}).`;
    throw new Error(message);
  }
  return { response, payload };
}

function randomAppwriteId(prefix = "user") {
  const stamp = Date.now().toString(36).slice(-6);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${stamp}-${rand}`.slice(0, 36);
}

function inviteTempPassword() {
  return `InviteTemp!${Math.random().toString(36).slice(2, 8)}A1`;
}

function randomDocumentId(prefix = "doc") {
  const compactPrefix = String(prefix || "doc").replace(/[^A-Za-z0-9._-]/g, "").slice(0, 8) || "doc";
  const stamp = Date.now().toString(36).slice(-6);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${compactPrefix}-${stamp}-${rand}`.slice(0, 36);
}

function normalizeFeeStatusServer(value) {
  const normalized = String(value || "pending").trim().toLowerCase();
  const aliases = {
    paid: "paid",
    paid_rookie_fee: "paid_rookie_fee",
    "paid rookie fee": "paid_rookie_fee",
    "paid rookie": "paid_rookie_fee",
    paid_with_fee: "paid_with_fee",
    "paid with fee": "paid_with_fee",
    "paid with fees": "paid_with_fee",
    partial: "partial",
    pending: "pending",
    "not paid": "pending",
    not_collected: "not_collected",
    "not collected": "not_collected",
    exempt: "exempt",
    exit: "exit",
    not_applicable: "not_applicable",
    "not applicable": "not_applicable"
  };
  return aliases[normalized] || "pending";
}

function parseArrayStrings(value, { uppercase = false, fallback = [] } = {}) {
  const source = Array.isArray(value) ? value : [];
  const parsed = source
    .map((entry) => String(entry || "").trim())
    .filter(Boolean)
    .map((entry) => (uppercase ? entry.toUpperCase() : entry));
  return parsed.length ? Array.from(new Set(parsed)) : fallback;
}

async function appwriteListCollectionDocuments(collectionId) {
  const query = encodeURIComponent("limit(5000)");
  const { payload } = await appwriteAdminRequest(
    `/databases/${APPWRITE_DATABASE_ID}/collections/${collectionId}/documents?queries[]=${query}`
  );
  return Array.isArray(payload?.documents) ? payload.documents : [];
}

function toIsoOrNull(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

async function createMemberViaAppwriteAdmin(input) {
  const firstName = String(input?.firstName || "").trim();
  const lastName = String(input?.lastName || "").trim();
  const displayName = `${firstName} ${lastName}`.trim() || "Unknown member";
  const jerseyRaw = String(input?.jerseyNumber ?? "").trim();
  const jerseyNumber = jerseyRaw === "" ? null : Number(jerseyRaw);
  const positions = parseArrayStrings(input?.positions, { uppercase: true, fallback: [] });
  const roles = parseArrayStrings(input?.roles, { fallback: ["player"] });
  const passStatusRaw = String(input?.passStatus || "").trim().toLowerCase();
  const passStatus = !passStatusRaw || passStatusRaw === "pending" || passStatusRaw === "unknown" ? "missing" : passStatusRaw;
  const passExpiry = passStatus === "missing" ? null : toIsoOrNull(input?.passExpiry) || null;

  const documentId = randomDocumentId("member");
  await appwriteAdminRequest(`/databases/${APPWRITE_DATABASE_ID}/collections/${APPWRITE_MEMBERS_COLLECTION_ID}/documents`, {
    method: "POST",
    body: {
      documentId,
      data: {
        displayName,
        jerseyNumber: Number.isFinite(jerseyNumber) ? jerseyNumber : null,
        email: String(input?.email || "").trim() || null,
        first_name: firstName || null,
        last_name: lastName || null,
        positions_json: JSON.stringify(positions),
        roles_json: JSON.stringify(roles),
        membership_status: String(input?.membershipStatus || "pending").trim() || "pending",
        notes: String(input?.notes || "").trim() || null,
        deleted_at: null
      }
    }
  });

  await appwriteAdminRequest(`/databases/${APPWRITE_DATABASE_ID}/collections/player_passes/documents`, {
    method: "POST",
    body: {
      documentId: randomDocumentId("pass"),
      data: {
        member_id: documentId,
        pass_status: ["valid", "expired", "missing"].includes(passStatus) ? passStatus : "missing",
        expires_on: passExpiry
      }
    }
  });

  return { memberId: documentId };
}

async function updateMemberViaAppwriteAdmin(memberId, input) {
  const firstName = String(input?.firstName || "").trim();
  const lastName = String(input?.lastName || "").trim();
  const displayName = `${firstName} ${lastName}`.trim() || "Unknown member";
  const jerseyRaw = String(input?.jerseyNumber ?? "").trim();
  const jerseyNumber = jerseyRaw === "" ? null : Number(jerseyRaw);
  const positions = parseArrayStrings(input?.positions, { uppercase: true, fallback: [] });
  const roles = parseArrayStrings(input?.roles, { fallback: ["player"] });
  const passStatusRaw = String(input?.passStatus || "").trim().toLowerCase();
  const passStatus = !passStatusRaw || passStatusRaw === "pending" || passStatusRaw === "unknown" ? "missing" : passStatusRaw;
  const passExpiry = passStatus === "missing" ? null : toIsoOrNull(input?.passExpiry) || null;

  await appwriteAdminRequest(
    `/databases/${APPWRITE_DATABASE_ID}/collections/${APPWRITE_MEMBERS_COLLECTION_ID}/documents/${encodeURIComponent(String(memberId || "").trim())}`,
    {
      method: "PATCH",
      body: {
        data: {
          displayName,
          jerseyNumber: Number.isFinite(jerseyNumber) ? jerseyNumber : null,
          email: String(input?.email || "").trim() || null,
          first_name: firstName || null,
          last_name: lastName || null,
          positions_json: JSON.stringify(positions),
          roles_json: JSON.stringify(roles),
          membership_status: String(input?.membershipStatus || "pending").trim() || "pending",
          notes: String(input?.notes || "").trim() || null,
          deleted_at: null
        }
      }
    }
  );

  const passRows = await appwriteListCollectionDocuments("player_passes");
  const existing = passRows.find((row) => String(row?.member_id || "") === String(memberId || ""));
  if (existing?.$id) {
    await appwriteAdminRequest(
      `/databases/${APPWRITE_DATABASE_ID}/collections/player_passes/documents/${encodeURIComponent(String(existing.$id))}`,
      {
        method: "PATCH",
        body: {
          data: {
            pass_status: ["valid", "expired", "missing"].includes(passStatus) ? passStatus : "missing",
            expires_on: passExpiry
          }
        }
      }
    );
  } else {
    await appwriteAdminRequest(`/databases/${APPWRITE_DATABASE_ID}/collections/player_passes/documents`, {
      method: "POST",
      body: {
        documentId: randomDocumentId("pass"),
        data: {
          member_id: String(memberId || "").trim(),
          pass_status: ["valid", "expired", "missing"].includes(passStatus) ? passStatus : "missing",
          expires_on: passExpiry
        }
      }
    });
  }
}

async function updateFeeRecordViaAppwriteAdmin(feeId, input) {
  const normalizedStatus = normalizeFeeStatusServer(input?.status);
  const amountCents = Math.max(0, Math.round(Number(input?.amount || 0) * 100));
  let paidCents = Math.max(0, Math.round(Number(input?.paidAmount || 0) * 100));

  if (["paid", "paid_rookie_fee"].includes(normalizedStatus)) paidCents = amountCents;
  else if (["pending", "not_collected", "exempt", "exit", "not_applicable"].includes(normalizedStatus)) paidCents = 0;

  await appwriteAdminRequest(
    `/databases/${APPWRITE_DATABASE_ID}/collections/${APPWRITE_MEMBERSHIP_FEES_COLLECTION_ID}/documents/${encodeURIComponent(String(feeId || "").trim())}`,
    {
      method: "PATCH",
      body: {
        data: {
          status: normalizedStatus,
          amount_cents: amountCents,
          paid_cents: paidCents,
          status_note: String(input?.note || "").trim() || null,
          iban: String(input?.iban || "").trim() || null
        }
      }
    }
  );
}

async function bulkUpdateFeeStatusViaAppwriteAdmin(input) {
  const feePeriod = String(input?.feePeriod || "").trim();
  const normalizedStatus = normalizeFeeStatusServer(input?.status);
  const memberIds = new Set((Array.isArray(input?.memberIds) ? input.memberIds : []).map((id) => String(id || "").trim()).filter(Boolean));
  if (!feePeriod) throw new Error("feePeriod is required.");
  if (!memberIds.size) throw new Error("Select at least one member.");

  const rows = await appwriteListCollectionDocuments(APPWRITE_MEMBERSHIP_FEES_COLLECTION_ID);
  const targets = rows.filter((row) => String(row?.fee_period || "") === feePeriod && memberIds.has(String(row?.member_id || "")));

  for (const row of targets) {
    const amountCents = Math.max(0, Number(row?.amount_cents || 0));
    let paidCents = Math.max(0, Number(row?.paid_cents || 0));
    if (["paid", "paid_rookie_fee", "paid_with_fee"].includes(normalizedStatus)) paidCents = amountCents;
    else if (normalizedStatus === "partial") paidCents = paidCents > 0 && paidCents < amountCents ? paidCents : Math.round(amountCents / 2);
    else paidCents = 0;

    await appwriteAdminRequest(
      `/databases/${APPWRITE_DATABASE_ID}/collections/${APPWRITE_MEMBERSHIP_FEES_COLLECTION_ID}/documents/${encodeURIComponent(String(row.$id || row.id || "").trim())}`,
      {
        method: "PATCH",
        body: {
          data: {
            status: normalizedStatus,
            paid_cents: paidCents
          }
        }
      }
    );
  }
}

function parseRolesJson(value, fallback = ["player"]) {
  if (Array.isArray(value)) return value.map((role) => String(role || "").trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((role) => String(role || "").trim()).filter(Boolean);
      }
    } catch {
      return fallback;
    }
  }
  return fallback;
}

async function listAppwriteUsers() {
  const { payload } = await appwriteAdminRequest(`/users?limit=5000`);
  return Array.isArray(payload?.users) ? payload.users : [];
}

async function findAppwriteUserByEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return null;
  const users = await listAppwriteUsers();
  return users.find((item) => String(item?.email || "").trim().toLowerCase() === normalized) || null;
}

async function ensureAppwriteUserForInvite({ email, fullName }) {
  const existing = await findAppwriteUserByEmail(email);
  if (existing) {
    return { user: existing, created: false };
  }

  const createResult = await appwriteAdminRequest("/users", {
    method: "POST",
    body: {
      userId: randomAppwriteId("user"),
      email: String(email || "").trim(),
      password: inviteTempPassword(),
      name: String(fullName || "").trim() || String(email || "").split("@")[0] || "ClubHub User"
    },
    tolerateStatus: [409]
  });

  if (createResult.response.status === 201) {
    return { user: createResult.payload, created: true };
  }

  const user = await findAppwriteUserByEmail(email);
  if (!user) {
    throw new Error("User exists but could not be loaded from Appwrite.");
  }
  return { user, created: false };
}

async function fetchAppwriteMemberForInvite(memberId) {
  if (!hasAppwriteAdminConfig()) {
    throw new Error("Set APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY, and APPWRITE_DATABASE_ID on the server to send invites.");
  }

  const { payload, response } = await appwriteAdminRequest(
    `/databases/${APPWRITE_DATABASE_ID}/collections/${APPWRITE_MEMBERS_COLLECTION_ID}/documents/${encodeURIComponent(String(memberId || "").trim())}`,
    { tolerateStatus: [404] }
  );

  if (response.status === 404) {
    return null;
  }
  return payload || null;
}

async function markAppwriteMemberInviteSent(memberId, profileId) {
  if (!hasAppwriteAdminConfig()) return;

  await appwriteAdminRequest(
    `/databases/${APPWRITE_DATABASE_ID}/collections/${APPWRITE_MEMBERS_COLLECTION_ID}/documents/${encodeURIComponent(String(memberId || "").trim())}`,
    {
      method: "PATCH",
      body: {
        data: {
          invite_sent_at: new Date().toISOString(),
          ...(profileId ? { profile_id: String(profileId) } : {})
        }
      }
    }
  );
}

async function sendAppwriteInvite({ email, fullName, req }) {
  if (!hasAppwriteAdminConfig()) {
    throw new Error("Set APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY, and APPWRITE_DATABASE_ID on the server to send invites.");
  }

  const ensured = await ensureAppwriteUserForInvite({ email, fullName });
  const redirectTo = `${resolvePublicSiteUrl(req)}/#recovery`;
  const userId = String(ensured.user?.$id || ensured.user?.id || "").trim();
  if (!userId) {
    throw new Error("Could not resolve Appwrite user ID for invite recovery email.");
  }

  await appwriteAdminRequest(`/users/${encodeURIComponent(userId)}/recovery`, {
    method: "POST",
    body: {
      url: redirectTo
    }
  });

  return {
    provider: "appwrite",
    userId,
    createdUser: Boolean(ensured.created),
    redirectTo
  };
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
  if (["paid", "paid_rookie_fee", "paid_with_fee"].includes(normalized)) return "Paid";
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
    } else {
      res.status(503).json({ error: "Clubee sync API is unavailable. Configure local DB support on the server." });
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
    } else {
      res.status(503).json({ error: "Clubee sync preview is unavailable. Configure local DB support on the server." });
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

    res.status(503).json({ error: "Clubee sync apply is unavailable. Configure local DB support on the server." });
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
      const member = await fetchAppwriteMemberForInvite(requestedMemberId);
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
        roles = parseRolesJson(member.roles_json, ["player"]);
      }
      memberId = String(member.$id || member.id || requestedMemberId);
    }

    if (!email) {
      res.status(400).json({ error: "Email is required." });
      return;
    }

    if (!fullName) {
      fullName = email.split("@")[0] || email;
    }

    const invite = await sendAppwriteInvite({ email, fullName, roles: roles.length ? roles : ["player"], memberId, req });
    if (memberId) {
      await markAppwriteMemberInviteSent(memberId, invite?.userId || null);
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
    if (isLocalDbEnabled()) {
      if (!requireLocalDb(res, "Member create API")) return;
      await localDbApi.createMember(req.body || {});
      res.status(201).json(await localDbApi.getBootstrapData());
      return;
    }
    if (hasAppwriteAdminConfig()) {
      console.log("[POST /api/members] Using Appwrite admin API");
      const created = await createMemberViaAppwriteAdmin(req.body || {});
      console.log("[POST /api/members] Member created successfully via Appwrite admin", { memberId: created?.id });
      res.status(201).json({ ok: true, ...created });
      return;
    }
    const diagMsg = `APPWRITE_API_KEY: ${String(APPWRITE_API_KEY || "").trim() ? "set" : "NOT SET"}, LOCAL_DB: ${isLocalDbEnabled() ? "enabled" : "disabled"}`;
    console.error("[POST /api/members] Backend unavailable:", diagMsg);
    res.status(503).json({ error: "Server not configured. Appwrite admin key missing or local DB disabled." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown member create error";
    console.error("[POST /api/members] Error:", message, error);
    res.status(400).json({ error: message });
  }
});

app.put("/api/members/:memberId", async (req, res) => {
  try {
    if (isLocalDbEnabled()) {
      if (!requireLocalDb(res, "Member update API")) return;
      await localDbApi.updateMember(Number(req.params.memberId), req.body || {});
      res.json(await localDbApi.getBootstrapData());
      return;
    }
    if (hasAppwriteAdminConfig()) {
      await updateMemberViaAppwriteAdmin(req.params.memberId, req.body || {});
      res.json({ ok: true, memberId: String(req.params.memberId || "").trim() });
      return;
    }
    res.status(503).json({ error: "Member update API is unavailable. Configure local DB or Appwrite admin settings on the server." });
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
    if (isLocalDbEnabled()) {
      if (!requireLocalDb(res, "Fees bulk status API")) return;
      await localDbApi.bulkUpdateFeeStatus(req.body || {});
      res.json(await localDbApi.getBootstrapData());
      return;
    }
    if (hasAppwriteAdminConfig()) {
      await bulkUpdateFeeStatusViaAppwriteAdmin(req.body || {});
      res.json({ ok: true });
      return;
    }
    res.status(503).json({ error: "Fees bulk status API is unavailable. Configure local DB or Appwrite admin settings on the server." });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Unknown fee update error"
    });
  }
});

app.put("/api/fees/:feeId", async (req, res) => {
  try {
    if (isLocalDbEnabled()) {
      if (!requireLocalDb(res, "Fee update API")) return;
      await localDbApi.updateFeeRecord(Number(req.params.feeId), req.body || {});
      res.json(await localDbApi.getBootstrapData());
      return;
    }
    if (hasAppwriteAdminConfig()) {
      await updateFeeRecordViaAppwriteAdmin(req.params.feeId, req.body || {});
      res.json({ ok: true, feeId: String(req.params.feeId || "").trim() });
      return;
    }
    res.status(503).json({ error: "Fee update API is unavailable. Configure local DB or Appwrite admin settings on the server." });
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

app.get("/api/status", (req, res) => {
  const appwriteConfigured = hasAppwriteAdminConfig();
  const localDbStatus = isLocalDbEnabled();
  res.json({
    status: "ok",
    localDb: {
      enabled: localDbStatus,
      available: localDbApi ? true : false,
      reason: localDbAvailableReason || ""
    },
    appwrite: {
      endpoint: APPWRITE_ENDPOINT,
      projectId: APPWRITE_PROJECT_ID,
      databaseId: APPWRITE_DATABASE_ID,
      apiKeySet: Boolean(String(APPWRITE_API_KEY || "").trim()),
      configured: appwriteConfigured
    },
    activeBackend: localDbStatus ? "local-db" : appwriteConfigured ? "appwrite-admin" : "none",
    message: !localDbStatus && !appwriteConfigured 
      ? "⚠️ No backend configured! Set APPWRITE_API_KEY environment variable on server for Appwrite admin API access."
      : "✓ Backend is configured"
  });
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
