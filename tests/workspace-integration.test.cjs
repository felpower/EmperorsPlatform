const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const w = require("../src/modules/club-workflows.js");

async function app() {
  const storage = () => { const values = new Map(); return { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key) }; };
  const localStorage = storage(), sessionStorage = storage();
  const window = { ClubHubModules: { workflows: w }, location: { hostname: "localhost", origin: "http://localhost", pathname: "/", search: "", hash: "" }, localStorage, sessionStorage, addEventListener() {} };
  const document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} };
  const sandbox = { window, document, localStorage, sessionStorage, URL, URLSearchParams, Blob, TextEncoder, console, setTimeout, clearTimeout, navigator: {}, crypto: require("node:crypto").webcrypto };
  const context = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync("src/modules/games-workspace.js", "utf8"), context);
  const source = fs.readFileSync("app.bundle.js", "utf8").replace("const backendClient =", "let backendClient =");
  const cut = source.indexOf("  leagueGamesStore = moduleRegistry.gamesWorkspace.create({");
  const boot = `
    authState.user = { id: "admin", user_metadata: {password_set: true} }; currentAccessRole = "admin"; hasBootstrapped = true;
    leagueGamesStore = window.ClubHubModules.gamesWorkspace.create({ backend:null, workflows, fallback:[...LEGACY_LEAGUE_GAMES.map(game=>({...game,season:"2025/26"})),...CURRENT_LEAGUE_GAMES.map(game=>({...game,season:"2026/27"}))], canManage:()=>true,isLocal:()=>true,changed:()=>{},escape:escapeAttribute,download:()=>{} });
    window.testApp = {
      setData: data => { state = {...state,...data}; }, setTryouts: rows => { tryoutSubmissions=rows;tryoutSubmissionsLoadedAt=1; }, setSponsors: rows => {sponsorOutreachRows=rows;},
      setTryoutFilter: status => {tryoutSubmissionFilters={search:"",uniWien:"all",experience:"all",status};},
      setFeeFilter: value => {selectedFeePeriod=value;}, setPassFilter: value => {passFilters=value;},
      dashboard: renderAdminDashboard, dashboardFees: dashboardFeeRows, dashboardPasses: dashboardPassMembers,
      renderGames: renderGamesBoard, selectSeason: selectGamesSeason, season:()=>selectedGamesSeason,
      filteredFees, currentFeePeriod, ensureValidFeeFilter, filteredTryouts: filteredTryoutSubmissions, filteredPasses: filteredPassMembers,
      tryoutOptions: tryoutSubmissionStatusOptions, tryoutLabel, renderTryouts:renderTryoutSubmissionsPanel,
      memberAction:renderTryoutMemberAction, updateStatus:updateTryoutSubmissionStatus,
      setBackend: value => {backendClient=value;reloadBootstrapAfterWrite=async()=>{};},
      bulkFees:updateFeeStatusesBulkViaRemote, updateFee:updateFeeRowViaRemote
    }; return;
  })();`;
  await vm.runInContext(source.slice(0, cut) + boot, context, { timeout: 3000 });
  return window.testApp;
}
const member = (patch = {}) => ({ id: "member", name: "Test Player", firstName: "Test", lastName: "Player", roles: ["player"], positions: [], membershipStatus: "active", passStatus: "missing", ...patch });

test("single and bulk rookie payments persist both amounts as 50 EUR; regular bulk uses the quarter tariff", async () => {
  const a = await app(), writes = [];
  a.setBackend({from:()=>({select(){return this;},eq(){return this;},in(){return Promise.resolve({data:[{id:"fee",amount_cents:8250,paid_cents:0}]});},update(patch){writes.push(patch);return {eq:()=>Promise.resolve({error:null})};}})});
  await a.updateFee({feeId:"fee",status:"paid_rookie_fee",amount:90,paidAmount:90});
  assert.equal(writes[0].amount_cents,5000);assert.equal(writes[0].paid_cents,5000);
  await a.bulkFees({feePeriod:"Q4_2026",status:"paid_rookie_fee",memberIds:["member"]});
  assert.equal(writes[1].amount_cents,5000);assert.equal(writes[1].paid_cents,5000);
  await a.bulkFees({feePeriod:"Q4_2026",status:"paid",memberIds:["member"]});
  assert.equal(writes[2].amount_cents,9000);assert.equal(writes[2].paid_cents,9000);
  await a.bulkFees({feePeriod:"Q3_2026",status:"paid",memberIds:["member"]});
  assert.equal(writes[3].amount_cents,8250);
});

