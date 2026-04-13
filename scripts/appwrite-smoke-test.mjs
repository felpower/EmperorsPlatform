const ENDPOINT = process.env.APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID || "69dd0fdd00336ea1b4b5";
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || "69dd11140002e2b4254a";
const MEMBERS_COLLECTION_ID = process.env.APPWRITE_MEMBERS_COLLECTION_ID || "members";
const API_KEY = process.env.APPWRITE_API_KEY || "";

if (!API_KEY) {
  throw new Error("APPWRITE_API_KEY is required for smoke test.");
}

function url(path) {
  return `${ENDPOINT.replace(/\/$/, "")}${path}`;
}

async function request(path, { method = "GET", body, headers = {} } = {}) {
  const response = await fetch(url(path), {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const raw = await response.text();
  const payload = raw ? JSON.parse(raw) : {};

  if (!response.ok) {
    const message = payload?.message || payload?.type || `HTTP ${response.status}`;
    throw new Error(`${method} ${path} failed: ${message}`);
  }

  return payload;
}

async function adminRequest(path, options = {}) {
  return request(path, {
    ...options,
    headers: {
      "X-Appwrite-Project": PROJECT_ID,
      "X-Appwrite-Key": API_KEY,
      ...(options.headers || {})
    }
  });
}

function randomId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function main() {
  console.log("Smoke test against Appwrite project", PROJECT_ID);

  const before = await adminRequest(`/databases/${DATABASE_ID}/collections/${MEMBERS_COLLECTION_ID}/documents?limit=1`);
  console.log(`Members before test: ${before.total}`);

  const testEmail = `smoke.${Date.now()}@example.com`;
  const testPassword = `SmokeTest!${Math.random().toString(36).slice(2, 8)}A1`;
  const testUserId = randomId("smoke-user");

  const createdUser = await adminRequest("/users", {
    method: "POST",
    body: {
      userId: testUserId,
      email: testEmail,
      password: testPassword,
      name: "Smoke Test User"
    }
  });
  console.log("Created test user:", createdUser.$id);

  const createdSession = await request("/account/sessions/email", {
    method: "POST",
    headers: {
      "X-Appwrite-Project": PROJECT_ID
    },
    body: {
      email: testEmail,
      password: testPassword
    }
  });
  console.log("Created email/password session:", createdSession.$id);

  const createdDoc = await adminRequest(`/databases/${DATABASE_ID}/collections/${MEMBERS_COLLECTION_ID}/documents`, {
    method: "POST",
    body: {
      documentId: randomId("smoke-member"),
      data: {
        displayName: "Smoke Member",
        jerseyNumber: 77,
        email: "smoke-member@example.com",
        membership_status: "active"
      }
    }
  });
  console.log("Created member row:", createdDoc.$id);

  const readDoc = await adminRequest(`/databases/${DATABASE_ID}/collections/${MEMBERS_COLLECTION_ID}/documents/${createdDoc.$id}`, {
    method: "GET"
  });
  console.log("Read member row displayName:", readDoc.displayName || readDoc.display_name);

  await adminRequest(`/databases/${DATABASE_ID}/collections/${MEMBERS_COLLECTION_ID}/documents/${createdDoc.$id}`, {
    method: "DELETE"
  });
  console.log("Deleted member row:", createdDoc.$id);

  await adminRequest(`/users/${createdUser.$id}`, {
    method: "DELETE"
  });
  console.log("Deleted test user:", createdUser.$id);

  const after = await adminRequest(`/databases/${DATABASE_ID}/collections/${MEMBERS_COLLECTION_ID}/documents?limit=1`);
  console.log(`Members after test: ${after.total}`);
  console.log("Smoke test completed successfully.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
