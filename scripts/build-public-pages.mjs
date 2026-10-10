import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "dist/site");
if (output !== path.join(root, "dist", "site")) throw new Error("Unexpected output path");
await fs.rm(output, { recursive: true, force: true });
await fs.mkdir(output, { recursive: true });
// Only frontend assets belong in the public artifact; never copy server code, keys or datasets.
for (const name of ["index.html", "thank-you.html", "404.html", "impressum.html", "datenschutz.html", "styles.css", "workspace.css", "app.bundle.js", "manifest.webmanifest", "favicon.svg", "robots.txt", "sitemap.xml", "CNAME", "src", "assets"]) {
  await fs.cp(path.join(root, name), path.join(output, name), { recursive: true, filter: source => !source.startsWith(path.join(root, "src", "server")) && !/\.(xlsx?|csv|tsv|db|sqlite3?)$/i.test(source) });
}
const bundle = await fs.readFile(path.join(root, "app.bundle.js"), "utf8");
const literal = bundle.match(/const ROUTE_SEO = (\{[\s\S]*?\n  \});/);
if (!literal) throw new Error("Public route metadata missing");
const routes = vm.runInNewContext(`(${literal[1]})`, {}, { timeout: 1000 });
const shell = await fs.readFile(path.join(root, "index.html"), "utf8");
const escape = value => String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const privateRoutes = ["organization", "members", "fees", "passes", "equipment", "pass-sync", "invites", "settings", "recovery", "sponsor-outreach", "user"].map(name => ({ path: `/${name}`, title: "Member area – Uni Wien Emperors", description: "Sign in to access the Emperors member area.", private: true }));
for (const info of [...Object.values(routes), ...privateRoutes]) {
  const url = `https://emperors.page${info.path}`;
  let html = shell.replace(/<title>[^<]*<\/title>/, `<title>${escape(info.title)}</title>`);
  for (const [attribute, key, value] of [["name", "description", info.description], ["property", "og:title", info.title], ["property", "og:description", info.description], ["property", "og:url", url], ["name", "twitter:title", info.title], ["name", "twitter:description", info.description]]) {
    html = html.replace(new RegExp(`<meta\\s+${attribute}="${key}"\\s+content="[^"]*"\\s*\\/>`), `<meta ${attribute}="${key}" content="${escape(value)}" />`);
  }
  html = html.replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url}" />`);
  if (info.private) html = html.replace('name="robots" content="index, follow"', 'name="robots" content="noindex, nofollow"');
  const directory = path.join(output, info.path.slice(1));
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, "index.html"), html);
}
await fs.writeFile(path.join(output, ".nojekyll"), "");
console.log(`Built ${Object.keys(routes).length} public routes in dist/site`);
