const ENDPOINT = process.env.APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID || "69dd0fdd00336ea1b4b5";
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || "69dd11140002e2b4254a";
const API_KEY = process.env.APPWRITE_API_KEY || "";

const MEMBERS = process.env.APPWRITE_MEMBERS_COLLECTION_ID || "members";
const FEES = process.env.APPWRITE_MEMBERSHIP_FEES_COLLECTION_ID || "membership_fees";
const PASSES = process.env.APPWRITE_PLAYER_PASSES_COLLECTION_ID || "player_passes";

if (!API_KEY) {
  throw new Error("APPWRITE_API_KEY is required.");
}

function baseUrl(path) {
  return `${ENDPOINT.replace(/\/$/, "")}${path}`;
}

function compactId(prefix) {
  const stamp = Date.now().toString(36).slice(-6);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${stamp}-${rand}`.slice(0, 36);
}

async function request(path, { method = "GET", body } = {}) {
  const response = await fetch(baseUrl(path), {
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
    const message = payload?.message || payload?.type || `HTTP ${response.status}`;
    throw new Error(`${method} ${path} failed: ${message}`);
  }

  return payload;
}

async function createDoc(collectionId, data, documentId) {
  return request(`/databases/${DATABASE_ID}/collections/${collectionId}/documents`, {
    method: "POST",
    body: {
      documentId: documentId || compactId("parity"),
      data
    }
  });
}

async function patchDoc(collectionId, documentId, data) {
  return request(`/databases/${DATABASE_ID}/collections/${collectionId}/documents/${documentId}`, {
    method: "PATCH",
    body: { data }
  });
}

async function getDoc(collectionId, documentId) {
  return request(`/databases/${DATABASE_ID}/collections/${collectionId}/documents/${documentId}`);
}

async function deleteDoc(collectionId, documentId) {
  return request(`/databases/${DATABASE_ID}/collections/${collectionId}/documents/${documentId}`, {
    method: "DELETE"
  });
}

async function main() {
  const created = [];

  try {
    const memberA = await createDoc(MEMBERS, {
      displayName: "Parity Alpha",
      first_name: "Parity",
      last_name: "Alpha",
      email: "parity-alpha@example.com",
      positions_json: JSON.stringify(["OL"]),
      roles_json: JSON.stringify(["player"]),
      membership_status: "active",
      notes: "seed",
      profile_id: null,
      invite_sent_at: null,
      deleted_at: null,
      jerseyNumber: 51
    }, compactId("parity-m-a"));
    created.push({ c: MEMBERS, id: memberA.$id });

    const memberB = await createDoc(MEMBERS, {
      displayName: "Parity Beta",
      first_name: "Parity",
      last_name: "Beta",
      email: "parity-beta@example.com",
      positions_json: JSON.stringify(["DL"]),
      roles_json: JSON.stringify(["player"]),
      membership_status: "active",
      notes: null,
      profile_id: null,
      invite_sent_at: null,
      deleted_at: null,
      jerseyNumber: 99
    }, compactId("parity-m-b"));
    created.push({ c: MEMBERS, id: memberB.$id });

    const feePeriod = `Q${Math.max(1, new Date().getUTCMonth() / 3 + 1 | 0)}_${new Date().getUTCFullYear()}`;

    const feeA = await createDoc(FEES, {
      member_id: memberA.$id,
      fee_period: feePeriod,
      season_label: String(new Date().getUTCFullYear()),
      amount_cents: 25000,
      paid_cents: 0,
      status: "pending",
      iban: null,
      status_note: null,
      due_date: null,
      created_at: new Date().toISOString()
    }, compactId("parity-f-a"));
    created.push({ c: FEES, id: feeA.$id });

    const feeB = await createDoc(FEES, {
      member_id: memberB.$id,
      fee_period: feePeriod,
      season_label: String(new Date().getUTCFullYear()),
      amount_cents: 25000,
      paid_cents: 10000,
      status: "partial",
      iban: null,
      status_note: null,
      due_date: null,
      created_at: new Date().toISOString()
    }, compactId("parity-f-b"));
    created.push({ c: FEES, id: feeB.$id });

    const passB = await createDoc(PASSES, {
      member_id: memberB.$id,
      pass_status: "valid",
      expires_on: null,
      federation_reference: null,
      notes: null,
      updated_at: new Date().toISOString()
    }, compactId("parity-p-b"));
    created.push({ c: PASSES, id: passB.$id });

    await patchDoc(MEMBERS, memberA.$id, {
      profile_id: compactId("profile")
    });

    const memberAAfterClaim = await getDoc(MEMBERS, memberA.$id);
    if (String(memberAAfterClaim.displayName || "") !== "Parity Alpha") {
      throw new Error("Member partial update changed displayName unexpectedly.");
    }
    if (String(memberAAfterClaim.membership_status || "") !== "active") {
      throw new Error("Member partial update changed membership_status unexpectedly.");
    }

    await patchDoc(FEES, feeA.$id, {
      status: "paid",
      paid_cents: 25000
    });
    const feeAAfter = await getDoc(FEES, feeA.$id);
    if (String(feeAAfter.status || "") !== "paid" || Number(feeAAfter.paid_cents || 0) !== 25000) {
      throw new Error("Fee inline update parity check failed.");
    }

    await patchDoc(FEES, feeB.$id, {
      status: "not_collected",
      paid_cents: 0
    });
    const feeBAfter = await getDoc(FEES, feeB.$id);
    if (String(feeBAfter.status || "") !== "not_collected" || Number(feeBAfter.paid_cents || 0) !== 0) {
      throw new Error("Fee bulk-like update parity check failed.");
    }

    await patchDoc(FEES, feeB.$id, {
      member_id: memberA.$id
    });
    await deleteDoc(PASSES, passB.$id);
    await deleteDoc(MEMBERS, memberB.$id);

    const movedFee = await getDoc(FEES, feeB.$id);
    if (String(movedFee.member_id || "") !== String(memberA.$id)) {
      throw new Error("Merge-like fee reassignment check failed.");
    }

    console.log("Members/fees parity smoke passed.");
  } finally {
    for (let i = created.length - 1; i >= 0; i -= 1) {
      const item = created[i];
      try {
        await deleteDoc(item.c, item.id);
      } catch {
        // Best-effort cleanup.
      }
    }
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
