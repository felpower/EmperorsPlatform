const xlsx = require("xlsx");

module.exports = async ({ req, res, log }) => {
  const endpoint = String(process.env.APPWRITE_ENDPOINT || "").trim();
  const projectId = String(process.env.APPWRITE_PROJECT_ID || "").trim();
  const apiKey = String(process.env.APPWRITE_API_KEY || "").trim();
  const databaseId = String(process.env.APPWRITE_DATABASE_ID || "").trim();
  const membersCollectionId = String(process.env.APPWRITE_MEMBERS_COLLECTION_ID || "members").trim();
  const playerPassesCollectionId = String(process.env.APPWRITE_PLAYER_PASSES_COLLECTION_ID || "player_passes").trim();

  if (!endpoint || !projectId || !apiKey || !databaseId) {
    return res.json(
      {
        error:
          "Missing APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY, or APPWRITE_DATABASE_ID environment variables."
      },
      500
    );
  }

  const parseBody = () => {
    try {
      if (!req || req.body === undefined || req.body === null) return {};
      if (typeof req.body === "string") {
        return req.body.trim() ? JSON.parse(req.body) : {};
      }
      if (typeof req.body === "object") {
        return req.body;
      }
      return {};
    } catch {
      return {};
    }
  };

  const body = parseBody();
  const action = String(body.action || "preview").trim().toLowerCase();
  const fileName = String(body.fileName || "clubee-upload.xlsx").trim() || "clubee-upload.xlsx";

  const decodeBase64FilePayload = (fileBase64) => {
    const value = String(fileBase64 || "").trim();
    if (!value) return null;
    const base64 = value.includes(",") ? value.split(",").pop() : value;
    try {
      return Buffer.from(String(base64 || ""), "base64");
    } catch {
      return null;
    }
  };

  const normalizeNamePart = (value) => {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "");
  };

  const normalizeFullName = (firstName, lastName) => {
    return `${normalizeNamePart(firstName)}|${normalizeNamePart(lastName)}`;
  };

  const splitDisplayName = (displayName) => {
    const parts = String(displayName || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return { firstName: "", lastName: "" };
    if (parts.length === 1) return { firstName: parts[0], lastName: "" };
    return {
      firstName: parts.slice(0, -1).join(" "),
      lastName: parts.slice(-1).join(" ")
    };
  };

  const parseLicense = (rawLicense) => {
    const text = String(rawLicense || "").trim();
    if (!text) return { status: "missing", expiry: "", licenseName: "", note: "No license text in Clubee export." };
    const match = text.match(/^(.*?)\s*\(\d+\)\s*:?\s*Spielberechtigt bis\s+(\d{2}\/\d{2}\/\d{4})/i);
    if (!match) return { status: "missing", expiry: "", licenseName: text, note: text };
    const licenseName = String(match[1] || "").trim();
    const expiryText = String(match[2] || "").trim();
    const parts = expiryText.split("/");
    if (parts.length !== 3) {
      return { status: "missing", expiry: "", licenseName, note: text };
    }
    const day = parts[0];
    const month = parts[1];
    const year = parts[2];
    const expiry = `${year}-${month}-${day}`;
    const expiryDate = new Date(`${expiry}T00:00:00Z`);
    const today = new Date();
    const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const diffDays = Math.ceil((expiryDate.getTime() - todayUtc.getTime()) / (1000 * 60 * 60 * 24));
    const status = diffDays < 0 ? "expired" : "valid";
    return { status, expiry, licenseName, note: text };
  };

  const parseClubeePassRecord = (row) => {
    const firstName = String(row?.Vorname || "").trim();
    const lastName = String(row?.Nachname || "").trim();
    if (!firstName && !lastName) return null;

    const normalizedKey = normalizeFullName(firstName, lastName);
    if (!normalizedKey) return null;

    const license = parseLicense(row?.Lizenz);
    return {
      firstName,
      lastName,
      normalizedKey,
      passStatus: license.status,
      passExpiry: license.expiry,
      licenseName: license.licenseName,
      note: license.note
    };
  };

  const base = endpoint.replace(/\/$/, "");
  const headers = {
    "X-Appwrite-Project": projectId,
    "X-Appwrite-Key": apiKey,
    "Content-Type": "application/json"
  };

  const request = async (pathname, { method = "GET", body: requestBody } = {}) => {
    const response = await fetch(`${base}${pathname}`, {
      method,
      headers,
      body: requestBody ? JSON.stringify(requestBody) : undefined
    });
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  };

  const listAllDocuments = async (collectionId) => {
    const documents = [];
    const limit = 100;
    let offset = 0;

    while (true) {
      const queryParams = new URLSearchParams();
      queryParams.append("queries[]", `limit(${limit})`);
      queryParams.append("queries[]", `offset(${offset})`);

      const listed = await request(
        `/databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(collectionId)}/documents?${queryParams.toString()}`
      );
      if (!listed.response.ok) {
        throw new Error(listed.payload?.message || `Could not list ${collectionId} documents.`);
      }

      const rows = Array.isArray(listed.payload?.documents) ? listed.payload.documents : [];
      documents.push(...rows);
      if (rows.length < limit) break;
      offset += limit;
    }

    return documents;
  };

  const buildPlan = async (clubeeRows) => {
    const members = await listAllDocuments(membersCollectionId);
    const passes = await listAllDocuments(playerPassesCollectionId);

    const activeMembers = members
      .filter((member) => !member.deleted_at)
      .map((member) => {
        const firstName = String(member.first_name || "").trim();
        const lastName = String(member.last_name || "").trim();
        const displayName = String(member.display_name || "").trim();
        const fromDisplay = splitDisplayName(displayName);
        const resolvedFirstName = firstName || fromDisplay.firstName;
        const resolvedLastName = lastName || fromDisplay.lastName;
        const normalizedKey = normalizeFullName(resolvedFirstName, resolvedLastName || displayName);
        return {
          id: String(member.$id || member.id || "").trim(),
          firstName: resolvedFirstName,
          lastName: resolvedLastName,
          displayName: displayName || `${resolvedFirstName} ${resolvedLastName}`.trim(),
          email: String(member.email || "").trim(),
          normalizedKey
        };
      });

    const passByMemberId = new Map();
    for (const pass of passes) {
      const memberId = String(pass.member_id || "").trim();
      if (!memberId) continue;
      passByMemberId.set(memberId, {
        id: String(pass.$id || pass.id || "").trim(),
        passStatus: String(pass.pass_status || "").trim(),
        passExpiry: String(pass.expires_on || "").trim(),
        licenseName: String(pass.federation_reference || "").trim(),
        note: String(pass.notes || "").trim()
      });
    }

    const memberByKey = new Map();
    for (const member of activeMembers) {
      if (member.normalizedKey) {
        memberByKey.set(member.normalizedKey, member);
      }
    }

    let processedRows = 0;
    let matchedRows = 0;
    let unmatchedRows = 0;
    const unmatchedNames = [];
    const changes = [];

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
      const currentPass = passByMemberId.get(member.id) || null;
      const fieldChanges = [];

      const currentStatus = String(currentPass?.passStatus || "");
      const currentExpiry = String(currentPass?.passExpiry || "");
      const currentLicense = String(currentPass?.licenseName || "");
      const currentNote = String(currentPass?.note || "");

      if (currentStatus !== record.passStatus) {
        fieldChanges.push({ field: "pass_status", current: currentStatus, next: record.passStatus });
      }
      if (currentExpiry !== record.passExpiry) {
        fieldChanges.push({ field: "expiry_date", current: currentExpiry, next: record.passExpiry });
      }
      if (currentLicense !== record.licenseName) {
        fieldChanges.push({ field: "license_name", current: currentLicense, next: record.licenseName });
      }
      if (currentNote !== record.note) {
        fieldChanges.push({ field: "note", current: currentNote, next: record.note });
      }

      if (!fieldChanges.length) continue;

      changes.push({
        memberId: member.id,
        memberName: member.displayName || `${member.firstName || ""} ${member.lastName || ""}`.trim(),
        memberEmail: member.email,
        existingPass: Boolean(currentPass?.id),
        passDocumentId: currentPass?.id || "",
        fieldChanges,
        proposed: {
          passStatus: record.passStatus,
          passExpiry: record.passExpiry,
          licenseName: record.licenseName,
          note: record.note
        }
      });
    }

    return {
      sourceFilePath: fileName,
      processedRows,
      matchedRows,
      unmatchedRows,
      createdPasses: changes.filter((change) => !change.existingPass).length,
      updatedPasses: changes.filter((change) => change.existingPass).length,
      unmatchedNames: unmatchedNames.slice(0, 20),
      changes
    };
  };

  const applyPlan = async (plan, memberIds) => {
    const selectedSet = new Set(
      (Array.isArray(memberIds) ? memberIds : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    );

    const selectedChanges = selectedSet.size
      ? plan.changes.filter((change) => selectedSet.has(String(change.memberId || "")))
      : [];

    for (const change of selectedChanges) {
      const data = {
        member_id: String(change.memberId || "").trim(),
        pass_status: String(change.proposed?.passStatus || "missing").trim() || "missing",
        expires_on: String(change.proposed?.passExpiry || "").trim() || null,
        federation_reference: String(change.proposed?.licenseName || "").trim() || null,
        notes: String(change.proposed?.note || "").trim() || null
      };

      if (change.existingPass && change.passDocumentId) {
        const patched = await request(
          `/databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(playerPassesCollectionId)}/documents/${encodeURIComponent(change.passDocumentId)}`,
          {
            method: "PATCH",
            body: { data }
          }
        );
        if (!patched.response.ok) {
          throw new Error(patched.payload?.message || `Could not update pass for member ${change.memberName || change.memberId}.`);
        }
      } else {
        const generatedId = `pass-${Math.random().toString(36).slice(2, 11)}${Date.now().toString(36)}`.slice(0, 36);
        const created = await request(
          `/databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(playerPassesCollectionId)}/documents`,
          {
            method: "POST",
            body: {
              documentId: generatedId,
              data
            }
          }
        );
        if (!created.response.ok) {
          throw new Error(created.payload?.message || `Could not create pass for member ${change.memberName || change.memberId}.`);
        }
      }
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
  };

  try {
    const fileBuffer = decodeBase64FilePayload(body.fileBase64);
    if (!fileBuffer || !fileBuffer.length) {
      return res.json(
        {
          error:
            "Clubee XLSX upload is required in Appwrite-only mode. Choose a file in Pass Sync Review before previewing changes."
        },
        400
      );
    }

    const workbook = xlsx.read(fileBuffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return res.json({ error: "The uploaded workbook has no sheets." }, 400);
    }
    const sheet = workbook.Sheets[firstSheetName];
    const clubeeRows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

    const plan = await buildPlan(clubeeRows);

    if (action === "apply") {
      const summary = await applyPlan(plan, body.memberIds);
      log(`Pass sync apply completed with ${summary.appliedCount} change(s).`);
      return res.json({ ok: true, passSyncApply: summary, preview: plan });
    }

    log(`Pass sync preview completed with ${plan.changes.length} change(s).`);
    return res.json({ ok: true, preview: plan });
  } catch (error) {
    return res.json(
      {
        error: error instanceof Error ? error.message : "Unknown pass sync function error."
      },
      500
    );
  }
};
