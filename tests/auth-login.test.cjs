const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('failed login retains escaped email; native form submit signs in once and preserves password whitespace',async()=>{const source=fs.readFileSync('app.bundle.js','utf8');const render=source.slice(source.indexOf('  function renderAuthGate()'),source.indexOf('  async function signInWithEmailPassword('));const bind=source.slice(source.indexOf('  function bindAuthActions()'),source.indexOf('  function bindRecoveryActions()'));const els={'auth-email':{value:'player@example.com'},'auth-password':{value:' wrong password '},'auth-sign-in':{},'auth-sign-in-form':{}};let calls=0,mounts=[];const ctx={document:{getElementById:id=>els[id]||null},authState:{},authEmailDraft:'',authActionActive:()=>false,shouldRequireAuth:()=>true,escapeAttribute:s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;'),showToast(){},recordDiagnostic(){},summarizeDiagnosticError:e=>e.message,signInWithEmailPassword:async(email,password)=>{calls++;assert.equal(email,'player@example.com');assert.equal(password,' wrong password ');throw Error('Invalid credentials.');},mount(){mounts.push(ctx.renderAuthGate());}};vm.createContext(ctx);vm.runInContext(render+bind,ctx);ctx.bindAuthActions();let prevented=false;await els['auth-sign-in-form'].onsubmit({preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(calls,1);assert.equal(ctx.authState.status,'Invalid credentials.');assert.match(mounts.at(-1),/value="player@example.com"/);assert.match(mounts.at(-1),/<form id="auth-sign-in-form"/);assert.match(mounts.at(-1),/id="auth-sign-in" type="submit"/);ctx.authEmailDraft='" onfocus="bad';assert.match(ctx.renderAuthGate(),/value="&quot; onfocus=&quot;bad"/);});
test('session role lookup is bounded, shares pending requests and ignores a previous account', async () => {
  const source = fs.readFileSync('app.bundle.js', 'utf8');
  const helper = source.slice(source.indexOf('  let authRoleLookup = null;'), source.indexOf('  function renderAuthGate()'));
  let release;
  const calls = [];
  const ctx = {
    authState: { user: { id: 'admin-id' }, roles: [], rolePending: true },
    currentAccessRole: 'player', ACCESS_KEY: 'access',
    capabilitySet: roles => [...new Set(roles)],
    primaryRoleFromRoles: roles => roles.includes('admin') ? 'admin' : 'player',
    parseJsonArrayField: (value, fallback) => value || fallback,
    saveStoredValue() {},
    backendClient: { from(table) { return {
      select() { return this; }, eq(key, value) { calls.push({table, key, value}); return this; },
      limit(n) { calls.at(-1).limit = n; return new Promise(resolve => { release = resolve; }); }
    }; } }
  };
  vm.createContext(ctx); vm.runInContext(helper, ctx);
  const first = ctx.resolveSessionRoles(), second = ctx.resolveSessionRoles();
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { table: 'member_roles', key: 'profile_id', value: 'admin-id', limit: 20 });
  release({ data: [{ role_code: 'admin' }] }); await Promise.all([first, second]);
  assert.equal(ctx.currentAccessRole, 'admin'); assert.equal(ctx.authState.rolePending, false);
  const stale = ctx.resolveSessionRoles();
  ctx.authState.user = { id: 'other-id' }; ctx.currentAccessRole = 'player';
  release({ data: [{ role_code: 'admin' }] }); await stale;
  assert.equal(ctx.currentAccessRole, 'player');
});

test('standings remain a table while member tables receive mobile card labels', () => {
  const make = standings => {
    const classes = new Set(standings ? ['work-responsive-table'] : []);
    return { classes, matches: () => standings, closest: () => null,
      classList: { add: name => classes.add(name), remove: name => classes.delete(name) },
      querySelector: () => null, querySelectorAll: () => [] };
  };
  const standings = make(true), members = make(false);
  const root = { addEventListener() {} };
  const document = { querySelectorAll: selector => selector === 'table' ? [standings, members] : [] };
  vm.runInNewContext(fs.readFileSync('src/modules/workspace-ui.js', 'utf8'), { window: root, document, setTimeout });
  root.ClubHubModules.workspaceUi.enhance();
  assert.equal(standings.classes.has('work-responsive-table'), false);
  assert.equal(members.classes.has('work-responsive-table'), true);
});
