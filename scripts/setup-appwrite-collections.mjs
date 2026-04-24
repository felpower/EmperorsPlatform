const ENDPOINT = process.env.APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID || "69dd0fdd00336ea1b4b5";
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || "69dd11140002e2b4254a";
const API_KEY = process.env.APPWRITE_API_KEY || "";

if (!API_KEY) {
  throw new Error("APPWRITE_API_KEY is missing.");
}

const collectionPermissions = [
  'read("users")',
  'create("users")',
  'update("users")',
  'delete("users")'
];

const schema = {
  members: {
    name: "members",
    attributes: [
      { type: "string", key: "displayName", size: 255, required: true },
      { type: "integer", key: "jerseyNumber", required: false },
      { type: "string", key: "email", size: 255, required: false },
      { type: "string", key: "first_name", size: 255, required: false },
      { type: "string", key: "last_name", size: 255, required: false },
      { type: "string", key: "positions_json", size: 2048, required: false },
      { type: "string", key: "roles_json", size: 2048, required: false },
      { type: "string", key: "membership_status", size: 32, required: false },
      { type: "string", key: "iban", size: 128, required: false },
      { type: "string", key: "notes", size: 2048, required: false },
      { type: "string", key: "profile_id", size: 255, required: false },
      { type: "datetime", key: "invite_sent_at", required: false },
      { type: "datetime", key: "deleted_at", required: false }
    ]
  },
  member_roles: {
    name: "member_roles",
    attributes: [
      { type: "string", key: "profile_id", size: 255, required: true },
      { type: "string", key: "role_code", size: 64, required: true }
    ]
  },
  player_passes: {
    name: "player_passes",
    attributes: [
      { type: "string", key: "member_id", size: 255, required: true },
      { type: "string", key: "pass_status", size: 32, required: true },
      { type: "datetime", key: "expires_on", required: false },
      { type: "string", key: "federation_reference", size: 255, required: false },
      { type: "string", key: "notes", size: 1024, required: false },
      { type: "datetime", key: "updated_at", required: false }
    ]
  },
  membership_fees: {
    name: "membership_fees",
    attributes: [
      { type: "string", key: "member_id", size: 255, required: true },
      { type: "string", key: "fee_period", size: 32, required: true },
      { type: "string", key: "season_label", size: 32, required: true },
      { type: "integer", key: "amount_cents", required: true },
      { type: "integer", key: "paid_cents", required: true },
      { type: "string", key: "status", size: 32, required: true },
      { type: "string", key: "iban", size: 128, required: false },
      { type: "string", key: "status_note", size: 2048, required: false },
      { type: "datetime", key: "due_date", required: false },
      { type: "datetime", key: "created_at", required: false }
    ]
  },
  events: {
    name: "events",
    attributes: [
      { type: "string", key: "title", size: 255, required: true },
      { type: "string", key: "event_type", size: 32, required: true },
      { type: "datetime", key: "starts_at", required: true },
      { type: "string", key: "location", size: 255, required: false },
      { type: "string", key: "notes", size: 2048, required: false },
      { type: "string", key: "created_by", size: 255, required: false },
      { type: "datetime", key: "created_at", required: false }
    ]
  },
  event_recipients: {
    name: "event_recipients",
    attributes: [
      { type: "string", key: "event_id", size: 255, required: true },
      { type: "string", key: "member_id", size: 255, required: true },
      { type: "string", key: "response", size: 32, required: true },
      { type: "datetime", key: "responded_at", required: false }
    ]
  },
  invites: {
    name: "invites",
    attributes: [
      { type: "string", key: "event_id", size: 255, required: true },
      { type: "string", key: "channel", size: 32, required: true },
      { type: "string", key: "sent_by", size: 255, required: false },
      { type: "datetime", key: "sent_at", required: false },
      { type: "integer", key: "recipient_count", required: true }
    ]
  }
};

function apiUrl(path) {
  return `${ENDPOINT.replace(/\/$/, "")}${path}`;
}

async function request(path, { method = "GET", body } = {}) {
  const response = await fetch(apiUrl(path), {
    method,
    headers: {
      "X-Appwrite-Project": PROJECT_ID,
      "X-Appwrite-Key": API_KEY,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const message = payload?.message || payload?.type || `HTTP ${response.status}`;
    throw new Error(`${method} ${path} failed: ${message}`);
  }

  return payload;
}

async function ensureCollection(collectionId, definition) {
  const list = await request(`/databases/${DATABASE_ID}/collections`);
  const existing = (list.collections || []).find((collection) => collection.$id === collectionId);

  if (existing) {
    console.log(`Collection exists: ${collectionId}`);
    return existing;
  }

  const created = await request(`/databases/${DATABASE_ID}/collections`, {
    method: "POST",
    body: {
      collectionId,
      name: definition.name,
      permissions: collectionPermissions,
      documentSecurity: false,
      enabled: true
    }
  });

  console.log(`Created collection: ${collectionId}`);
  return created;
}

function attributeExists(attributes, key) {
  return (attributes || []).some((attribute) => attribute.key === key);
}

async function ensureAttribute(collectionId, attribute) {
  const collection = await request(`/databases/${DATABASE_ID}/collections/${collectionId}`);
  if (attributeExists(collection.attributes, attribute.key)) {
    console.log(`  Attribute exists: ${collectionId}.${attribute.key}`);
    return;
  }

  const base = {
    key: attribute.key,
    required: Boolean(attribute.required),
    array: false
  };

  if (attribute.type === "string") {
    await request(`/databases/${DATABASE_ID}/collections/${collectionId}/attributes/string`, {
      method: "POST",
      body: {
        ...base,
        size: Number(attribute.size || 255)
      }
    });
  } else if (attribute.type === "integer") {
    await request(`/databases/${DATABASE_ID}/collections/${collectionId}/attributes/integer`, {
      method: "POST",
      body: base
    });
  } else if (attribute.type === "datetime") {
    await request(`/databases/${DATABASE_ID}/collections/${collectionId}/attributes/datetime`, {
      method: "POST",
      body: base
    });
  } else {
    throw new Error(`Unsupported attribute type: ${attribute.type}`);
  }

  console.log(`  Created attribute: ${collectionId}.${attribute.key}`);
}

async function main() {
  for (const [collectionId, definition] of Object.entries(schema)) {
    await ensureCollection(collectionId, definition);
    for (const attribute of definition.attributes) {
      await ensureAttribute(collectionId, attribute);
    }
  }

  console.log("Appwrite collections setup complete.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
