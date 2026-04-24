(function () {
  function getCacheWithTTL(key, ttlMs) {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      const data = parsed && typeof parsed === "object" ? parsed.data : null;
      const timestamp = Number(parsed && parsed.timestamp);
      if (!Number.isFinite(timestamp) || Date.now() - timestamp > Number(ttlMs || 0)) {
        localStorage.removeItem(key);
        return null;
      }
      return data;
    } catch {
      return null;
    }
  }

  function setCacheWithTTL(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
    } catch {
      // Ignore storage write errors to keep UI resilient.
    }
  }

  function invalidateCache(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore storage remove errors.
    }
  }

  window.ClubHubModules = window.ClubHubModules || {};
  window.ClubHubModules.cache = {
    getCacheWithTTL,
    setCacheWithTTL,
    invalidateCache
  };
})();
