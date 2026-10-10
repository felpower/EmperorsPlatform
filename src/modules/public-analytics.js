(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CLUBHUB_MODULES = root.CLUBHUB_MODULES || {}; root.CLUBHUB_MODULES.publicAnalytics = api; }
})(typeof window !== "undefined" ? window : globalThis, function () {
  const paths = new Set(["/", "/tryout", "/roster", "/hall-of-fame", "/events", "/contact", "/sponsors"]);
  function publicPath(value) {
    const pathname = String(value || "").split(/[?#]/)[0].replace(/\/$/, "") || "/";
    return paths.has(pathname) ? pathname : null;
  }
  function canTrack({ host, choice, loading, signedIn, path, doNotTrack, globalPrivacyControl, recovery }) {
    return ["emperors.page", "www.emperors.page"].includes(host) && choice === "allowed" && !loading && !signedIn && !recovery && doNotTrack !== "1" && doNotTrack !== "yes" && globalPrivacyControl !== true && publicPath(path) !== null;
  }
  function eventFor(value, now = new Date()) {
    const route = publicPath(value);
    if (!route) return null;
    return { loggedAt: now.toISOString(), level: "info", scope: "web-analytics", message: `Page view ${route}`, route, origin: "https://emperors.page" };
  }
  function summarize(rows, now = new Date()) {
    const counts = {};
    let last7 = 0, last30 = 0;
    for (const row of rows) {
      if (row.scope !== "web-analytics") continue;
      const route = publicPath(row.route || String(row.message || "").replace(/^Page view /, ""));
      const time = Date.parse(row.logged_at || row.loggedAt || row.$createdAt || "");
      const age = now.getTime() - time;
      if (!route || !Number.isFinite(time) || age < 0 || age > 30 * 86400000) continue;
      last30++; if (age <= 7 * 86400000) last7++;
      counts[route] = (counts[route] || 0) + 1;
    }
    return { last7, last30, pages: Object.entries(counts).sort((a, b) => b[1] - a[1]) };
  }
  return { publicPath, canTrack, eventFor, summarize };
});
