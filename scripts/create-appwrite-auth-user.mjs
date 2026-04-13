const ENDPOINT = process.env.APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID || "69dd0fdd00336ea1b4b5";
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || "69dd11140002e2b4254a";
const API_KEY = process.env.APPWRITE_API_KEY || "";
const MEMBERS_COLLECTION_ID = process.env.APPWRITE_MEMBERS_COLLECTION_ID || "members";

const EMAIL = String(process.env.AUTH_EMAIL || "").trim();
const PASSWORD = String(process.env.AUTH_PASSWORD || "").trim();
const NAME = String(process.env.AUTH_NAME || "").trim() || EMAIL.split("@")[0] || "ClubHub User";

if (!API_KEY) throw new Error("APPWRITE_API_KEY is required.");
if (!EMAIL) throw new Error("AUTH_EMAIL is required.");
if (!PASSWORD) throw new Error("AUTH_PASSWORD is required.");
if (PASSWORD.length < 8) throw new Error("AUTH_PASSWORD must be at least 8 characters.");

function api(path) {
  return `${ENDPOINT.replace(/\/$/, "")}${path}`;
}

async function request(path, { method = "GET", body, tolerateStatus = [] } = {}) {
  const response = await fetch(api(path), {
    method,
    headers: {
      "X-Appwrite-Project": PROJECT_ID,
      "X-Appwrite-Key": API_KEY,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const raw = await response.text();
  const payload = raw ? JSON.parse(raw) : {};

  if (!response.ok && !tolerateStatus.includes(response.status)) {
    const message = payload?.message || payload?.type || `HTTP ${response.status}`;
    throw new Error(`${method} ${path} failed: ${message}`);
  }

  return { status: response.status, payload };
}

function randomId(prefix) {
  const stamp = Date.now().toString(36).slice(-6);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${stamp}-${rand}`.slice(0, 36);
}

async function listUsersByEmail(email) {
  const { payload } = await request(`/users?limit=5000`);
  const users = Array.isArray(payload?.users) ? payload.users : [];
  const normalizedEmail = String(email || "").trim().toLowerCase();
  return users.filter((item) => String(item?.email || "").trim().toLowerCase() === normalizedEmail);
}

async function createUser() {
  return request("/users", {
    method: "POST",
    body: {
      userId: randomId("user"),
      email: EMAIL,
      password: PASSWORD,
      name: NAME
    },
    tolerateStatus: [409]
  });
}

async function linkMemberByEmail(userId) {
  const { payload } = await request(`/databases/${DATABASE_ID}/collections/${MEMBERS_COLLECTION_ID}/documents?limit=5000`);
  const allDocs = Array.isArray(payload?.documents) ? payload.documents : [];
  const normalizedEmail = EMAIL.trim().toLowerCase();
  const docs = allDocs.filter((item) => String(item?.email || "").trim().toLowerCase() === normalizedEmail);
  if (!docs.length) {
    return { linked: false, reason: "No member row with matching email." };
  }

  const member = docs[0];
  await request(`/databases/${DATABASE_ID}/collections/${MEMBERS_COLLECTION_ID}/documents/${member.$id}`, {
    method: "PATCH",
    body: {
      data: {
        profile_id: userId
      }
    }
  });

  return { linked: true, memberId: member.$id };
}

async function main() {
  const created = await createUser();

  let user = null;
  if (created.status === 201) {
    user = created.payload;
    console.log(`Created auth user: ${user.$id}`);
  } else {
    const users = await listUsersByEmail(EMAIL);
    user = users[0] || null;
    if (!user) {
      throw new Error("User already exists but could not be fetched by email.");
    }
    console.log(`Auth user already exists: ${user.$id}`);
  }

  const linked = await linkMemberByEmail(String(user.$id || ""));
  if (linked.linked) {
    console.log(`Linked member profile_id to user: member=${linked.memberId}, user=${user.$id}`);
  } else {
    console.log(`Skipped member linking: ${linked.reason}`);
  }

  console.log("Auth bootstrap complete.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
