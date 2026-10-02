// Small REST helper for the one-off admin scripts (API key from .env or environment).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const fileEnv = {};
const envFile = path.join(repoRoot, ".env");
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
export const env = (key, fallback = "") => process.env[key] || fileEnv[key] || fallback;

export const ENDPOINT = env("APPWRITE_ENDPOINT", "https://fra.cloud.appwrite.io/v1").replace(/\/$/, "");
export const PROJECT_ID = env("APPWRITE_PROJECT_ID", "69dd0fdd00336ea1b4b5");
export const DATABASE_ID = env("APPWRITE_DATABASE_ID", "69dd11140002e2b4254a");
const API_KEY = env("APPWRITE_API_KEY");

export function requireApiKey() {
  if (!API_KEY) {
    console.error("APPWRITE_API_KEY is missing (.env or environment).");
    process.exit(1);
  }
}

export const args = process.argv.slice(2);
export const hasFlag = (name) => args.includes(`--${name}`);
export function option(name, fallback = "") {
  const prefix = `--${name}=`;
  const hit = args.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class AppwriteError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

// body: plain object (JSON) or FormData. raw: return the Response (binary downloads).
export async function request(apiPath, { method = "GET", body, raw = false, headers = {} } = {}) {
  for (let attempt = 1; ; attempt += 1) {
    const isForm = typeof FormData !== "undefined" && body instanceof FormData;
    const response = await fetch(`${ENDPOINT}${apiPath}`, {
      method,
      headers: {
        "X-Appwrite-Project": PROJECT_ID,
        "X-Appwrite-Key": API_KEY,
        ...(body && !isForm ? { "Content-Type": "application/json" } : {}),
        ...headers
      },
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined
    });
    if (response.status === 429 && attempt < 6) {
      await sleep(1000 * attempt);
      continue;
    }
    if (raw && response.ok) return response;
    const text = await response.text();
    let payload = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { message: text };
    }
    if (!response.ok) {
      throw new AppwriteError(`${method} ${apiPath} failed (${response.status}): ${payload?.message || payload?.type || text}`, response.status, payload);
    }
    return payload;
  }
}

export async function tryRequest(apiPath, options) {
  try {
    return await request(apiPath, options);
  } catch (error) {
    if (error instanceof AppwriteError && error.status === 404) return null;
    throw error;
  }
}

export function q(query) {
  return `queries[]=${encodeURIComponent(JSON.stringify(query))}`;
}

// Lists every item of a paginated Appwrite list endpoint (cursor based).
export async function listAll(apiPath, key, pageSize = 100) {
  const items = [];
  let cursor = null;
  for (;;) {
    const parts = [q({ method: "limit", values: [pageSize] })];
    if (cursor) parts.push(q({ method: "cursorAfter", values: [cursor] }));
    const separator = apiPath.includes("?") ? "&" : "?";
    const page = await request(`${apiPath}${separator}${parts.join("&")}`);
    const rows = page[key] || [];
    items.push(...rows);
    if (rows.length < pageSize) break;
    cursor = rows[rows.length - 1].$id;
  }
  return items;
}

export function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}

export function writeReport(name, data) {
  const dir = env("MIGRATION_REPORT_DIR") || path.join(repoRoot, "migration-reports");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  return file;
}
