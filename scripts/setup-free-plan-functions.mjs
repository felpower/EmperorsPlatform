// Free-plan migration, step "functions": creates emperors-public and emperors-admin next to
// the six old functions and copies their settings + env variables. Never changes or deletes
// the old functions, never overwrites anything that already exists on the new ones.
//
//   node scripts/setup-free-plan-functions.mjs --dry-run
//   node scripts/setup-free-plan-functions.mjs
import { request, tryRequest, listAll, hasFlag, requireApiKey, writeReport, AppwriteError } from "./lib/appwrite-admin.mjs";

requireApiKey();
const DRY_RUN = hasFlag("dry-run");

const TARGETS = [
  {
    $id: "emperors-public",
    name: "Emperors Public",
    execute: ["any"],
    root: "appwrite/functions/public",
    sources: ["ContactEmail", "69fe0260003aa6db005b"],
    // scopes needed by the dynamic key (only used if APPWRITE_API_KEY is not set as variable)
    wantedScopes: ["users.read", "users.write", "rows.write", "documents.write"]
  },
  {
    $id: "emperors-admin",
    name: "Emperors Admin",
    execute: ["users"],
    root: "appwrite/functions/admin",
    sources: ["CreateAuthAccount", "PassSyncFunction", "SepaExport", "TryoutEmail"],
    wantedScopes: ["users.read", "users.write", "rows.read", "rows.write", "documents.read", "documents.write"]
  }
];

// New variables (all optional, sensible defaults in code).
const NEW_VARIABLES = {
  "emperors-public": {
    AUTH_EMAIL_MODE: "mailgun",
    PUBLIC_SITE_URL: "https://emperors.page/recovery",
    RESET_LINK_TTL_SECONDS: "3600"
  },
  "emperors-admin": {
    AUTH_EMAIL_MODE: "mailgun",
    PUBLIC_SITE_URL: "https://emperors.page/recovery",
    INVITE_LINK_TTL_SECONDS: "259200"
  }
};

const report = { dryRun: DRY_RUN, functions: [], manualSteps: [] };
const manual = (text) => report.manualSteps.push(text);

const runtimeRank = (runtime) => Number(String(runtime || "").replace(/^\D+/, "").split(".")[0]) || 0;

async function loadSource(id) {
  const fn = await tryRequest(`/functions/${encodeURIComponent(id)}`);
  if (!fn) return null;
  const variables = (await request(`/functions/${encodeURIComponent(id)}/variables`)).variables || [];
  return { fn, variables };
}

function mergeVariables(sources, targetId) {
  const merged = new Map();
  const conflicts = [];
  for (const { fn, variables } of sources) {
    for (const variable of variables) {
      const current = merged.get(variable.key);
      const value = variable.secret ? "" : String(variable.value ?? "");
      if (!current) {
        merged.set(variable.key, { key: variable.key, value, secret: Boolean(variable.secret), from: [fn.$id] });
        continue;
      }
      current.from.push(fn.$id);
      current.secret = current.secret || Boolean(variable.secret);
      if (!variable.secret && current.value && value && current.value !== value) {
        conflicts.push(`${variable.key}: "${current.value}" (${current.from[0]}) vs "${value}" (${fn.$id}) - kept the first`);
      } else if (!current.value && value) {
        current.value = value;
      }
    }
  }
  // New values win: e.g. the old PUBLIC_SITE_URL still points at felpower.github.io, which the
  // new link check (AUTH_LINK_ALLOWED_HOSTS) does not accept.
  for (const [key, value] of Object.entries(NEW_VARIABLES[targetId] || {})) {
    merged.set(key, { key, value, secret: false, from: ["new"] });
  }
  return { merged: [...merged.values()], conflicts };
}

function buildFunctionBody(target, sources, anyVcsSource) {
  const fns = sources.map((source) => source.fn);
  const runtime = fns.map((fn) => fn.runtime).sort((a, b) => runtimeRank(b) - runtimeRank(a))[0] || "node-22";
  // Same repository for every function: fall back to any old function connected to Git.
  const connected = fns.filter((fn) => fn.installationId && fn.providerRepositoryId);
  const vcsSource = connected.find((fn) => fn.providerBranch === "main") || connected[0] || anyVcsSource;
  const events = [...new Set(fns.flatMap((fn) => fn.events || []))];
  const schedules = [...new Set(fns.map((fn) => fn.schedule).filter(Boolean))];
  const scopes = [...new Set(fns.flatMap((fn) => fn.scopes || []))];

  const body = {
    functionId: target.$id,
    name: target.name,
    runtime,
    execute: target.execute,
    events,
    schedule: schedules.length === 1 ? schedules[0] : "",
    timeout: Math.max(15, ...fns.map((fn) => Number(fn.timeout || 0))),
    enabled: true,
    logging: true,
    entrypoint: "src/main.js",
    commands: "npm install --omit=dev",
    scopes
  };
  if (vcsSource) {
    Object.assign(body, {
      installationId: vcsSource.installationId,
      providerRepositoryId: vcsSource.providerRepositoryId,
      providerBranch: "main",
      providerSilentMode: Boolean(vcsSource.providerSilentMode),
      providerRootDirectory: target.root,
      // Git "build triggers": only deploy when this folder changes.
      providerPaths: [`${target.root}/**`]
    });
  }
  return { body, schedules, events, vcsSource, missingScopes: target.wantedScopes.filter((scope) => !scopes.includes(scope)) };
}

