module.exports = async ({ req, res, log }) => {
  const endpoint = String(process.env.APPWRITE_ENDPOINT || "").trim();
  const projectId = String(process.env.APPWRITE_PROJECT_ID || "").trim();
  const apiKey = String(process.env.APPWRITE_API_KEY || "").trim();
  const databaseId = String(process.env.APPWRITE_DATABASE_ID || "").trim();
  const diagnosticsTableId = String(
    process.env.APPWRITE_DIAGNOSTICS_TABLE_ID ||
    process.env.APPWRITE_DIAGNOSTICS_COLLECTION_ID ||
    "diagnostics_logs"
  ).trim();

  if (!endpoint || !projectId || !apiKey || !databaseId || !diagnosticsTableId) {
    return res.json(
      {
        ok: false,
        error: "Missing APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY, APPWRITE_DATABASE_ID, or APPWRITE_DIAGNOSTICS_TABLE_ID."
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

  const clamp = (value, maxLength) => {
    const text = String(value || "").trim();
    if (!text) return "";
    return text.length > maxLength ? `${text.slice(0, Math.max(0, maxLength - 3))}...` : text;
  };

  const normalizeIso = (value) => {
    const text = String(value || "").trim();
    if (!text) return new Date().toISOString();
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  };

  const request = async (pathname, { method = "GET", body: requestBody } = {}) => {
    const response = await fetch(`${endpoint.replace(/\/$/, "")}${pathname}`, {
      method,
      headers: {
        "X-Appwrite-Project": projectId,
        "X-Appwrite-Key": apiKey,
        "Content-Type": "application/json"
      },
      body: requestBody ? JSON.stringify(requestBody) : undefined
    });
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  };

  const createRowInTables = async (rowId, data) => {
    return request(`/tablesdb/${encodeURIComponent(databaseId)}/tables/${encodeURIComponent(diagnosticsTableId)}/rows`, {
      method: "POST",
      body: {
        rowId,
        data
      }
    });
  };

  const createDocumentInLegacyCollection = async (rowId, data) => {
    return request(`/databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(diagnosticsTableId)}/documents`, {
      method: "POST",
      body: {
        documentId: rowId,
        data
      }
    });
  };

  const body = parseBody();
  const event = body && typeof body.event === "object" && body.event ? body.event : body;

  const normalized = {
    logged_at: normalizeIso(event.loggedAt || event.logged_at),
    level: clamp(event.level || "info", 32).toLowerCase() || "info",
    scope: clamp(event.scope || "app", 64) || "app",
    message: clamp(event.message || "Diagnostic event", 512) || "Diagnostic event",
    details: clamp(event.details || "", 4000) || null,
    route: clamp(event.route || "", 255) || null,
    origin: clamp(event.origin || "", 255) || null,
    user_id: clamp(event.userId || event.user_id || "", 128) || null,
    member_id: clamp(event.memberId || event.member_id || "", 128) || null,
    access_role: clamp(event.accessRole || event.access_role || "", 64) || null,
    user_email: clamp(event.userEmail || event.user_email || "", 255) || null
  };

  const payloadVariants = [
    normalized,
    {
      logged_at: normalized.logged_at,
      level: normalized.level,
      scope: normalized.scope,
      message: normalized.message,
      details: normalized.details
    },
    {
      level: normalized.level,
      scope: normalized.scope,
      message: normalized.message
    }
  ];

  try {
    const rowId = `diag-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`.slice(0, 36);
    let lastErrorMessage = "";

    for (const payload of payloadVariants) {
      const tableAttempt = await createRowInTables(rowId, payload);
      if (tableAttempt.response.ok) {
        log(`Client diagnostic stored in tablesdb with keys: ${Object.keys(payload).join(", ")}`);
        return res.json({ ok: true, storage: "tablesdb", acceptedKeys: Object.keys(payload) });
      }
      lastErrorMessage = String(tableAttempt.payload?.message || "Unknown tablesdb error.");

      const legacyAttempt = await createDocumentInLegacyCollection(rowId, payload);
      if (legacyAttempt.response.ok) {
        log(`Client diagnostic stored in legacy collection with keys: ${Object.keys(payload).join(", ")}`);
        return res.json({ ok: true, storage: "legacy", acceptedKeys: Object.keys(payload) });
      }
      lastErrorMessage = String(legacyAttempt.payload?.message || lastErrorMessage || "Unknown diagnostics storage error.");
    }

    throw new Error(
      `${lastErrorMessage} Add diagnostics_logs columns for: logged_at, level, scope, message, details, route, origin, user_id, member_id, access_role, user_email.`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not store client diagnostic.";
    log(`Client diagnostics failed: ${message}`);
    return res.json({ ok: false, error: message }, 500);
  }
};
