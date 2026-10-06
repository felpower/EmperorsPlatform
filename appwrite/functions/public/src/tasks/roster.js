// Public roster (roster page, tryout referral list) for signed-out visitors.
// Reads the members table with the function's API key and returns ONLY public fields,
// so the members table itself no longer has to be readable by "any".
const { appwriteConfig, appwriteRequest, queryParam } = require("../shared/runtime");

const PUBLIC_FIELDS = [
  "first_name", "last_name", "displayName", "display_name", "positions_json", "roles_json",
  "rosterImage", "jerseyNumber", "jersey_number", "side_of_ball", "membership_status", "rookie_season"
];

module.exports = async ({ res, error }) => {
  const config = appwriteConfig();
  if (!config.databaseId) return res.json({ ok: false, error: "Missing APPWRITE_DATABASE_ID." }, 500);
  const table = encodeURIComponent(config.membersCollectionId);
  const members = [];
  for (let offset = 0; offset < 5000; offset += 500) {
    const query = [queryParam({ method: "limit", values: [500] }), queryParam({ method: "offset", values: [offset] }), queryParam({ method: "isNull", attribute: "deleted_at" })].join("&");
    const { response, payload } = await appwriteRequest(`/tablesdb/${encodeURIComponent(config.databaseId)}/tables/${table}/rows?${query}`);
    if (!response.ok) {
      error(`roster: list failed ${response.status} ${payload?.message || ""}`);
      return res.json({ ok: false, error: "Roster could not be loaded." }, 502);
    }
    const rows = Array.isArray(payload?.rows) ? payload.rows : [];
    rows.forEach((row) => {
      const out = { id: row.$id };
      PUBLIC_FIELDS.forEach((field) => { if (row[field] !== undefined && row[field] !== null && row[field] !== "") out[field] = row[field]; });
      members.push(out);
    });
    if (rows.length < 500) break;
  }
  return res.json({ ok: true, members });
};
