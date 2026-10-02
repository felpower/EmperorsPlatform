// Free-plan migration, step "storage": copies every file of the old buckets into one
// bucket ("media") and rewrites stored file URLs in the database. NEVER deletes anything.
//
//   node scripts/migrate-storage-to-single-bucket.mjs --dry-run   -> report only, no writes
//   node scripts/migrate-storage-to-single-bucket.mjs             -> apply (safe to re-run)
//
// Options:
//   --target=media                         new bucket id
//   --sources=equipment,hall_of_fame,...   old bucket ids (default: the five below)
//   --skip-tables=diagnostics_logs         tables whose rows are not scanned for URLs
//   --no-db                                only copy files
//
// File ids are kept (they are unique across the old buckets: avatar-…, equipment-…, hof-…,
// rp_…, random team-logo ids), so columns that store a file id need no change. The script
// stops before copying anything if two old buckets contain the same file id.
import { request, tryRequest, listAll, hasFlag, option, DATABASE_ID, requireApiKey, formatBytes, writeReport, AppwriteError } from "./lib/appwrite-admin.mjs";

requireApiKey();
const DRY_RUN = hasFlag("dry-run");
const TARGET = option("target", "media");
const SOURCES = option("sources", "equipment,hall_of_fame,ProfilePictures,RosterPictures,teams").split(",").map((s) => s.trim()).filter(Boolean);
const SKIP_TABLES = new Set(option("skip-tables", "diagnostics_logs").split(",").map((s) => s.trim()).filter(Boolean));
const CHUNK = 5 * 1024 * 1024;
// Which old bucket holds what the frontend uploads (for the storageFilePermissions config).
const UPLOAD_CATEGORY = { ProfilePictures: "avatar", equipment: "equipment", hall_of_fame: "hallOfFame" };

const report = { dryRun: DRY_RUN, target: TARGET, sources: SOURCES, mode: "", bucket: {}, files: [], rows: [], warnings: [], errors: [] };
const warn = (message) => { report.warnings.push(message); console.log(`  ! ${message}`); };

const sortUnique = (list) => [...new Set(list)].sort();
const parsePermission = (perm) => {
  const match = String(perm).match(/^(\w+)\("(.+)"\)$/);
  return match ? { action: match[1], role: match[2] } : null;
};
const byAction = (perms, actions) => sortUnique(tighten(perms.filter((perm) => actions.includes(parsePermission(perm)?.action))));
const FILE_ACTIONS = ["read", "update", "delete", "write"];
// RosterPictures/hall_of_fame allowed create/update/delete for "any" (anonymous visitors).
// No page uploads or deletes anonymously, so these become "users" unless --keep-any is given.
const KEEP_ANY = hasFlag("keep-any");
const tighten = (perms) => (KEEP_ANY ? perms : perms.map((perm) => (/^(create|update|delete|write)\("any"\)$/.test(perm) ? perm.replace('"any"', '"users"') : perm)));
const sameSet = (a, b) => JSON.stringify(sortUnique(a)) === JSON.stringify(sortUnique(b));

async function loadSources() {
  const buckets = [];
  for (const id of SOURCES) {
    const bucket = await tryRequest(`/storage/buckets/${encodeURIComponent(id)}`);
    if (!bucket) {
      warn(`Source bucket "${id}" does not exist - skipped.`);
      continue;
    }
    bucket.files = await listAll(`/storage/buckets/${encodeURIComponent(id)}/files`, "files");
    buckets.push(bucket);
  }
  return buckets;
}

function planBucket(sources) {
  const allPerms = sources.map((bucket) => bucket.$permissions || []);
  const identical = allPerms.every((perms) => sameSet(perms, allPerms[0])) && sources.every((bucket) => !bucket.fileSecurity);
  const intersection = allPerms.reduce((acc, perms) => acc.filter((perm) => perms.includes(perm)), allPerms[0] || []);
  const createPerms = sortUnique(allPerms.flatMap((perms) => byAction(perms, ["create"])));
  const extensions = sources.some((bucket) => !(bucket.allowedFileExtensions || []).length)
    ? []
    : sortUnique(sources.flatMap((bucket) => bucket.allowedFileExtensions || []));
  const compressions = sortUnique(sources.map((bucket) => bucket.compression || "none"));

  const settings = {
    name: "Media",
    permissions: identical ? sortUnique(allPerms[0] || []) : sortUnique([...byAction(intersection, FILE_ACTIONS), ...createPerms]),
    fileSecurity: !identical,
    enabled: true,
    maximumFileSize: Math.max(...sources.map((bucket) => Number(bucket.maximumFileSize || 0))),
    allowedFileExtensions: extensions,
    compression: compressions.length === 1 ? compressions[0] : "none",
    encryption: sources.some((bucket) => bucket.encryption),
    antivirus: sources.some((bucket) => bucket.antivirus)
  };
  if (sources.some((bucket) => typeof bucket.transformations === "boolean")) {
    settings.transformations = sources.some((bucket) => bucket.transformations !== false);
  }
  return { identical, settings };
}

