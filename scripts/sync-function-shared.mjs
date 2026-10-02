// Copies appwrite/functions/shared/ into every function folder (each Appwrite
// function only deploys its own folder, so shared code has to live inside it).
//   node scripts/sync-function-shared.mjs          -> copy
//   node scripts/sync-function-shared.mjs --check  -> exit 1 if a copy is outdated
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "appwrite", "functions");
const sharedDir = path.join(root, "shared");
const targets = ["public", "admin"].map((name) => path.join(root, name, "src", "shared"));
const check = process.argv.includes("--check");

function listFiles(dir, prefix = "") {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(prefix, entry.name);
    return entry.isDirectory() ? listFiles(path.join(dir, entry.name), rel) : [rel];
  });
}

let outdated = 0;
for (const target of targets) {
  for (const rel of listFiles(sharedDir)) {
    const source = fs.readFileSync(path.join(sharedDir, rel));
    const destination = path.join(target, rel);
    const current = fs.existsSync(destination) ? fs.readFileSync(destination) : null;
    if (current && current.equals(source)) continue;
    outdated += 1;
    if (check) {
      console.log(`outdated: ${path.relative(root, destination)}`);
    } else {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, source);
      console.log(`copied:   ${path.relative(root, destination)}`);
    }
  }
}
if (check && outdated) {
  console.error(`${outdated} shared file(s) out of sync - run: npm run functions:sync-shared`);
  process.exit(1);
}
console.log(outdated ? "Done." : "Shared files already in sync.");
