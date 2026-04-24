(function () {
  function normalizeIbanText(value) {
    return String(value || "").replace(/\s+/g, "").toUpperCase().trim();
  }

  function formatIbanDisplay(value) {
    const normalized = normalizeIbanText(value);
    if (!normalized) return "";
    return normalized.replace(/(.{4})/g, "$1 ").trim();
  }

  window.ClubHubModules = window.ClubHubModules || {};
  window.ClubHubModules.iban = {
    normalizeIbanText,
    formatIbanDisplay
  };
})();
