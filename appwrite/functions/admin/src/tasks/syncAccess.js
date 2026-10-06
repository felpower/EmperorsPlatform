// Sets Appwrite user labels from the member_roles table so that table permissions can be
// role-based (e.g. read("label:financeadmin") on membership_fees). Labels must be
// alphanumeric, hence "financeadmin"/"techadmin" for the role codes with underscores.
// Only the managed labels below are touched; other labels on a user are kept.
const { appwriteConfig, appwriteRequest, queryParam } = require("../shared/runtime");

const ROLE_LABELS = { admin: "admin", finance_admin: "financeadmin", coach: "coach", tech_admin: "techadmin" };
const MANAGED = new Set(Object.values(ROLE_LABELS));

async function listAll(path, key) {
  const items = [];
  for (let offset = 0; offset < 10000; offset += 100) {
    const sep = path.includes("?") ? "&" : "?";
    const { response, payload } = await appwriteRequest(`${path}${sep}${queryParam({ method: "limit", values: [100] })}&${queryParam({ method: "offset", values: [offset] })}`);
    if (!response.ok) throw new Error(`${path}: ${response.status} ${payload?.message || ""}`);
    const rows = payload?.[key] || [];
    items.push(...rows);
    if (rows.length < 100) break;
  }
  return items;
}

module.exports = async ({ res, log }) => {
  const config = appwriteConfig();
  try {
    const roleRows = await listAll(`/tablesdb/${encodeURIComponent(config.databaseId)}/tables/${encodeURIComponent(config.memberRolesCollectionId)}/rows`, "rows");
    const wanted = new Map();
    roleRows.forEach((row) => {
      const userId = String(row.profile_id || "").trim();
      const label = ROLE_LABELS[String(row.role_code || "").trim().toLowerCase()];
      if (!userId || !label) return;
      if (!wanted.has(userId)) wanted.set(userId, new Set());
      wanted.get(userId).add(label);
    });
    const users = await listAll("/users", "users");
    const changed = [];
    for (const user of users) {
      const current = Array.isArray(user.labels) ? user.labels : [];
      const keep = current.filter((label) => !MANAGED.has(label));
      const next = [...new Set([...keep, ...(wanted.get(user.$id) || [])])].sort();
      if (next.join(",") === [...current].sort().join(",")) continue;
      const { response, payload } = await appwriteRequest(`/users/${encodeURIComponent(user.$id)}/labels`, { method: "PUT", body: { labels: next } });
      if (!response.ok) throw new Error(`labels for ${user.$id}: ${response.status} ${payload?.message || ""}`);
      changed.push({ userId: user.$id, labels: next });
    }
    const summary = Object.fromEntries(Object.values(ROLE_LABELS).map((label) => [label, [...wanted.values()].filter((set) => set.has(label)).length]));
    log(`syncAccess: ${changed.length} user(s) updated ${JSON.stringify(summary)}`);
    return res.json({ ok: true, updated: changed.length, users: users.length, labels: summary });
  } catch (error) {
    log(`syncAccess failed: ${error instanceof Error ? error.message : error}`);
    return res.json({ ok: false, error: "Could not sync access labels." }, 500);
  }
};
