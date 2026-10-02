// Shared helpers for the EmperorsPlatform Appwrite functions.
// SOURCE OF TRUTH: appwrite/functions/shared/ - copied into each function by
// `npm run functions:sync-shared` (each function deploys only its own folder).

function parseBody(req) {
  try {
    if (!req || req.body === undefined || req.body === null) return {};
    if (typeof req.body === "string") return req.body.trim() ? JSON.parse(req.body) : {};
    if (typeof req.body === "object") return req.body;
    return {};
  } catch {
    return {};
  }
}

function header(req, name) {
  const headers = (req && req.headers) || {};
  const wanted = String(name).toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === wanted) return String(headers[key] || "").trim();
  }
  return "";
}

// The task modules read APPWRITE_ENDPOINT / APPWRITE_PROJECT_ID / APPWRITE_API_KEY.
// Fall back to the variables Appwrite injects automatically and to the dynamic
// API key (x-appwrite-key header, scopes configured on the function).
function applyEnvDefaults(req) {
  if (!process.env.APPWRITE_ENDPOINT && process.env.APPWRITE_FUNCTION_API_ENDPOINT) {
    process.env.APPWRITE_ENDPOINT = process.env.APPWRITE_FUNCTION_API_ENDPOINT;
  }
  if (!process.env.APPWRITE_PROJECT_ID && process.env.APPWRITE_FUNCTION_PROJECT_ID) {
    process.env.APPWRITE_PROJECT_ID = process.env.APPWRITE_FUNCTION_PROJECT_ID;
  }
  if (!process.env.APPWRITE_API_KEY) {
    const dynamicKey = header(req, "x-appwrite-key");
    if (dynamicKey) process.env.APPWRITE_API_KEY = dynamicKey;
  }
}

function appwriteConfig() {
  return {
    endpoint: String(process.env.APPWRITE_ENDPOINT || "").trim().replace(/\/$/, ""),
    projectId: String(process.env.APPWRITE_PROJECT_ID || "").trim(),
    apiKey: String(process.env.APPWRITE_API_KEY || "").trim(),
    databaseId: String(process.env.APPWRITE_DATABASE_ID || "").trim(),
    membersCollectionId: String(process.env.APPWRITE_MEMBERS_COLLECTION_ID || "members").trim(),
    memberRolesCollectionId: String(process.env.APPWRITE_MEMBER_ROLES_COLLECTION_ID || "member_roles").trim()
  };
}

async function appwriteRequest(pathname, { method = "GET", body } = {}) {
  const config = appwriteConfig();
  if (!config.endpoint || !config.projectId || !config.apiKey) {
    throw new Error("Missing APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID or APPWRITE_API_KEY.");
  }
  const response = await fetch(`${config.endpoint}${pathname}`, {
    method,
    headers: {
      "X-Appwrite-Project": config.projectId,
      "X-Appwrite-Key": config.apiKey,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

function queryParam(query) {
  return `queries%5B%5D=${encodeURIComponent(JSON.stringify(query))}`;
}

module.exports = { parseBody, header, applyEnvDefaults, appwriteConfig, appwriteRequest, queryParam };
