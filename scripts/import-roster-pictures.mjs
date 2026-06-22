const DEFAULT_CLUBEE_URL = "https://clubee.com/acsluniwienemperors/uni-wien-emperors-976457v4/groups/431040/seasons/218";
const ENDPOINT = process.env.APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID || "69dd0fdd00336ea1b4b5";
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || "69dd11140002e2b4254a";
const MEMBERS_COLLECTION_ID = process.env.APPWRITE_MEMBERS_COLLECTION_ID || "members";
const ROSTER_BUCKET_ID = process.env.APPWRITE_ROSTER_BUCKET_ID || "RosterPictures";
const ROSTER_IMAGE_ATTRIBUTE = process.env.APPWRITE_ROSTER_IMAGE_ATTRIBUTE || "rosterImage";
const API_KEY = process.env.APPWRITE_API_KEY || "";
const USER_AGENT = "Mozilla/5.0 (compatible; EmperorsRosterImporter/1.0)";

const args = new Set(process.argv.slice(2));
const rawArgs = process.argv.slice(2);

function npmConfigName(name) {
  return `npm_config_${String(name || "").replace(/^--/, "").replace(/-/g, "_")}`;
}

function hasFlag(name) {
  const envValue = process.env[npmConfigName(name)];
  return args.has(name) || envValue === "true" || envValue === "1";
}

function optionValue(name, fallback = "") {
  const prefix = `${name}=`;
  const match = rawArgs.find((arg) => arg.startsWith(prefix));
  if (match) return match.slice(prefix.length);
  const envValue = process.env[npmConfigName(name)];
  return envValue === undefined ? fallback : envValue;
}

const clubeeUrl = optionValue("--clubee-url", process.env.CLUBEE_ROSTER_URL || DEFAULT_CLUBEE_URL);
const dryRun = !hasFlag("--apply");
const extractOnly = hasFlag("--extract-only");
const force = hasFlag("--force");
const publicFiles = optionValue("--public-files", "true") !== "false";
const limit = Number(optionValue("--limit", "0")) || 0;

function appwriteUrl(pathname) {
  return `${ENDPOINT.replace(/\/$/, "")}${pathname}`;
}

