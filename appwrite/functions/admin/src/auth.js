// Server-side role check for emperors-admin. The function's execute permission is
// "users" (any signed-in account), so every task decides here who may run it.
// Roles are resolved like the frontend does: member_roles rows for the caller's
// profile id, falling back to members.roles_json, plus Appwrite user labels.
const { header, appwriteConfig, appwriteRequest, queryParam } = require("./shared/runtime");

// Mirrors what the UI offers each role. "self" = any signed-in user (own account only).
const DEFAULT_TASK_ROLES = {
  invite: ["admin", "coach", "finance_admin", "tech_admin"],
  passSync: ["admin"],
  sepaExport: ["admin", "finance_admin"],
  tryoutEmail: ["admin", "coach"],
  setPassword: ["self"],
  syncAccess: ["admin"],
  tryoutConvert: ["admin"]
};

function taskRoles() {
  const raw = String(process.env.ADMIN_TASK_ROLES || "").trim();
  if (!raw) return DEFAULT_TASK_ROLES;
  try {
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_TASK_ROLES, ...parsed };
  } catch {
    return DEFAULT_TASK_ROLES;
  }
}

function parseRoles(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function callerRoles(userId) {
  const config = appwriteConfig();
  const roles = new Set();

  const user = await appwriteRequest(`/users/${encodeURIComponent(userId)}`);
  if (user.response.ok) {
    for (const label of user.payload?.labels || []) roles.add(String(label).trim().toLowerCase());
  }

  const base = `/databases/${encodeURIComponent(config.databaseId)}/collections`;
  const roleRows = await appwriteRequest(
    `${base}/${encodeURIComponent(config.memberRolesCollectionId)}/documents?${queryParam({ method: "equal", attribute: "profile_id", values: [userId] })}&${queryParam({ method: "limit", values: [100] })}`
  );
  const fromRoleRows = roleRows.response.ok
    ? (roleRows.payload?.documents || []).map((row) => String(row.role_code || "").trim().toLowerCase()).filter(Boolean)
    : [];

  if (fromRoleRows.length) {
    fromRoleRows.forEach((role) => roles.add(role));
  } else {
    const members = await appwriteRequest(
      `${base}/${encodeURIComponent(config.membersCollectionId)}/documents?${queryParam({ method: "equal", attribute: "profile_id", values: [userId] })}&${queryParam({ method: "limit", values: [5] })}`
    );
    for (const member of members.response.ok ? members.payload?.documents || [] : []) {
      if (member.deleted_at) continue;
      parseRoles(member.roles_json).forEach((role) => roles.add(String(role).trim().toLowerCase()));
    }
  }
  return [...roles];
}

// Returns { ok: true, userId, roles } or { ok: false, status, error }.
async function authorize(req, task) {
  const userId = header(req, "x-appwrite-user-id");
  if (!userId) return { ok: false, status: 401, error: "You must be signed in to use this function." };

  const allowed = taskRoles()[task] || ["admin"];
  if (allowed.includes("self")) return { ok: true, userId, roles: [] };

  const roles = await callerRoles(userId);
  if (roles.includes("admin") || roles.some((role) => allowed.includes(role))) {
    return { ok: true, userId, roles };
  }
  return {
    ok: false,
    status: 403,
    error: `Your account is not allowed to run "${task}" (needs one of: ${allowed.join(", ")}).`,
    userId,
    roles
  };
}

module.exports = { authorize, callerRoles, DEFAULT_TASK_ROLES };
