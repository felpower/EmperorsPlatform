const { exportState, loadState, resetState, saveState } = window.ClubHubStore;
const {
  renderDashboard,
  renderEvents,
  renderFees,
  renderInvites,
  renderMembers,
  renderPasses,
  renderSettings
} = window.ClubHubRender;

let state = loadState();
let authState = {
  email: "",
  mode: "demo",
  status:
    window.location.protocol === "file:"
      ? "Demo mode active. For Supabase login, open this app through a web server or GitHub Pages."
      : "Demo mode active. Sign in to use Supabase live data.",
  canSync: false,
  user: null
};

const supabaseConfig = window.ClubHubSupabaseConfig;
const supabaseClient =
  window.supabase && supabaseConfig?.url && supabaseConfig?.publishableKey
    ? window.supabase.createClient(
        supabaseConfig.url,
        supabaseConfig.publishableKey,
        {
          auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true
          }
        }
      )
    : null;

const viewIds = [
  "dashboard",
  "members",
  "fees",
  "passes",
  "events",
  "invites",
  "settings"
];

function mount() {
  renderHeroNotice();
  document.getElementById("dashboard").innerHTML = renderDashboard(state);
  document.getElementById("members").innerHTML = renderMembers(state);
  document.getElementById("fees").innerHTML = renderFees(state);
  document.getElementById("passes").innerHTML = renderPasses(state);
  document.getElementById("events").innerHTML = renderEvents(state);
  document.getElementById("invites").innerHTML = renderInvites(state);
  document.getElementById("settings").innerHTML = renderSettings({ auth: authState });

  bindMemberDialog();
  bindAuthPanel();
}

function renderHeroNotice() {
  const heroActions = document.querySelector(".hero-actions");
  if (!heroActions) {
    return;
  }

  const noticeClass =
    authState.mode === "live"
      ? "notice is-live"
      : authState.mode === "error"
        ? "notice is-error"
        : "notice";

  heroActions.innerHTML = `
    <div class="hero-stack">
      <div class="${noticeClass}">
        <span class="notice-dot"></span>
        <span>${authState.status}</span>
      </div>
      <div class="button-row">
        <button id="seed-demo" class="primary-button">Reset Demo Data</button>
        <button id="export-demo" class="ghost-button">Export JSON</button>
      </div>
    </div>
  `;

  bindHeaderActions();
}

function switchView(nextViewId) {
  for (const viewId of viewIds) {
    document.getElementById(viewId).classList.toggle("active", viewId === nextViewId);
  }

  for (const button of document.querySelectorAll(".nav-link")) {
    button.classList.toggle("active", button.dataset.view === nextViewId);
  }
}

function bindNavigation() {
  document.querySelectorAll(".nav-link").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });
}

function bindHeaderActions() {
  document.getElementById("seed-demo").addEventListener("click", () => {
    state = resetState();
    mount();
  });

  document.getElementById("export-demo").addEventListener("click", () => {
    exportState(state);
  });
}

function bindAuthPanel() {
  const authForm = document.getElementById("auth-form");
  const loadButton = document.getElementById("load-live-data");
  const syncButton = document.getElementById("sync-demo-data");
  const signOutButton = document.getElementById("sign-out");

  if (authForm) {
    authForm.onsubmit = async (event) => {
      event.preventDefault();
      const formData = new FormData(authForm);
      const email = String(formData.get("email")).trim();
      authState.email = email;

      if (!supabaseClient) {
        authState = {
          ...authState,
          mode: "error",
          status: "Supabase client could not be created in this browser."
        };
        mount();
        return;
      }

      const { error } = await supabaseClient.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.href.startsWith("http")
            ? window.location.href
            : undefined
        }
      });

      authState = {
        ...authState,
        mode: error ? "error" : "demo",
        status: error
          ? `Magic link failed: ${error.message}`
          : `Magic link sent to ${email}. Open the link on the same hosted app URL, then use "Load live data".`
      };
      mount();
    };
  }

  if (loadButton) {
    loadButton.onclick = async () => {
      await loadLiveData();
    };
  }

  if (syncButton) {
    syncButton.onclick = async () => {
      await syncDemoMembers();
    };
  }

  if (signOutButton) {
    signOutButton.onclick = async () => {
      if (supabaseClient) {
        await supabaseClient.auth.signOut();
      }
      authState = {
        email: authState.email,
        mode: "demo",
        status: "Signed out. Demo mode active.",
        canSync: false,
        user: null
      };
      state = loadState();
      mount();
    };
  }
}

function normalizeMembers(rows) {
  return rows.map((row) => ({
    id: row.id,
    name: row.display_name,
    email: row.email,
    roles: row.member_roles?.map((item) => item.role_code) ?? [],
    jerseyNumber: row.jersey_number,
    membershipStatus: row.membership_status,
    passStatus: row.player_pass_status,
    passExpiry: row.player_pass_expires_on ?? "2026-12-31",
    feeStatus: "pending",
    notes: row.notes ?? "",
    lastInviteResponse: "pending"
  }));
}