async function appwriteRequest(pathname, { method = "GET", body, form = false, tolerateStatus = [] } = {}) {
  const headers = {
    "X-Appwrite-Project": PROJECT_ID,
    "X-Appwrite-Key": API_KEY
  };
  if (!form) headers["Content-Type"] = "application/json";

  const response = await fetch(appwriteUrl(pathname), {
    method,
    headers,
    body: form ? body : (body ? JSON.stringify(body) : undefined)
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok && !tolerateStatus.includes(response.status)) {
    throw new Error(payload?.message || payload?.type || `Appwrite request failed (${response.status}).`);
  }
  return { response, payload };
}

function decodeHtmlJsonString(value) {
  const raw = String(value || "");
  try {
    return JSON.parse(`"${raw.replace(/"/g, '\\"')}"`);
  } catch {
    return raw
      .replace(/\\u([0-9a-f]{4})/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
      .replace(/\\"/g, "\"")
      .replace(/\\\//g, "/")
      .replace(/\\\\/g, "\\");
  }
}

function extractField(rest, field) {
  const escapedField = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = rest.match(new RegExp(`"${escapedField}":"((?:\\\\.|[^"])*)"`, "i"));
  return match ? decodeHtmlJsonString(match[1]) : "";
}

function extractNumberField(rest, field) {
  const escapedField = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = rest.match(new RegExp(`"${escapedField}":(\\d+)`, "i"));
  return match ? Number(match[1]) : null;
}

async function fetchClubeePlayers(url) {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) {
    throw new Error(`Clubee roster fetch failed (${response.status}).`);
  }
  const html = await response.text();
  const normalizedHtml = html
    .replace(/\\"/g, "\"")
    .replace(/\\\//g, "/")
    .replace(/\\u0026/g, "&");
  const recordRegex = /\{"id":(\d+),"firstname":"((?:\\.|[^"])*)","lastname":"((?:\\.|[^"])*)"(?<rest>.*?)(?=\},\{"id":\d+,"firstname"|\}\]|\}\},|\}\}\])/gs;
  const byId = new Map();

  for (const match of normalizedHtml.matchAll(recordRegex)) {
    const clubeeId = String(match[1] || "").trim();
    const rest = String(match.groups?.rest || "");
    const firstName = decodeHtmlJsonString(match[2]).trim();
    const lastName = decodeHtmlJsonString(match[3]).trim();
    const imageUrl = extractField(rest, "pic_roster") || extractField(rest, "picture");
    if (!clubeeId || !firstName || !lastName || !imageUrl) continue;
    byId.set(clubeeId, {
      clubeeId,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`.replace(/\s+/g, " ").trim(),
      jerseyNumber: extractNumberField(rest, "jersey_number"),
      imageUrl
    });
  }

  return Array.from(byId.values()).sort((left, right) => {
    const leftNumber = left.jerseyNumber ?? 999;
    const rightNumber = right.jerseyNumber ?? 999;
    if (leftNumber !== rightNumber) return leftNumber - rightNumber;
    return left.name.localeCompare(right.name, "de-AT", { sensitivity: "base" });
  });
}

async function fetchMembers() {
  const { payload } = await appwriteRequest(
    `/databases/${DATABASE_ID}/collections/${MEMBERS_COLLECTION_ID}/documents?limit=5000`
  );
  return Array.isArray(payload?.documents) ? payload.documents : [];
}

function rowValue(row, ...keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row || {}, key)) return row[key];
  }
  return undefined;
}

function normalizeNameToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function namePartsForMember(member) {
  const firstName = String(rowValue(member, "first_name", "firstName") || "").trim();
  const lastName = String(rowValue(member, "last_name", "lastName") || "").trim();
  const displayName = String(rowValue(member, "displayName", "display_name", "name") || "").trim();
  const fullName = `${firstName} ${lastName}`.trim() || displayName;
  const tokens = normalizeNameToken(fullName).split(" ").filter(Boolean);
  return {
    first: normalizeNameToken(firstName || tokens.slice(0, -1).join(" ")),
    last: normalizeNameToken(lastName || tokens.slice(-1).join(" ")),
    full: normalizeNameToken(fullName),
    tokens
  };
}

function scoreMatch(player, member) {
  const memberName = namePartsForMember(member);
  const playerFirst = normalizeNameToken(player.firstName);
  const playerLast = normalizeNameToken(player.lastName);
  const playerFull = normalizeNameToken(player.name);
  const playerTokens = playerFull.split(" ").filter(Boolean);
  const memberJerseyRaw = rowValue(member, "jerseyNumber", "jersey_number");
  const memberJersey = memberJerseyRaw === null || memberJerseyRaw === undefined || memberJerseyRaw === "" ? null : Number(memberJerseyRaw);

  let score = 0;
  if (memberName.full && memberName.full === playerFull) score += 70;
  if (memberName.first && memberName.first === playerFirst) score += 18;
  if (memberName.last && memberName.last === playerLast) score += 28;
  if (memberName.last && playerLast && (memberName.last.includes(playerLast) || playerLast.includes(memberName.last))) score += 10;
  if (memberName.first && playerFirst && (memberName.first.includes(playerFirst) || playerFirst.includes(memberName.first))) score += 6;

  const memberTokenSet = new Set(memberName.tokens);
  for (const token of playerTokens) {
    if (memberTokenSet.has(token)) score += 5;
  }

  if (Number.isFinite(memberJersey) && Number.isFinite(player.jerseyNumber)) {
    if (memberJersey === player.jerseyNumber) score += 18;
    else score -= 12;
  }

  return score;
}

function matchPlayers(players, members) {
  const matches = [];
  const ambiguous = [];
  const unmatched = [];
  const usedMemberIds = new Set();

  for (const player of players) {
    const candidates = members
      .map((member) => ({ member, score: scoreMatch(player, member) }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score);
    const best = candidates[0];
    const second = candidates[1];
    const bestId = String(best?.member?.$id || best?.member?.id || "");
    const strongEnough = best && best.score >= 35 && (!second || best.score - second.score >= 8);

    if (strongEnough && !usedMemberIds.has(bestId)) {
      usedMemberIds.add(bestId);
      matches.push({ player, member: best.member, score: best.score });
    } else if (best) {
      ambiguous.push({ player, candidates: candidates.slice(0, 3) });
    } else {
      unmatched.push(player);
    }
  }

  return { matches, ambiguous, unmatched };
}

function safeFileId(player) {
  const base = `rp_${player.clubeeId || player.name}`;
  return base
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 36) || `rp_${Date.now()}`.slice(0, 36);
}

function filenameForImage(player, contentType) {
  const urlPath = new URL(player.imageUrl).pathname;
  const extensionFromUrl = urlPath.match(/\.(jpg|jpeg|png|webp)$/i)?.[0] || "";
  const extensionFromType = contentType.includes("png") ? ".png" : contentType.includes("webp") ? ".webp" : ".jpg";
  const extension = extensionFromUrl || extensionFromType;
  return `${safeFileId(player)}${extension}`;
}

async function fileExists(fileId) {
  const { response } = await appwriteRequest(
    `/storage/buckets/${encodeURIComponent(ROSTER_BUCKET_ID)}/files/${encodeURIComponent(fileId)}`,
    { tolerateStatus: [404] }
  );
  return response.status !== 404;
}

async function deleteFile(fileId) {
  await appwriteRequest(
    `/storage/buckets/${encodeURIComponent(ROSTER_BUCKET_ID)}/files/${encodeURIComponent(fileId)}`,
    { method: "DELETE", tolerateStatus: [404] }
  );
}

async function uploadRosterImage(player, fileId) {
  const response = await fetch(player.imageUrl, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) {
    throw new Error(`Image fetch failed for ${player.name} (${response.status}).`);
  }
  const contentType = response.headers.get("content-type") || "image/jpeg";
  const bytes = await response.arrayBuffer();
  const makeForm = (includePermissions) => {
    const form = new FormData();
    form.append("fileId", fileId);
    form.append("file", new Blob([bytes], { type: contentType }), filenameForImage(player, contentType));
    if (includePermissions) {
      form.append("permissions[]", 'read("any")');
    }
    return form;
  };

  try {
    await appwriteRequest(`/storage/buckets/${encodeURIComponent(ROSTER_BUCKET_ID)}/files`, {
      method: "POST",
      body: makeForm(publicFiles),
      form: true
    });
  } catch (error) {
    if (!publicFiles || !/permission|permissions|unknown/i.test(String(error?.message || ""))) {
      throw error;
    }
    await appwriteRequest(`/storage/buckets/${encodeURIComponent(ROSTER_BUCKET_ID)}/files`, {
      method: "POST",
      body: makeForm(false),
      form: true
    });
  }
}

async function updateMemberRosterImage(member, fileId) {
  const memberId = String(member.$id || member.id || "").trim();
  await appwriteRequest(
    `/databases/${DATABASE_ID}/collections/${MEMBERS_COLLECTION_ID}/documents/${encodeURIComponent(memberId)}`,
    {
      method: "PATCH",
      body: {
        data: {
          [ROSTER_IMAGE_ATTRIBUTE]: fileId
        }
      }
    }
  );
}

function memberLabel(member) {
  const parts = namePartsForMember(member);
  const jersey = rowValue(member, "jerseyNumber", "jersey_number");
  return `${parts.full || String(member.displayName || member.display_name || member.$id || "")}${jersey ? ` #${jersey}` : ""}`;
}

function printExtractOnly(players) {
  console.log(`Extracted ${players.length} Clubee roster players with images.`);
  for (const player of players.slice(0, limit || players.length)) {
    console.log(`${player.jerseyNumber ?? "-"}\t${player.name}\t${player.imageUrl}`);
  }
}

async function main() {
  const players = await fetchClubeePlayers(clubeeUrl);
  if (extractOnly) {
    printExtractOnly(players);
    return;
  }

  if (!API_KEY) {
    throw new Error("APPWRITE_API_KEY is missing. Use --extract-only to inspect Clubee data without Appwrite writes.");
  }

  const members = await fetchMembers();
  const playerRows = limit ? players.slice(0, limit) : players;
  const result = matchPlayers(playerRows, members);

  console.log(`Clubee players with images: ${players.length}`);
  console.log(`Appwrite members: ${members.length}`);
  console.log(`Auto matches: ${result.matches.length}`);
  console.log(`Ambiguous: ${result.ambiguous.length}`);
  console.log(`Unmatched: ${result.unmatched.length}`);
  console.log(dryRun ? "Mode: dry run. Add --apply to upload and update Appwrite." : "Mode: apply.");

  for (const { player, member, score } of result.matches) {
    const fileId = safeFileId(player);
    console.log(`MATCH score=${score} ${player.name} #${player.jerseyNumber ?? "-"} -> ${memberLabel(member)} :: ${fileId}`);
    if (dryRun) continue;
    if (force && await fileExists(fileId)) {
      await deleteFile(fileId);
    }
    if (!await fileExists(fileId)) {
      await uploadRosterImage(player, fileId);
    }
    await updateMemberRosterImage(member, fileId);
  }

  if (result.ambiguous.length) {
    console.log("\nAmbiguous matches:");
    for (const entry of result.ambiguous.slice(0, 30)) {
      console.log(`- ${entry.player.name} #${entry.player.jerseyNumber ?? "-"} -> ${entry.candidates.map((candidate) => `${memberLabel(candidate.member)} (${candidate.score})`).join("; ")}`);
    }
  }

  if (result.unmatched.length) {
    console.log("\nUnmatched Clubee players:");
    for (const player of result.unmatched.slice(0, 30)) {
      console.log(`- ${player.name} #${player.jerseyNumber ?? "-"} ${player.imageUrl}`);
    }
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
