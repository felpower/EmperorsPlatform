// Emperors ⇄ Clubee – Teil auf clubee.com.
// 1) Mitgliederverwaltung: Button "Mit emperors.page abgleichen" liest ALLE Mitglieder der
//    Gruppe (alle Seiten) samt Lizenzen über die Clubee-Schnittstelle, die auch die Seite selbst
//    nutzt, und öffnet emperors.page mit dem Abgleich. Es wird nichts in Clubee geändert.
// 2) "Mitglied hinzufügen": Panel mit der Warteschlange aus emperors.page; "Einfügen" füllt
//    Vorname/Nachname/E-Mail aus. DSGVO-Haken und Speichern macht man selbst.
(function () {
  const API = "https://apiv3.clubee.com";
  // Startseite statt /members: Unterseiten laufen über 404.html (document.write), das würde
  // den Nachrichten-Listener der Erweiterung entfernen.
  const SITE = "https://emperors.page/?clubee=1";
  const PAGE_SIZE = 50;

  const token = () => decodeURIComponent((document.cookie.match(/(?:^|; )token=([^;]*)/) || [])[1] || "");
  const website = () => location.pathname.split("/")[1] || "";
  const groupId = () => (location.pathname.match(/membermanagement\/(\d+)/) || [])[1] || "";

  function headers(group) {
    return {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token(),
      "X-Website": website(),
      "X-Tool": "/admin/membermanagement/" + group
    };
  }

  async function api(path, group, init) {
    const response = await fetch(API + path, Object.assign({ headers: headers(group) }, init || {}));
    if (!response.ok) throw new Error("Clubee antwortet mit " + response.status + " (" + path.split("?")[0] + ")");
    return response.json();
  }

  const day = (value) => (/^\d{4}-\d{2}-\d{2}/.test(String(value || "")) ? String(value).slice(0, 10) : "");

  async function loadAll(group, onProgress) {
    const users = [];
    let total = Infinity;
    for (let offset = 0; offset < total && offset < 5000; offset += PAGE_SIZE) {
      const page = await api(`/group/${group}/users?language=de&_offset=${offset}&_limit=${PAGE_SIZE}&sortBy=u.lastname&sortOrder=asc`, group);
      total = Number(page._meta && page._meta.total) || 0;
      users.push(...(page.data || []));
      onProgress(users.length, total);
      if (!(page.data || []).length) break;
    }
    const licences = new Map();
    for (let i = 0; i < users.length; i += 100) {
      const ids = users.slice(i, i + 100).map((u) => u.id);
      const rows = await api(`/licenses/by-users?language=de&date=${encodeURIComponent(new Date().toISOString())}`, group, { method: "POST", body: JSON.stringify({ users: ids }) }).catch(() => []);
      (Array.isArray(rows) ? rows : []).forEach((l) => {
        const userId = l.user && l.user.id;
        const prev = licences.get(userId);
        // pro Person die Lizenz mit dem spätesten Ablaufdatum
        if (!prev || String(l.expiration || l.end_date || "") > String(prev.expiration || prev.end_date || "")) licences.set(userId, l);
      });
    }
    return users.map((u) => {
      const l = licences.get(u.id);
      const emails = [].concat(u.emails || [], (u.accounts || []).map((a) => a.email)).filter(Boolean);
      return {
        clubeeId: String(u.id),
        firstName: String(u.firstname || "").trim(),
        lastName: String(u.lastname || "").trim(),
        birthday: day(u.birthday),
        email: emails[0] || "",
        phone: String(u.phone || "").trim(),
        licence: l ? {
          status: String(l.status || ""),
          number: String(l.license_number || l.number || ""),
          name: String((l.package && l.package.name) || ""),
          expires: day(l.expiration || l.end_date)
        } : null
      };
    });
  }

  function button(label, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.style.cssText = "position:fixed;right:20px;bottom:20px;z-index:99999;padding:12px 18px;border:0;border-radius:999px;background:#151b1c;color:#f6c316;font:700 14px system-ui;box-shadow:0 8px 24px rgba(0,0,0,.3);cursor:pointer";
    b.addEventListener("click", onClick);
    return b;
  }

  let syncButton = null;
  function ensureSyncButton() {
    const group = groupId();
    if (!group || !/\/admin\/membermanagement\//.test(location.pathname)) { if (syncButton) { syncButton.remove(); syncButton = null; } return; }
    if (syncButton) return;
    syncButton = button("⇄ Mit emperors.page abgleichen", async () => {
      const b = syncButton;
      b.disabled = true;
      try {
        const members = await loadAll(groupId(), (n, total) => { b.textContent = `Lade Mitglieder … ${n}/${total}`; });
        await chrome.storage.local.set({ clubeeSync: { at: Date.now(), group: groupId(), members } });
        b.textContent = `✓ ${members.length} Mitglieder – öffne emperors.page`;
        window.open(SITE, "_blank");
      } catch (error) {
        b.textContent = "Fehler: " + error.message;
      } finally {
        setTimeout(() => { b.disabled = false; b.textContent = "⇄ Mit emperors.page abgleichen"; }, 4000);
      }
    });
    document.body.appendChild(syncButton);
  }

  // ---- Mitglied hinzufügen: Warteschlange aus emperors.page vorausfüllen -------------------
  function setInput(el, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(el, value || "");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  let panel = null;
  async function ensureCreatePanel() {
    const onAddPage = /\/steps\/add\/members/.test(location.pathname);
    const { clubeeCreateQueue } = await chrome.storage.local.get("clubeeCreateQueue");
    const queue = Array.isArray(clubeeCreateQueue) ? clubeeCreateQueue : [];
    if (!onAddPage || !queue.length) { if (panel) { panel.remove(); panel = null; } return; }
    if (!panel) {
      panel = document.createElement("div");
      panel.style.cssText = "position:fixed;right:20px;bottom:20px;z-index:99999;width:300px;padding:16px;border-radius:16px;background:#151b1c;color:#fff;font:14px system-ui;box-shadow:0 12px 32px rgba(0,0,0,.35)";
      document.body.appendChild(panel);
    }
    const next = queue[0];
    panel.innerHTML = "";
    const title = document.createElement("div");
    title.style.cssText = "font-weight:800;color:#f6c316;margin-bottom:6px";
    title.textContent = `Aus emperors.page anlegen (${queue.length} offen)`;
    const who = document.createElement("div");
    who.style.cssText = "margin-bottom:12px;line-height:1.4";
    who.textContent = `${next.firstName} ${next.lastName}${next.email ? " · " + next.email : ""}`;
    const hint = document.createElement("div");
    hint.style.cssText = "font-size:12px;color:#b7c0c2;margin:10px 0 0";
    hint.textContent = "Nach dem Einfügen DSGVO-Bestätigung prüfen und selbst speichern, dann „Nächste Person“.";
    const fill = document.createElement("button");
    fill.textContent = "Einfügen";
    const skip = document.createElement("button");
    skip.textContent = "Nächste Person";
    const clear = document.createElement("button");
    clear.textContent = "Liste leeren";
    [fill, skip, clear].forEach((b) => { b.type = "button"; b.style.cssText = "margin:0 6px 6px 0;padding:8px 12px;border:0;border-radius:10px;font:700 13px system-ui;cursor:pointer;background:#2a3436;color:#fff"; });
    fill.style.background = "#f6c316"; fill.style.color = "#151b1c";
    fill.onclick = () => {
      const f = document.getElementById("firstname"), l = document.getElementById("lastname"), e = document.getElementById("email");
      if (!f) { hint.textContent = "Formular nicht gefunden – Seite neu laden."; return; }
      setInput(f, next.firstName); if (l) setInput(l, next.lastName); if (e && next.email) setInput(e, next.email);
    };
    skip.onclick = async () => { await chrome.storage.local.set({ clubeeCreateQueue: queue.slice(1) }); ensureCreatePanel(); };
    clear.onclick = async () => { await chrome.storage.local.remove("clubeeCreateQueue"); ensureCreatePanel(); };
    panel.append(title, who, fill, skip, clear, hint);
  }

  // Clubee ist eine Single-Page-App: auf URL-Wechsel reagieren.
  let lastUrl = "";
  setInterval(() => {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    ensureSyncButton();
    ensureCreatePanel();
  }, 800);
  chrome.storage.onChanged.addListener((changes) => { if (changes.clubeeCreateQueue) ensureCreatePanel(); });
})();
