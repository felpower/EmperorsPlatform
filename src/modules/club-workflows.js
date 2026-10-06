(function (root) {
  "use strict";
  const MEMBERSHIP_STATUSES = Object.freeze(["active", "pending", "inactive", "exited", "coach"]);
  const FEE_STATUSES = Object.freeze(["paid", "paid_rookie_fee", "paid_with_fee", "partial", "pending", "not_collected", "deferred", "exempt", "exit", "not_applicable"]);
  const PASS_STATUSES = Object.freeze(["valid", "missing", "expired"]);
  const MEMBER_ROLES = Object.freeze(["player", "coach", "admin", "finance_admin", "tech_admin", "staff"]);
  const SIDE_OF_BALL = Object.freeze([{ value: "", label: "Not set" }, { value: "offense", label: "Offense" }, { value: "defense", label: "Defense" }, { value: "both", label: "Both" }]);
  const SPONSOR_STATUSES = Object.freeze([
    { value: "research", label: "Research" }, { value: "planned", label: "Planned" }, { value: "contacted", label: "Contacted" },
    { value: "follow_up", label: "Follow-up" }, { value: "negotiating", label: "In discussion" }, { value: "confirmed", label: "Confirmed" },
    { value: "declined", label: "Declined" }, { value: "no_response", label: "No response" }, { value: "postponed", label: "Follow up later" }
  ]);
  const TRYOUT_STATUSES = Object.freeze([
    { value: "new", label: "New" }, { value: "contacted", label: "Contacted" },
    { value: "invited", label: "Invited" }, { value: "attended", label: "Attended" },
    { value: "no_show", label: "Did not attend" }, { value: "joined", label: "Became a member" },
    { value: "archived", label: "Archived" }
  ]);
  const TRYOUT_STUDENT_OPTIONS = Object.freeze([{value:"yes",label:"Uni Wien student"},{value:"accepted_or_starting",label:"Accepted / starting soon"},{value:"no",label:"No"},{value:"prefer_to_discuss",label:"Not sure"}]);
  const TRYOUT_EXPERIENCE_OPTIONS = Object.freeze([{value:"none",label:"No football experience"},{value:"flag_football",label:"Flag Football"},{value:"tackle_training",label:"Tackle training"},{value:"tackle_team",label:"Played on a tackle team"},{value:"coaching_or_staff",label:"Coaching / staff"},{value:"other",label:"Other"}]);
  const TRYOUT_POSITION_OPTIONS = Object.freeze([{value:"offense",label:"Offense"},{value:"defense",label:"Defense"},{value:"special_teams",label:"Special Teams"},{value:"line",label:"Line"},{value:"skill_position",label:"Skill position"},{value:"coach_or_staff",label:"Coach / staff"}]);
  const GAME_ROUNDS = Object.freeze([
    { value: "regular", label: "Regular season" }, { value: "semifinal", label: "Semifinal" },
    { value: "final", label: "Final" }, { value: "wildcard", label: "Wildcard" },
    { value: "third_place", label: "Third place" }
  ]);
  const GAME_STATUSES = Object.freeze([
    { value: "scheduled", label: "Scheduled" }, { value: "completed", label: "Result" },
    { value: "postponed", label: "Postponed" }, { value: "cancelled", label: "Cancelled" }
  ]);
  function localDate(date = new Date()) {
    return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Vienna" }).format(date);
  }
  function safeUrl(value) {
    if (!String(value || "").trim()) return "";
    const url = new URL(String(value).trim());
    if (!["https:", "http:"].includes(url.protocol)) throw new Error("Links must start with https:// or http://.");
    return url.href;
  }
  function viennaDateTime(value) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("Enter a valid kickoff date and time.");
    const provisional = new Date(`${value}:00Z`);
    if (!Number.isFinite(provisional.getTime())) throw new Error("Invalid kickoff date.");
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Vienna", timeZoneName: "longOffset" }).formatToParts(provisional);
    const offset = parts.find((part) => part.type === "timeZoneName").value.replace("GMT", "");
    const result = `${value}:00${offset}`;
    const check = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Vienna", dateStyle: "short", timeStyle: "short" }).format(new Date(result)).replace(" ", "T");
    if (check !== value) throw new Error("This kickoff time does not exist in Vienna (daylight saving change).");
    return result;
  }
  function validateGame(game) {
    if (!/^\d{4}\/\d{2}$/.test(game.season || "") || Number(game.season.slice(5)) !== (Number(game.season.slice(0, 4)) + 1) % 100) throw new Error("Use a season such as 2026/27.");
    if (!game.homeTeam?.name?.trim() || !game.awayTeam?.name?.trim()) throw new Error("Both teams are required.");
    if (game.homeTeam.name === game.awayTeam.name) throw new Error("Choose two different teams.");
    if (!GAME_ROUNDS.some((option) => option.value === game.round)) throw new Error("Choose a valid round.");
    if (!GAME_STATUSES.some((option) => option.value === game.status)) throw new Error("Choose a valid game status.");
    const date = String(game.startsAt || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error("Enter a valid game date.");
    if (!game.dateOnly && !Number.isFinite(new Date(game.startsAt).getTime())) throw new Error("Enter a valid kickoff time.");
    const scores = [game.homeScore, game.awayScore];
    if (scores.some((score) => score != null) && !scores.every((score) => Number.isInteger(score) && score >= 0 && score <= 999)) throw new Error("Enter both scores as whole numbers, or leave both empty.");
    if (game.status === "completed" && scores.some((score) => score == null)) throw new Error("A completed game needs both scores.");
    if (game.status !== "completed" && scores.some((score) => score != null)) throw new Error("Select Result to save scores.");
    safeUrl(game.streamLink); safeUrl(game.ticketLink);
    return game;
  }
  function roundFor(game) {
    return game.round || (/wildcard/i.test(game.stage) ? "wildcard" : /semi/i.test(game.stage) ? "semifinal" : /3rd/i.test(game.stage) ? "third_place" : /final/i.test(game.stage) ? "final" : "regular");
  }
  function nextGame(games, team, now = new Date()) {
    const today = localDate(now);
    return games.filter((game) => [game.homeTeam?.name, game.awayTeam?.name].includes(team)
      && !["cancelled", "postponed", "completed"].includes(game.status)
      && !(Number.isFinite(game.homeScore) && Number.isFinite(game.awayScore))
      && (game.dateOnly ? game.startsAt.slice(0, 10) >= today : new Date(game.startsAt) >= now))
      .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0] || null;
  }
  function standings(games) {
    const rows = new Map();
    for (const game of games.filter((game) => roundFor(game) === "regular")) {
      for (const team of [game.homeTeam.name, game.awayTeam.name]) if (!rows.has(team)) rows.set(team, { teamName: team, wins: 0, losses: 0, draws: 0, pointsFor: 0, pointsAgainst: 0 });
      if (![game.homeScore, game.awayScore].every(Number.isFinite) || ["cancelled", "postponed"].includes(game.status)) continue;
      for (const [name, scored, conceded] of [[game.homeTeam.name, game.homeScore, game.awayScore], [game.awayTeam.name, game.awayScore, game.homeScore]]) {
        const row = rows.get(name); row.pointsFor += scored; row.pointsAgainst += conceded;
        if (scored > conceded) row.wins++; else if (scored < conceded) row.losses++; else row.draws++;
      }
    }
    return [...rows.values()].map((row) => ({ ...row, diff: row.pointsFor - row.pointsAgainst, pct: (row.wins + row.draws / 2) / (row.wins + row.losses + row.draws || 1) }))
      .sort((a, b) => b.pct - a.pct || b.diff - a.diff || a.teamName.localeCompare(b.teamName)).map((row, i) => ({ ...row, rank: i + 1 }));
  }
  function calendar(games, now = new Date()) {
    const escape = (value) => String(value || "").replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
    const timestamp = (value) => new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Uni Wien Emperors//Games//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
    for (const game of games.filter((game) => game.status !== "cancelled")) {
      lines.push("BEGIN:VEVENT", `UID:${escape(game.id)}@emperors.page`, `DTSTAMP:${timestamp(now)}`);
      if (game.dateOnly) {
        const day = game.startsAt.slice(0, 10);
        const end = new Date(`${day}T12:00:00Z`); end.setUTCDate(end.getUTCDate() + 1);
        lines.push(`DTSTART;VALUE=DATE:${day.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replace(/-/g, "")}`);
      } else {
        lines.push(`DTSTART:${timestamp(game.startsAt)}`, `DTEND:${timestamp(new Date(new Date(game.startsAt).getTime() + 3 * 3600000))}`);
      }
      lines.push(`SUMMARY:${escape(`${game.homeTeam.name} vs ${game.awayTeam.name}`)}`, `LOCATION:${escape([game.venueName, game.venueCity].filter(Boolean).join(", "))}`,
        `DESCRIPTION:${escape([game.subtitle || game.stage, game.dateOnly ? "Kickoff TBA" : "", game.status === "postponed" ? "Postponed — new date TBA" : "", game.ticketLink, game.streamLink].filter(Boolean).join("\n"))}`, "END:VEVENT");
    }
    lines.push("END:VCALENDAR");
    // RFC 5545 lines are folded at 75 UTF-8 octets, without splitting a character.
    return lines.map((line) => {
      let out = "", chunk = "", bytes = 0;
      for (const char of line) {
        const size = new TextEncoder().encode(char).length;
        if (bytes + size > 75) { out += chunk + "\r\n"; chunk = " "; bytes = 1; }
        chunk += char; bytes += size;
      }
      return out + chunk;
    }).join("\r\n") + "\r\n";
  }
  async function batch(items, action, onProgress = () => {}) {
    const succeeded = [], failed = [];
    for (const item of items) {
      try { const result = await action(item); succeeded.push({ item, result }); }
      catch (error) { failed.push({ item, reason: error.message || String(error) }); }
      onProgress(succeeded.length + failed.length, items.length);
    }
    return { succeeded, failed };
  }
  const api = { MEMBERSHIP_STATUSES, FEE_STATUSES, PASS_STATUSES, MEMBER_ROLES, SIDE_OF_BALL, SPONSOR_STATUSES, TRYOUT_STATUSES, TRYOUT_STUDENT_OPTIONS, TRYOUT_EXPERIENCE_OPTIONS, TRYOUT_POSITION_OPTIONS, GAME_ROUNDS, GAME_STATUSES, localDate, safeUrl, viennaDateTime, validateGame, roundFor, nextGame, standings, calendar, batch };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else { root.ClubHubModules = root.ClubHubModules || {}; root.ClubHubModules.workflows = api; }
})(typeof window !== "undefined" ? window : globalThis);
