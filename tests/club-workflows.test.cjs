const test = require("node:test");
const assert = require("node:assert/strict");
const w = require("../src/modules/club-workflows.js");
const game = (patch = {}) => ({ id: "one", season: "2026/27", startsAt: "2026-10-18T15:30:00+02:00", dateOnly: false, homeTeam: { name: "Emperors" }, awayTeam: { name: "Astros" }, round: "regular", status: "scheduled", ...patch });

test("Vienna kickoff conversion follows summer and winter offsets and rejects nonexistent times", () => {
  assert.equal(w.viennaDateTime("2026-10-18T15:30"), "2026-10-18T15:30:00+02:00");
  assert.equal(w.viennaDateTime("2026-11-07T19:00"), "2026-11-07T19:00:00+01:00");
  assert.throws(() => w.viennaDateTime("2027-03-28T02:30"));
  assert.throws(() => w.viennaDateTime("2027-02-30T12:30"));
});
test("game validation rejects invalid dates, half scores, wrong season and unsafe links", () => {
  assert.equal(w.validateGame(game()).id, "one");
  for (const patch of [{ season: "2026/28" }, { startsAt: "2027-02-30", dateOnly: true }, { homeScore: 12 }, { status: "completed" }, { ticketLink: "javascript:alert(1)" }, { homeScore: 1, awayScore: 2 }]) assert.throws(() => w.validateGame(game(patch)));
  assert.doesNotThrow(() => w.validateGame(game({ status: "completed", homeScore: 0, awayScore: 7 })));
});
test("next game skips completed, cancelled, postponed and past games but keeps date-only games today", () => {
  const now = new Date("2026-10-18T11:00:00Z");
  const next = w.nextGame([game({ id: "cancelled", status: "cancelled" }), game({ id: "final", status: "completed", homeScore: 0, awayScore: 7 }), game({ id: "late", startsAt: "2026-10-24T18:30:00+02:00" }), game()], "Emperors", now);
  assert.equal(next.id, "one");
  assert.equal(w.nextGame([game({ startsAt: "2026-10-18", dateOnly: true })], "Emperors", new Date("2026-10-18T20:00:00Z")).id, "one");
});
test("calendar exports timed games in UTC, TBA games as all-day, escapes content and folds UTF8 lines", () => {
  const ics = w.calendar([game({ venueName: "Wien, Österreich; Süd\\Nord", subtitle: "ä".repeat(100) }), game({ id: "tba", dateOnly: true, startsAt: "2027-06-26" })], new Date("2026-10-06T12:00:00Z"));
  assert.match(ics, /DTSTART:20261018T133000Z/);
  assert.match(ics, /DTSTART;VALUE=DATE:20270626/);
  assert.match(ics, /DTEND;VALUE=DATE:20270627/);
  assert.match(ics, /Wien\\, Österreich\\; Süd\\\\Nord/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  for (const line of ics.split("\r\n")) assert.ok(Buffer.byteLength(line) <= 75);
});
test("standings exclude playoffs and preserve zero scores", () => {
  const rows = w.standings([game({ status: "completed", homeScore: 7, awayScore: 0 }), game({ round: "final", status: "completed", homeScore: 0, awayScore: 100 })]);
  assert.equal(rows[0].teamName, "Emperors"); assert.equal(rows[0].wins, 1); assert.equal(rows[0].pointsAgainst, 0);
});
test("batch records partial failures and retries only failed entries", async () => {
  const result = await w.batch(["a", "b", "c"], async (id) => { if (id === "b") throw new Error("database unavailable"); return id; });
  assert.deepEqual(result.succeeded.map((item) => item.item), ["a", "c"]);
  const retried = []; await w.batch(result.failed.map((item) => item.item), async (id) => retried.push(id));
  assert.deepEqual(retried, ["b"]);
});
test("fee tariffs change at Q4 2026 and rookie fees remain 50 EUR", () => {
  assert.equal(w.standardFeeCents("Q3_2026"), 8250);
  assert.equal(w.standardFeeCents("Q4_2025"), 8250);
  assert.equal(w.standardFeeCents("Q4_2026"), 9000);
  assert.equal(w.standardFeeCents("Q1_2027"), 9000);
  assert.equal(w.feeCentsForStatus("paid_rookie_fee", "Q3_2026", 8250), 5000);
  assert.equal(w.feeCentsForStatus("paid_rookie_fee", "Q1_2027", 9000), 5000);
  assert.equal(w.feeCentsForStatus("paid", "Q4_2026", 5000), 9000);
  assert.equal(w.feeCentsForStatus("partial", "Q4_2026", 4500), 4500);
});

test("editable contribution schedules apply chronologically and keep historical rates", () => {
  const rates=[...w.DEFAULT_FEE_RATES,{fee_period:"Q2_2027",normal_cents:9500,rookie_cents:5500}];
  assert.equal(w.standardFeeCents("Q1_2027",rates),9000);
  assert.equal(w.standardFeeCents("Q2_2027",rates),9500);
  assert.equal(w.standardFeeCents("Q4_2028",rates),9500);
  assert.equal(w.feeCentsForStatus("paid_rookie_fee","Q3_2027",9000,rates),5500);
  assert.equal(w.feeCentsForStatus("paid_rookie_fee","Q3_2026",8250,rates),5000);
});
