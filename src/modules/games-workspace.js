(function (root) {
  "use strict";
  function create({ backend, workflows: w, fallback, canManage, isLocal, changed, escape: esc, download }) {
    let rows = fallback.slice(), loaded = false, loading = false, error = "", draft = null, busy = false, draftValues = null;
    const storageKey = "emperors-managed-games-v1";
    const options = (values, selected) => values.map((item) => `<option value="${esc(item.value)}" ${item.value === selected ? "selected" : ""}>${esc(item.label)}</option>`).join("");
    const seasons = () => [...new Set(rows.map((row) => row.season))].sort().reverse();
    async function load(force = false) {
      if (loading || (loaded && !force)) return;
      loading = true; error = ""; changed();
      try {
        if (isLocal()) {
          const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
          if (Array.isArray(saved)) rows = saved;
        } else {
          const result = await backend.from("league_games").select("*");
          if (result.error) throw result.error;
          rows = result.data.map((row) => ({ ...JSON.parse(row.game_json), id: String(row.id || row.$id), season: row.season }));
        }
        loaded = true;
      } catch (failure) { error = failure.message || "Could not load games."; }
      finally { loading = false; changed(); }
    }
    function notice() {
      return loading ? `<div class="work-status" role="status"><span class="work-spinner"></span>Loading games…</div>`
        : error ? `<div class="work-status work-error" role="alert">${esc(error)} Showing the saved schedule. <button data-games-refresh type="button" class="ghost-button">Retry</button></div>` : "";
    }
    function nextCard(team) {
      const game = w.nextGame(rows, team);
      if (!game) return notice();
      const when = game.dateOnly ? `${new Intl.DateTimeFormat("de-AT", { dateStyle: "long" }).format(new Date(`${game.startsAt.slice(0, 10)}T12:00:00Z`))} · Kickoff TBA`
        : new Intl.DateTimeFormat("de-AT", { timeZone: "Europe/Vienna", dateStyle: "long", timeStyle: "short" }).format(new Date(game.startsAt));
      const venue = [game.venueName, game.venueCity].filter(Boolean).join(", ");
      return `${notice()}<article class="setup-card next-game-card"><p class="eyebrow">Next Emperors game · ${esc(game.season)}</p><h3>${esc(game.homeTeam.name)} vs ${esc(game.awayTeam.name)}</h3><p><strong>${esc(when)}</strong></p><p>${esc(venue || "Venue TBA")}</p><div class="button-row"><a class="ghost-button" href="/events">Full schedule</a><button class="ghost-button" type="button" data-calendar-game="${esc(game.id)}">Add to calendar</button>${venue && venue !== "TBA" ? `<a class="ghost-button" target="_blank" rel="noreferrer" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue)}">Directions</a>` : ""}${game.ticketLink ? `<a class="primary-button" target="_blank" rel="noreferrer" href="${esc(w.safeUrl(game.ticketLink))}">Tickets</a>` : ""}</div></article>`;
    }
    function editor(season, teams) {
      if (!canManage()) return "";
      const teamOptions = [...new Set([...teams, "1st Seed", "2nd Seed", "3rd Seed", "4th Seed", "Winner Semifinal 1", "Winner Semifinal 2", ...rows.flatMap((game) => [game.homeTeam.name, game.awayTeam.name])])];
      const input = (label, name, value, type = "text", extra = "") => `<label>${label}<input name="${name}" type="${type}" value="${esc(draftValues?.[name] ?? value ?? "")}" ${extra}></label>`;
      const select = (label, name, values, value) => `<label>${label}<select name="${name}">${options(values, draftValues?.[name] ?? value)}</select></label>`;
      let form = "";
      if (draft) {
        const parts = draft.dateOnly ? draft.startsAt.slice(0, 10) : new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Vienna", dateStyle: "short", timeStyle: "short" }).format(new Date(draft.startsAt)).replace(" ", "T");
        form = `<dialog id="game-editor-dialog" class="work-dialog"><form id="game-editor-form"><h3>${draft.id ? "Edit game" : "Add game"}</h3><div class="work-form-grid">
          ${input("Season", "season", draft.season, "text", 'required pattern="[0-9]{4}/[0-9]{2}" maxlength="7"')}
          ${input("Gameday title", "stage", draft.stage, "text", 'required maxlength="255"')}
          ${select("Round", "round", w.GAME_ROUNDS, draft.round)}${select("Status", "status", w.GAME_STATUSES, draft.status)}
          ${select("Home team", "home", teamOptions.map((value) => ({ value, label: value })), draft.homeTeam.name)}
          ${select("Away team", "away", teamOptions.map((value) => ({ value, label: value })), draft.awayTeam.name)}
          ${input("Date (Vienna)", "date", parts.slice(0, 10), "date", "required")}${input("Kickoff (Vienna, empty = TBA)", "time", draft.dateOnly ? "" : parts.slice(11, 16), "time")}
          ${input("Venue / address", "venue", draft.venueName, "text", 'maxlength="255"')}${input("City", "city", draft.venueCity, "text", 'maxlength="100"')}
          ${input("Home score", "homeScore", draft.homeScore, "number", 'min="0" max="999" step="1"')}${input("Away score", "awayScore", draft.awayScore, "number", 'min="0" max="999" step="1"')}
          ${input("Stream / replay link", "stream", draft.streamLink, "url", 'maxlength="2048"')}${input("Ticket link", "tickets", draft.ticketLink, "url", 'maxlength="2048"')}
          </div><p id="game-editor-status" role="alert" class="work-error"></p><div class="button-row"><button type="submit" class="primary-button" ${busy ? "disabled" : ""}>${busy ? "Saving…" : "Save changes"}</button><button type="button" class="ghost-button" data-game-cancel ${busy ? "disabled" : ""}>Cancel</button></div></form></dialog>`;
      }
      return `<details class="setup-card games-admin"><summary>Manage games · Admin</summary><p class="meta">Changes are saved for all visitors. Existing seasons remain available.</p><div class="button-row"><button type="button" class="primary-button" data-game-add>Add game / season</button><button type="button" class="ghost-button" data-games-refresh>Refresh</button></div><div class="work-game-admin-list">${rows.filter((game) => game.season === season).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)).map((game) => `<div><span>${esc(game.startsAt.slice(0, 10))} · ${esc(game.homeTeam.name)} vs ${esc(game.awayTeam.name)}</span><button class="ghost-button small-button" type="button" data-game-edit="${esc(game.id)}">Edit</button><button class="ghost-button small-button danger-button" type="button" data-game-delete="${esc(game.id)}">Delete</button></div>`).join("")}</div></details>${form}`;
    }
    async function persist(game) {
      if (!canManage()) throw new Error("Only admins can edit games.");
      w.validateGame(game);
      const id = game.id || `game-${crypto.randomUUID().replace(/-/g, "").slice(0, 28)}`;
      const next = { ...game, id };
      if (isLocal()) {
        const updated = rows.some((row) => row.id === id) ? rows.map((row) => row.id === id ? next : row) : [...rows, next];
        localStorage.setItem(storageKey, JSON.stringify(updated)); rows = updated;
      } else {
        if (!backend || !loaded) throw new Error("Load the games successfully before saving.");
        const data = { season: next.season, game_json: JSON.stringify(next) };
        const result = game.id ? await backend.from("league_games").update(data).eq("id", id).select("*").single()
          : await backend.from("league_games").insert([{ id, ...data }]).select("*").single();
        if (result.error) throw result.error;
        rows = rows.some((row) => row.id === id) ? rows.map((row) => row.id === id ? next : row) : [...rows, next];
      }
      return next;
    }
    function bind(season, team) {
      document.querySelectorAll("[data-calendar-game], [data-calendar-season]").forEach((button) => button.onclick = () => {
        const games = button.dataset.calendarGame ? rows.filter((row) => row.id === button.dataset.calendarGame)
          : rows.filter((row) => row.season === season && [row.homeTeam.name, row.awayTeam.name].includes(team));
        download(w.calendar(games), "text/calendar;charset=utf-8", `emperors-${button.dataset.calendarGame || season.replace("/", "-")}.ics`);
      });
      document.querySelectorAll("[data-games-refresh]").forEach((button) => button.onclick = () => load(true));
      document.querySelectorAll("[data-game-edit]").forEach((button) => button.onclick = () => { if (!canManage()) return; draftValues = null; draft = structuredClone(rows.find((row) => row.id === button.dataset.gameEdit)); draft.round = w.roundFor(draft); draft.status ||= Number.isFinite(draft.homeScore) ? "completed" : "scheduled"; changed(); });
      document.querySelectorAll("[data-game-add]").forEach((button) => button.onclick = () => { if (!canManage()) return; draftValues = null; draft = { season, startsAt: w.localDate(), dateOnly: true, homeTeam: { name: team }, awayTeam: { name: "JKU Astros" }, stage: "Gameday", round: "regular", status: "scheduled" }; changed(); });
      document.querySelectorAll("[data-game-delete]").forEach((button) => button.onclick = async () => {
        if (!canManage() || busy) return;
        const game = rows.find((row) => row.id === button.dataset.gameDelete);
        if (!confirm(`Delete only ${game.homeTeam.name} vs ${game.awayTeam.name} on ${game.startsAt.slice(0, 10)}? Other games and seasons stay available.`)) return;
        busy = true; button.disabled = true;
        try {
          if (!isLocal()) { const result = await backend.from("league_games").delete().eq("id", game.id); if (result.error) throw result.error; }
          const next = rows.filter((row) => row.id !== game.id);
          if (isLocal()) localStorage.setItem(storageKey, JSON.stringify(next));
          rows = next; error = "";
        } catch (failure) { error = failure.message; }
        finally { busy = false; changed(); }
      });
      const dialog = document.getElementById("game-editor-dialog");
      if (!dialog) return;
      if (!dialog.open) dialog.showModal();
      const cancel = () => { if (!busy) { draft = null; draftValues = null; changed(); } };
      dialog.oncancel = (event) => { event.preventDefault(); cancel(); };
      dialog.querySelector("[data-game-cancel]").onclick = cancel;
      const form = document.getElementById("game-editor-form");
      form.oninput = form.onchange = () => { draftValues = Object.fromEntries(new FormData(form).entries()); };
      form.onsubmit = async (event) => {
        event.preventDefault(); if (busy) return;
        const value = (name) => form.elements[name].value.trim();
        const submit = form.querySelector('[type="submit"]');
        try {
          const game = { ...draft, season: value("season"), stage: value("stage"), subtitle: value("stage"), round: value("round"), status: value("status"),
            dateOnly: !value("time"), startsAt: value("time") ? w.viennaDateTime(`${value("date")}T${value("time")}`) : value("date"),
            homeTeam: { name: value("home") }, awayTeam: { name: value("away") }, venueName: value("venue"), venueCity: value("city"),
            homeScore: value("homeScore") === "" ? null : Number(value("homeScore")), awayScore: value("awayScore") === "" ? null : Number(value("awayScore")),
            streamLink: w.safeUrl(value("stream")), ticketLink: w.safeUrl(value("tickets")) };
          w.validateGame(game); busy = true;
          [...form.elements].forEach((el) => el.disabled = true); submit.textContent = "Saving…";
          await persist(game); draft = null; draftValues = null; error = ""; busy = false;
          root.ClubHubModules.workspaceUi?.message(isLocal() ? "Game saved in this local preview." : "Game saved for all visitors.", "success");
          changed(game.season);
        } catch (failure) {
          document.getElementById("game-editor-status").textContent = failure.message; busy = false;
          [...form.elements].forEach((el) => el.disabled = false); submit.textContent = "Save changes";
        }
      };
    }
    return { load, notice, nextCard, editor, bind, seasons, rows: () => rows, loaded: () => loaded, loading: () => loading, hasDraft: () => Boolean(draftValues) };
  }
  root.ClubHubModules = root.ClubHubModules || {}; root.ClubHubModules.gamesWorkspace = { create };
})(window);