async function loadLiveData() {
  if (!supabaseClient) {
    authState = {
      ...authState,
      mode: "error",
      status: "Supabase client is unavailable."
    };
    mount();
    return;
  }

  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

  if (!session) {
    authState = {
      ...authState,
      mode: "demo",
      status:
        window.location.protocol === "file:"
          ? "No active session. Supabase sign-in works best on GitHub Pages or another web host."
          : "No active Supabase session yet. Sign in with a magic link first."
    };
    mount();
    return;
  }

  const [membersResult, feesResult, eventsResult, invitesResult] = await Promise.all([
    supabaseClient
      .from("members")
      .select("id, display_name, email, jersey_number, membership_status, player_pass_status, player_pass_expires_on, notes, member_roles(role_code)"),
    supabaseClient
      .from("membership_fees")
      .select("id, member_id, season_label, amount_cents, paid_cents, due_date"),
    supabaseClient
      .from("events")
      .select("id, title, event_type, starts_at, location"),
    supabaseClient
      .from("invites")
      .select("id, event_id, channel, sent_at, recipient_count")
  ]);

  const firstError = [
    membersResult.error,
    feesResult.error,
    eventsResult.error,
    invitesResult.error
  ].find(Boolean);

  if (firstError) {
    authState = {
      ...authState,
      mode: "error",
      canSync: false,
      user: session.user,
      status: `Connected to Supabase, but live tables are not ready yet: ${firstError.message}`
    };
    mount();
    return;
  }

  const liveMembers = normalizeMembers(membersResult.data ?? []);
  const liveFees = (feesResult.data ?? []).map((row) => ({
    id: row.id,
    memberId: row.member_id,
    season: row.season_label,
    amount: Math.round((row.amount_cents ?? 0) / 100),
    paidAmount: Math.round((row.paid_cents ?? 0) / 100),
    status:
      (row.paid_cents ?? 0) >= (row.amount_cents ?? 0)
        ? "paid"
        : (row.paid_cents ?? 0) > 0
          ? "due"
          : "overdue",
    dueDate: row.due_date
  }));
  const feeStatusByMember = new Map(liveFees.map((fee) => [fee.memberId, fee.status]));

  state = {
    members: liveMembers.map((member) => ({
      ...member,
      feeStatus: feeStatusByMember.get(member.id) ?? "pending"
    })),
    fees: liveFees,
    events: (eventsResult.data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      type: row.event_type,
      date: row.starts_at,
      location: row.location,
      inviteStatus: "live",
      attending: [],
      maybe: [],
      unavailable: []
    })),
    invites: (invitesResult.data ?? []).map((row) => ({
      id: row.id,
      eventId: row.event_id,
      channel: row.channel,
      sentAt: row.sent_at,
      recipients: row.recipient_count,
      opens: 0,
      confirmations: 0
    }))
  };

  authState = {
    ...authState,
    mode: "live",
    canSync: true,
    user: session.user,
    status: `Live Supabase data loaded for ${session.user.email}.`
  };
  mount();
}

async function syncDemoMembers() {
  if (!supabaseClient) {
    return;
  }

  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

  if (!session) {
    authState = {
      ...authState,
      mode: "demo",
      status: "Sign in before syncing demo data."
    };
    mount();
    return;
  }

  const membersPayload = state.members.map((member) => ({
    display_name: member.name,
    email: member.email,
    jersey_number: member.jerseyNumber,
    membership_status: member.membershipStatus,
    player_pass_status: member.passStatus,
    player_pass_expires_on: member.passExpiry,
    notes: member.notes
  }));

  const { error } = await supabaseClient.from("members").insert(membersPayload);

  authState = {
    ...authState,
    mode: error ? "error" : "live",
    status: error
      ? `Sync failed: ${error.message}`
      : "Demo members synced to Supabase. Load live data to refresh."
  };
  mount();
}

function bindMemberDialog() {
  const openButton = document.getElementById("open-member-dialog");
  const dialog = document.getElementById("member-dialog");
  const form = document.getElementById("member-form");

  if (!openButton || !dialog || !form) {
    return;
  }

  openButton.addEventListener("click", () => {
    form.reset();
    dialog.showModal();
  });

  form.onsubmit = (event) => {
    event.stopPropagation();
    event.preventDefault();
    const formData = new FormData(form);
    const member = {
      id: crypto.randomUUID(),
      name: String(formData.get("name")).trim(),
      email: String(formData.get("email")).trim(),
      roles: String(formData.get("roles"))
        .split(",")
        .map((role) => role.trim())
        .filter(Boolean),
      jerseyNumber: Number(formData.get("jerseyNumber")) || null,
      membershipStatus: String(formData.get("membershipStatus")),
      passStatus: "valid",
      passExpiry: "2026-12-31",
      feeStatus: "due",
      notes: String(formData.get("notes")).trim(),
      lastInviteResponse: "pending"
    };

    state.members.unshift(member);
    saveState(state);
    mount();
    dialog.close();
    switchView("members");
  };
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Keep startup quiet if SW registration is not supported by the host.
    });
  }
}

bindNavigation();
mount();
registerServiceWorker();

if (supabaseClient) {
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      authState = {
        ...authState,
        mode: "demo",
        canSync: true,
        user: session.user,
        email: session.user.email ?? authState.email,
        status: `Signed in as ${session.user.email}. Use "Load live data" to pull from Supabase.`
      };
      mount();
    }
  });
}