test("admin overview excludes waived fees and inactive/deleted pass alerts", async () => {
  const a = await app(); a.setData({ members:[member(),member({id:"inactive",membershipStatus:"exited"}),member({id:"deleted",deletedAt:"2026-10-01"})], fees:[{memberId:"member",amount:82.5,paidAmount:0,status:"pending"},{memberId:"member",amount:82.5,paidAmount:0,status:"exempt"},{memberId:"deleted",amount:82.5,paidAmount:0,status:"pending"}] });
  assert.equal(a.dashboardFees().length, 1); assert.equal(a.dashboardPasses().length, 1);
  assert.match(a.dashboard(), /Club dashboard/);
});
test("new and archived seasons stay switchable; next game and individual calendar controls render", async () => {
  const a = await app(); a.selectSeason("2025/26");
  assert.match(a.renderGames(), /Games &amp; results|Games & results/); assert.match(a.renderGames(), /2025\/26/);
  a.selectSeason("2026/27"); const html = a.renderGames();
  assert.match(html, /data-calendar-game="g-2627-2"/); assert.match(html, /data-calendar-season/); assert.match(html, /Manage games/);
  assert.match(html, /2026-10-18/); assert.match(html, /15:30/);
});
test("all-quarter fee overview preserves the filter and blocks quarter exports", async () => {
  const a = await app(); a.setData({fees:[{id:"one",memberId:"member",feePeriod:"Q2_2026",status:"pending"},{id:"two",memberId:"member",feePeriod:"Q3_2026",status:"pending"}]});
  a.setFeeFilter("all");a.ensureValidFeeFilter();assert.equal(a.currentFeePeriod(),"");assert.equal(a.filteredFees().length,2);
});
test("tryout status enum includes attendance and member linkage; attendance filter includes invited and no-show", async () => {
  const a = await app(); a.setTryouts([{id:"one",status:"invited"},{id:"two",status:"attended"},{id:"three",status:"joined"},{id:"four",status:"no_show"}]);
  a.setTryoutFilter("attendance");assert.equal(a.filteredTryouts().length,3);
  assert.ok(a.tryoutOptions().includes("attended"));assert.equal(a.tryoutLabel("status","joined"),"Became a member");
  assert.match(a.memberAction({id:"one",status:"attended"}),/Create \/ link member/);
  assert.match(a.memberAction({id:"one",status:"joined",linkedMemberId:"member"}),/View member/);
  await assert.rejects(a.updateStatus("one","joined"),/Create \/ link member/);
});
test("pass dashboard drilldown includes expiring players even when their stored status is valid", async () => {
  const a = await app(); const soon = new Date();soon.setDate(soon.getDate()+5);
  a.setData({members:[member({id:"soon",passStatus:"valid",passExpiry:soon.toISOString().slice(0,10)}),member({id:"later",passStatus:"valid",passExpiry:"2030-01-01"})]});
  a.setPassFilter({search:"",statuses:[],positions:[],membership:["active"],from:"",to:"",needsReviewOnly:true});
  assert.equal(a.filteredPasses().length,1);assert.equal(a.filteredPasses()[0].id,"soon");
});

test("single-row failures preserve the actual Appwrite error and failed id", async () => {
  class Client { setEndpoint() { return this; } setProject() { return this; } }
  class Account {}
  class TablesDB {
    async listRows() { return { rows: [{ $id: "submission", status: "new" }] }; }
    async updateRow() { throw new Error("Invalid document structure: age is required"); }
  }
  const window = { ClubHubAppwriteConfig: { projectId:"test", databaseId:"test" }, Appwrite: { Client, Account, TablesDB, ID:{unique:()=>"id"},Query:{limit:()=>"limit",equal:()=>"equal"} } };
  const context = vm.createContext({ window, console, setTimeout, localStorage:{getItem:()=>null,setItem(){}}, fetch:()=>{throw Error("unexpected network request");} });
  vm.runInContext(fs.readFileSync("src/appwrite-backend-compat.js","utf8"),context);
  const result = await window.ClubHubDataClient.createClient().from("tryout_registrations").update({status:"invited"}).eq("id","submission").select("*").single();
  assert.match(result.error.message,/age is required/);assert.equal(result.partialFailures[0].id,"submission");
});
