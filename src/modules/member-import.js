// Member import / sync from a spreadsheet (Google Sheet or CSV export).
// Pure logic only (parsing, matching, diff). UI and writes live in app.bundle.js.
// Nothing here writes data: buildImportPlan() only describes what *would* change.
(function () {
  function normalizeToken(value) {
    return String(value || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "");
  }

  // Season = 1 September – 31 August. A rookie is a player whose first season is the current one,
  // so rookie status ends automatically on 1 September (no cron needed).
  function currentSeasonStartYear(date) {
    const d = date instanceof Date ? date : new Date();
    return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1;
  }
  function seasonLabel(startYear) {
    return Number.isFinite(startYear) ? `${startYear}/${String((startYear + 1) % 100).padStart(2, "0")}` : "";
  }
  function isRookieSeason(rookieSeason, date) {
    return rookieSeason !== null && rookieSeason !== undefined && rookieSeason !== "" && Number(rookieSeason) === currentSeasonStartYear(date);
  }

  function nameKey(firstName, lastName) {
    return `${normalizeToken(firstName)}|${normalizeToken(lastName)}`;
  }

  // RFC 4180 CSV parser (quotes, escaped quotes, newlines inside quotes).
  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    const input = String(text || "").replace(/^\uFEFF/, "");
    const firstLine = input.split(/\r?\n/, 1)[0] || "";
    const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : ",";
    for (let i = 0; i < input.length; i += 1) {
      const ch = input[i];
      if (inQuotes) {
        if (ch === '"') {
          if (input[i + 1] === '"') { field += '"'; i += 1; } else inQuotes = false;
        } else field += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === delimiter) { row.push(field); field = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && input[i + 1] === "\n") i += 1;
        row.push(field); rows.push(row); row = []; field = "";
      } else field += ch;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows.filter((r) => r.some((cell) => String(cell).trim() !== ""));
  }

  function parseSheetReference(value) {
    const raw = String(value || "").trim();
    const idMatch = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/) || raw.match(/^([a-zA-Z0-9_-]{20,})$/);
    return idMatch ? idMatch[1] : "";
  }

  function sheetCsvUrl(sheetId, tabName) {
    return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
  }

  const HEADER_ALIASES = {
    firstName: ["first name", "firstname", "vorname"],
    lastName: ["last name", "lastname", "nachname", "surname"],
    positions: ["position", "positions", "positionen"],
    active: ["active", "aktiv"],
    jerseyNumber: ["jersey number", "jersey", "number", "nummer", "trikotnummer", "rückennummer"],
    inClubee: ["in clubee", "clubee"],
    rookie: ["rookie"]
  };

  function parseBool(value) {
    const v = String(value ?? "").trim().toLowerCase();
    if (["true", "wahr", "ja", "yes", "x", "1", "✓", "✔"].includes(v)) return true;
    if (["false", "falsch", "nein", "no", "0", ""].includes(v)) return false;
    return null;
  }

  function parsePositions(value) {
    return Array.from(new Set(String(value || "")
      .split(/[,/;|+&\s]+/)
      .map((p) => p.trim().toUpperCase())
      .filter(Boolean)));
  }

  /** Converts CSV rows (first row = header) into player objects. */
  function rowsToPlayers(rows, sourceLabel) {
    if (!rows.length) return { players: [], missingColumns: ["First Name", "Last Name"] };
    const header = rows[0].map((h) => String(h || "").trim().toLowerCase());
    const col = {};
    Object.entries(HEADER_ALIASES).forEach(([key, aliases]) => {
      const index = header.findIndex((h) => aliases.includes(h));
      if (index >= 0) col[key] = index;
    });
    const missingColumns = [];
    if (col.firstName === undefined) missingColumns.push("First Name");
    if (col.lastName === undefined) missingColumns.push("Last Name");
    if (missingColumns.length) return { players: [], missingColumns };
    const cell = (row, key) => (col[key] === undefined ? "" : String(row[col[key]] ?? "").trim());
    const players = [];
    rows.slice(1).forEach((row, index) => {
      const firstName = cell(row, "firstName").replace(/\s+/g, " ");
      const lastName = cell(row, "lastName").replace(/\s+/g, " ");
      if (!firstName && !lastName) return;
      const jerseyRaw = cell(row, "jerseyNumber");
      const jersey = jerseyRaw === "" ? null : Number(jerseyRaw.replace(/[^0-9]/g, ""));
      players.push({
        rowNumber: index + 2,
        source: sourceLabel || "Sheet",
        firstName,
        lastName,
        positions: col.positions === undefined ? null : parsePositions(cell(row, "positions")),
        active: col.active === undefined ? null : parseBool(cell(row, "active")),
        jerseyNumber: col.jerseyNumber === undefined ? undefined : (Number.isFinite(jersey) && jerseyRaw !== "" ? jersey : null),
        inClubee: col.inClubee === undefined ? null : parseBool(cell(row, "inClubee")),
        rookie: col.rookie === undefined ? null : parseBool(cell(row, "rookie"))
      });
    });
    return { players, missingColumns };
  }

  /** Merges players from several tabs; the first tab wins for duplicate names. */
  function mergePlayers(lists) {
    const byKey = new Map();
    const duplicates = [];
    lists.flat().forEach((player) => {
      const key = nameKey(player.firstName, player.lastName);
      const existing = byKey.get(key);
      if (!existing) { byKey.set(key, { ...player, sources: [player.source] }); return; }
      if (!existing.sources.includes(player.source)) existing.sources.push(player.source);
      else duplicates.push(`${player.firstName} ${player.lastName} (${player.source}, row ${player.rowNumber})`);
      // Missing values are filled from later tabs (e.g. jersey only in one tab).
      if ((existing.jerseyNumber === null || existing.jerseyNumber === undefined) && Number.isFinite(player.jerseyNumber)) existing.jerseyNumber = player.jerseyNumber;
      if ((!existing.positions || !existing.positions.length) && player.positions && player.positions.length) existing.positions = player.positions;
      if (player.active === true) existing.active = true;
      if (player.rookie === true) existing.rookie = true;
    });
    return { players: Array.from(byKey.values()), duplicates };
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i += 1) {
      const curr = [i];
      for (let j = 1; j <= b.length; j += 1) curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = curr;
    }
    return prev[b.length];
  }

  /** 0..100 – how likely sheet player and member are the same person. */
  function similarity(player, member) {
    const pf = normalizeToken(player.firstName), pl = normalizeToken(player.lastName);
    const mf = normalizeToken(member.firstName), ml = normalizeToken(member.lastName);
    if (pf === mf && pl === ml) return 100;
    if (pf === ml && pl === mf) return 95; // first/last swapped
    const pFull = pf + pl, mFull = mf + ml;
    let score = 0;
    if (pl && pl === ml) score += 50;
    else if (pl && ml && levenshtein(pl, ml) <= 1) score += 38;
    else if (pl && ml && levenshtein(pl, ml) <= 2 && Math.min(pl.length, ml.length) >= 6) score += 28;
    if (pf && mf && pf === mf) score += 40;
    else if (pf && mf && (pf.startsWith(mf) || mf.startsWith(pf))) score += 32; // "Tim" vs "Tim Jonas"
    else if (pf && mf && levenshtein(pf, mf) <= 1) score += 28;
    else if (pf && mf && pf[0] === mf[0]) score += 8;
    if (score < 50 && pFull.length > 6 && levenshtein(pFull, mFull) <= 2) score = Math.max(score, 70);
    // Tokens of the sheet name contained in the member name (e.g. double surnames).
    const pTokens = `${player.firstName} ${player.lastName}`.split(/\s+/).map(normalizeToken).filter(Boolean);
    const mTokens = new Set(`${member.firstName} ${member.lastName} ${member.name || ""}`.split(/\s+/).map(normalizeToken).filter(Boolean));
    if (pTokens.length >= 2 && pTokens.every((t) => mTokens.has(t))) score = Math.max(score, 85);
    return Math.min(score, 99);
  }

  function sameSet(a, b) {
    const sa = new Set((a || []).map((x) => String(x).toUpperCase()));
    const sb = new Set((b || []).map((x) => String(x).toUpperCase()));
    return sa.size === sb.size && Array.from(sa).every((x) => sb.has(x));
  }

  function isPlayerMember(member) {
    const roles = Array.isArray(member.roles) ? member.roles : [];
    return roles.includes("player") || !roles.length;
  }

  /** Status the member should get according to the sheet ("active" column). */
  function targetStatus(player, member) {
    if (player.active === null || player.active === undefined) return member ? member.membershipStatus : "active";
    const current = member ? String(member.membershipStatus || "") : "";
    if (player.active) return current === "coach" ? "coach" : "active";
    if (!member) return "inactive";
    if (["exited", "coach", "inactive"].includes(current)) return current;
    return "inactive";
  }

  function fieldChanges(player, member, options) {
    const changes = [];
    if (player.positions && player.positions.length && !sameSet(player.positions, member.positions)) {
      changes.push({ field: "positions", label: "Positions", current: (member.positions || []).join(", ") || "–", next: player.positions.join(", "), value: player.positions });
    }
    if (player.jerseyNumber !== undefined && options.updateJerseys !== false) {
      const current = member.jerseyNumber === null || member.jerseyNumber === undefined ? null : Number(member.jerseyNumber);
      if (current !== player.jerseyNumber && !(player.jerseyNumber === null && options.keepJerseyWhenEmpty !== false)) {
        changes.push({ field: "jerseyNumber", label: "Jersey #", current: current === null ? "–" : String(current), next: player.jerseyNumber === null ? "–" : String(player.jerseyNumber), value: player.jerseyNumber });
      }
    }
    const status = targetStatus(player, member);
    if (status !== member.membershipStatus) changes.push({ field: "membershipStatus", label: "Status", current: member.membershipStatus || "–", next: status, value: status });
    // Name spelling (case/diacritics/typos) – optional, off by default.
    if (normalizeToken(player.firstName) !== normalizeToken(member.firstName) || normalizeToken(player.lastName) !== normalizeToken(member.lastName)) {
      changes.push({ field: "name", label: "Name", current: `${member.firstName} ${member.lastName}`.trim(), next: `${player.firstName} ${player.lastName}`.trim(), value: { firstName: player.firstName, lastName: player.lastName }, optional: true });
    }
    // Rookie (only when the sheet has a Rookie column).
    if (player.rookie === true || player.rookie === false) {
      const season = currentSeasonStartYear(options.today);
      const memberSeason = member.rookieSeason === null || member.rookieSeason === undefined || member.rookieSeason === "" ? null : Number(member.rookieSeason);
      const memberIsRookie = memberSeason === season;
      if (player.rookie !== memberIsRookie) {
        const earlierSeason = memberSeason !== null && memberSeason < season;
        changes.push({
          field: "rookie",
          label: "Rookie",
          current: memberIsRookie ? `yes (${seasonLabel(season)})` : earlierSeason ? `no (was rookie ${seasonLabel(memberSeason)})` : "no",
          next: player.rookie ? `yes (${seasonLabel(season)}, until 31.8.${season + 1})` : "no",
          value: player.rookie ? season : (earlierSeason ? memberSeason : null),
          // Was already a rookie in an earlier season → the sheet was probably not updated yet.
          optional: player.rookie && earlierSeason,
          note: player.rookie && earlierSeason ? "already a rookie last season – sheet not updated?" : ""
        });
      }
    }
    if (member.deletedAt) changes.push({ field: "restore", label: "Deleted", current: "deleted", next: "restored", value: true });
    return changes;
  }

  /**
   * Compares sheet players with existing members.
   * Returns entries of kind: update | unchanged | create | missing, each with a proposed action.
   */
  function buildImportPlan(players, members, options = {}) {
    const all = (members || []).filter((m) => m && m.id);
    const used = new Set();
    const entries = [];
    const autoLink = options.autoLinkScore ?? 75;
    const suggestScore = options.suggestScore ?? 55;

    // 1st pass: exact matches (also deleted members, so they can be restored instead of duplicated).
    const pending = [];
    players.forEach((player) => {
      const exact = all.filter((m) => !used.has(m.id) && similarity(player, m) >= 95);
      const pick = exact.find((m) => !m.deletedAt) || exact[0];
      if (pick) { used.add(pick.id); entries.push(matchEntry(player, pick, 100, [], options)); }
      else pending.push(player);
    });

    // 2nd pass: fuzzy matches.
    pending.forEach((player) => {
      const candidates = all
        .filter((m) => !used.has(m.id))
        .map((m) => ({ member: m, score: similarity(player, m) - (m.deletedAt ? 5 : 0) }))
        .filter((c) => c.score >= suggestScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);
      const best = candidates[0];
      if (best && best.score >= autoLink && (!candidates[1] || candidates[1].score < best.score - 10)) {
        used.add(best.member.id);
        entries.push(matchEntry(player, best.member, best.score, candidates.slice(1), options));
      } else {
        entries.push({
          kind: "create",
          id: `create-${nameKey(player.firstName, player.lastName)}-${player.rowNumber}`,
          player,
          draft: { firstName: player.firstName, lastName: player.lastName, positions: player.positions || [], jerseyNumber: player.jerseyNumber ?? null, membershipStatus: targetStatus(player, null), rookie: player.rookie === false ? false : true },
          candidates: candidates.map((c) => ({ id: c.member.id, name: `${c.member.firstName} ${c.member.lastName}`.trim() || c.member.name, score: c.score, deleted: Boolean(c.member.deletedAt) })),
          action: candidates.length ? "review" : "create",
          include: !candidates.length
        });
      }
    });

    // Members not in the sheet (only players, not deleted, not already exited).
    all.filter((m) => !used.has(m.id) && !m.deletedAt && isPlayerMember(m) && m.membershipStatus !== "exited").forEach((member) => {
      const linkedFromCreate = entries.some((e) => e.kind === "create" && e.candidates.some((c) => c.id === member.id));
      entries.push({ kind: "missing", id: `missing-${member.id}`, member, action: "keep", include: false, hasPossibleMatch: linkedFromCreate });
    });

    return entries;
  }

  function matchEntry(player, member, score, otherCandidates, options) {
    const changes = fieldChanges(player, member, options);
    changes.forEach((c) => { c.accepted = !c.optional; });
    return {
      kind: changes.length ? "update" : "unchanged",
      id: `match-${member.id}`,
      player,
      member,
      score,
      changes,
      otherCandidates: otherCandidates.map((c) => ({ id: c.member.id, name: `${c.member.firstName} ${c.member.lastName}`.trim(), score: c.score })),
      include: changes.some((c) => !c.optional)
    };
  }

  /** Jersey numbers used twice after the import (same side of ball or unknown side). */
  function jerseyConflicts(members, entries) {
    const result = new Map();
    const next = new Map();
    members.filter((m) => !m.deletedAt && ["active", "pending"].includes(m.membershipStatus)).forEach((m) => next.set(m.id, { name: `${m.firstName} ${m.lastName}`.trim(), jersey: m.jerseyNumber, side: m.sideOfBall || "", loan: m.loanJersey }));
    entries.forEach((e) => {
      if (!e.include) return;
      if (e.kind === "update") {
        const cur = next.get(e.member.id) || { name: `${e.member.firstName} ${e.member.lastName}`.trim(), jersey: e.member.jerseyNumber, side: e.member.sideOfBall || "" };
        e.changes.forEach((c) => {
          if (!c.accepted) return;
          if (c.field === "jerseyNumber") cur.jersey = c.value;
          if (c.field === "membershipStatus" && !["active", "pending"].includes(c.value)) cur.removed = true;
        });
        if (cur.removed) next.delete(e.member.id); else next.set(e.member.id, cur);
      }
      if (e.kind === "create" && e.action === "create" && ["active", "pending"].includes(e.draft.membershipStatus)) next.set(e.id, { name: `${e.draft.firstName} ${e.draft.lastName}`, jersey: e.draft.jerseyNumber, side: "" });
      if (e.kind === "missing" && e.action !== "keep") next.delete(e.member.id);
    });
    const byNumber = new Map();
    next.forEach((v) => { if (v.jersey === null || v.jersey === undefined || v.jersey === "" || v.loan) return; const list = byNumber.get(Number(v.jersey)) || []; list.push(v); byNumber.set(Number(v.jersey), list); });
    byNumber.forEach((list, number) => {
      if (list.length < 2) return;
      const sides = list.map((v) => v.side);
      const clash = sides.some((s, i) => sides.some((t, j) => i !== j && (!s || !t || s === "both" || t === "both" || s === t)));
      if (clash) result.set(number, list.map((v) => v.name));
    });
    return Array.from(result.entries()).map(([number, names]) => ({ number, names }));
  }

  const api = { parseCsv, parseSheetReference, sheetCsvUrl, rowsToPlayers, mergePlayers, buildImportPlan, jerseyConflicts, similarity, normalizeToken, currentSeasonStartYear, seasonLabel, isRookieSeason };
  if (typeof window !== "undefined") {
    window.ClubHubModules = window.ClubHubModules || {};
    window.ClubHubModules.memberImport = api;
  }
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
