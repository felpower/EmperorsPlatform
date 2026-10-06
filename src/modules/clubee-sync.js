// Clubee-Abgleich: empfängt die Mitgliederliste von der Chrome-Erweiterung "Emperors ⇄ Clubee"
// (tools/clubee-extension), vergleicht sie mit den Website-Mitgliedern und übernimmt nach
// Bestätigung Clubee-ID, E-Mail/Telefon/Geburtstag (nur wo leer) und Lizenz → Spielerpass.
// Website-Spieler, die in Clubee fehlen, können an die Erweiterung übergeben werden, die sie in
// Clubee vorausfüllt (Speichern macht man in Clubee selbst). Nur für Admin/Finance.
(function () {
  const EXT = "emperors-clubee-extension";
  const CLUBEE_ADD_URL = "https://clubee.com/acsluniwienemperors/steps/add/members?steps=add_members&redirectUrl=/admin/membermanagement/431212";
  let handledAt = 0;
  let extensionPresent = false;

  const norm = (v) => String(v || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "");
  const nameKey = (first, last) => `${norm(first)}|${norm(last)}`;
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const today = () => new Date().toISOString().slice(0, 10);
  const fmt = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || "") ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : "–");

  function passFromLicence(licence) {
    if (!licence) return null;
    const expired = licence.status === "expired" || (licence.expires && licence.expires < today());
    const status = expired ? "expired" : licence.status === "approved" ? "valid" : "missing";
    const reference = [licence.name, licence.number].filter(Boolean).join(" · ");
    return { pass_status: status, expires_on: licence.expires || null, federation_reference: reference || null };
  }

  function buildPlan(clubeeMembers, websiteRows, passRows) {
    const active = websiteRows.filter((m) => !m.deleted_at);
    const byClubeeId = new Map(active.filter((m) => m.clubee_id).map((m) => [String(m.clubee_id), m]));
    const byName = new Map();
    active.forEach((m) => { const k = nameKey(m.first_name, m.last_name); byName.set(k, byName.has(k) ? null : m); });
    const passByMember = new Map(passRows.map((p) => [String(p.member_id), p]));
    const used = new Set();
    const matched = [], onlyClubee = [];
    clubeeMembers.forEach((c) => {
      let m = byClubeeId.get(c.clubeeId);
      let via = "Clubee-ID";
      if (!m) { m = byName.get(nameKey(c.firstName, c.lastName)) || null; via = "Name"; }
      if (!m || used.has(m.id)) { onlyClubee.push(c); return; }
      used.add(m.id);
      const changes = [];
      const patch = {};
      if (String(m.clubee_id || "") !== c.clubeeId) { patch.clubee_id = c.clubeeId; changes.push(`mit Clubee verknüpfen (${via})`); }
      if (c.email && !m.email) { patch.email = c.email; changes.push(`E-Mail ${c.email}`); }
      if (c.phone && !m.phone) { patch.phone = c.phone; changes.push(`Telefon ${c.phone}`); }
      if (c.birthday && m.birthday !== c.birthday) { patch.birthday = c.birthday; changes.push(`Geburtstag ${fmt(c.birthday)}`); }
      const pass = passFromLicence(c.licence);
      const current = passByMember.get(String(m.id));
      let passChange = null;
      if (pass && (!current || current.pass_status !== pass.pass_status || String(current.expires_on || "").slice(0, 10) !== String(pass.expires_on || "") || String(current.federation_reference || "") !== String(pass.federation_reference || ""))) {
        passChange = pass;
        changes.push(`Lizenz: ${pass.pass_status}${pass.expires_on ? " bis " + fmt(pass.expires_on) : ""}`);
      }
      matched.push({ member: m, clubee: c, patch, passChange, changes });
    });
    const onlyWebsite = active.filter((m) => !used.has(m.id) && String(m.membership_status || "") === "active");
    return { matched, onlyClubee, onlyWebsite };
  }

  function dialogShell() {
    let dlg = document.getElementById("clubee-sync-dialog");
    if (!dlg) {
      dlg = document.createElement("dialog");
      dlg.id = "clubee-sync-dialog";
      dlg.className = "clubee-sync-dialog";
      document.body.appendChild(dlg);
    }
    return dlg;
  }

  async function open(payload) {
    const client = window.ClubHubDataClient && window.ClubHubDataClient.createClient();
    if (!client) return;
    const dlg = dialogShell();
    dlg.innerHTML = `<div class="clubee-sync-body"><h2>Clubee-Abgleich</h2><p>Wird geladen …</p></div>`;
    if (!dlg.open) dlg.showModal();
    const [membersRes, privateRes, passRes] = await Promise.all([
      client.from("members").select("*"),
      client.from("member_private").select("id").limit(1),
      client.from("player_passes").select("*")
    ]);
    if (membersRes.error || privateRes.error) {
      dlg.innerHTML = `<div class="clubee-sync-body"><h2>Clubee-Abgleich</h2><p>Nur für eingeloggte Admins (bzw. Finance). ${esc((membersRes.error || privateRes.error).message)}</p><div class="clubee-sync-actions"><button type="button" data-close>Schließen</button></div></div>`;
      dlg.querySelector("[data-close]").onclick = () => dlg.close();
      return;
    }
    const plan = buildPlan(payload.members || [], membersRes.data || [], passRes.data || []);
    const changed = plan.matched.filter((r) => r.changes.length);
    const at = new Date(payload.at || Date.now()).toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" });
    dlg.innerHTML = `<form method="dialog" class="clubee-sync-body">
      <h2>Clubee-Abgleich</h2>
      <p class="clubee-sync-meta">${(payload.members || []).length} Mitglieder aus Clubee (gelesen ${at}) · ${plan.matched.length} zugeordnet · ${plan.matched.length - changed.length} ohne Änderung</p>
      <h3>Änderungen übernehmen (${changed.length})</h3>
      ${changed.length ? `<label class="clubee-sync-all"><input type="checkbox" data-all="upd" checked> alle</label><ul class="clubee-sync-list">${changed.map((r, i) => `<li><label><input type="checkbox" data-upd="${i}" checked><span><strong>${esc(r.member.first_name)} ${esc(r.member.last_name)}</strong><small>${r.changes.map(esc).join(" · ")}</small></span></label></li>`).join("")}</ul>` : `<p class="clubee-sync-empty">Alles aktuell.</p>`}
      <h3>Nur in Clubee (${plan.onlyClubee.length})</h3>
      ${plan.onlyClubee.length ? `<p class="clubee-sync-hint">Auf der Website anlegen (Status „pending“) oder ignorieren (z. B. ehemalige Spieler).</p><ul class="clubee-sync-list">${plan.onlyClubee.map((c, i) => `<li><label><input type="checkbox" data-new="${i}"><span><strong>${esc(c.firstName)} ${esc(c.lastName)}</strong><small>${[c.licence ? `Lizenz ${c.licence.status}${c.licence.expires ? " bis " + fmt(c.licence.expires) : ""}` : "keine Lizenz", c.email].filter(Boolean).map(esc).join(" · ")}</small></span></label></li>`).join("")}</ul>` : `<p class="clubee-sync-empty">Keine.</p>`}
      <h3>Nur auf der Website (${plan.onlyWebsite.length})</h3>
      ${plan.onlyWebsite.length ? `<p class="clubee-sync-hint">Aktive Mitglieder, die in Clubee fehlen. Ausgewählte werden in Clubee nacheinander vorausgefüllt – speichern musst du dort selbst.${extensionPresent ? "" : " (Dafür muss die Chrome-Erweiterung installiert sein.)"}</p><label class="clubee-sync-all"><input type="checkbox" data-all="web"> alle</label><ul class="clubee-sync-list">${plan.onlyWebsite.map((m, i) => `<li><label><input type="checkbox" data-web="${i}"><span><strong>${esc(m.first_name)} ${esc(m.last_name)}</strong><small>${esc(m.email || "keine E-Mail")}</small></span></label></li>`).join("")}</ul>` : `<p class="clubee-sync-empty">Keine.</p>`}
      <p class="clubee-sync-status" role="status"></p>
      <div class="clubee-sync-actions">
        <button type="button" data-close>Schließen</button>
        ${plan.onlyWebsite.length ? `<button type="button" data-create>Ausgewählte in Clubee anlegen</button>` : ""}
        <button type="button" class="primary-button" data-apply>Übernehmen</button>
      </div></form>`;
    const status = dlg.querySelector(".clubee-sync-status");
    dlg.querySelectorAll("[data-all]").forEach((box) => { box.onchange = () => dlg.querySelectorAll(`[data-${box.dataset.all}]`).forEach((b) => { if (b !== box) b.checked = box.checked; }); });
    dlg.querySelector("[data-close]").onclick = () => dlg.close();
    const createBtn = dlg.querySelector("[data-create]");
    if (createBtn) createBtn.onclick = () => {
      const people = [...dlg.querySelectorAll("[data-web]:checked")].map((b) => plan.onlyWebsite[Number(b.dataset.web)]).map((m) => ({ firstName: m.first_name, lastName: m.last_name, email: m.email || "" }));
      if (!people.length) { status.textContent = "Bitte zuerst Personen auswählen."; return; }
      if (!extensionPresent) { status.textContent = "Die Chrome-Erweiterung „Emperors ⇄ Clubee“ ist nicht aktiv."; return; }
      window.postMessage({ source: "emperors-page", type: "clubee-create", people, addUrl: CLUBEE_ADD_URL }, location.origin);
      status.textContent = `${people.length} Person(en) an Clubee übergeben – im neuen Tab „Einfügen“ klicken.`;
    };
    dlg.querySelector("[data-apply]").onclick = async (event) => {
      const btn = event.currentTarget;
      const updates = [...dlg.querySelectorAll("[data-upd]:checked")].map((b) => changed[Number(b.dataset.upd)]);
      const creates = [...dlg.querySelectorAll("[data-new]:checked")].map((b) => plan.onlyClubee[Number(b.dataset.new)]);
      if (!updates.length && !creates.length) { status.textContent = "Nichts ausgewählt."; return; }
      if (!window.confirm(`${updates.length} Mitglied(er) aktualisieren und ${creates.length} neu anlegen?`)) return;
      btn.disabled = true;
      const errors = [];
      const stamp = new Date().toISOString();
      let done = 0;
      for (const r of updates) {
        status.textContent = `Speichere … ${++done}/${updates.length + creates.length}`;
        if (Object.keys(r.patch).length) {
          const res = await client.from("members").update(Object.assign({}, r.patch, { clubee_synced_at: stamp })).eq("id", r.member.id);
          if (res.error) { errors.push(`${r.member.first_name} ${r.member.last_name}: ${res.error.message}`); continue; }
        }
        if (r.passChange) {
          const res = await client.from("player_passes").upsert(Object.assign({ member_id: r.member.id }, r.passChange), { onConflict: "member_id" });
          if (res.error) errors.push(`${r.member.first_name} ${r.member.last_name} (Lizenz): ${res.error.message}`);
        }
      }
      for (const c of creates) {
        status.textContent = `Speichere … ${++done}/${updates.length + creates.length}`;
        const res = await client.from("members").insert([{ display_name: `${c.firstName} ${c.lastName}`.trim(), first_name: c.firstName, last_name: c.lastName, email: c.email || null, membership_status: "pending", clubee_id: c.clubeeId, phone: c.phone || null, birthday: c.birthday || null, clubee_synced_at: stamp }]);
        if (res.error) { errors.push(`${c.firstName} ${c.lastName}: ${res.error.message}`); continue; }
        const pass = passFromLicence(c.licence);
        const newId = res.data && res.data[0] && res.data[0].id;
        if (pass && newId) await client.from("player_passes").upsert(Object.assign({ member_id: newId }, pass), { onConflict: "member_id" });
      }
      status.textContent = errors.length ? `Fertig mit ${errors.length} Fehler(n): ${errors.slice(0, 3).join("; ")}` : "Fertig – alle Änderungen gespeichert.";
      btn.disabled = false;
      if (window.ClubHubApp && typeof window.ClubHubApp.reloadData === "function") window.ClubHubApp.reloadData();
    };
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const data = event.data || {};
    if (data.source !== EXT) return;
    if (data.type === "hello") { extensionPresent = true; window.postMessage({ source: "emperors-page", type: "ready" }, location.origin); return; }
    if (data.type === "clubee-members" && Array.isArray(data.members) && data.at !== handledAt) {
      handledAt = data.at;
      extensionPresent = true;
      window.postMessage({ source: "emperors-page", type: "clubee-received" }, location.origin);
      const start = () => open({ at: data.at, members: data.members }).catch((error) => console.error("Clubee-Abgleich fehlgeschlagen", error));
      // warten, bis die App (Login) geladen ist
      setTimeout(start, 1500);
    }
  });
  window.postMessage({ source: "emperors-page", type: "ready" }, location.origin);

  window.ClubHubModules = window.ClubHubModules || {};
  window.ClubHubModules.clubeeSync = { buildPlan, passFromLicence, open };
})();