async function createFunction(body) {
  try {
    return await request(`/functions`, { method: "POST", body });
  } catch (error) {
    if (body.providerPaths && error instanceof AppwriteError && error.status === 400 && /providerPaths|param/i.test(error.message)) {
      const { providerPaths, ...rest } = body;
      const created = await request(`/functions`, { method: "POST", body: rest });
      created._providerPathsSkipped = providerPaths;
      return created;
    }
    throw error;
  }
}

async function main() {
  console.log(`${DRY_RUN ? "[dry-run] " : ""}Setting up the two Free-plan functions`);
  const allFunctions = await listAll(`/functions`, "functions");
  const existingIds = new Set(allFunctions.map((fn) => fn.$id));
  const anyVcsSource = allFunctions.find((fn) => fn.installationId && fn.providerRepositoryId && !TARGETS.some((target) => target.$id === fn.$id));

  for (const target of TARGETS) {
    console.log(`\n=== ${target.$id} (execute: ${target.execute.join(", ")}) ===`);
    const sources = (await Promise.all(target.sources.map(loadSource))).filter(Boolean);
    const missing = target.sources.filter((id) => !sources.some((source) => source.fn.$id === id));
    if (missing.length) console.log(`  ! old function(s) not found: ${missing.join(", ")}`);
    sources.forEach(({ fn }) => console.log(`  source ${fn.$id.padEnd(22)} runtime=${fn.runtime} timeout=${fn.timeout}s execute=${JSON.stringify(fn.execute)} events=${JSON.stringify(fn.events || [])} schedule="${fn.schedule || ""}" git=${fn.installationId ? `${fn.providerBranch} /${fn.providerRootDirectory || ""}` : "no"}`));

    const plan = buildFunctionBody(target, sources, anyVcsSource);
    const { merged, conflicts } = mergeVariables(sources, target.$id);
    const entry = { id: target.$id, settings: plan.body, variables: merged.map(({ key, secret, from }) => ({ key, secret, from })), conflicts, actions: [] };
    report.functions.push(entry);

    if (plan.events.length) console.log(`  events carried over: ${plan.events.join(", ")} (the router must know the task for these - check!)`);
    if (plan.schedules.length > 1) manual(`${target.$id}: old functions had several schedules (${plan.schedules.join(" | ")}) - only one is possible per function, decide by hand.`);
    if (plan.missingScopes.length) manual(`${target.$id}: if you rely on the dynamic API key instead of APPWRITE_API_KEY, add scopes: ${plan.missingScopes.join(", ")}`);
    conflicts.forEach((conflict) => manual(`${target.$id}: variable conflict ${conflict}`));
    if (!plan.vcsSource) manual(`${target.$id}: no old function was connected to Git - connect it in Console > Functions > ${target.$id} > Settings > Git (root ${target.root}, path filter ${target.root}/**), or deploy with: appwrite push functions --function-id ${target.$id}`);

    if (existingIds.has(target.$id)) {
      console.log(`  function exists - settings left unchanged`);
      entry.actions.push("exists");
    } else if (DRY_RUN) {
      console.log(`  [dry-run] would create: ${JSON.stringify(plan.body)}`);
      entry.actions.push("would-create");
    } else {
      const created = await createFunction(plan.body);
      console.log(`  created function ${created.$id}`);
      entry.actions.push("created");
      if (created._providerPathsSkipped) {
        manual(`${target.$id}: the API did not accept the Git path filter - set it in Console > Functions > ${target.$id} > Settings > Configuration > Git settings: ${created._providerPathsSkipped.join(", ")}`);
      }
    }

    const targetVariables = existingIds.has(target.$id) || !DRY_RUN
      ? ((await tryRequest(`/functions/${encodeURIComponent(target.$id)}/variables`))?.variables || [])
      : [];
    const targetKeys = new Set(targetVariables.map((variable) => variable.key));
    for (const variable of merged) {
      if (targetKeys.has(variable.key)) {
        console.log(`  var ${variable.key.padEnd(34)} exists`);
        continue;
      }
      if (variable.secret || !variable.value) {
        console.log(`  var ${variable.key.padEnd(34)} SET BY HAND (${variable.secret ? "secret" : "empty"} in ${variable.from.join(", ")})`);
        manual(`${target.$id}: set variable ${variable.key}${variable.secret ? " (secret)" : ""} - value from ${variable.from.join(", ")}`);
        continue;
      }
      if (DRY_RUN) {
        console.log(`  var ${variable.key.padEnd(34)} would copy (from ${variable.from.join(", ")})`);
        continue;
      }
      await request(`/functions/${encodeURIComponent(target.$id)}/variables`, { method: "POST", body: { key: variable.key, value: variable.value, secret: false } });
      console.log(`  var ${variable.key.padEnd(34)} copied (from ${variable.from.join(", ")})`);
    }
  }

  manual("Deploy both functions once (Console > function > Deployments > Create deployment from Git, or push a commit touching their folders) and check the build log.");
  console.log(`\n================ MANUAL STEPS ================\n- ${report.manualSteps.join("\n- ")}`);
  console.log(`\nReport saved: ${writeReport(DRY_RUN ? "functions-setup-dry-run" : "functions-setup", report)}`);
  console.log("Old functions were not changed or deleted.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