// Effective permissions a copied file must carry so nobody gains or loses access.
function desiredFilePermissions(sourceBucket, file, plan) {
  if (plan.identical) return [];
  const baseline = new Set(plan.settings.permissions);
  const fromBucket = byAction(sourceBucket.$permissions || [], FILE_ACTIONS).filter((perm) => !baseline.has(perm));
  const fromFile = sourceBucket.fileSecurity ? byAction(file.$permissions || [], FILE_ACTIONS) : [];
  return sortUnique([...fromBucket, ...fromFile]);
}

async function ensureTargetBucket(plan) {
  const existing = await tryRequest(`/storage/buckets/${encodeURIComponent(TARGET)}`);
  if (existing) {
    console.log(`Target bucket "${TARGET}" exists.`);
    for (const key of ["fileSecurity", "maximumFileSize", "compression", "encryption", "antivirus"]) {
      if (existing[key] !== plan.settings[key]) warn(`Target bucket ${key} is ${JSON.stringify(existing[key])}, planned ${JSON.stringify(plan.settings[key])} (left unchanged).`);
    }
    if (!sameSet(existing.$permissions || [], plan.settings.permissions)) {
      warn(`Target bucket permissions ${JSON.stringify(existing.$permissions)} differ from planned ${JSON.stringify(plan.settings.permissions)} (left unchanged).`);
    }
    return existing;
  }
  if (DRY_RUN) {
    console.log(`[dry-run] Would create bucket "${TARGET}": ${JSON.stringify(plan.settings)}`);
    return { $id: TARGET, ...plan.settings, $permissions: plan.settings.permissions, simulated: true };
  }
  const created = await request(`/storage/buckets`, { method: "POST", body: { bucketId: TARGET, ...plan.settings } });
  console.log(`Created bucket "${TARGET}".`);
  return created;
}

async function uploadFile(bucketId, file, bytes, permissions) {
  const total = bytes.length;
  let result = null;
  for (let start = 0; start < total || (total === 0 && start === 0); start += CHUNK) {
    const end = Math.min(start + CHUNK, total);
    const form = new FormData();
    form.set("fileId", file.$id);
    permissions.forEach((perm) => form.append("permissions[]", perm));
    form.set("file", new Blob([bytes.subarray(start, end)], { type: file.mimeType || "application/octet-stream" }), file.name || file.$id);
    const headers = total > CHUNK ? { "Content-Range": `bytes ${start}-${Math.max(end - 1, 0)}/${total}` } : {};
    if (start > 0) headers["x-appwrite-id"] = file.$id;
    result = await request(`/storage/buckets/${encodeURIComponent(bucketId)}/files`, { method: "POST", body: form, headers });
    if (total === 0) break;
  }
  return result;
}

