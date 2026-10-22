const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');

function client(listRows) {
  class Client {setEndpoint(){return this;}setProject(){return this;}}
  class Account {}
  class TablesDB {listRows(...args){return listRows(...args);}}
  const Query={limit:n=>({type:'limit',n}),equal:(key,values)=>({type:'equal',key,values}),orderDesc:key=>({type:'orderDesc',key}),orderAsc:key=>({type:'orderAsc',key})};
  const window={ClubHubAppwriteConfig:{projectId:'test',databaseId:'test'},Appwrite:{Client,Account,TablesDB,Query,ID:{unique:()=> 'id'}}};
  vm.runInNewContext(fs.readFileSync('src/appwrite-backend-compat.js','utf8'),{window,console,setTimeout,localStorage:{getItem:()=>null,setItem(){}}});
  return window.ClubHubDataClient.createClient();
}

test('ordering fallback retains the server filter and requested read limit',async()=>{
  const calls=[];
  const api=client(async(db,table,queries)=>{
    calls.push(queries);
    if(calls.length===1)throw Object.assign(Error('unsupported ordering'),{code:400});
    return {rows:[{$id:'log',scope:'web-analytics'}]};
  });
  const result=await api.from('diagnostics_logs').select('*').eq('scope','web-analytics').order('$createdAt',{ascending:false}).limit(25);
  assert.equal(result.error,null);assert.equal(calls.length,2);
  for(const queries of calls){assert.equal(queries.find(x=>x.type==='limit').n,25);assert.equal(queries.find(x=>x.type==='equal').key,'scope');}
  assert.equal(calls[1].some(x=>x.type==='orderDesc'),false);
});

test('a network error cannot fall back to a full table read',async()=>{
  let calls=0;
  const api=client(async()=>{calls++;throw Object.assign(Error('network failure'),{code:503});});
  const result=await api.from('diagnostics_logs').select('*').order('$createdAt',{ascending:false}).limit(25);
  assert.match(result.error.message,/network/);assert.equal(calls,1);
});

test('private member details are queried only for displayed IDs and in bounded chunks',async()=>{
  const calls=[];
  const rows=Array.from({length:121},(_,i)=>({$id:'member-'+i,first_name:'Player',last_name:String(i)}));
  const api=client(async(db,table,queries)=>{
    if(table==='members')return {rows};
    assert.equal(table,'member_private');calls.push(queries);
    const filter=queries.find(x=>x.type==='equal');assert.equal(filter.key,'$id');assert.ok(filter.values.length<=50);
    assert.equal(queries.find(x=>x.type==='limit').n,filter.values.length);
    return {rows:filter.values.map(id=>({$id:id,iban:'IBAN-'+id}))};
  });
  const result=await api.from('members').select('*');
  assert.equal(result.error,null);assert.equal(calls.length,3);assert.equal(result.data.length,121);
  assert.equal(result.data[120].iban,'IBAN-member-120');
});

test('settings binding performs no log or statistics reads until their buttons are clicked',async()=>{
  const source=fs.readFileSync('app.bundle.js','utf8');
  const code=source.slice(source.indexOf('  function bindDiagnosticsActions()'),source.indexOf('  function bindFeeEditModeActions()'));
  const elements={'refresh-website-analytics':{},'refresh-remote-diagnostics-log':{}};
  let logs=0,statistics=0;
  const ctx={document:{getElementById:id=>elements[id]},loadWebsiteAnalytics:async()=>{statistics++;},loadRemoteDiagnosticsLog:async()=>{logs++;}};
  vm.createContext(ctx);vm.runInContext(code,ctx);ctx.bindDiagnosticsActions();
  assert.equal(logs,0);assert.equal(statistics,0);
  await elements['refresh-website-analytics'].onclick();await elements['refresh-remote-diagnostics-log'].onclick();
  assert.equal(logs,1);assert.equal(statistics,1);
});

test('equipment loader skips unrelated pages and shares concurrent equipment requests',async()=>{
  const source=fs.readFileSync('app.bundle.js','utf8');
  const code=source.slice(source.indexOf('  let equipmentLoadPromise = null;'),source.indexOf('  async function loadEquipmentDataWithCacheNow()'));
  let view='members',calls=0,release;
  const ctx={getRouteView:()=>view,loadEquipmentDataWithCacheNow:()=>{calls++;return new Promise(resolve=>{release=resolve;});}};
  vm.createContext(ctx);vm.runInContext(code,ctx);
  await ctx.loadEquipmentDataWithCache();assert.equal(calls,0);
  view='equipment';const first=ctx.loadEquipmentDataWithCache(),second=ctx.loadEquipmentDataWithCache();
  assert.equal(calls,1);release();await Promise.all([first,second]);
});
