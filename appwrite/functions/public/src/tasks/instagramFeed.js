// Instagram feed for the public "Socials" page (Instagram API with Instagram Login).
// The access token comes from the function variable INSTAGRAM_ACCESS_TOKEN (long-lived,
// 60 days). The function refreshes it automatically every ~30 days and keeps the newest one in
// the server-only table social_cache, together with a cached copy of the latest posts (1 hour),
// so visitors never hit Instagram's rate limits and no Meta scripts run on the website.
const { appwriteConfig, appwriteRequest } = require("../shared/runtime");

const CACHE_TABLE = String(process.env.APPWRITE_SOCIAL_CACHE_TABLE_ID || "social_cache").trim();
const FEED_TTL_MS = 60 * 60 * 1000;
const TOKEN_REFRESH_MS = 30 * 24 * 60 * 60 * 1000;
const FIELDS = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp";

function rowPath(id) {
  const { databaseId } = appwriteConfig();
  return `/tablesdb/${encodeURIComponent(databaseId)}/tables/${encodeURIComponent(CACHE_TABLE)}/rows/${encodeURIComponent(id)}`;
}

async function readRow(id) {
  const { response, payload } = await appwriteRequest(rowPath(id));
  return response.ok ? payload : null;
}

async function writeRow(id, value) {
  const data = { value: typeof value === "string" ? value : JSON.stringify(value), updated_at: new Date().toISOString() };
  const { response } = await appwriteRequest(rowPath(id), { method: "PUT", body: { data } });
  if (!response.ok) {
    const { databaseId } = appwriteConfig();
    await appwriteRequest(`/tablesdb/${encodeURIComponent(databaseId)}/tables/${encodeURIComponent(CACHE_TABLE)}/rows`, { method: "POST", body: { rowId: id, data } });
  }
}

async function currentToken(log) {
  const envToken = String(process.env.INSTAGRAM_ACCESS_TOKEN || "").trim();
  const stored = await readRow("instagram_token");
  let token = envToken;
  let issuedAt = 0;
  if (stored && stored.value) {
    try {
      const parsed = JSON.parse(stored.value);
      // A newly entered variable wins over an older refreshed token.
      if (parsed.token && (!envToken || parsed.source === envToken.slice(-12))) { token = parsed.token; issuedAt = Date.parse(parsed.issuedAt) || 0; }
    } catch { /* ignore */ }
  }
  if (!token) return "";
  if (Date.now() - issuedAt > TOKEN_REFRESH_MS) {
    try {
      const res = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`);
      const body = await res.json();
      if (res.ok && body.access_token) {
        token = body.access_token;
        await writeRow("instagram_token", { token, issuedAt: new Date().toISOString(), source: envToken.slice(-12) });
      }
    } catch (error) {
      log(`instagramFeed: token refresh failed ${error instanceof Error ? error.message : error}`);
    }
  }
  return token;
}

module.exports = async ({ res, log }) => {
  const cached = await readRow("instagram_feed").catch(() => null);
  let cachedFeed = null;
  try { cachedFeed = cached && cached.value ? JSON.parse(cached.value) : null; } catch { cachedFeed = null; }
  const fresh = cached && Date.now() - (Date.parse(cached.updated_at) || 0) < FEED_TTL_MS;
  if (cachedFeed && fresh) return res.json({ ok: true, cached: true, ...cachedFeed });

  const token = await currentToken(log);
  if (!token) return res.json({ ok: true, configured: false, posts: cachedFeed ? cachedFeed.posts : [] });
  try {
    const response = await fetch(`https://graph.instagram.com/me/media?fields=${FIELDS}&limit=12&access_token=${encodeURIComponent(token)}`);
    const body = await response.json();
    if (!response.ok) throw new Error(body?.error?.message || `HTTP ${response.status}`);
    const posts = (body.data || []).map((p) => ({
      id: String(p.id),
      type: String(p.media_type || ""),
      image: String(p.media_type === "VIDEO" ? p.thumbnail_url || "" : p.media_url || ""),
      url: String(p.permalink || ""),
      caption: String(p.caption || "").slice(0, 300),
      at: String(p.timestamp || "")
    })).filter((p) => p.image && p.url);
    const feed = { configured: true, posts, fetchedAt: new Date().toISOString() };
    await writeRow("instagram_feed", feed);
    return res.json({ ok: true, ...feed });
  } catch (error) {
    log(`instagramFeed: fetch failed ${error instanceof Error ? error.message : error}`);
    return res.json({ ok: true, configured: true, stale: true, posts: cachedFeed ? cachedFeed.posts : [] });
  }
};
