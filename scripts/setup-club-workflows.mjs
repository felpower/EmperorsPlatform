// Additive migration: game editing and tryout/member linking. Existing rows are preserved.
import fs from "node:fs";
import vm from "node:vm";
import { request, tryRequest, requireApiKey, DATABASE_ID, repoRoot, hasFlag } from "./lib/appwrite-admin.mjs";
requireApiKey();
const dryRun = hasFlag("dry-run");
const base = `/databases/${DATABASE_ID}/collections`;
async function attribute(collection, key, size) {
  const info = await request(`${base}/${collection}`);
  if (!info.attributes.some((item) => item.key === key)) {
    if (dryRun) return console.log(`Would add ${collection}.${key}`);
    await request(`${base}/${collection}/attributes/string`, { method: "POST", body: { key, size, required: false, array: false } });
  }
}
let collection = await tryRequest(`${base}/league_games`);
if (!collection) {
  if (dryRun) console.log("Would create league_games (public read, admin write)");
  else collection = await request(base, { method: "POST", body: {
    collectionId: "league_games", name: "League games", documentSecurity: false, enabled: true,
    permissions: ['read("any")', 'create("label:admin")', 'update("label:admin")', 'delete("label:admin")']
  } });
}
if (collection) { await attribute("league_games", "season", 32); await attribute("league_games", "game_json", 8192); }
await attribute("tryout_registrations", "linked_member_id", 36);
if (!dryRun) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const collections = await Promise.all([request(`${base}/league_games`), request(`${base}/tryout_registrations`)]);
    if (collections.some((info) => info.attributes.some((attr) => attr.status === "failed"))) throw new Error("An attribute could not be created.");
    if (collections.every((info) => info.attributes.every((attr) => attr.status === "available"))) break;
    if (attempt === 29) throw new Error("Schema is still processing. Run the migration again.");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
const source = fs.readFileSync(`${repoRoot}/app.bundle.js`, "utf8");
const workflows = (await import("../src/modules/club-workflows.js")).default;
const snapshots = {};
for (const name of ["LEGACY_LEAGUE_GAMES", "CURRENT_LEAGUE_GAMES"]) {
  const begin = source.indexOf(`const ${name} = `) + `const ${name} = `.length;
  const end = source.indexOf("\n  ];", begin);
  snapshots[name] = vm.runInNewContext(source.slice(begin, end) + "\n]", {}, { timeout: 1000 });
}
let created = 0, preserved = 0;
for (const [name, games] of Object.entries(snapshots)) {
  const season = name === "LEGACY_LEAGUE_GAMES" ? "2025/26" : "2026/27";
  for (const game of games) {
    const id = game.id;
    if (await tryRequest(`${base}/league_games/documents/${id}`)) { preserved++; continue; }
    const payload = { ...game, season, round: workflows.roundFor(game), status: Number.isFinite(game.homeScore) && Number.isFinite(game.awayScore) ? "completed" : "scheduled" };
    if (!dryRun) await request(`${base}/league_games/documents`, { method: "POST", body: { documentId: id, data: { season, game_json: JSON.stringify(payload) } } });
    created++;
  }
}
console.log(`${dryRun ? "Would seed" : "Seeded"} ${created} games; preserved ${preserved} existing games. Existing seasons and results were not overwritten.`);
