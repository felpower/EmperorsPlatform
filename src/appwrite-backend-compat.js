(function () {
  function toCamelCase(value) {
    return String(value || "").replace(/_([a-z])/g, function (_, letter) {
      return letter.toUpperCase();
    });
  }

  function splitDisplayName(value) {
    const parts = String(value || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return { firstName: "", lastName: "" };
    if (parts.length === 1) return { firstName: parts[0], lastName: "" };
    return {
      firstName: parts.slice(0, -1).join(" "),
      lastName: parts.slice(-1).join(" ")
    };
  }

  function createError(message) {
    return { message: String(message || "Unknown error") };
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  const config = window.ClubHubAppwriteConfig || {};
  const appwrite = window.Appwrite || window.appwrite;

  if (!appwrite || !config.projectId || !config.databaseId) {
    console.warn("Appwrite compatibility is not configured. Falling back to local mode.");
    return;
  }

  const client = new appwrite.Client()
    .setEndpoint(String(config.endpoint || "https://fra.cloud.appwrite.io/v1"))
    .setProject(String(config.projectId));

  const account = new appwrite.Account(client);
  const tablesService = typeof appwrite.TablesDB === "function" ? new appwrite.TablesDB(client) : null;
  const databasesService = typeof appwrite.Databases === "function" ? new appwrite.Databases(client) : null;
  const Query = appwrite.Query;
  const ID = appwrite.ID;

  function buildListQueries() {
    return Query && typeof Query.limit === "function" ? [Query.limit(5000)] : [];
  }

  const dbApi = tablesService
    ? {
        listRows: function (databaseId, tableId) {
          return tablesService.listRows(databaseId, tableId, buildListQueries());
        },
        createRow: function (databaseId, tableId, rowId, data) {
          return tablesService.createRow(databaseId, tableId, rowId, data);
        },
        updateRow: function (databaseId, tableId, rowId, data) {
          return tablesService.updateRow(databaseId, tableId, rowId, data);
        },
        deleteRow: function (databaseId, tableId, rowId) {
          return tablesService.deleteRow(databaseId, tableId, rowId);
        }
      }
    : databasesService
      ? {
          listRows: function (databaseId, tableId) {
            return databasesService.listDocuments(databaseId, tableId, buildListQueries());
          },
          createRow: function (databaseId, tableId, rowId, data) {
            return databasesService.createDocument(databaseId, tableId, rowId, data);
          },
          updateRow: function (databaseId, tableId, rowId, data) {
            return databasesService.updateDocument(databaseId, tableId, rowId, data);
          },
          deleteRow: function (databaseId, tableId, rowId) {
            return databasesService.deleteDocument(databaseId, tableId, rowId);
          }
        }
      : null;

  if (!dbApi) {
    console.error("Appwrite SDK does not expose TablesDB or Databases in this runtime.");
    return;
  }

  const authListeners = new Set();

  function membersTableId() {
    return String(config.membersTableId || "members");
  }

  function tableMap() {
    return {
      members: String(config.membersTableId || "members"),
      member_roles: String(config.memberRolesTableId || "member_roles"),
      player_passes: String(config.playerPassesTableId || "player_passes"),
      membership_fees: String(config.membershipFeesTableId || "membership_fees"),
      events: String(config.eventsTableId || "events"),
      event_recipients: String(config.eventRecipientsTableId || "event_recipients"),
      invites: String(config.invitesTableId || "invites"),
      equipment_inventory: String(config.equipmentTableId || "equipment_inventory")
    };
  }

  function tableIdFor(tableName) {
    const mapped = tableMap()[String(tableName || "")];
    return String(mapped || "").trim();
  }

  function metadataStorageKey(userId) {
    return "clubhub-appwrite-user-metadata-" + String(userId || "");
  }

  function loadUserMetadata(userId) {
    try {
      const raw = localStorage.getItem(metadataStorageKey(userId));
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveUserMetadata(userId, patch) {
    const existing = loadUserMetadata(userId);
    const merged = Object.assign({}, existing, patch || {});
    localStorage.setItem(metadataStorageKey(userId), JSON.stringify(merged));
    return merged;
  }

  function normalizeUser(user) {
    const metadata = loadUserMetadata(user.$id);
    return {
      id: user.$id,
      email: user.email,
      user_metadata: metadata
    };
  }

  async function getCurrentSession() {
    try {
      const user = await account.get();
      return {
        user: normalizeUser(user)
      };
    } catch {
      return null;
    }
  }

  function notifyAuthListeners(eventName, session) {
    authListeners.forEach(function (listener) {
      try {
        listener(eventName, session);
      } catch {
        // Ignore listener errors to keep auth flow resilient.
      }
    });
  }

  function rowValue(row, field) {
    const candidates = [
      String(field || ""),
      toCamelCase(field),
      String(field || "").toLowerCase()
    ];

    for (const key of candidates) {
      if (Object.prototype.hasOwnProperty.call(row, key)) return row[key];
    }
    return undefined;
  }

  function applyFilters(rows, filters) {
    return rows.filter(function (row) {
      return filters.every(function (filter) {
        const value = rowValue(row, filter.field);
        if (filter.operator === "eq") {
          return String(value || "") === String(filter.value || "");
        }
        if (filter.operator === "in") {
          const set = Array.isArray(filter.value) ? filter.value.map(String) : [];
          return set.includes(String(value || ""));
        }
        if (filter.operator === "is") {
          if (filter.value === null) return value === null || value === undefined;
          return String(value || "") === String(filter.value || "");
        }
        if (filter.operator === "ilike") {
          const haystack = String(value || "").trim().toLowerCase();
          const needle = String(filter.value || "").trim().toLowerCase();
          return haystack === needle;
        }
        return true;
      });
    });
  }

  function normalizeMembersRow(row) {
    const displayName = String(rowValue(row, "display_name") || rowValue(row, "displayName") || "").trim();
    const split = splitDisplayName(displayName);
    const firstName = String(rowValue(row, "first_name") || split.firstName || "").trim();
    const lastName = String(rowValue(row, "last_name") || split.lastName || "").trim();

    return Object.assign({}, row, {
      id: row.$id || row.id,
      first_name: firstName,
      last_name: lastName,
      display_name: displayName || ((firstName + " " + lastName).trim() || "Unknown member"),
      email: String(rowValue(row, "email") || "").trim(),
      iban: String(rowValue(row, "iban") || "").trim(),
      positions_json: rowValue(row, "positions_json") || rowValue(row, "positionsJson") || [],
      roles_json: rowValue(row, "roles_json") || rowValue(row, "rolesJson") || ["player"],
      jersey_number: rowValue(row, "jersey_number") !== undefined ? rowValue(row, "jersey_number") : rowValue(row, "jerseyNumber"),
      membership_status: String(rowValue(row, "membership_status") || rowValue(row, "membershipStatus") || "active"),
      notes: String(rowValue(row, "notes") || ""),
      profile_id: rowValue(row, "profile_id") || rowValue(row, "profileId") || null,
      invite_sent_at: rowValue(row, "invite_sent_at") || rowValue(row, "inviteSentAt") || null,
      deleted_at: rowValue(row, "deleted_at") || rowValue(row, "deletedAt") || null
    });
  }

  function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj || {}, key);
  }

  function toOptionalIso(value) {
    if (value === null) return null;
    const raw = String(value || "").trim();
    if (!raw) return null;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  function sanitizeMembersPayload(payload, options) {
    const input = payload || {};
    const forInsert = Boolean(options && options.forInsert);
    const sanitized = {};

    if (hasOwn(input, "display_name") || hasOwn(input, "displayName") || forInsert) {
      const displayName = String(input.display_name ?? input.displayName ?? "").trim();
      sanitized.displayName = displayName || "Unknown member";
    }

    if (hasOwn(input, "jersey_number") || hasOwn(input, "jerseyNumber")) {
      const jerseyRaw = input.jersey_number !== undefined ? input.jersey_number : input.jerseyNumber;
      const jerseyNumber = jerseyRaw === null || jerseyRaw === "" || jerseyRaw === undefined ? null : Number(jerseyRaw);
      sanitized.jerseyNumber = Number.isFinite(jerseyNumber) ? jerseyNumber : null;
    }

    if (hasOwn(input, "email")) sanitized.email = input.email ? String(input.email).trim() : null;
    if (hasOwn(input, "iban")) sanitized.iban = input.iban ? String(input.iban).trim() : null;
    if (hasOwn(input, "first_name")) sanitized.first_name = input.first_name ? String(input.first_name).trim() : null;
    if (hasOwn(input, "last_name")) sanitized.last_name = input.last_name ? String(input.last_name).trim() : null;
    if (hasOwn(input, "membership_status")) sanitized.membership_status = input.membership_status ? String(input.membership_status).trim() : "pending";
    if (hasOwn(input, "notes")) sanitized.notes = input.notes ? String(input.notes).trim() : null;
    if (hasOwn(input, "profile_id")) sanitized.profile_id = input.profile_id ? String(input.profile_id).trim() : null;
    if (hasOwn(input, "invite_sent_at")) sanitized.invite_sent_at = toOptionalIso(input.invite_sent_at);
    if (hasOwn(input, "deleted_at")) sanitized.deleted_at = toOptionalIso(input.deleted_at);

    if (hasOwn(input, "positions_json")) {
      if (Array.isArray(input.positions_json)) sanitized.positions_json = JSON.stringify(input.positions_json);
      else if (typeof input.positions_json === "string") sanitized.positions_json = input.positions_json;
      else sanitized.positions_json = "[]";
    }

    if (hasOwn(input, "roles_json")) {
      if (Array.isArray(input.roles_json)) sanitized.roles_json = JSON.stringify(input.roles_json);
      else if (typeof input.roles_json === "string") sanitized.roles_json = input.roles_json;
      else sanitized.roles_json = "[]";
    }

    return sanitized;
  }

  function sanitizeNonMembersPayload(payload) {
    const sanitized = clone(payload || {});
    // Appwrite document ids must be passed as documentId, never as data attributes.
    delete sanitized.id;
    delete sanitized.$id;
    return sanitized;
  }

  class Builder {
    constructor(tableName) {
      this.tableName = String(tableName || "");
      this.action = "none";
      this.payload = null;
      this.options = null;
      this.columns = "*";
      this.filters = [];
      this.singleMode = "many";
      this.execution = null;
    }

    select(columns) {
      this.columns = columns || "*";
      if (this.action === "none") {
        this.action = "select";
      }
      return this;
    }

    update(payload) {
      this.action = "update";
      this.payload = payload || {};
      return this;
    }

    insert(rows) {
      this.action = "insert";
      this.payload = Array.isArray(rows) ? rows : [rows];
      return this;
    }

    upsert(payload, options) {
      this.action = "upsert";
      this.payload = payload || {};
      this.options = options || {};
      return this;
    }

    delete() {
      this.action = "delete";
      return this;
    }

    eq(field, value) {
      this.filters.push({ operator: "eq", field: field, value: value });
      return this;
    }

    in(field, values) {
      this.filters.push({ operator: "in", field: field, value: values });
      return this;
    }

    is(field, value) {
      this.filters.push({ operator: "is", field: field, value: value });
      return this;
    }

    ilike(field, value) {
      this.filters.push({ operator: "ilike", field: field, value: value });
      return this;
    }

    single() {
      this.singleMode = "single";
      return this;
    }

    maybeSingle() {
      this.singleMode = "maybeSingle";
      return this;
    }

    then(resolve, reject) {
      return this.execute().then(resolve, reject);
    }

    async execute() {
      if (!this.execution) {
        this.execution = this.executeInternal();
      }
      return this.execution;
    }

    async fetchRows() {
      const tableId = tableIdFor(this.tableName);
      if (!tableId) throw new Error("Missing table id for " + this.tableName + ".");
      const response = await dbApi.listRows(String(config.databaseId), tableId);
      const rows = response.rows || response.documents || [];
      const normalized = this.tableName === "members" ? rows.map(normalizeMembersRow) : rows.map(function (row) {
        return Object.assign({}, row, { id: row.$id || row.id });
      });
      return applyFilters(normalized, this.filters);
    }

    async executeInternal() {
      try {
        let data = null;

        if (this.action === "select") {
          data = await this.fetchRows();
        } else if (this.action === "insert") {
          const tableId = tableIdFor(this.tableName);
          const created = [];
          for (const row of this.payload || []) {
            const rawRow = row || {};
            const payload = this.tableName === "members"
              ? sanitizeMembersPayload(rawRow, { forInsert: true })
              : sanitizeNonMembersPayload(rawRow);
            const requestedDocumentId = String(rawRow.id || rawRow.$id || "").trim();
            const inserted = await dbApi.createRow(String(config.databaseId), tableId, requestedDocumentId || ID.unique(), payload);
            created.push(this.tableName === "members" ? normalizeMembersRow(inserted) : Object.assign({}, inserted, { id: inserted.$id || inserted.id }));
          }
          data = created;
        } else if (this.action === "update") {
          const tableId = tableIdFor(this.tableName);
          const rows = await this.fetchRows();
          const updated = [];
          for (const row of rows) {
            const payload = this.tableName === "members"
              ? sanitizeMembersPayload(this.payload || {})
              : sanitizeNonMembersPayload(this.payload || {});
            const next = await dbApi.updateRow(String(config.databaseId), tableId, String(row.$id || row.id), payload);
            updated.push(this.tableName === "members" ? normalizeMembersRow(next) : Object.assign({}, next, { id: next.$id || next.id }));
          }
          data = updated;
        } else if (this.action === "delete") {
          const tableId = tableIdFor(this.tableName);
          const rows = await this.fetchRows();
          for (const row of rows) {
            await dbApi.deleteRow(String(config.databaseId), tableId, String(row.$id || row.id));
          }
          data = [];
        } else if (this.action === "upsert") {
          const tableId = tableIdFor(this.tableName);
          const conflictField = String(this.options?.onConflict || "").trim();
          let target = null;
          if (conflictField) {
            const rows = await this.fetchRows();
            target = rows.find(function (row) {
              return String(rowValue(row, conflictField) || "") === String(rowValue(this.payload || {}, conflictField) || "");
            }, this);
          }
          const payload = this.tableName === "members"
            ? sanitizeMembersPayload(this.payload || {}, { forInsert: !target })
            : sanitizeNonMembersPayload(this.payload || {});
          const requestedDocumentId = String(this.payload?.id || this.payload?.$id || "").trim();
          const saved = target
            ? await dbApi.updateRow(String(config.databaseId), tableId, String(target.$id || target.id), payload)
            : await dbApi.createRow(String(config.databaseId), tableId, requestedDocumentId || ID.unique(), payload);
          data = [this.tableName === "members" ? normalizeMembersRow(saved) : Object.assign({}, saved, { id: saved.$id || saved.id })];
        } else {
          data = [];
        }

        if (this.singleMode === "single") {
          if (!Array.isArray(data) || data.length !== 1) {
            return { data: null, error: createError("Expected a single row."), status: 406 };
          }
          return { data: data[0], error: null, status: 200 };
        }

        if (this.singleMode === "maybeSingle") {
          if (!Array.isArray(data) || data.length === 0) {
            return { data: null, error: null, status: 200 };
          }
          if (data.length > 1) {
            return { data: null, error: createError("Expected zero or one row."), status: 406 };
          }
          return { data: data[0], error: null, status: 200 };
        }

        return { data: data, error: null, status: 200 };
      } catch (error) {
        const rawMessage = error && error.message ? String(error.message) : "Appwrite query failed.";
        return {
          data: null,
          error: createError(rawMessage),
          status: 400
        };
      }
    }
  }

  const compatClient = {
    auth: {
      async signInWithPassword(input) {
        try {
          await account.createEmailPasswordSession(String(input?.email || "").trim(), String(input?.password || ""));
          const session = await getCurrentSession();
          if (session?.user?.id) {
            saveUserMetadata(session.user.id, { password_set: true });
          }
          const nextSession = await getCurrentSession();
          notifyAuthListeners("SIGNED_IN", nextSession);
          return { data: { session: nextSession, user: nextSession?.user || null }, error: null };
        } catch (error) {
          return { data: { session: null, user: null }, error: createError(error && error.message) };
        }
      },

      async resetPasswordForEmail(email, options) {
        try {
          const redirectTo = String(options?.redirectTo || window.location.origin).trim();
          await account.createRecovery(String(email || "").trim(), redirectTo);
          return { data: {}, error: null };
        } catch (error) {
          return { data: null, error: createError(error && error.message) };
        }
      },

      async updateRecovery(input) {
        try {
          const userId = String(input?.userId || "").trim();
          const secret = String(input?.secret || "").trim();
          const password = String(input?.password || "");
          if (!userId || !secret || !password) {
            return { data: null, error: createError("Recovery token data is incomplete.") };
          }

          if (typeof account.updateRecovery !== "function") {
            return { data: null, error: createError("Recovery confirmation is not supported by this Appwrite SDK build.") };
          }

          try {
            await account.updateRecovery({ userId: userId, secret: secret, password: password });
          } catch {
            await account.updateRecovery(userId, secret, password);
          }

          return { data: {}, error: null };
        } catch (error) {
          return { data: null, error: createError(error && error.message) };
        }
      },

      async signOut() {
        try {
          await account.deleteSession("current");
          notifyAuthListeners("SIGNED_OUT", null);
          return { error: null };
        } catch (error) {
          return { error: createError(error && error.message) };
        }
      },

      async updateUser(payload) {
        try {
          if (payload && typeof payload.password === "string" && payload.password) {
            await account.updatePassword(payload.password);
          }

          const session = await getCurrentSession();
          if (session?.user?.id && payload && payload.data && typeof payload.data === "object") {
            saveUserMetadata(session.user.id, payload.data);
          }
          const nextSession = await getCurrentSession();
          notifyAuthListeners("USER_UPDATED", nextSession);
          return { data: { user: nextSession?.user || null }, error: null };
        } catch (error) {
          return { data: null, error: createError(error && error.message) };
        }
      },

      async getSession() {
        const session = await getCurrentSession();
        return { data: { session: session }, error: null };
      },

      onAuthStateChange(listener) {
        if (typeof listener === "function") {
          authListeners.add(listener);
        }
        return {
          data: {
            subscription: {
              unsubscribe: function () {
                authListeners.delete(listener);
              }
            }
          }
        };
      }
    },

    from(tableName) {
      return new Builder(tableName);
    }
  };

  window.ClubHubDataClient = {
    createClient: function () {
      return compatClient;
    }
  };
})();
