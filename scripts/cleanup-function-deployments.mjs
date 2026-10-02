// Deletes old, inactive function deployments to free storage. Dry run unless --apply.
// The active deployment of every function is always kept, as are builds still in progress.
//
//   node scripts/cleanup-function-deployments.mjs                    -> list what would be deleted
//   node scripts/cleanup-function-deployments.mjs --apply            -> delete
//   options: --function=emperors-admin (only this function)   --keep=2 (also keep the 2 newest inactive ones)
import { request, listAll, hasFlag, option, requireApiKey, formatBytes } from "./lib/appwrite-admin.mjs";

requireApiKey();
const APPLY = hasFlag("apply");
const ONLY = option("function", "");
const KEEP = Math.max(0, Number(option("keep", "0")) || 0);
const BUSY = new Set(["waiting", "processing", "building"]);

const sizeOf = (deployment) => Number(deployment.totalSize ?? (Number(deployment.sourceSize || deployment.size || 0) + Number(deployment.buildSize || 0)));

async function main() {
  const functions = (await listAll(`/functions`, "functions")).filter((fn) => !ONLY || fn.$id === ONLY);
  let totalCount = 0;
  let totalBytes = 0;
  for (const fn of functions) {
    const activeId = String(fn.deploymentId || fn.deployment || "");
    const deployments = (await listAll(`/functions/${encodeURIComponent(fn.$id)}/deployments`, "deployments"))
      .sort((a, b) => String(b.$createdAt).localeCompare(String(a.$createdAt)));
    const inactive = deployments.filter((deployment) => deployment.$id !== activeId && !BUSY.has(String(deployment.status)));
    const toDelete = inactive.slice(KEEP);
    const bytes = toDelete.reduce((sum, deployment) => sum + sizeOf(deployment), 0);
    console.log(`\n${fn.$id}: ${deployments.length} deployment(s), active ${activeId || "(none)"}, ${toDelete.length} to delete (${formatBytes(bytes)})`);
    for (const deployment of toDelete) {
      const line = `  ${APPLY ? "delete" : "would delete"} ${deployment.$id}  ${deployment.$createdAt}  ${deployment.status}  ${formatBytes(sizeOf(deployment))}`;
      if (!APPLY) {
        console.log(line);
        continue;
      }
      try {
        await request(`/functions/${encodeURIComponent(fn.$id)}/deployments/${encodeURIComponent(deployment.$id)}`, { method: "DELETE" });
        console.log(line);
      } catch (error) {
        console.log(`${line}  FAILED: ${error.message}`);
      }
    }
    totalCount += toDelete.length;
    totalBytes += bytes;
  }
  console.log(`\n${APPLY ? "Deleted" : "Would delete"} ${totalCount} deployment(s), about ${formatBytes(totalBytes)}.`);
  if (!APPLY) console.log("Dry run - nothing deleted. Re-run with --apply to delete.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
