const ENDPOINT = process.env.APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID || "69dd0fdd00336ea1b4b5";
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || "69dd11140002e2b4254a";
const API_KEY = process.env.APPWRITE_API_KEY || "";

const COLLECTIONS = [
  "members",
  "member_roles",
  "player_passes",
  "membership_fees",
  "events",
  "event_recipients",
  "invites"
];

if (!API_KEY) {
  throw new Error("APPWRITE_API_KEY is required for CRUD smoke test.");
}

function url(path) {
  return `${ENDPOINT.replace(/\/$/, "")}${path}`;
}

async function request(path, { method = "GET", body } = {}) {
  const response = await fetch(url(path), {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Appwrite-Project": PROJECT_ID,
      "X-Appwrite-Key": API_KEY
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const raw = await response.text();
  const payload = raw ? JSON.parse(raw) : {};

  if (!response.ok) {
    throw new Error(payload?.message || payload?.type || `HTTP ${response.status}`);
  }

  return payload;
}

function randomId(prefix) {
  const compactPrefix = String(prefix).slice(0, 10).replace(/[^a-zA-Z0-9._-]/g, "");
  const stamp = Date.now().toString(36).slice(-6);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${compactPrefix}-${stamp}-${rand}`.slice(0, 36);
}

function sampleValueForAttribute(attribute) {
  const key = String(attribute?.key || "").toLowerCase();
  const type = String(attribute?.type || "").toLowerCase();
  const format = String(attribute?.format || "").toLowerCase();
  const isArray = Boolean(attribute?.array);

  if (isArray) {
    return [];
  }

  if (Array.isArray(attribute?.elements) && attribute.elements.length > 0) {
    return attribute.elements[0];
  }

  if (type === "boolean") {
    return false;
  }

  if (type === "integer") {
    return 1;
  }

  if (type === "double" || type === "float") {
    return 1.5;
  }

  if (type === "datetime") {
    return new Date().toISOString();
  }

  if (type === "string") {
    if (format === "email" || key.includes("email")) {
      return "smoke@example.com";
    }
    if (format === "url") {
      return "https://example.com";
    }
    if (format === "ip") {
      return "127.0.0.1";
    }
    if (key.includes("status")) {
      return "active";
    }
    if (key.includes("date")) {
      return new Date().toISOString();
    }
    return `smoke-${key || "value"}`.slice(0, attribute?.size || 64);
  }

  return null;
}

async function testCollection(collectionId) {
  const attributesResponse = await request(`/databases/${DATABASE_ID}/collections/${collectionId}/attributes`);
  const attributes = Array.isArray(attributesResponse?.attributes) ? attributesResponse.attributes : [];

  const required = attributes.filter((attr) => attr?.required);
  const data = {};
  const unsupportedRequired = [];

  for (const attr of required) {
    const value = sampleValueForAttribute(attr);
    if (value === null || value === undefined) {
      unsupportedRequired.push(`${attr.key}:${attr.type}`);
      continue;
    }
    data[attr.key] = value;
  }

  if (unsupportedRequired.length > 0) {
    return {
      collectionId,
      ok: false,
      reason: `Unsupported required attributes ${unsupportedRequired.join(", ")}`
    };
  }

  const before = await request(`/databases/${DATABASE_ID}/collections/${collectionId}/documents?limit=1`);
  const created = await request(`/databases/${DATABASE_ID}/collections/${collectionId}/documents`, {
    method: "POST",
    body: {
      documentId: randomId(`smoke-${collectionId}`),
      data
    }
  });
  const read = await request(`/databases/${DATABASE_ID}/collections/${collectionId}/documents/${created.$id}`);
  await request(`/databases/${DATABASE_ID}/collections/${collectionId}/documents/${created.$id}`, {
    method: "DELETE"
  });
  const after = await request(`/databases/${DATABASE_ID}/collections/${collectionId}/documents?limit=1`);

  return {
    collectionId,
    ok: true,
    before: before.total,
    after: after.total,
    createdId: created.$id,
    roundTrip: Boolean(read?.$id)
  };
}

async function main() {
  console.log("Collection CRUD smoke test starting...");
  const results = [];

  for (const collectionId of COLLECTIONS) {
    try {
      const result = await testCollection(collectionId);
      results.push(result);
      if (result.ok) {
        console.log(`[OK] ${collectionId}: created ${result.createdId}, round-trip=${result.roundTrip}, count ${result.before}->${result.after}`);
      } else {
        console.log(`[SKIP] ${collectionId}: ${result.reason}`);
      }
    } catch (error) {
      results.push({ collectionId, ok: false, reason: error.message || String(error) });
      console.log(`[FAIL] ${collectionId}: ${error.message || error}`);
    }
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.log("\nSome collections failed smoke test:");
    for (const item of failed) {
      console.log(`- ${item.collectionId}: ${item.reason}`);
    }
    process.exit(1);
  }

  console.log("All collection CRUD smoke tests passed.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
