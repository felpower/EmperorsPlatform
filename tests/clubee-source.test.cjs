const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function setup() {
  let clientReads = 0;
  const dialog = { open:false, innerHTML:'', querySelector:()=>({}), showModal(){this.open=true;} };
  const window = { addEventListener(){}, postMessage(){}, ClubHubDataClient:{createClient(){clientReads++;throw new Error('Must not query members for an invalid source');}} };
  vm.runInNewContext(fs.readFileSync('src/modules/clubee-sync.js','utf8'), {window,document:{getElementById:()=>dialog},location:{origin:'https://emperors.page'}});
  return {api:window.ClubHubModules.clubeeSync,dialog,reads:()=>clientReads};
}
const member={clubeeId:'123',firstName:'Jan',lastName:'Märzinger'};
const payload=()=>({at:Date.now(),group:'431040',season:'220',scope:'season-team',complete:true,total:1,members:[member]});
test('empty Clubee list cannot classify every website member as missing',()=>{
  const {api}=setup();
  assert.throws(()=>api.buildPlan([],Array.from({length:73},(_,i)=>({id:i,membership_status:'active'})),[]),/Keine Clubee-Mitglieder/);
});
test('empty or wrong-season sources render an abort dialog before querying any member data',async()=>{
  for(const patch of [{members:[],total:0},{group:'431212'},{season:'219'},{complete:false},{total:72}]){
    const h=setup();await h.api.open({...payload(),...patch});
    assert.equal(h.reads(),0);assert.equal(h.dialog.open,true);
    assert.match(h.dialog.innerHTML,/Abgleich abgebrochen/);
    assert.ok(!h.dialog.innerHTML.includes('data-create'));
    assert.ok(!h.dialog.innerHTML.includes('Alles aktuell'));
  }
});
test('only a fresh complete AllAges 2026/2027 snapshot is accepted',()=>{
  const {api}=setup();api.validateSource(payload());
  for(const patch of [{at:Date.now()-1000000},{at:Date.now()+120000},{scope:'all-contacts'},{total:2}])assert.throws(()=>api.validateSource({...payload(),...patch}));
  assert.throws(()=>api.validateSource({...payload(),members:[member,member],total:2}),/doppelte IDs/);
});
