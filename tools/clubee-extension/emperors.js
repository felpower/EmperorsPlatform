// Emperors ⇄ Clubee – Teil auf emperors.page.
// Übergibt die in Clubee gelesene Mitgliederliste an die Seite (window.postMessage) und nimmt
// von der Seite die Liste der Personen entgegen, die in Clubee angelegt werden sollen.
(function () {
  const SOURCE = "emperors-clubee-extension";
  const MAX_AGE_MS = 15 * 60 * 1000;

  // Der Seite mitteilen, dass die Erweiterung installiert ist.
  window.postMessage({ source: SOURCE, type: "hello" }, location.origin);

  async function deliver() {
    const { clubeeSync } = await chrome.storage.local.get("clubeeSync");
    if (!clubeeSync || Date.now() - Number(clubeeSync.at || 0) > MAX_AGE_MS) return;
    window.postMessage({ source: SOURCE, type: "clubee-members", at: clubeeSync.at, members: clubeeSync.members }, location.origin);
  }

  // Robust gegen späte Seiten-Initialisierung (und 404.html mit document.write, das Listener
  // entfernt): einige Sekunden lang wiederholt anbieten, bis die Seite den Empfang bestätigt.
  let received = false;
  let tries = 0;
  const retry = setInterval(() => {
    if (received || ++tries > 20) { clearInterval(retry); return; }
    window.postMessage({ source: SOURCE, type: "hello" }, location.origin);
    deliver();
  }, 1000);

  window.addEventListener("message", async (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const data = event.data || {};
    if (data.source !== "emperors-page") return;
    if (data.type === "ready") deliver();
    if (data.type === "clubee-received") { received = true; await chrome.storage.local.remove("clubeeSync"); }
    if (data.type === "clubee-create") {
      const people = (Array.isArray(data.people) ? data.people : []).map((p) => ({ firstName: String(p.firstName || ""), lastName: String(p.lastName || ""), email: String(p.email || "") })).filter((p) => p.firstName || p.lastName);
      await chrome.storage.local.set({ clubeeCreateQueue: people });
      window.open(String(data.addUrl || "https://clubee.com/acsluniwienemperors/steps/add/members?steps=add_members&redirectUrl=/admin/membermanagement/431212"), "_blank");
    }
  });
  deliver();
})();
