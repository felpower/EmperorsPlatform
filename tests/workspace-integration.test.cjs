const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const w = require("../src/modules/club-workflows.js");

async function app({ now } = {}) {
  const storage = () => { const values = new Map(); return { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key) }; };
  const localStorage = storage(), sessionStorage = storage();
  const window = { ClubHubModules: { workflows: w }, location: { hostname: "localhost", origin: "http://localhost", pathname: "/", search: "", hash: "" }, localStorage, sessionStorage, addEventListener() {} };
  const document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} };
  const sandbox = { window, document, localStorage, sessionStorage, URL, URLSearchParams, Blob, TextEncoder, console, setTimeout, clearTimeout, navigator: {}, crypto: require("node:crypto").webcrypto };
  const context = vm.createContext(sandbox);
  // Optional frozen clock so date-dependent views (upcoming games) don't break as real time passes.
  if (now) vm.runInContext(`(() => { const Real = Date, fixed = new Real(${JSON.stringify(now)}).getTime(); class FrozenDate extends Real { constructor(...args) { super(...(args.length ? args : [fixed])); } static now() { return fixed; } } globalThis.Date = FrozenDate; })();`, context);
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
      bulkFees:updateFeeStatusesBulkViaRemote, updateFee:updateFeeRowViaRemote,
      setReloadHandler:value=>{reloadBootstrapAfterWrite=value;}, getData:()=>state, applyFeeRows:applyConfirmedFeeRows,
      setRates:value=>{feeRates=value;}, renderFees
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
  a.setRates([...w.DEFAULT_FEE_RATES,{fee_period:"Q2_2027",normal_cents:9500,rookie_cents:5500}]);
  a.setData({fees:[{id:"fee",feePeriod:"Q2_2027",amount:95}]});
  await a.updateFee({feeId:"fee",status:"paid_rookie_fee",amount:95,paidAmount:95});
  assert.equal(writes[4].amount_cents,5500);assert.equal(writes[4].paid_cents,5500);
  await a.bulkFees({feePeriod:"Q3_2027",status:"paid",memberIds:["member"]});
  assert.equal(writes[5].amount_cents,9500);
  assert.match(a.renderFees(),/Normaler Beitrag/);assert.match(a.renderFees(),/Rookie-Beitrag/);
});

test("admin overview excludes waived fees and inactive/deleted pass alerts", async () => {
  const a = await app(); a.setData({ members:[member(),member({id:"inactive",membershipStatus:"exited"}),member({id:"deleted",deletedAt:"2026-10-01"})], fees:[{memberId:"member",amount:82.5,paidAmount:0,status:"pending"},{memberId:"member",amount:82.5,paidAmount:0,status:"exempt"},{memberId:"deleted",amount:82.5,paidAmount:0,status:"pending"}] });
  assert.equal(a.dashboardFees().length, 1); assert.equal(a.dashboardPasses().length, 1);
  assert.match(a.dashboard(), /Club dashboard/);
});
test("new and archived seasons stay switchable; next game and individual calendar controls render", async () => {
  const a = await app({ now: "2026-10-01T10:00:00+02:00" }); a.selectSeason("2025/26");
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


test("confirmed fee edits update local balances and member badges without reloading unrelated tables", async()=>{
  const a=await app();
  a.setData({members:[member({memberIban:'AT-MEMBER'})],fees:[
    {id:'old',memberId:'member',feePeriod:'Q2_2026',amount:82.5,paidAmount:0,status:'pending',iban:''},
    {id:'fee',memberId:'member',feePeriod:'Q3_2026',amount:82.5,paidAmount:0,status:'pending',iban:''}
  ]});
  let writes=0;
  a.setBackend({from:table=>{assert.equal(table,'membership_fees');return {update(){writes++;return {eq:()=>Promise.resolve({error:null})};}};}});
  a.setReloadHandler(()=>{throw Error('Unexpected full bootstrap reload');});
  await a.updateFee({feeId:'fee',status:'paid',amount:82.5,paidAmount:0,note:'confirmed'});
  assert.equal(writes,1);assert.equal(a.getData().fees.find(x=>x.id==='fee').paidAmount,82.5);
  assert.equal(a.getData().fees.find(x=>x.id==='old').status,'pending');
  assert.equal(a.getData().members[0].feeStatus,'paid');assert.equal(a.getData().members[0].iban,'AT-MEMBER');
  a.applyFeeRows([{id:'new',member_id:'member',fee_period:'Q4_2026',amount_cents:9000,paid_cents:0,status:'not_collected'}]);
  assert.equal(a.getData().fees.length,3);assert.equal(a.getData().members[0].feeStatus,'not_collected');
});

test("a partially failed bulk fee edit retains confirmed rows and leaves the rejected row unchanged",async()=>{
  const a=await app();
  a.setData({members:[member()],fees:['one','two'].map(id=>({id,memberId:'member',feePeriod:'Q4_2026',amount:90,paidAmount:0,status:'pending'}))});
  a.setBackend({from:()=>({select(){return this;},eq(){return this;},in:async()=>({data:['one','two'].map(id=>({id,member_id:'member',fee_period:'Q4_2026',amount_cents:9000,paid_cents:0}))}),update:()=>({eq:async(field,id)=>({error:id==='two'?{message:'temporary failure'}:null})})})});
  a.setReloadHandler(()=>{throw Error('Unexpected full bootstrap reload');});
  await assert.rejects(a.bulkFees({feePeriod:'Q4_2026',status:'paid',memberIds:['member']}));
  assert.equal(a.getData().fees.find(x=>x.id==='one').status,'paid');
  assert.equal(a.getData().fees.find(x=>x.id==='two').status,'pending');
});