async function copyFiles(sources, plan, target) {
  const targetFiles = target.simulated ? [] : await listAll(`/storage/buckets/${encodeURIComponent(TARGET)}/files`, "files");
  const targetById = new Map(targetFiles.map((file) => [file.$id, file]));

  for (const bucket of sources) {
    console.log(`\nBucket ${bucket.$id}: ${bucket.files.length} file(s)`);
    for (const file of bucket.files) {
      const permissions = desiredFilePermissions(bucket, file, plan);
      const entry = { source: bucket.$id, fileId: file.$id, name: file.name, size: file.sizeOriginal, permissions, action: "" };
      const existing = targetById.get(file.$id);
      try {
        if (existing) {
          if (Number(existing.sizeOriginal) !== Number(file.sizeOriginal)) {
            entry.action = "conflict";
            warn(`${file.$id}: already in "${TARGET}" with a different size (${existing.sizeOriginal} vs ${file.sizeOriginal}) - left alone.`);
          } else if (!plan.identical && !sameSet(existing.$permissions || [], permissions)) {
            entry.action = DRY_RUN ? "would-fix-permissions" : "fixed-permissions";
            if (!DRY_RUN) {
              await request(`/storage/buckets/${encodeURIComponent(TARGET)}/files/${encodeURIComponent(file.$id)}`, { method: "PUT", body: { permissions } });
            }
          } else {
            entry.action = "already-copied";
          }
        } else if (DRY_RUN) {
          entry.action = "would-copy";
        } else {
          const response = await request(`/storage/buckets/${encodeURIComponent(bucket.$id)}/files/${encodeURIComponent(file.$id)}/download`, { raw: true });
          const bytes = new Uint8Array(await response.arrayBuffer());
          if (bytes.length !== Number(file.sizeOriginal)) {
            throw new Error(`downloaded ${bytes.length} bytes, expected ${file.sizeOriginal}`);
          }
          const uploaded = await uploadFile(TARGET, file, bytes, permissions);
          if (Number(uploaded?.sizeOriginal) !== bytes.length) throw new Error(`uploaded size ${uploaded?.sizeOriginal} != ${bytes.length}`);
          entry.action = "copied";
        }
      } catch (error) {
        entry.action = "error";
        entry.error = error.message;
        report.errors.push(`${bucket.$id}/${file.$id}: ${error.message}`);
      }
      report.files.push(entry);
      console.log(`  ${entry.action.padEnd(22)} ${file.$id} (${formatBytes(file.sizeOriginal)})${entry.error ? ` - ${entry.error}` : ""}`);
    }
  }
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function rewriteRows(sourceIds) {
  const source = `/storage/buckets/(${sourceIds.map(escapeRegExp).join("|")})/files/`;
  const urlPattern = new RegExp(source, "g");
  const hasOldUrl = new RegExp(source);
  const replacement = `/storage/buckets/${TARGET}/files/`;
  const collections = await listAll(`/databases/${DATABASE_ID}/collections`, "collections");
  console.log(`\nScanning ${collections.length} table(s) for stored file URLs (skipping ${[...SKIP_TABLES].join(", ") || "none"})`);

  for (const collection of collections) {
    if (SKIP_TABLES.has(collection.$id)) continue;
    const documents = await listAll(`/databases/${DATABASE_ID}/collections/${encodeURIComponent(collection.$id)}/documents`, "documents");
    let changedRows = 0;
    for (const document of documents) {
      const patch = {};
      for (const [key, value] of Object.entries(document)) {
        if (key.startsWith("$")) continue;
        if (typeof value === "string") {
          if (hasOldUrl.test(value)) patch[key] = value.replace(urlPattern, replacement);
          if (sourceIds.includes(value.trim()) && /bucket/i.test(key)) {
            warn(`${collection.$id}/${document.$id}.${key} stores a bucket id ("${value}") - not changed, check it.`);
          }
        } else if (Array.isArray(value) && value.some((item) => typeof item === "string" && hasOldUrl.test(item))) {
          patch[key] = value.map((item) => (typeof item === "string" ? item.replace(urlPattern, replacement) : item));
        }
      }
      if (!Object.keys(patch).length) continue;
      changedRows += 1;
      const entry = { table: collection.$id, rowId: document.$id, fields: Object.keys(patch), action: DRY_RUN ? "would-update" : "updated" };
      try {
        if (!DRY_RUN) {
          await request(`/databases/${DATABASE_ID}/collections/${encodeURIComponent(collection.$id)}/documents/${encodeURIComponent(document.$id)}`, { method: "PATCH", body: { data: patch } });
        }
      } catch (error) {
        entry.action = "error";
        entry.error = error.message;
        report.errors.push(`${collection.$id}/${document.$id}: ${error.message}`);
      }
      report.rows.push(entry);
      console.log(`  ${entry.action.padEnd(13)} ${collection.$id}/${document.$id} [${entry.fields.join(", ")}]${entry.error ? ` - ${entry.error}` : ""}`);
    }
    console.log(`  ${collection.$id}: ${documents.length} row(s) scanned, ${changedRows} with old bucket URLs`);
  }
}

function permissionsSnippet(sources, plan) {
  if (plan.identical) return null;
  const snippet = {};
  for (const bucket of sources) {
    const category = UPLOAD_CATEGORY[bucket.$id];
    if (!category) continue;
    // Old buckets with file security gave the uploader read/update/delete on their own file
    // automatically; with explicit permissions that has to be spelled out ({currentUser} is
    // replaced by the signed-in user's id in the frontend).
    const own = bucket.fileSecurity ? ["read", "update", "delete"].map((action) => `${action}("user:{currentUser}")`) : [];
    snippet[category] = sortUnique([...byAction(bucket.$permissions || [], FILE_ACTIONS), ...own]);
  }
  return snippet;
}

async function main() {
  console.log(`${DRY_RUN ? "[dry-run] " : ""}Storage migration -> "${TARGET}"`);
  const sources = await loadSources();
  if (!sources.length) throw new Error("No source buckets found.");

  for (const bucket of sources) {
    const bytes = bucket.files.reduce((sum, file) => sum + Number(file.sizeOriginal || 0), 0);
    console.log(`  ${bucket.$id.padEnd(16)} files=${String(bucket.files.length).padEnd(4)} size=${formatBytes(bytes).padEnd(9)} fileSecurity=${bucket.fileSecurity} permissions=${JSON.stringify(bucket.$permissions)}`);
  }

  // File ids must be unique across all source buckets, because they are kept.
  const owners = new Map();
  for (const bucket of sources) {
    for (const file of bucket.files) {
      if (!owners.has(file.$id)) owners.set(file.$id, []);
      owners.get(file.$id).push(bucket.$id);
    }
  }
  const collisions = [...owners.entries()].filter(([, list]) => list.length > 1);
  if (collisions.length) {
    collisions.forEach(([id, list]) => report.errors.push(`File id "${id}" exists in ${list.join(" and ")}`));
    throw new Error(`File id collision(s), nothing copied:\n${report.errors.join("\n")}`);
  }

  const plan = planBucket(sources);
  report.mode = plan.identical ? "bucket-permissions" : "file-security";
  report.bucket = plan.settings;
  console.log(`\nPermission mode: ${plan.identical
    ? "all old buckets share the same permissions -> bucket-level permissions, file security off"
    : "old buckets differ -> file security on, every file carries its old effective permissions"}`);

  const target = await ensureTargetBucket(plan);
  await copyFiles(sources, plan, target);
  if (!hasFlag("no-db")) await rewriteRows(sources.map((bucket) => bucket.$id));

  report.storageFilePermissions = permissionsSnippet(sources, plan);
  const count = (list, action) => list.filter((entry) => entry.action === action).length;
  console.log("\n================ REPORT ================");
  console.log(`Files: ${report.files.length} total, copied ${count(report.files, "copied")}, would copy ${count(report.files, "would-copy")}, already there ${count(report.files, "already-copied")}, permissions fixed ${count(report.files, "fixed-permissions") + count(report.files, "would-fix-permissions")}, conflicts ${count(report.files, "conflict")}, errors ${count(report.files, "error")}`);
  console.log(`Rows:  ${DRY_RUN ? "would update" : "updated"} ${count(report.rows, DRY_RUN ? "would-update" : "updated")}, errors ${count(report.rows, "error")}`);
  console.log(`\nsrc/appwrite-config.js -> CLUBHUB_FREE_PLAN_SETUP.storageFilePermissions:`);
  console.log(`  storageFilePermissions: ${JSON.stringify(report.storageFilePermissions, null, 2).replace(/\n/g, "\n  ")},`);
  if (report.warnings.length) console.log(`\nWarnings (${report.warnings.length}):\n  - ${report.warnings.join("\n  - ")}`);
  if (report.errors.length) console.log(`\nErrors (${report.errors.length}):\n  - ${report.errors.join("\n  - ")}`);
  console.log(`\nReport saved: ${writeReport(DRY_RUN ? "storage-migration-dry-run" : "storage-migration", report)}`);
  console.log("Nothing was deleted. Old buckets stay until you remove them by hand.");
  if (report.errors.length) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof AppwriteError || error instanceof Error ? error.message : error);
  try { writeReport("storage-migration-failed", report); } catch { /* ignore */ }
  process.exit(1);
});
