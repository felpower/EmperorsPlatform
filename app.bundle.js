(async function () {
  const SUPABASE_CONFIG = {
    url: "https://qggypwdmfrkhehmspvsr.supabase.co",
    publishableKey: "sb_publishable_3DSRw25D8oYpoivsnpVViQ_aIiOX0vy",
    projectRef: "qggypwdmfrkhehmspvsr"
  };
  const APP_CONFIG = window.__EMPERORS_CONFIG__ || {};
  const API_BASE_URL = String(APP_CONFIG.apiBaseUrl || "").trim().replace(/\/$/, "");

  const demoData = {
    source: "demo",
    permissionsModel: {
      note: "Admins inherit all coach, player, finance, and tech capabilities.",
      restrictedAreas: {
        fees: ["admin"],
        playerPasses: ["admin", "coach", "tech_admin"]
      }
    },
    members: [],
    fees: [],
    events: [],
    invites: []
  };

  const STORAGE_KEY = "emperors-local-state-v3";
  const ACCESS_KEY = "emperors-local-access-role";
  const FEE_FILTER_KEY = "emperors-fee-period-filter";
  const FEE_STATUS_FILTER_KEY = "emperors-fee-status-filter";
  const TABLE_SORT_KEY = "emperors-table-sort-v1";
  const MEMBER_FILTER_KEY = "emperors-member-filters-v1";
  const PASS_FILTER_KEY = "emperors-pass-filters-v1";
  const INVITE_ROLE_OPTIONS = ["admin", "coach", "finance_admin", "tech_admin", "player", "staff"];
  const viewIds = ["dashboard", "members", "fees", "user", "passes", "pass-sync", "events", "invites", "settings", "recovery"];
  const accessRoleOptions = ["admin", "finance_admin", "coach", "tech_admin", "player"];
  const memberRoleOptions = ["player", "coach", "admin", "finance_admin", "tech_admin", "staff"];
  const memberPositionOptions = [
    "QB", "RB", "FB", "WR", "TE", "OL", "DL", "LB", "DB", "CB", "S", "K", "P",
    "OT", "OG", "C", "DT", "DE", "NT", "ILB", "OLB"
  ];

  const supabaseClient =
    window.supabase && SUPABASE_CONFIG.url && SUPABASE_CONFIG.publishableKey
      ? window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.publishableKey, {
          auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true
          }
        })
      : null;

  let state = loadState();
  let bootstrapMeta = {
    source: state.source || "demo",
    permissionsModel: state.permissionsModel || demoData.permissionsModel
  };
  let currentAccessRole = loadStoredValue(ACCESS_KEY, "admin");
  let selectedFeePeriod = loadStoredValue(FEE_FILTER_KEY, "latest");
  let selectedFeeStatuses = loadStatusFilter();
  let feeEditMode = false;
  let feeInlineEditId = null;
  let memberMergeMode = false;
  let memberFiltersExpanded = false;
  let feeFiltersExpanded = false;
  let passFiltersExpanded = false;
  let feeBulkStatus = "paid";
  let selectedFeeMemberIds = [];
  let selectedUserMemberId = "";
  let profileRouteMode = "member";
  let authInviteRole = "admin";
  let teardownMembersStickyHeader = null;
  let teardownFeesStickyHeader = null;
  let teardownPassesStickyHeader = null;
  let tableSort = loadTableSort();
  let memberFilters = loadMemberFilters();
  let passFilters = loadPassFilters();
  let passSyncPreview = null;
  let selectedPassSyncMemberIds = [];
  let passSyncUpload = null;
  let authState = {
    mode: "local",
    status: "Local development mode active.",
    user: null,
    ready: false,
    loading: true,
    roles: [],
    pendingAction: ""
  };
  let recoveryState = {
    show: false,
    status: "",
    loading: false
  };
  let buttonFeedbackBound = false;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function apiUrl(path) {
    const normalizedPath = String(path || "").startsWith("/") ? String(path || "") : `/${String(path || "")}`;
    return API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath;
  }

  function loadStoredValue(key, fallback) {
    const saved = localStorage.getItem(key);
    return saved || fallback;
  }

  function saveStoredValue(key, value) {
    localStorage.setItem(key, value);
  }

  function ensureToastStack() {
    let toastStack = document.getElementById("toast-stack");
    if (!toastStack) {
      toastStack = document.createElement("div");
      toastStack.id = "toast-stack";
      toastStack.className = "toast-stack";
      toastStack.setAttribute("aria-live", "polite");
      toastStack.setAttribute("aria-atomic", "true");
      document.body.appendChild(toastStack);
    }
    return toastStack;
  }

  function showToast(message, tone = "info") {
    const text = String(message || "").trim();
    if (!text) return;
    const toastStack = ensureToastStack();
    const toast = document.createElement("div");
    toast.className = `toast toast-${tone}`;
    toast.textContent = text;
    toastStack.appendChild(toast);
    requestAnimationFrame(() => {
      toast.classList.add("is-visible");
    });
    window.setTimeout(() => {
      toast.classList.remove("is-visible");
      window.setTimeout(() => toast.remove(), 220);
    }, 2200);
  }

  function buttonLabelForToast(button) {
    const explicitLabel = String(button?.dataset?.toast || "").trim();
    if (explicitLabel) return explicitLabel;
    const ariaLabel = String(button?.getAttribute("aria-label") || "").trim();
    if (ariaLabel) return ariaLabel;
    return String(button?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function bindButtonFeedback() {
    if (buttonFeedbackBound) return;
    buttonFeedbackBound = true;

    document.addEventListener(
      "click",
      (event) => {
        const button = event.target.closest("button");
        if (!button || button.disabled || button.dataset.noToast === "true") {
          return;
        }

        button.classList.add("is-clicked");
        window.setTimeout(() => {
          button.classList.remove("is-clicked");
        }, 180);

        const label = buttonLabelForToast(button);
        if (label) {
          showToast(label, button.classList.contains("danger-button") ? "error" : "info");
        }
      },
      true
    );
  }

  function loadStatusFilter() {
    try {
      const saved = localStorage.getItem(FEE_STATUS_FILTER_KEY);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  function saveStatusFilter() {
    localStorage.setItem(FEE_STATUS_FILTER_KEY, JSON.stringify(selectedFeeStatuses));
  }

  function loadMemberFilters() {
    try {
      const saved = sessionStorage.getItem(MEMBER_FILTER_KEY);
      if (!saved) return { positions: [], roles: [], membership: ["active"], showDeleted: false, search: "" };
      const parsed = JSON.parse(saved);
      return {
        positions: Array.isArray(parsed?.positions) ? parsed.positions : [],
        roles: Array.isArray(parsed?.roles) ? parsed.roles : [],
        membership: Array.isArray(parsed?.membership) && parsed.membership.length ? parsed.membership : ["active"],
        showDeleted: Boolean(parsed?.showDeleted),
        search: String(parsed?.search || "").trim()
      };
    } catch {
      return { positions: [], roles: [], membership: ["active"], showDeleted: false, search: "" };
    }
  }

  function saveMemberFilters() {
    sessionStorage.setItem(MEMBER_FILTER_KEY, JSON.stringify(memberFilters));
  }

  function loadPassFilters() {
    try {
      const saved = sessionStorage.getItem(PASS_FILTER_KEY);
      if (!saved) {
        return {
          search: "",
          from: "",
          to: "",
          statuses: [],
          positions: [],
          membership: ["active"]
        };
      }
      const parsed = JSON.parse(saved);
      return {
        search: String(parsed?.search || "").trim(),
        from: String(parsed?.from || "").trim(),
        to: String(parsed?.to || "").trim(),
        statuses: Array.isArray(parsed?.statuses) ? parsed.statuses.filter(Boolean) : [],
        positions: Array.isArray(parsed?.positions) ? parsed.positions.filter(Boolean) : [],
        membership: Array.isArray(parsed?.membership) && parsed.membership.length ? parsed.membership.filter(Boolean) : ["active"]
      };
    } catch {
      return {
        search: "",
        from: "",
        to: "",
        statuses: [],
        positions: [],
        membership: ["active"]
      };
    }
  }

  function savePassFilters() {
    sessionStorage.setItem(PASS_FILTER_KEY, JSON.stringify(passFilters));
  }

  function defaultTableSort() {
    return {
      members: { key: "lastName", direction: "asc" },
      fees: { key: "member", direction: "asc" }
    };
  }

  function loadTableSort() {
    try {
      const saved = localStorage.getItem(TABLE_SORT_KEY);
      if (!saved) return defaultTableSort();
      const parsed = JSON.parse(saved);
      return {
        members: parsed?.members || defaultTableSort().members,
        fees: parsed?.fees || defaultTableSort().fees
      };
    } catch {
      return defaultTableSort();
    }
  }

  function saveTableSort() {
    localStorage.setItem(TABLE_SORT_KEY, JSON.stringify(tableSort));
  }

  function splitNameParts(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return { firstName: "", lastName: "" };
    if (parts.length === 1) return { firstName: parts[0], lastName: "" };
    return {
      firstName: parts.slice(0, -1).join(" "),
      lastName: parts.slice(-1).join(" ")
    };
  }

  function normalizeLookupToken(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "");
  }

  function memberNameTokens(member) {
    const fallback = splitNameParts(member?.name || "");
    const first = normalizeLookupToken(member?.firstName || fallback.firstName || "");
    const last = normalizeLookupToken(member?.lastName || fallback.lastName || "");
    const full = `${member?.firstName || ""} ${member?.lastName || ""} ${member?.name || ""}`;
    const fullTokens = String(full)
      .split(/\s+/)
      .map((part) => normalizeLookupToken(part))
      .filter(Boolean);
    const tokenSet = new Set(fullTokens);
    if (first) tokenSet.add(first);
    if (last) tokenSet.add(last);
    return {
      first,
      last,
      tokens: Array.from(tokenSet)
    };
  }

  function mergeSuggestionScore(keepMember, candidateMember) {
    const keep = memberNameTokens(keepMember);
    const candidate = memberNameTokens(candidateMember);
    const keepTokens = new Set(keep.tokens);
    const candidateTokens = new Set(candidate.tokens);
    let overlap = 0;
    keepTokens.forEach((token) => {
      if (candidateTokens.has(token)) overlap += 1;
    });

    let score = 0;
    if (keep.last && candidate.last && keep.last === candidate.last) score += 12;
    if (keep.first && candidate.first && (keep.first === candidate.first || keep.first.startsWith(candidate.first) || candidate.first.startsWith(keep.first))) score += 8;
    score += overlap * 2;
    if (keep.last && candidate.tokens.includes(keep.last)) score += 3;
    if (candidate.last && keep.tokens.includes(candidate.last)) score += 3;
    return score;
  }

  function capabilitySet(roles) {
    return Array.from(new Set(Array.isArray(roles) ? roles.filter(Boolean) : []));
  }

  function isLocalDevHost() {
    return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  }

  function shouldRequireAuth() {
    return Boolean(supabaseClient) && !isLocalDevHost();
  }

  function extractUserRoles(user) {
    const metadata = user?.user_metadata || {};
    const appMetadata = user?.app_metadata || {};
    const rawRoles = Array.isArray(metadata.roles)
      ? metadata.roles
      : Array.isArray(appMetadata.roles)
        ? appMetadata.roles
        : [];
    return capabilitySet(rawRoles.map((role) => String(role || "").trim()).filter(Boolean));
  }

  function primaryRoleFromRoles(roles) {
    const available = capabilitySet(roles);
    const preferred = ["admin", "finance_admin", "coach", "tech_admin", "player", "staff"];
    return preferred.find((role) => available.includes(role)) || "player";
  }

  function authDisplayName() {
    const ownMember = signedInMemberRecord();
    if (ownMember?.name) return String(ownMember.name).trim();
    if (ownMember?.firstName || ownMember?.lastName) {
      const fullName = `${String(ownMember.firstName || "").trim()} ${String(ownMember.lastName || "").trim()}`.trim();
      if (fullName) return fullName;
    }
    const metadata = authState.user?.user_metadata || {};
    return String(metadata.full_name || metadata.name || authState.user?.email || "").trim();
  }

  function authActionActive(action) {
    return String(authState.pendingAction || "") === String(action || "");
  }

  function needsPasswordSetup() {
    return Boolean(authState.user) && !authState.user?.user_metadata?.password_set;
  }

  function syncAuthSession(session) {
    authState.ready = true;
    authState.loading = false;
    authState.user = session?.user || null;
    authState.roles = extractUserRoles(session?.user);
    if (authState.user) {
      if (authState.roles.length) {
        currentAccessRole = primaryRoleFromRoles(authState.roles);
      } else {
        currentAccessRole = loadStoredValue(ACCESS_KEY, currentAccessRole || "player");
      }
      saveStoredValue(ACCESS_KEY, currentAccessRole);
      authState.mode = "supabase";
      if (needsPasswordSetup()) {
        authState.status = "Set your password to finish activating this account.";
        if (!/^recovery/i.test(String(window.location.hash || "").replace("#", ""))) {
          window.location.hash = "#recovery";
        }
      } else {
        authState.status = `Signed in as ${authDisplayName() || authState.user.full_name}.`;
      }
      return;
    }
    currentAccessRole = loadStoredValue(ACCESS_KEY, "admin");
    authState.mode = supabaseClient ? "supabase" : "local";
    authState.status = shouldRequireAuth()
      ? "Sign in with email and password to continue."
      : (window.location.hostname.includes("localhost") || window.location.hostname === "127.0.0.1"
        ? "Local database mode active."
        : "Static preview mode active.");
  }

  function renderAuthGate() {
    const signInBusy = authActionActive("sign-in");
    const resetBusy = authActionActive("reset-password");
    const signOutBusy = authActionActive("sign-out");
    const authMessage = authState.loading
      ? "Checking your session..."
      : shouldRequireAuth()
        ? "Use your email and password to sign in. If you were invited, set your password from the email you received first."
        : "Sign in is available for Supabase users, but local demo mode is still active on localhost.";

    return `
      <article class="card auth-card" style="display:grid; gap: 12px; max-width: 720px;">
        <div>
          <p class="eyebrow">Authentication</p>
          <h3 style="margin-top: 4px;">Sign in</h3>
          <p class="muted">${authMessage}</p>
        </div>
        <div class="auth-status" role="status" aria-live="polite">${authState.status || "Enter your email and password to continue."}</div>
        ${signInBusy || resetBusy || signOutBusy ? `<div class="auth-progress"><span class="auth-spinner" aria-hidden="true"></span><span>${authState.status || "Working..."}</span></div>` : ""}
        <div class="form-grid">
          <label>Email<input id="auth-email" type="email" autocomplete="email" placeholder="you@example.com" ${signInBusy || resetBusy ? "disabled" : ""} /></label>
          <label>Password<input id="auth-password" type="password" autocomplete="current-password" placeholder="••••••••" /></label>
        </div>
        <div class="button-row">
          <button id="auth-sign-in" type="button" class="primary-button" data-no-toast="true" ${signInBusy || resetBusy || signOutBusy ? "disabled" : ""}>${signInBusy ? "Signing in..." : "Sign in"}</button>
          <button id="auth-reset-password" type="button" class="ghost-button" data-no-toast="true" ${signInBusy || resetBusy || signOutBusy ? "disabled" : ""} aria-label="Send password reset email">${resetBusy ? "Sending reset email..." : "Forgot password?"}</button>
          <button id="auth-sign-out" type="button" class="ghost-button" data-no-toast="true" ${signInBusy || resetBusy || signOutBusy ? "disabled" : ""}>${signOutBusy ? "Signing out..." : "Sign out"}</button>
        </div>
        <p class="meta">Invited users must set their password first before normal sign-in. Use Forgot password? to send a reset email and return to the password setup screen.</p>
      </article>
    `;
  }

  async function signInWithEmailPassword(email, password) {
    if (!supabaseClient) {
      throw new Error("Supabase auth is not configured.");
    }
    const response = await supabaseClient.auth.signInWithPassword({
      email: String(email || "").trim(),
      password: String(password || "")
    });
    if (response.error) {
      throw response.error;
    }
    if (response.data?.user && !response.data.user?.user_metadata?.password_set) {
      await supabaseClient.auth.updateUser({
        data: {
          ...(response.data.user.user_metadata || {}),
          password_set: true
        }
      });
    }
    syncAuthSession(response.data.session || null);
  }

  async function sendResetPasswordEmail(email) {
    if (!supabaseClient) {
      throw new Error("Supabase auth is not configured.");
    }
    const normalizedEmail = String(email || "").trim();
    if (!normalizedEmail) {
      throw new Error("Enter your email address first.");
    }
    const redirectTo = window.location.href.startsWith("http")
      ? `${window.location.origin}${window.location.pathname}#recovery`
      : undefined;
    const response = await supabaseClient.auth.resetPasswordForEmail(normalizedEmail, {
      ...(redirectTo ? { redirectTo } : {})
    });
    if (response.error) {
      throw response.error;
    }
  }

  async function signOut() {
    if (!supabaseClient) return;
    const response = await supabaseClient.auth.signOut();
    if (response.error) {
      throw response.error;
    }
    syncAuthSession(null);
  }

  async function setRecoveryPassword(password) {
    if (!supabaseClient) {
      throw new Error("Supabase auth is not configured.");
    }
    recoveryState.loading = true;
    recoveryState.status = "Setting password...";
    try {
      const response = await supabaseClient.auth.updateUser({
        password: String(password || ""),
        data: {
          ...(authState.user?.user_metadata || {}),
          password_set: true
        }
      });
      if (response.error) {
        throw response.error;
      }
      if (response.data?.user) {
        syncAuthSession({ user: response.data.user });
      }
      recoveryState.status = "Password set successfully! Redirecting...";
      setTimeout(() => {
        window.location.href = window.location.origin + window.location.pathname + "#dashboard";
      }, 1500);
    } catch (error) {
      recoveryState.status = error.message || "Failed to set password.";
    } finally {
      recoveryState.loading = false;
    }
  }

  function renderRecoveryGate() {
    const passwordInput = document.getElementById("recovery-password");
    const email = authState.user?.email || "your email";
    const isFirstTime = !authState.user?.user_metadata?.password_set;

    if (!authState.user) {
      return `
        <article class="card auth-card" style="display:grid; gap: 12px; max-width: 720px;">
          <div>
            <p class="eyebrow">Password setup</p>
            <h3 style="margin-top: 4px;">This recovery link is no longer active</h3>
            <p class="muted">Invite and reset links are time-limited. Request a new invite or use Forgot password? from the sign-in screen to get a fresh link.</p>
          </div>
          <div class="auth-status" role="status" aria-live="polite">No active recovery session was found.</div>
          <div class="button-row">
            <button id="recovery-back-to-sign-in" type="button" class="primary-button" data-no-toast="true">Back to sign in</button>
          </div>
        </article>
      `;
    }

    return `
      <article class="card auth-card" style="display:grid; gap: 12px; max-width: 720px;">
        <div>
          <p class="eyebrow">Set Your Password</p>
          <h3 style="margin-top: 4px;">${isFirstTime ? "Complete Your Registration" : "Reset Your Password"}</h3>
          <p class="muted">${isFirstTime ? "You were invited to join Uni Wien Emperors. Set a password to activate your account." : "Create a new password for your account."}</p>
        </div>
        <div>
          <p><strong>Email:</strong> ${email}</p>
        </div>
        <div class="form-grid">
          <label>New Password<input id="recovery-password" type="password" autocomplete="new-password" placeholder="••••••••" minlength="6" /></label>
          <label>Confirm Password<input id="recovery-password-confirm" type="password" autocomplete="new-password" placeholder="••••••••" minlength="6" /></label>
        </div>
        <div class="button-row">
          <button id="recovery-submit" type="button" class="primary-button" ${recoveryState.loading ? "disabled" : ""}>${recoveryState.loading ? "Setting password..." : "Set Password"}</button>
          ${!isFirstTime ? `<button id="recovery-cancel" type="button" class="ghost-button">Cancel</button>` : ""}
        </div>
        ${recoveryState.status ? `<p class="meta" style="color: ${recoveryState.status.includes("successfully") ? "#00aa00" : "#ff6b6b"};">${recoveryState.status}</p>` : ""}
        <p class="meta">Your password must be at least 6 characters long.</p>
      </article>
    `;
  }

  async function inviteRecipient(payload) {
    const response = await fetch(apiUrl("/api/auth/invites"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const rawBody = await response.text();
    let data = {};
    try {
      data = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      data = {};
    }
    if (!response.ok) {
      if (response.status === 404 || response.status === 405) {
        throw new Error("Invite API is not reachable. Start the backend server (or deploy the API) and try again.");
      }
      throw new Error(data.error || data.message || `Could not send invite (${response.status}).`);
    }
    return data;
  }

  async function inviteMember(memberId) {
    return inviteRecipient({ memberId });
  }

  async function inviteAdmin(email, fullName, roles) {
    return inviteRecipient({ email, fullName, roles });
  }

  function normalizeMember(member, index) {
    const fallbackParts = splitNameParts(member.name || "");
    const firstName = String(member.firstName || fallbackParts.firstName || "").trim();
    const lastName = String(member.lastName || fallbackParts.lastName || "").trim();
    const fullName = `${firstName} ${lastName}`.trim() || member.name || "Unknown member";
    return {
      id: member.id || `member-${index + 1}`,
      firstName,
      lastName,
      name: fullName,
      email: member.email || "",
      positions: Array.isArray(member.positions) ? member.positions.filter(Boolean) : [],
      roles: capabilitySet(Array.isArray(member.roles) ? member.roles : ["player"]),
      jerseyNumber: member.jerseyNumber === null || member.jerseyNumber === undefined || member.jerseyNumber === "" ? null : Number(member.jerseyNumber),
      active: Boolean(member.active),
      rookie: Boolean(member.rookie),
      inClubee: Boolean(member.inClubee),
      membershipStatus: member.membershipStatus || (member.active ? "active" : "inactive"),
      deletedAt: member.deletedAt || null,
      profileId: member.profileId || null,
      inviteSentAt: member.inviteSentAt || null,
      passStatus: member.passStatus || "missing",
      passExpiry: member.passExpiry || "",
      licenseName: member.licenseName || "",
      feeStatus: member.feeStatus || "pending",
      notes: member.notes || "",
      lastInviteResponse: member.lastInviteResponse || "pending"
    };
  }

  function normalizeFee(fee, index) {
    return {
      id: fee.id || `fee-${index + 1}`,
      memberId: fee.memberId,
      season: String(fee.season || ""),
      feePeriod: String(fee.feePeriod || fee.period || ""),
      amount: Number(fee.amount || 0),
      paidAmount: Number(fee.paidAmount || 0),
      status: fee.status || "pending",
      iban: String(fee.iban || "").trim(),
      note: fee.note || ""
    };
  }

  function normalizeState(value) {
    return {
      source: value.source || "demo",
      permissionsModel: value.permissionsModel || demoData.permissionsModel,
      members: Array.isArray(value.members) ? value.members.map(normalizeMember) : [],
      fees: Array.isArray(value.fees) ? value.fees.map(normalizeFee) : [],
      events: Array.isArray(value.events) ? value.events : [],
      invites: Array.isArray(value.invites) ? value.invites : []
    };
  }

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return normalizeState(demoData);
      return normalizeState(JSON.parse(saved));
    } catch {
      return normalizeState(demoData);
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function exportState() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "emperors-local-export.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  function canAccess(area) {
    const restricted = bootstrapMeta.permissionsModel?.restrictedAreas?.[area];
    if (!Array.isArray(restricted) || !restricted.length) return true;
    return capabilitySet([currentAccessRole]).some((role) => restricted.includes(role));
  }

  function memberName(memberId) {
    const member = state.members.find((item) => String(item.id) === String(memberId));
    return member ? member.name : "Unknown";
  }

  function memberById(memberId) {
    return state.members.find((item) => String(item.id) === String(memberId)) || null;
  }

  function signedInUserEmail() {
    return String(authState.user?.email || "").trim().toLowerCase();
  }

  function signedInUserMemberId() {
    const metadata = authState.user?.user_metadata || {};
    const appMetadata = authState.user?.app_metadata || {};
    return String(metadata.member_id || appMetadata.member_id || "").trim();
  }

  function signedInMemberRecord() {
    if (!authState.user) return null;
    const profileMatch = state.members.find((member) => String(member.profileId || "") === String(authState.user.id || ""));
    if (profileMatch) return profileMatch;
    const email = signedInUserEmail();
    if (!email) return null;
    return state.members.find((member) => String(member.email || "").trim().toLowerCase() === email) || null;
  }

  function canEditMemberProfile(member) {
    if (!member) return false;
    if (currentAccessRole === "admin") return true;
    if (currentAccessRole !== "player") return false;

    const loggedInMemberId = signedInUserMemberId();
    if (loggedInMemberId && String(member.id) === loggedInMemberId) return true;

    const loggedInEmail = signedInUserEmail();
    if (!loggedInEmail) return false;
    return String(member.email || "").trim().toLowerCase() === loggedInEmail;
  }

  function isOwnProfile(member) {
    if (!member) return false;
    const loggedInMemberId = String(signedInUserMemberId() || "").trim();
    if (loggedInMemberId && String(member.id) === loggedInMemberId) return true;
    const loggedInEmail = signedInUserEmail();
    if (!loggedInEmail) return false;
    return String(member.email || "").trim().toLowerCase() === loggedInEmail;
  }

  function canViewSensitiveProfileFields(member) {
    return currentAccessRole === "admin" || isOwnProfile(member);
  }

  function shiftQuarterToken(token, offset) {
    const [quarterRaw, yearRaw] = String(token || "Q1_2025").split("_");
    let quarter = Number(String(quarterRaw || "Q1").replace("Q", "")) || 1;
    let year = Number(yearRaw || 2025);
    for (let i = 0; i < Math.abs(offset); i += 1) {
      if (offset > 0) {
        quarter += 1;
        if (quarter > 4) {
          quarter = 1;
          year += 1;
        }
      } else {
        quarter -= 1;
        if (quarter < 1) {
          quarter = 4;
          year -= 1;
        }
      }
    }
    return `Q${quarter}_${year}`;
  }

  function profileQuarterWindowTokens() {
    const current = currentQuarterToken();
    return [
      shiftQuarterToken(current, -4),
      shiftQuarterToken(current, -3),
      shiftQuarterToken(current, -2),
      shiftQuarterToken(current, -1),
      current,
      shiftQuarterToken(current, 1),
      shiftQuarterToken(current, 2)
    ];
  }

  function memberFeesByPeriod(memberId) {
    const map = new Map();
    state.fees
      .filter((fee) => String(fee.memberId) === String(memberId))
      .forEach((fee) => {
        if (fee.feePeriod) map.set(fee.feePeriod, fee);
      });
    return map;
  }

  function memberIban(memberId) {
    const fees = state.fees
      .filter((fee) => String(fee.memberId) === String(memberId) && String(fee.iban || "").trim())
      .sort((left, right) => String(right.feePeriod || "").localeCompare(String(left.feePeriod || "")));
    return fees[0]?.iban || "";
  }

  function memberFirstName(memberId) {
    const member = memberById(memberId);
    if (!member) return "";
    if (member.firstName) return member.firstName;
    return splitNameParts(member.name).firstName;
  }

  function memberLastName(memberId) {
    const member = memberById(memberId);
    if (!member) return "";
    if (member.lastName) return member.lastName;
    return splitNameParts(member.name).lastName;
  }

  function statusLabel(value) {
    const normalized = String(value || "pending").toLowerCase();
    if (normalized === "not_applicable") return "not in team";
    return normalized.replaceAll("_", " ");
  }

  function statusPill(value, label) {
    const normalized = String(value || "pending").toLowerCase();
    return `<span class="status ${normalized}">${label || statusLabel(normalized)}</span>`;
  }

  function roleLabel(value) {
    const normalized = String(value || "").trim().toLowerCase();
    const labels = {
      player: "Athlete",
      admin: "Admin",
      finance_admin: "Finance",
      tech_admin: "Tech",
      coach: "Coach",
      staff: "Staff"
    };
    return labels[normalized] || value;
  }

  function rolePill(value) {
    return plainPill(roleLabel(value));
  }

  function memberInviteState(member) {
    if (member?.inviteSentAt) return "invited";
    if (member?.profileId) return "activated";
    return "ready";
  }

  function renderMemberInviteAction(member) {
    if (currentAccessRole !== "admin") return "";
    if (member?.deletedAt) return "";
    if (!String(member?.email || "").trim()) return "";
    const state = memberInviteState(member);
    if (state === "activated") return "";
    const label = state === "invited" ? "Invited" : "Invite";
    return `<button class="ghost-button small-button invite-member-button" type="button" data-member-id="${member.id}" data-invite-state="${state}">${label}</button>`;
  }

  function memberInviteStateLabel(member) {
    const state = memberInviteState(member);
    if (state === "activated") return "Activated";
    if (state === "invited") return "Invite pending";
    return "Not invited";
  }

  function renderMemberInvitePill(member) {
    if (currentAccessRole !== "admin") return "";
    if (member?.deletedAt) return "";
    if (!String(member?.email || "").trim()) return `<span class="meta">No email</span>`;
    const state = memberInviteState(member);
    if (state === "activated") return statusPill("activated", "Activated");
    if (state === "invited") return statusPill("invited", "Invited");
    return statusPill("not_invited", "Not invited");
  }

  async function promoteInvitedMemberOnFirstSignIn() {
    if (!supabaseClient) return;
    const profileId = String(authState.user?.id || "").trim();
    if (!profileId) return;

    const updateResponse = await supabaseClient
      .from("members")
      .update({ invite_sent_at: null })
      .eq("profile_id", profileId)
      .not("invite_sent_at", "is", null);

    if (updateResponse.error) {
      if (/invite_sent_at/i.test(String(updateResponse.error?.message || ""))) {
        return;
      }
      throw updateResponse.error;
    }
  }

  function userPageMemberIdFromHash() {
    const hash = String(window.location.hash || "").replace("#", "").trim();
    const match = hash.match(/^user\/(.+)$/i);
    if (!match) return "";
    const decoded = decodeURIComponent(match[1]);
    if (decoded.toLowerCase() === "me") {
      return String(signedInMemberRecord()?.id || "");
    }
    return decoded;
  }

  function plainPill(label) {
    return `<span class="pill">${label}</span>`;
  }

  function renderSortButton(tableKey, columnKey, label) {
    const activeSort = tableSort[tableKey] || { key: "", direction: "asc" };
    const isActive = activeSort.key === columnKey;
    const marker = isActive ? (activeSort.direction === "asc" ? " ▲" : " ▼") : "";
    return `<button class="sort-button ${isActive ? "is-active" : ""}" type="button" data-sort-table="${tableKey}" data-sort-key="${columnKey}">${label}${marker}</button>`;
  }

  function formatMoney(amount) {
    return new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" }).format(Number(amount || 0));
  }

  function formatDate(dateText) {
    if (!dateText) return "-";
    const date = new Date(dateText);
    if (Number.isNaN(date.getTime())) return String(dateText);
    return new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
  }

  function displayPassStatus(status) {
    const normalized = String(status || "").trim().toLowerCase();
    if (!normalized || normalized === "pending" || normalized === "missing" || normalized === "unknown") return "missing";
    if (normalized === "expired") return "expired";
    return "valid";
  }

  function defaultPassExpiryDate() {
    const now = new Date();
    return `${now.getFullYear() + 1}-12-30`;
  }

  function isPassExpiringSoon(expiryText) {
    if (!expiryText) return false;
    const expiryDate = new Date(`${expiryText}T00:00:00`);
    if (Number.isNaN(expiryDate.getTime())) return false;
    const diffDays = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 90;
  }

  function isIsoDateText(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").trim());
  }

  function normalizePassFilterDate(value) {
    const text = String(value || "").trim();
    if (!isIsoDateText(text)) return "";
    const year = Number(text.slice(0, 4));
    if (!Number.isFinite(year) || year < 2020) return "";
    return text;
  }

  function formatFeePeriod(period) {
    return String(period || "-").replace("_", " ");
  }

  function formatList(items, emptyLabel) {
    const values = Array.isArray(items) ? items.filter(Boolean) : [];
    return values.length ? values.join(", ") : emptyLabel;
  }

  function escapeCsvValue(value) {
    const text = String(value ?? "");
    if (/[",\n\r]/.test(text)) {
      return `"${text.replaceAll("\"", "\"\"")}"`;
    }
    return text;
  }

  function downloadBlobFile(content, type, fileName) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function downloadCsv(columns, rows, fileName) {
    const header = columns.map((column) => escapeCsvValue(column.label)).join(",");
    const body = rows
      .map((row) => columns.map((column) => escapeCsvValue(row[column.key])).join(","))
      .join("\n");
    const csv = `${header}\n${body}`;
    downloadBlobFile(csv, "text/csv;charset=utf-8", fileName);
  }

  function downloadExcel(columns, rows, fileName) {
    const headerHtml = columns.map((column) => `<th>${String(column.label || "")}</th>`).join("");
    const bodyHtml = rows
      .map((row) => `<tr>${columns.map((column) => `<td>${String(row[column.key] ?? "")}</td>`).join("")}</tr>`)
      .join("");
    const html = `
      <html>
      <head><meta charset="utf-8" /></head>
      <body>
        <table>
          <thead><tr>${headerHtml}</tr></thead>
          <tbody>${bodyHtml}</tbody>
        </table>
      </body>
      </html>
    `;
    downloadBlobFile(html, "application/vnd.ms-excel;charset=utf-8", fileName);
  }

  async function downloadFromApi(url, fallbackFileName) {
    const response = await fetch(url);
    if (!response.ok) {
      let message = `Download failed (${response.status})`;
      try {
        const payload = await response.json();
        message = payload?.error || message;
      } catch {
        // ignore JSON parse errors for non-JSON error responses
      }
      throw new Error(message);
    }
    const blob = await response.blob();
    const contentDisposition = response.headers.get("content-disposition") || "";
    const fileNameMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/i);
    const extractedName = decodeURIComponent(fileNameMatch?.[1] || fileNameMatch?.[2] || "");
    const fileName = extractedName || fallbackFileName;
    const urlObject = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = urlObject;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(urlObject);
  }

  function memberExportRows() {
    return sortedMembers().map((member) => ({
      id: member.id,
      firstName: member.firstName || "",
      lastName: member.lastName || "",
      email: member.email || "",
      positions: (member.positions || []).join(", "),
      roles: (member.roles || []).map((role) => roleLabel(role)).join(", "),
      jerseyNumber: member.jerseyNumber ?? "",
      membershipStatus: member.membershipStatus || "",
      passStatus: member.passStatus || "",
      passExpiry: member.passExpiry || "",
      deletedAt: member.deletedAt || ""
    }));
  }

  function feeExportRows() {
    return sortedVisibleFees().map((fee) => ({
      memberId: fee.memberId,
      firstName: memberFirstName(fee.memberId) || "",
      lastName: memberLastName(fee.memberId) || "",
      feePeriod: fee.feePeriod || "",
      amount: Number(fee.amount || 0).toFixed(2),
      paidAmount: Number(fee.paidAmount || 0).toFixed(2),
      status: statusLabel(fee.status),
      iban: fee.iban || ""
    }));
  }

  function emptyState(title, copy) {
    return `<article class="setup-card empty-state"><p class="eyebrow">No data yet</p><h3>${title}</h3><p>${copy}</p></article>`;
  }

  function lockedState(title, copy) {
    return `
      <article class="setup-card locked-card">
        <p class="eyebrow">Restricted area</p>
        <h3>${title}</h3>
        <p>${copy}</p>
        <div class="pill-row">
          ${plainPill(`Viewing as ${roleLabel(currentAccessRole)}`)}
          ${plainPill("Admins inherit all capabilities")}
        </div>
      </article>
    `;
  }

  function getFeePeriods() {
    const values = Array.from(new Set(state.fees.map((fee) => fee.feePeriod).filter(Boolean)));
    values.sort((left, right) => {
      const [lQuarter, lYear] = String(left).split("_");
      const [rQuarter, rYear] = String(right).split("_");
      const leftScore = Number(lYear || 0) * 10 + Number(String(lQuarter || "Q0").replace("Q", ""));
      const rightScore = Number(rYear || 0) * 10 + Number(String(rQuarter || "Q0").replace("Q", ""));
      return rightScore - leftScore;
    });
    return values;
  }

  function currentQuarterToken() {
    const now = new Date();
    const quarter = Math.floor(now.getMonth() / 3) + 1;
    return `Q${quarter}_${now.getFullYear()}`;
  }

  function ensureValidFeeFilter() {
    const periods = getFeePeriods();
    if (!periods.length) {
      selectedFeePeriod = "";
      return;
    }
    const currentQuarter = currentQuarterToken();
    if ((selectedFeePeriod === "latest" || !selectedFeePeriod) && periods.includes(currentQuarter)) {
      selectedFeePeriod = currentQuarter;
      saveStoredValue(FEE_FILTER_KEY, selectedFeePeriod);
      return;
    }
    if (periods.includes(selectedFeePeriod)) return;
    selectedFeePeriod = periods.includes(currentQuarter) ? currentQuarter : periods[0];
    saveStoredValue(FEE_FILTER_KEY, selectedFeePeriod);
  }

  function currentFeePeriod() {
    const periods = getFeePeriods();
    if (!periods.length) return "";
    return periods.includes(selectedFeePeriod) ? selectedFeePeriod : periods[0];
  }

  function compareValues(left, right) {
    const leftValue = left === null || left === undefined ? "" : left;
    const rightValue = right === null || right === undefined ? "" : right;
    if (typeof leftValue === "number" || typeof rightValue === "number") {
      return Number(leftValue || 0) - Number(rightValue || 0);
    }
    return String(leftValue).localeCompare(String(rightValue), undefined, {
      sensitivity: "base",
      numeric: true
    });
  }

  function sortRows(rows, tableKey, selectValue) {
    const sortConfig = tableSort[tableKey] || { key: "", direction: "asc" };
    const multiplier = sortConfig.direction === "desc" ? -1 : 1;
    return [...rows].sort((left, right) => {
      const leftValue = selectValue(left, sortConfig.key);
      const rightValue = selectValue(right, sortConfig.key);
      return compareValues(leftValue, rightValue) * multiplier;
    });
  }

  function sortedMembers() {
    return sortRows(filteredMembers(), "members", (member, key) => {
      if (key === "id") return String(member.id || "");
      if (key === "firstName") return member.firstName || "";
      if (key === "lastName") return member.lastName || "";
      if (key === "jerseyNumber") return member.jerseyNumber || 0;
      if (key === "passStatus") return member.passStatus || "";
      return member.name || "";
    });
  }

  function memberFilterOptions() {
    return {
      positions: Array.from(new Set(state.members.flatMap((member) => member.positions || []).filter(Boolean))).sort(),
      roles: Array.from(new Set(state.members.flatMap((member) => member.roles || []).filter(Boolean))).sort(),
      membership: Array.from(new Set(state.members.map((member) => member.membershipStatus).filter(Boolean))).sort()
    };
  }

  function filteredMembers() {
    return state.members.filter((member) => {
      const query = String(memberFilters.search || "").trim().toLowerCase();
      if (query) {
        const haystack = [
          member.name,
          member.firstName,
          member.lastName,
          member.email,
          member.id
        ].map((value) => String(value || "").toLowerCase()).join(" ");
        if (!haystack.includes(query)) {
          return false;
        }
      }
      if (member.deletedAt && !memberFilters.showDeleted) {
        return false;
      }
      if (memberFilters.positions.length && !memberFilters.positions.some((position) => (member.positions || []).includes(position))) {
        return false;
      }
      if (memberFilters.roles.length && !memberFilters.roles.some((role) => (member.roles || []).includes(role))) {
        return false;
      }
      if (memberFilters.membership.length && !memberFilters.membership.includes(member.membershipStatus)) {
        return false;
      }
      return true;
    });
  }

  function passFilterOptions() {
    const playerMembers = state.members.filter((member) => (member.roles || []).includes("player"));
    return {
      statuses: ["valid", "missing", "expired"],
      positions: Array.from(new Set(playerMembers.flatMap((member) => member.positions || []).filter(Boolean))).sort(),
      membership: Array.from(new Set(playerMembers.map((member) => member.membershipStatus).filter(Boolean))).sort()
    };
  }

  function filteredPassMembers() {
    return state.members.filter((member) => {
      if (!(member.roles || []).includes("player")) {
        return false;
      }

      const query = String(passFilters.search || "").trim().toLowerCase();
      if (query) {
        const haystack = [
          member.firstName,
          member.lastName,
          member.name,
          member.email
        ].map((value) => String(value || "").toLowerCase()).join(" ");
        if (!haystack.includes(query)) {
          return false;
        }
      }

      if (passFilters.statuses.length) {
        const status = displayPassStatus(member.passStatus);
        if (!passFilters.statuses.includes(status)) {
          return false;
        }
      }

      if (passFilters.positions.length && !passFilters.positions.some((position) => (member.positions || []).includes(position))) {
        return false;
      }

      if (passFilters.membership.length && !passFilters.membership.includes(member.membershipStatus)) {
        return false;
      }

      const fromDate = normalizePassFilterDate(passFilters.from);
      const toDate = normalizePassFilterDate(passFilters.to);
      const hasFrom = Boolean(fromDate);
      const hasTo = Boolean(toDate);
      if (hasFrom || hasTo) {
        if (!member.passExpiry) {
          return false;
        }
        if (hasFrom && member.passExpiry < fromDate) {
          return false;
        }
        if (hasTo && member.passExpiry > toDate) {
          return false;
        }
      }

      return true;
    });
  }

  function sortedVisibleFees() {
    return sortRows(filteredFees(), "fees", (fee, key) => {
      if (key === "member") return memberName(fee.memberId);
      if (key === "firstName") return memberFirstName(fee.memberId);
      if (key === "lastName") return memberLastName(fee.memberId);
      if (key === "period") return fee.feePeriod || "";
      if (key === "season") return fee.season || "";
      if (key === "amount") return fee.amount || 0;
      if (key === "paid") return fee.paidAmount || 0;
      if (key === "status") return fee.status || "";
      if (key === "note") return fee.note || "";
      return "";
    });
  }

  function filteredFees() {
    const current = currentFeePeriod();
    let rows = current ? state.fees.filter((fee) => fee.feePeriod === current) : state.fees;
    if (selectedFeeStatuses.length) {
      rows = rows.filter((fee) => selectedFeeStatuses.includes(fee.status));
    }
    return rows;
  }

  function availableFeeStatuses() {
    const current = currentFeePeriod();
    const rows = current ? state.fees.filter((fee) => fee.feePeriod === current) : state.fees;
    return Array.from(new Set(rows.map((fee) => fee.status).filter(Boolean))).sort();
  }

  function defaultFeeStatuses() {
    const available = availableFeeStatuses();
    const preferred = ["paid", "pending", "not_collected"];
    const selected = preferred.filter((status) => available.includes(status));
    return selected.length ? selected : available;
  }

  function reconcileFeeStatusFilter() {
    const available = new Set(availableFeeStatuses());
    if (!selectedFeeStatuses.length) {
      selectedFeeStatuses = defaultFeeStatuses();
      saveStatusFilter();
      return;
    }
    const next = selectedFeeStatuses.filter((status) => available.has(status));
    if (next.length === selectedFeeStatuses.length) return;
    selectedFeeStatuses = next.length ? next : defaultFeeStatuses();
    saveStatusFilter();
  }

  function applyBootstrap(bootstrap) {
    state = normalizeState(bootstrap);
    bootstrapMeta = {
      source: bootstrap.source || "local-sqlite",
      permissionsModel: bootstrap.permissionsModel || demoData.permissionsModel
    };
    ensureValidFeeFilter();
    saveState();
  }

  function shouldUseSupabaseData() {
    return Boolean(supabaseClient) && !isLocalDevHost();
  }

  function parseJsonArrayField(value, fallback = []) {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === "string" && value.trim()) {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : fallback;
      } catch {
        return fallback;
      }
    }
    return fallback;
  }

    function normalizePassStatus({ status, expiry, licenseName }) {
      const normalized = String(status || "").trim().toLowerCase();
      const hasExpiry = Boolean(String(expiry || "").trim());
      const hasLicense = Boolean(String(licenseName || "").trim());
      if (!normalized) return "missing";
      if (normalized === "expired" && !hasExpiry && !hasLicense) return "missing";
      return normalized;
    }

  async function loadSupabaseBootstrap() {
    if (!supabaseClient) return;
    if (!authState.user) {
      authState.status = "Sign in with email and password to continue.";
      return;
    }

    const currentUserId = String(authState.user?.id || "").trim();
    const currentUserEmail = String(authState.user?.email || "").trim();
    if (currentUserId && currentUserEmail) {
      // Best-effort claim: link imported member rows to this auth user by matching email once.
      await supabaseClient
        .from("members")
        .update({ profile_id: currentUserId })
        .is("profile_id", null)
        .ilike("email", currentUserEmail);
    }

    const canReadFeesOnline = currentAccessRole === "admin" || currentAccessRole === "finance_admin" || currentAccessRole === "player";
    const canReadPassesOnline = currentAccessRole === "admin" || currentAccessRole === "coach" || currentAccessRole === "tech_admin" || currentAccessRole === "player";
    const canReadAllMemberRolesOnline = currentAccessRole === "admin" || currentAccessRole === "coach" || currentAccessRole === "finance_admin" || currentAccessRole === "tech_admin";

    const queryWarnings = [];
    const selectMaybe = async (table, columns, optional = false) => {
      const response = await supabaseClient.from(table).select(columns);
      if (response.error) {
        if (optional) {
          queryWarnings.push(`${table}: ${response.error.message || "read blocked"}`);
          return [];
        }
        throw response.error;
      }
      return response.data || [];
    };

    let memberRowsResponse = await supabaseClient.from("members").select("id, profile_id, first_name, last_name, display_name, email, positions_json, roles_json, jersey_number, membership_status, notes, deleted_at, invite_sent_at");
    if (memberRowsResponse.error && /invite_sent_at/i.test(String(memberRowsResponse.error?.message || ""))) {
      memberRowsResponse = await supabaseClient.from("members").select("id, profile_id, first_name, last_name, display_name, email, positions_json, roles_json, jersey_number, membership_status, notes, deleted_at");
    }
    if (memberRowsResponse.error) {
      throw memberRowsResponse.error;
    }
    const memberRows = memberRowsResponse.data || [];
    const memberRoleRows = canReadAllMemberRolesOnline
      ? await selectMaybe("member_roles", "profile_id, role_code", true)
      : await selectMaybe("member_roles", "profile_id, role_code", true);
    const passRows = canReadPassesOnline
      ? await selectMaybe("player_passes", "member_id, pass_status, expires_on, federation_reference, notes, updated_at", true)
      : [];
    const feeRows = canReadFeesOnline
      ? await selectMaybe("membership_fees", "id, member_id, fee_period, season_label, amount_cents, paid_cents, status, iban, status_note, due_date, created_at", true)
      : [];
    const eventRows = await selectMaybe("events", "id, title, event_type, starts_at, location, notes, created_by, created_at", true);
    const recipientRows = await selectMaybe("event_recipients", "event_id, member_id, response, responded_at", true);
    const inviteRows = await selectMaybe("invites", "id, event_id, channel, sent_by, sent_at, recipient_count", true);

    const rolesByProfile = new Map();
    (memberRoleRows || []).forEach((row) => {
      const profileId = String(row.profile_id || "").trim();
      const roleCode = String(row.role_code || "").trim();
      if (!profileId || !roleCode) return;
      const roles = rolesByProfile.get(profileId) || [];
      roles.push(roleCode);
      rolesByProfile.set(profileId, roles);
    });

    const passesByMember = new Map();
    (passRows || []).forEach((row) => {
      passesByMember.set(String(row.member_id || ""), row);
    });

    const feesByMember = new Map();
    (feeRows || []).forEach((row) => {
      const memberId = String(row.member_id || "");
      const list = feesByMember.get(memberId) || [];
      list.push(row);
      feesByMember.set(memberId, list);
    });
    feesByMember.forEach((rows) => {
      rows.sort((left, right) => String(right.season_label || right.due_date || right.created_at || "").localeCompare(String(left.season_label || left.due_date || left.created_at || "")));
    });

    const recipientsByEvent = new Map();
    (recipientRows || []).forEach((row) => {
      const eventId = String(row.event_id || "");
      const list = recipientsByEvent.get(eventId) || [];
      list.push(row);
      recipientsByEvent.set(eventId, list);
    });

    const normalizeDisplayName = (row) => {
      const firstName = String(row.first_name || "").trim();
      const lastName = String(row.last_name || "").trim();
      const fallback = String(row.display_name || "").trim();
      const displayName = `${firstName} ${lastName}`.trim() || fallback || "Unknown member";
      return { firstName, lastName, displayName };
    };

    const members = (memberRows || []).map((row) => {
      const { firstName, lastName, displayName } = normalizeDisplayName(row);
      const memberId = String(row.id || "");
      const pass = passesByMember.get(memberId) || null;
      const passExpiry = String(pass?.expires_on || "");
      const licenseName = String(pass?.federation_reference || "");
      const rawPassStatus = String(pass?.pass_status || "");
      const memberFees = feesByMember.get(memberId) || [];
      const latestFee = memberFees[0] || null;
      return {
        id: memberId,
        firstName,
        lastName,
        name: displayName,
        email: String(row.email || ""),
        positions: parseJsonArrayField(row.positions_json, []),
        roles: capabilitySet(rolesByProfile.get(String(row.profile_id || "")) || parseJsonArrayField(row.roles_json, ["player"])),
        jerseyNumber: row.jersey_number === null || row.jersey_number === undefined ? null : Number(row.jersey_number),
        active: String(row.membership_status || "") === "active",
        rookie: false,
        inClubee: Boolean(row.profile_id),
        membershipStatus: row.membership_status || "pending",
        deletedAt: row.deleted_at || null,
        profileId: row.profile_id || null,
        inviteSentAt: row.invite_sent_at || null,
        passStatus: normalizePassStatus({
          status: rawPassStatus,
          expiry: passExpiry,
          licenseName
        }),
        passExpiry,
        licenseName,
        feeStatus: latestFee
          ? String(latestFee.status || (Number(latestFee.paid_cents || 0) >= Number(latestFee.amount_cents || 0) && Number(latestFee.amount_cents || 0) > 0 ? "paid" : (Number(latestFee.paid_cents || 0) > 0 ? "partial" : "pending")))
          : "pending",
        notes: String(row.notes || ""),
        lastInviteResponse: "pending"
      };
    });

    const fees = (feeRows || []).map((row) => ({
      id: String(row.id || ""),
      memberId: String(row.member_id || ""),
      season: String(row.season_label || ""),
      feePeriod: String(row.fee_period || row.season_label || ""),
      amount: Number(row.amount_cents || 0) / 100,
      paidAmount: Number(row.paid_cents || 0) / 100,
      status: String(row.status || (String(row.paid_cents || 0) >= Number(row.amount_cents || 0) && Number(row.amount_cents || 0) > 0 ? "paid" : (Number(row.paid_cents || 0) > 0 ? "partial" : "pending"))),
      iban: String(row.iban || ""),
      note: String(row.status_note || "")
    }));

    const eventRecipientsByEvent = new Map();
    (recipientRows || []).forEach((row) => {
      const eventId = String(row.event_id || "");
      const list = eventRecipientsByEvent.get(eventId) || [];
      list.push(row);
      eventRecipientsByEvent.set(eventId, list);
    });

    const events = (eventRows || []).map((row) => {
      const recipients = eventRecipientsByEvent.get(String(row.id || "")) || [];
      return {
        id: String(row.id || ""),
        title: String(row.title || ""),
        type: String(row.event_type || "practice"),
        date: String(row.starts_at || "").slice(0, 10),
        location: String(row.location || ""),
        inviteStatus: recipients.length ? "sent" : "scheduled",
        attending: recipients.filter((recipient) => recipient.response === "confirmed").map((recipient) => String(recipient.member_id || "")),
        maybe: recipients.filter((recipient) => recipient.response === "maybe").map((recipient) => String(recipient.member_id || "")),
        unavailable: recipients.filter((recipient) => recipient.response === "declined").map((recipient) => String(recipient.member_id || ""))
      };
    });

    const invites = (inviteRows || []).map((row) => ({
      id: String(row.id || ""),
      eventId: String(row.event_id || ""),
      channel: String(row.channel || "email"),
      sentAt: String(row.sent_at || ""),
      recipients: Number(row.recipient_count || 0),
      opens: 0,
      confirmations: 0
    }));

    const currentUserRoles = (memberRoleRows || [])
      .filter((row) => String(row.profile_id || "") === String(authState.user.id || ""))
      .map((row) => String(row.role_code || "").trim())
      .filter(Boolean);
    const profileMatchedMember = (memberRows || []).find((row) => String(row.profile_id || "") === String(authState.user.id || ""));
    const emailMatchedMember = profileMatchedMember
      ? null
      : (memberRows || []).find((row) => String(row.email || "").trim().toLowerCase() === String(authState.user?.email || "").trim().toLowerCase());
    const memberRoleFallback = parseJsonArrayField(profileMatchedMember?.roles_json ?? emailMatchedMember?.roles_json, []);
    const effectiveRoles = currentUserRoles.length ? currentUserRoles : (memberRoleFallback.length ? memberRoleFallback : authState.roles);
    if (effectiveRoles.length) {
      currentAccessRole = primaryRoleFromRoles(effectiveRoles);
      saveStoredValue(ACCESS_KEY, currentAccessRole);
    }

    applyBootstrap({
      source: "supabase",
      permissionsModel: demoData.permissionsModel,
      members,
      fees,
      events,
      invites
    });
    authState.status = `Supabase data loaded for ${authDisplayName() || authState.user.email}.`;
    if (queryWarnings.length) {
      authState.status += ` Some data may be hidden by permissions (${queryWarnings.join(" | ")}).`;
    }
  }

  async function loadBootstrapData() {
    if (shouldUseSupabaseData()) {
      await loadSupabaseBootstrap();
      return;
    }
    await loadLocalBootstrap();
  }

  async function loadLocalBootstrap() {
    if (shouldRequireAuth() && !authState.user) {
      authState.status = "Sign in with email and password to continue.";
      return;
    }
    if (!window.location.hostname.includes("localhost") && window.location.hostname !== "127.0.0.1") {
      authState.status = "Static mode active. Local API is only available on localhost.";
      return;
    }

    try {
      const response = await fetch(apiUrl("/api/bootstrap"));
      if (!response.ok) throw new Error(`Bootstrap request failed with ${response.status}`);
      const bootstrap = await response.json();
      applyBootstrap(bootstrap);
      authState.status = "Local database mode active.";
    } catch (error) {
      authState.status = `Local API unavailable. Using saved local data. ${error.message}`;
      bootstrapMeta = {
        source: state.source || "demo",
        permissionsModel: state.permissionsModel || demoData.permissionsModel
      };
      ensureValidFeeFilter();
    }
  }

  function normalizeFeeStatusValue(value) {
    const normalized = String(value || "pending").trim().toLowerCase();
    const aliases = {
      paid: "paid",
      partial: "partial",
      pending: "pending",
      "not paid": "pending",
      not_collected: "not_collected",
      "not collected": "not_collected",
      exempt: "exempt",
      exit: "exit",
      not_applicable: "not_applicable",
      "not applicable": "not_applicable"
    };
    return aliases[normalized] || "pending";
  }

  function fullNameFromPayload(firstName, lastName) {
    const fullName = `${String(firstName || "").trim()} ${String(lastName || "").trim()}`.trim();
    return fullName || "Unknown member";
  }

  async function saveMemberViaSupabase(memberPayload) {
    if (!supabaseClient) throw new Error("Supabase client is not available.");

    const memberId = String(memberPayload.memberId || "").trim();
    const firstName = String(memberPayload.firstName || "").trim();
    const lastName = String(memberPayload.lastName || "").trim();
    const displayName = fullNameFromPayload(firstName, lastName);
    const positions = Array.isArray(memberPayload.positions)
      ? Array.from(new Set(memberPayload.positions.map((entry) => String(entry || "").trim().toUpperCase()).filter(Boolean)))
      : [];
    const roles = Array.isArray(memberPayload.roles)
      ? Array.from(new Set(memberPayload.roles.map((entry) => String(entry || "").trim()).filter(Boolean)))
      : ["player"];
    const jerseyRaw = String(memberPayload.jerseyNumber ?? "").trim();
    const jerseyNumber = jerseyRaw === "" ? null : Number(jerseyRaw);
    const passFieldsProvided = Object.prototype.hasOwnProperty.call(memberPayload, "passStatus") || Object.prototype.hasOwnProperty.call(memberPayload, "passExpiry");
    const normalizedPassStatus = (() => {
      const value = String(memberPayload.passStatus || "").trim().toLowerCase();
      if (!value || value === "pending" || value === "missing" || value === "unknown") return "missing";
      if (value === "expired") return "expired";
      return "valid";
    })();
    const normalizedPassExpiry = normalizedPassStatus === "missing"
      ? ""
      : String(memberPayload.passExpiry || "").trim();

    const patch = {
      first_name: firstName || null,
      last_name: lastName || null,
      display_name: displayName,
      email: String(memberPayload.email || "").trim(),
      positions_json: positions,
      roles_json: roles.length ? roles : ["player"],
      jersey_number: Number.isFinite(jerseyNumber) ? jerseyNumber : null,
      membership_status: String(memberPayload.membershipStatus || "pending").trim() || "pending",
      notes: String(memberPayload.notes || "").trim(),
      deleted_at: null
    };

    let savedMemberId = memberId;

    if (memberId) {
      const updateResponse = await supabaseClient.from("members").update(patch).eq("id", memberId).select("id, profile_id").single();
      if (updateResponse.error) throw updateResponse.error;
      savedMemberId = String(updateResponse.data?.id || memberId);

      if (currentAccessRole === "admin" && updateResponse.data?.profile_id) {
        const profileId = String(updateResponse.data.profile_id);
        const deleteResponse = await supabaseClient.from("member_roles").delete().eq("profile_id", profileId);
        if (deleteResponse.error) throw deleteResponse.error;
        const insertRows = (roles.length ? roles : ["player"]).map((role) => ({ profile_id: profileId, role_code: role }));
        const insertResponse = await supabaseClient.from("member_roles").insert(insertRows);
        if (insertResponse.error) throw insertResponse.error;
      }
    } else {
      const insertResponse = await supabaseClient.from("members").insert([patch]).select("id, profile_id").single();
      if (insertResponse.error) throw insertResponse.error;
      savedMemberId = String(insertResponse.data?.id || "");
    }

    if (passFieldsProvided && savedMemberId) {
      const passPayload = {
        member_id: savedMemberId,
        pass_status: normalizedPassStatus,
        expires_on: normalizedPassExpiry || null
      };

      let passResponse = await supabaseClient.from("player_passes").upsert(passPayload, { onConflict: "member_id" });

      if (passResponse.error && normalizedPassStatus === "missing") {
        const message = String(passResponse.error?.message || "").toLowerCase();
        const likelyOldStatusConstraint =
          message.includes("player_passes_pass_status_check") ||
          message.includes("violates check constraint") ||
          message.includes("pass_status");

        if (likelyOldStatusConstraint) {
          // Compatibility mode for older schemas that don't accept 'missing'.
          passResponse = await supabaseClient.from("player_passes").upsert(
            {
              member_id: savedMemberId,
              pass_status: "expired",
              expires_on: null
            },
            { onConflict: "member_id" }
          );
        }
      }

      if (passResponse.error) throw passResponse.error;
    }

    await loadBootstrapData();
  }

  async function removeMemberViaSupabase(memberId) {
    const response = await supabaseClient
      .from("members")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", memberId);
    if (response.error) throw response.error;
    await loadBootstrapData();
  }

  async function undeleteMemberViaSupabase(memberId) {
    const response = await supabaseClient.from("members").update({ deleted_at: null }).eq("id", memberId);
    if (response.error) throw response.error;
    await loadBootstrapData();
  }

  async function mergeMembersViaSupabase({ keepMemberId, removeMemberId }) {
    if (!supabaseClient) throw new Error("Supabase client is not available.");

    const keepId = String(keepMemberId || "").trim();
    const removeId = String(removeMemberId || "").trim();
    if (!keepId || !removeId || keepId === removeId) {
      throw new Error("Keep and remove member must be different.");
    }

    const feeMove = await supabaseClient.from("membership_fees").update({ member_id: keepId }).eq("member_id", removeId);
    if (feeMove.error) throw feeMove.error;

    const keepPass = await supabaseClient.from("player_passes").select("id").eq("member_id", keepId).maybeSingle();
    if (keepPass.error) throw keepPass.error;
    const removePass = await supabaseClient.from("player_passes").select("id").eq("member_id", removeId).maybeSingle();
    if (removePass.error) throw removePass.error;
    if (removePass.data?.id) {
      if (keepPass.data?.id) {
        const deletePass = await supabaseClient.from("player_passes").delete().eq("member_id", removeId);
        if (deletePass.error) throw deletePass.error;
      } else {
        const movePass = await supabaseClient.from("player_passes").update({ member_id: keepId }).eq("member_id", removeId);
        if (movePass.error) throw movePass.error;
      }
    }

    const deleteMember = await supabaseClient.from("members").delete().eq("id", removeId);
    if (deleteMember.error) throw deleteMember.error;

    await loadBootstrapData();
  }

  async function updateFeeStatusesBulkViaSupabase({ feePeriod, status, memberIds }) {
    if (!supabaseClient) throw new Error("Supabase client is not available.");

    const normalizedStatus = normalizeFeeStatusValue(status);
    const ids = (Array.isArray(memberIds) ? memberIds : []).map((id) => String(id || "").trim()).filter(Boolean);
    if (!ids.length) throw new Error("Select at least one member.");

    const query = await supabaseClient
      .from("membership_fees")
      .select("id, amount_cents, paid_cents")
      .eq("fee_period", String(feePeriod || ""))
      .in("member_id", ids);
    if (query.error) throw query.error;

    const rows = query.data || [];
    for (const row of rows) {
      const amountCents = Number(row.amount_cents || 0);
      let paidCents = Number(row.paid_cents || 0);
      if (normalizedStatus === "paid") paidCents = amountCents;
      else if (normalizedStatus === "partial") paidCents = paidCents > 0 && paidCents < amountCents ? paidCents : Math.round(amountCents / 2);
      else paidCents = 0;

      const update = await supabaseClient
        .from("membership_fees")
        .update({ status: normalizedStatus, paid_cents: paidCents })
        .eq("id", row.id);
      if (update.error) throw update.error;
    }

    await loadBootstrapData();
  }

  async function updateFeeRowViaSupabase({ feeId, status, amount, paidAmount, note, iban }) {
    if (!supabaseClient) throw new Error("Supabase client is not available.");

    const normalizedStatus = normalizeFeeStatusValue(status);
    const amountCents = Math.max(0, Math.round(Number(amount || 0) * 100));
    let paidCents = Math.max(0, Math.round(Number(paidAmount || 0) * 100));

    if (normalizedStatus === "paid") paidCents = amountCents;
    else if (["pending", "not_collected", "exempt", "exit", "not_applicable"].includes(normalizedStatus)) paidCents = 0;

    const response = await supabaseClient
      .from("membership_fees")
      .update({
        status: normalizedStatus,
        amount_cents: amountCents,
        paid_cents: paidCents,
        status_note: String(note || "").trim() || null,
        iban: String(iban || "").trim() || null
      })
      .eq("id", String(feeId || ""));
    if (response.error) throw response.error;

    await loadBootstrapData();
  }

  async function saveMember(memberPayload) {
    if (shouldUseSupabaseData()) {
      await saveMemberViaSupabase(memberPayload);
      return;
    }
    const memberId = String(memberPayload.memberId || "").trim();
    const url = memberId ? apiUrl(`/api/members/${memberId}`) : apiUrl("/api/members");
    const method = memberId ? "PUT" : "POST";
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: memberPayload.firstName,
        lastName: memberPayload.lastName,
        email: memberPayload.email,
        positions: memberPayload.positions,
        roles: memberPayload.roles,
        jerseyNumber: memberPayload.jerseyNumber,
        membershipStatus: memberPayload.membershipStatus,
        passStatus: memberPayload.passStatus,
        passExpiry: memberPayload.passExpiry,
        notes: memberPayload.notes
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not save member.");
    applyBootstrap(payload);
  }

  async function removeMember(memberId) {
    if (shouldUseSupabaseData()) {
      await removeMemberViaSupabase(memberId);
      return;
    }
    const response = await fetch(apiUrl(`/api/members/${memberId}`), { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not delete member.");
    applyBootstrap(payload);
  }

  async function undeleteMember(memberId) {
    if (shouldUseSupabaseData()) {
      await undeleteMemberViaSupabase(memberId);
      return;
    }
    const response = await fetch(apiUrl(`/api/members/${memberId}/undelete`), { method: "POST" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not undelete member.");
    applyBootstrap(payload);
  }

  async function mergeMemberRecords({ keepMemberId, removeMemberId, firstName, lastName }) {
    if (shouldUseSupabaseData()) {
      await mergeMembersViaSupabase({ keepMemberId, removeMemberId, firstName, lastName });
      return;
    }
    const response = await fetch(apiUrl("/api/members/merge"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keepMemberId, removeMemberId, firstName, lastName })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not merge members.");
    applyBootstrap(payload);
  }

  async function updateFeeStatusesBulk({ feePeriod, status, memberIds }) {
    if (shouldUseSupabaseData()) {
      await updateFeeStatusesBulkViaSupabase({ feePeriod, status, memberIds });
      return;
    }
    const response = await fetch(apiUrl("/api/fees/bulk-status"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feePeriod, status, memberIds })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not update fee statuses.");
    applyBootstrap(payload);
  }

  async function updateFeeRow({ feeId, status, amount, paidAmount, note, iban }) {
    if (shouldUseSupabaseData()) {
      await updateFeeRowViaSupabase({ feeId, status, amount, paidAmount, note, iban });
      return;
    }
    const response = await fetch(apiUrl(`/api/fees/${feeId}`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, amount, paidAmount, note, iban })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not update fee row.");
    applyBootstrap(payload);
  }

  async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        resolve(result.includes(",") ? result.split(",").pop() || "" : result);
      };
      reader.onerror = () => reject(new Error("Could not read the selected file."));
      reader.readAsDataURL(file);
    });
  }

  async function previewClubeePassSync() {
    const response = await fetch(apiUrl("/api/passes/sync-clubee/preview"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: passSyncUpload?.fileName || "",
        fileBase64: passSyncUpload?.fileBase64 || ""
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not build Clubee pass preview.");
    return payload.preview || null;
  }

  async function applyClubeePassSync(memberIds) {
    const response = await fetch(apiUrl("/api/passes/sync-clubee/apply"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberIds,
        fileName: passSyncUpload?.fileName || "",
        fileBase64: passSyncUpload?.fileBase64 || ""
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not apply Clubee pass sync.");
    if (Array.isArray(payload?.members) || Array.isArray(payload?.fees)) {
      applyBootstrap(payload);
    } else {
      await loadBootstrapData();
    }
    return payload.passSyncApply || null;
  }

  function passSyncFieldLabel(field) {
    const labels = {
      in_clubee: "In Clubee",
      pass_status: "Pass status",
      expiry_date: "Expiry date",
      license_name: "License",
      medical_status: "Medical status",
      docs_json: "Documents",
      clubee_email: "Clubee email",
      clubee_phone: "Clubee phone",
      note: "Clubee note"
    };
    return labels[String(field || "")] || String(field || "");
  }

  async function updateMemberSensitiveFinance({ memberId, iban, statusByFeeId }) {
    if (currentAccessRole !== "admin") {
      throw new Error("Only admins can change IBAN or quarter payment statuses.");
    }
    const memberFees = state.fees.filter((fee) => String(fee.memberId) === String(memberId));
    const ibanValue = String(iban || "").trim();
    for (const fee of memberFees) {
      await updateFeeRow({
        feeId: fee.id,
        status: statusByFeeId[String(fee.id)] || fee.status,
        amount: Number(fee.amount || 0),
        paidAmount: Number(fee.paidAmount || 0),
        note: "",
        iban: ibanValue
      });
    }
  }

  function computeDashboardStats() {
    return {
      activeMembers: state.members.filter((member) => member.membershipStatus === "active").length,
      players: state.members.filter((member) => member.roles.includes("player")).length,
      passAlerts: state.members.filter((member) => ["expiring", "expired", "missing", "pending"].includes(member.passStatus) || isPassExpiringSoon(member.passExpiry)).length,
      outstandingFees: state.fees.reduce((sum, fee) => sum + Math.max(fee.amount - fee.paidAmount, 0), 0)
    };
  }

  function renderHeroNotice() {
    const heroActions = document.querySelector(".hero-actions");
    if (!heroActions) return;
    const signedInLabel = authState.user ? authDisplayName() || authState.user.email : "Not signed in";
    heroActions.innerHTML = `
      <div class="hero-stack">
        <div class="toolbar-row">
          ${authState.user ? `<div class="role-switcher"><span>Signed in</span><strong>${signedInLabel}</strong><div class="meta">${roleLabel(currentAccessRole)}</div></div>` : ""}
          <div class="button-row">
            ${authState.user ? `<button id="auth-sign-out-header" class="ghost-button" type="button">Sign out</button>` : ""}
          </div>
        </div>
      </div>
    `;
    const signOutHeaderButton = document.getElementById("auth-sign-out-header");
    if (signOutHeaderButton) {
      signOutHeaderButton.onclick = async function () {
        try {
          await signOut();
          authState.status = "Signed out.";
          mount();
        } catch (error) {
          authState.status = error.message;
          mount();
        }
      };
    }
  }
  function renderDashboard() {
    if (shouldRequireAuth() && !authState.user) {
      return renderAuthGate();
    }
    const userMember = signedInMemberRecord();
    const quarterToken = currentQuarterToken();
    const quarterFormatted = quarterToken.replace("_", " ");
    const currentQuarterFee = userMember ? memberFeesByPeriod(userMember.id).get(quarterToken) : null;
    const currentQuarterFeeStatusLabel = currentQuarterFee
      ? statusLabel(currentQuarterFee.status)
      : statusLabel(userMember?.feeStatus || "pending");
    const passValidationDate = userMember?.passExpiry ? formatDate(userMember.passExpiry) : "-";
    const passValidity = (() => {
      if (!userMember) return "-";
      const normalizedPassStatus = String(userMember.passStatus || "").trim().toLowerCase();
      if (normalizedPassStatus === "expired") return "Expired";
      if (normalizedPassStatus === "valid" || normalizedPassStatus === "expiring") return "Valid";
      if (userMember.passExpiry) {
        const expiryDate = new Date(`${userMember.passExpiry}T00:00:00`);
        if (!Number.isNaN(expiryDate.getTime())) {
          return expiryDate.getTime() < Date.now() ? "Expired" : "Valid";
        }
      }
      return "Missing";
    })();
    const athleteStatsHtml = userMember ? `
      <article class="setup-card">
        <p class="eyebrow">Your Profile</p>
        <h3>${userMember.name}</h3>
        <div style="display: grid; gap: 12px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <p class="muted">Jersey Number</p>
              <p style="font-size: 1.25rem; font-weight: 600;">${userMember.jerseyNumber || "—"}</p>
            </div>
            <div>
              <p class="muted">Membership Status</p>
              <p style="font-size: 1.25rem; font-weight: 600;">${userMember.membershipStatus}</p>
            </div>
          </div>
          <div>
            <p class="muted">Membership fee status for ${quarterFormatted}</p>
            <p style="font-size: 1.25rem; font-weight: 600;">${currentQuarterFeeStatusLabel || "No fees"}</p>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <p class="muted">Player pass</p>
              <p style="font-size: 1.25rem; font-weight: 600;">${passValidity}</p>
            </div>
            <div>
              <p class="muted">Valid till</p>
              <p style="font-size: 1.25rem; font-weight: 600;">${passValidationDate}</p>
            </div>
          </div>
          <div class="button-row">
            <button class="primary-button" id="athlete-view-profile-btn" type="button" data-no-toast="true">View Full Profile</button>
          </div>
        </div>
      </article>
    ` : `
      <article class="setup-card">
        <p class="eyebrow">Your Profile</p>
        <h3>No athlete profile linked</h3>
        <p class="muted">Your signed-in account is active, but no player record is connected yet.</p>
      </article>
    `;
    return `
      <div style="max-width: 760px; display: grid; gap: 12px;">
        ${athleteStatsHtml}
      </div>
    `;
  }

  function renderMembers() {
    if (shouldRequireAuth() && !authState.user) {
      return renderAuthGate();
    }
    const rows = sortedMembers();
    const options = memberFilterOptions();
    const canManageMembers = currentAccessRole === "admin" || currentAccessRole === "coach";
    const canSeeSensitiveMemberColumns = canManageMembers;
    const adminActionsEnabled = currentAccessRole === "admin" && memberMergeMode;
    const mergeControls = currentAccessRole === "admin"
      ? `<button class="ghost-button" id="toggle-member-admin-mode" type="button">${memberMergeMode ? "Disable admin mode" : "Enable admin mode"}</button>`
      : "";
    const mergeHint = currentAccessRole === "admin"
      ? `<p class="muted">${memberMergeMode ? "Admin mode is active. Merge and deleted-member tools are enabled." : "Enable admin mode for critical tools like merge and deleted-member visibility."}</p>`
      : "";
    const showMergeButton = adminActionsEnabled;
    const showMemberIdColumn = showMergeButton;
    const showActionColumn = canManageMembers;
    const showProfileColumn = true;
    const visibleColumnCount =
      (showMemberIdColumn ? 1 : 0) +
      1 +
      1 +
      1 +
      1 +
      1 +
      (showProfileColumn ? 1 : 0) +
      (canSeeSensitiveMemberColumns ? 1 : 0) +
      (canSeeSensitiveMemberColumns ? 1 : 0) +
      (showActionColumn ? 1 : 0);
    return `
      <div class="section-head">
        <div><p class="eyebrow">Roster</p><h3>Members, roles, and positions</h3></div>
        <div class="button-row">
          <details class="export-menu">
            <summary class="ghost-button export-menu-trigger">Export</summary>
            <div class="export-menu-list">
              <button class="ghost-button small-button" id="export-members-csv-option" type="button">CSV</button>
              <button class="ghost-button small-button" id="export-members-excel-option" type="button">Excel</button>
            </div>
          </details>
          ${canManageMembers ? `<button class="primary-button" id="open-member-dialog" type="button">Add member</button>` : ""}
          ${mergeControls}
        </div>
      </div>
      ${mergeHint}
      <article class="card filter-card members-filter-sticky members-filter-card" style="margin-bottom: 14px;">
        <details class="member-filters-dropdown" ${memberFiltersExpanded ? "open" : ""}>
          <summary>
            <span class="member-filter-summary-label">Filters</span>
            <span class="member-filter-summary-meta">Positions, roles, membership</span>
          </summary>
          <div style="margin-top: 10px;">
            <label>Search by name or email
              <input id="member-search-input" type="search" placeholder="e.g. test test" value="${String(memberFilters.search || "").replaceAll('"', '&quot;')}" />
            </label>
          </div>
          <div class="split" style="grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 10px;">
            <fieldset class="status-filter-group">
              <legend>Positions</legend>
              <div class="status-filter-options">
                ${options.positions.map((value) => `
                  <label class="status-check">
                    <input type="checkbox" class="member-filter-checkbox" data-member-filter="positions" value="${value}" ${memberFilters.positions.includes(value) ? "checked" : ""} />
                    <span>${value}</span>
                  </label>
                `).join("") || `<span class="meta">No positions</span>`}
              </div>
            </fieldset>
            <fieldset class="status-filter-group">
              <legend>Roles</legend>
              <div class="status-filter-options">
                ${options.roles.map((value) => `
                  <label class="status-check">
                    <input type="checkbox" class="member-filter-checkbox" data-member-filter="roles" value="${value}" ${memberFilters.roles.includes(value) ? "checked" : ""} />
                    <span>${roleLabel(value)}</span>
                  </label>
                `).join("") || `<span class="meta">No roles</span>`}
              </div>
            </fieldset>
            <fieldset class="status-filter-group">
              <legend>Membership</legend>
              <div class="status-filter-options">
                ${options.membership.map((value) => `
                  <label class="status-check">
                    <input type="checkbox" class="member-filter-checkbox" data-member-filter="membership" value="${value}" ${memberFilters.membership.includes(value) ? "checked" : ""} />
                    <span>${value.replaceAll("_", " ")}</span>
                  </label>
                `).join("") || `<span class="meta">No membership states</span>`}
                ${adminActionsEnabled ? `
                  <label class="status-check">
                    <input type="checkbox" id="show-deleted-members" ${memberFilters.showDeleted ? "checked" : ""} />
                    <span>deleted</span>
                  </label>
                ` : ""}
              </div>
            </fieldset>
          </div>
          <div class="button-row" style="margin-top: 10px;">
            <button id="clear-member-filters" type="button" class="ghost-button">Clear member filters</button>
          </div>
        </details>
      </article>
      <div class="table-wrap">
        <table>
          <thead><tr>${showProfileColumn ? `<th>Profile</th>` : ""}${showMemberIdColumn ? `<th>${renderSortButton("members", "id", "ID")}</th>` : ""}<th>${renderSortButton("members", "firstName", "First name")}</th><th>${renderSortButton("members", "lastName", "Last name")}</th><th>Positions</th><th>Roles</th><th>${renderSortButton("members", "jerseyNumber", "Jersey")}</th>${canSeeSensitiveMemberColumns ? `<th>Membership</th><th>${renderSortButton("members", "passStatus", "Pass")}</th>` : ""}${showActionColumn ? `<th>Actions</th>` : ""}</tr></thead>
          <tbody>
            ${rows.map((member) => `
              <tr>
                ${showProfileColumn ? `<td><button class="ghost-button small-button profile-icon-button open-user-page-button" type="button" data-member-id="${member.id}" aria-label="Open profile"></button></td>` : ""}
                ${showMemberIdColumn ? `<td><span class="meta">${member.id}</span></td>` : ""}
                <td>
                  ${adminActionsEnabled && !member.deletedAt
                    ? `<input class="member-inline-input member-inline-first-name" data-member-id="${member.id}" value="${member.firstName || ""}" />`
                    : `<strong>${member.firstName || "-"}</strong>`}
                </td>
                <td>
                  ${adminActionsEnabled && !member.deletedAt
                    ? `<input class="member-inline-input member-inline-last-name" data-member-id="${member.id}" value="${member.lastName || ""}" /><div class="meta"><input class="member-inline-input member-inline-email" data-member-id="${member.id}" value="${member.email || ""}" placeholder="email" /></div>`
                    : `<strong>${member.lastName || "-"}</strong><div class="meta">${member.email || "No email yet"}</div>`}
                </td>
                <td>
                  ${adminActionsEnabled && !member.deletedAt
                    ? `<details class="member-inline-multiselect" data-member-id="${member.id}" data-member-multi="positions"><summary>${(member.positions || []).length ? `${(member.positions || []).length} selected` : "Select positions"}</summary><div class="member-inline-multiselect-options">${Array.from(new Set([...memberPositionOptions, ...(member.positions || [])])).map((value) => `<label class="status-check"><input type="checkbox" class="member-inline-option" data-member-id="${member.id}" data-member-multi="positions" value="${value}" ${(member.positions || []).includes(value) ? "checked" : ""} /><span>${value}</span></label>`).join("")}</div></details>`
                    : `<div class="pill-row dense-row">${member.positions.length ? member.positions.map(plainPill).join(" ") : `<span class="meta">-</span>`}</div>`}
                </td>
                <td>
                  ${adminActionsEnabled && !member.deletedAt
                    ? `<details class="member-inline-multiselect" data-member-id="${member.id}" data-member-multi="roles"><summary>${(member.roles || []).length ? `${(member.roles || []).length} selected` : "Select roles"}</summary><div class="member-inline-multiselect-options">${Array.from(new Set([...memberRoleOptions, ...(member.roles || [])])).map((value) => `<label class="status-check"><input type="checkbox" class="member-inline-option" data-member-id="${member.id}" data-member-multi="roles" value="${value}" ${(member.roles || []).includes(value) ? "checked" : ""} /><span>${roleLabel(value)}</span></label>`).join("")}</div></details>`
                    : `<div class="pill-row dense-row">${member.roles.length ? member.roles.map(rolePill).join(" ") : `<span class="meta">-</span>`}</div>`}
                </td>
                <td>
                  ${adminActionsEnabled && !member.deletedAt
                    ? `<input type="number" min="0" class="member-inline-input member-inline-jersey" data-member-id="${member.id}" value="${member.jerseyNumber ?? ""}" />`
                    : (member.jerseyNumber ?? "-")}
                </td>
                ${canSeeSensitiveMemberColumns ? `
                  <td>
                    ${adminActionsEnabled && !member.deletedAt
                      ? `<select class="member-inline-input member-inline-membership" data-member-id="${member.id}"><option value="active" ${member.membershipStatus === "active" ? "selected" : ""}>active</option><option value="pending" ${member.membershipStatus === "pending" ? "selected" : ""}>pending</option><option value="inactive" ${member.membershipStatus === "inactive" ? "selected" : ""}>inactive</option></select>`
                      : (member.deletedAt ? statusPill("deleted", "deleted") : statusPill(member.membershipStatus))}
                  </td>
                  <td>
                    ${adminActionsEnabled && !member.deletedAt
                      ? `<div class="member-pass-stack"><select class="member-inline-input member-inline-pass-status" data-member-id="${member.id}"><option value="valid" ${displayPassStatus(member.passStatus) === "valid" ? "selected" : ""}>valid</option><option value="missing" ${displayPassStatus(member.passStatus) === "missing" ? "selected" : ""}>missing</option><option value="expired" ${displayPassStatus(member.passStatus) === "expired" ? "selected" : ""}>expired</option></select><input type="date" class="member-inline-input member-inline-pass-expiry ${isPassExpiringSoon(member.passExpiry) ? "is-expiring-soon" : ""}" data-member-id="${member.id}" value="${member.passExpiry || ""}" /></div>`
                      : `<div class="member-pass-stack"><span>${statusPill(displayPassStatus(member.passStatus))}</span><div class="meta ${isPassExpiringSoon(member.passExpiry) ? "is-expiring-soon" : ""}">${member.passExpiry ? `Until ${formatDate(member.passExpiry)}` : member.licenseName || "No pass data"}</div></div>`}
                  </td>
                ` : ""}
                ${showActionColumn ? `
                  <td>
                    <div class="pill-row dense-row" style="margin-bottom: 6px;">${renderMemberInvitePill(member)}</div>
                    <div class="action-row">
                      ${adminActionsEnabled && !member.deletedAt ? `<button class="ghost-button small-button member-inline-save-button" type="button" data-member-id="${member.id}">Save</button>` : `<button class="ghost-button small-button edit-member-button" type="button" data-member-id="${member.id}">Edit</button>`}
                      ${renderMemberInviteAction(member)}
                      ${showMergeButton ? `<button class="ghost-button small-button merge-member-button" type="button" data-member-id="${member.id}">Merge</button>` : ""}
                      ${adminActionsEnabled && member.deletedAt ? `<button class="ghost-button small-button undelete-member-button" type="button" data-member-id="${member.id}">Undelete</button>` : ""}
                      ${adminActionsEnabled && !member.deletedAt ? `<button class="ghost-button small-button danger-button delete-member-button" type="button" data-member-id="${member.id}">Delete</button>` : ""}
                    </div>
                  </td>
                ` : ""}
              </tr>
            `).join("") || `<tr><td colspan="${visibleColumnCount}" class="meta">No members match the selected filters.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderUserPage() {
    if (shouldRequireAuth() && !authState.user) {
      return renderAuthGate();
    }
    const hashMemberId = userPageMemberIdFromHash();
    const ownMemberId = signedInMemberRecord()?.id || "";
    const memberId = profileRouteMode === "own"
      ? (hashMemberId || ownMemberId)
      : (hashMemberId || ownMemberId || selectedUserMemberId);
    const member = memberById(memberId);

    if (!member) {
      if (profileRouteMode === "own") {
        return emptyState("Your profile is not linked yet", "Your signed-in account is not connected to a member record. Ask an admin to link your account to your member profile.");
      }
      return emptyState("No member selected", "Open a profile from Members or Membership Finance to view and edit details.");
    }

    const canEditProfile = canEditMemberProfile(member);
    const editDisabled = canEditProfile ? "" : "disabled";
    const canViewSensitive = canViewSensitiveProfileFields(member);
    const canEditSensitive = currentAccessRole === "admin";
    const sensitiveDisabled = canEditSensitive ? "" : "disabled";
    const canEditRolePosition = currentAccessRole === "admin";
    const rolePositionDisabled = canEditRolePosition ? "" : "disabled";
    const canEditNotes = currentAccessRole === "admin";
    const notesDisabled = canEditNotes ? "" : "disabled";
    const feeMap = memberFeesByPeriod(member.id);
    const periods = profileQuarterWindowTokens();
    const firstIban = memberIban(member.id);
    const sensitiveSection = canViewSensitive
      ? `
      <article class="card compact-card" style="display:grid; gap: 10px;">
        <div>
          <p class="eyebrow">Sensitive finance</p>
          <h3 style="margin-top: 4px;">IBAN and quarter payment statuses</h3>
        </div>
        ${canEditSensitive
          ? `<label>IBAN:<input id="user-sensitive-iban" value="${firstIban}" ${sensitiveDisabled} /></label>`
          : `<div><p class="muted" style="margin-bottom: 4px;">IBAN</p><p>${firstIban || "No IBAN on file"}</p></div>`}
        <div class="table-wrap">
          <table>
            <thead><tr><th>Quarter</th><th>Status</th></tr></thead>
            <tbody>
              ${periods.map((period) => {
                const fee = feeMap.get(period);
                if (!fee) {
                  return `<tr><td>${formatFeePeriod(period)}</td><td><span class="meta">No record</span></td></tr>`;
                }
                if (canEditSensitive) {
                  return `<tr><td>${formatFeePeriod(period)}</td><td><select class="user-sensitive-fee-status" data-fee-id="${fee.id}" ${sensitiveDisabled}><option value="paid" ${fee.status === "paid" ? "selected" : ""}>paid</option><option value="partial" ${fee.status === "partial" ? "selected" : ""}>partial</option><option value="pending" ${fee.status === "pending" ? "selected" : ""}>pending</option><option value="not_collected" ${fee.status === "not_collected" ? "selected" : ""}>not collected</option><option value="exempt" ${fee.status === "exempt" ? "selected" : ""}>exempt</option><option value="exit" ${fee.status === "exit" ? "selected" : ""}>exit</option><option value="not_applicable" ${fee.status === "not_applicable" ? "selected" : ""}>not in team</option></select></td></tr>`;
                }
                return `<tr><td>${formatFeePeriod(period)}</td><td>${statusPill(fee.status)}</td></tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
        ${canEditSensitive ? `<div class="button-row"><button type="button" class="primary-button" id="save-user-sensitive" data-member-id="${member.id}">Save finance fields</button></div>` : ""}
      </article>
      `
      : "";
    const rolePositionSection = `
      <article class="card compact-card" style="display:grid; gap: 10px;">
        <div>
          <p class="eyebrow">Club profile</p>
          <h3 style="margin-top: 4px;">Role and position</h3>
        </div>
        <div class="pill-row dense-row">
          ${member.roles.length ? member.roles.map(rolePill).join(" ") : `<span class="meta">No role set</span>`}
          ${member.positions.length ? member.positions.map(plainPill).join(" ") : `<span class="meta">No position set</span>`}
        </div>
        ${canEditRolePosition ? `
          <div class="form-grid">
            <div>
              <label>Roles</label>
              <details class="member-inline-multiselect" id="user-role-multiselect">
                <summary>${member.roles.length ? `${member.roles.length} selected` : "Select roles"}</summary>
                <div class="member-inline-multiselect-options">
                  ${Array.from(new Set([...memberRoleOptions, ...(member.roles || [])])).map((role) => `<label class="status-check"><input type="checkbox" class="user-role-option" value="${role}" ${(member.roles || []).includes(role) ? "checked" : ""} ${rolePositionDisabled} /><span>${roleLabel(role)}</span></label>`).join("")}
                </div>
              </details>
            </div>
            <div>
              <label>Positions</label>
              <details class="member-inline-multiselect" id="user-position-multiselect">
                <summary>${member.positions.length ? `${member.positions.length} selected` : "Select positions"}</summary>
                <div class="member-inline-multiselect-options">
                  ${Array.from(new Set([...memberPositionOptions, ...(member.positions || [])])).map((position) => `<label class="status-check"><input type="checkbox" class="user-position-option" value="${position}" ${(member.positions || []).includes(position) ? "checked" : ""} ${rolePositionDisabled} /><span>${position}</span></label>`).join("")}
                </div>
              </details>
            </div>
          </div>
          <div class="button-row"><button type="button" class="primary-button" id="save-user-role-position" data-member-id="${member.id}">Save role and position</button></div>
        ` : ""}
      </article>
    `;
    const notesSection = `
      <article class="card compact-card" style="display:grid; gap: 10px;">
        <div>
          <p class="eyebrow">Notes</p>
          <h3 style="margin-top: 4px;">Member notes</h3>
        </div>
        <label>Notes<textarea id="user-notes" rows="3" placeholder="No notes yet" ${notesDisabled}>${member.notes || ""}</textarea></label>
        ${canEditNotes ? `<div class="button-row"><button type="button" class="primary-button" id="save-user-notes" data-member-id="${member.id}">Save notes</button></div>` : ""}
      </article>
    `;
    const passSection = `
      <article class="card compact-card" style="display:grid; gap: 10px;">
        <div>
          <p class="eyebrow">Eligibility</p>
          <h3 style="margin-top: 4px;">Player pass</h3>
        </div>
        <div class="pill-row dense-row">
          ${statusPill(displayPassStatus(member.passStatus))}
        </div>
        <p class="meta ${isPassExpiringSoon(member.passExpiry) ? "is-expiring-soon" : ""}">${member.passExpiry ? `Valid till ${formatDate(member.passExpiry)}` : (member.licenseName || "No expiry date")}</p>
      </article>
    `;
    const securitySection = authState.user && isOwnProfile(member) ? `
      <article class="card compact-card" style="display:grid; gap: 10px;">
        <div>
          <p class="eyebrow">Security</p>
          <h3 style="margin-top: 4px;">Password</h3>
        </div>
        <p class="muted">Update your password to keep your account secure.</p>
        <div class="button-row"><button type="button" class="primary-button" id="change-password-button">Change password</button></div>
      </article>
    ` : "";

    return `
      <div class="section-head">
        <div><p class="eyebrow">User</p><h3>Member profile</h3></div>
        <div class="button-row"><button type="button" id="back-to-members" class="ghost-button">Back to members</button></div>
      </div>
      <div class="profile-layout">
        <article class="card profile-main-card" style="display:grid; gap: 12px;">
        <div style="display:flex; align-items:center; gap: 14px;">
          <img src="./assets/emperors-mark.png" alt="Profile placeholder" style="width:64px; height:64px; border-radius:999px; object-fit:cover; border:1px solid var(--line);" />
          <div>
            <h3 style="margin:0;">${member.name}</h3>
            <p class="meta" style="margin:4px 0 0;">${member.email || "No email yet"}</p>
          </div>
        </div>
        <div class="form-grid">
          <label>First name<input id="user-first-name" value="${member.firstName || ""}" ${editDisabled} /></label>
          <label>Last name<input id="user-last-name" value="${member.lastName || ""}" ${editDisabled} /></label>
        </div>
        <div class="form-grid">
          <label>Email<input id="user-email" type="email" value="${member.email || ""}" ${editDisabled} /></label>
          <label>Jersey number<input id="user-jersey" type="number" min="0" value="${member.jerseyNumber ?? ""}" ${editDisabled} /></label>
        </div>
        ${canEditProfile ? `<div class="button-row"><button type="button" class="primary-button" id="save-user-profile" data-member-id="${member.id}">Save profile</button></div>` : ""}
        </article>
        <div class="profile-side-column">
          ${rolePositionSection}
          ${passSection}
          ${notesSection}
          ${securitySection}
          ${sensitiveSection}
        </div>
      </div>
    `;
  }

  function renderFees() {
    if (shouldRequireAuth() && !authState.user) {
      return renderAuthGate();
    }
    if (currentAccessRole !== "admin") {
      return lockedState("Membership finance is hidden for this role.", "Only admins should see and manage membership finance data.");
    }

    const periods = getFeePeriods();
    const visibleFees = sortedVisibleFees();
    const statuses = availableFeeStatuses();
    const collectibleRows = visibleFees.filter((fee) => ["paid", "pending"].includes(fee.status));
    const totalTarget = collectibleRows.reduce((sum, fee) => sum + fee.amount, 0);
    const totalPaid = collectibleRows.reduce((sum, fee) => sum + fee.paidAmount, 0);
    const selectedLabel = currentFeePeriod();
    const currentQuarter = currentQuarterToken();
    const selectedSet = new Set(selectedFeeMemberIds.map(String));
    const visibleMemberIds = Array.from(new Set(visibleFees.map((fee) => String(fee.memberId))));
    const selectedVisibleCount = visibleMemberIds.filter((memberId) => selectedSet.has(memberId)).length;
    const editableStatuses = ["paid", "partial", "pending", "not_collected", "exempt", "exit", "not_applicable"];

    return `
      <div class="section-head">
        <div><p class="eyebrow">Finance</p><h3>Membership finance</h3></div>
        <div class="button-row">
          <details class="export-menu">
            <summary class="ghost-button export-menu-trigger">Export</summary>
            <div class="export-menu-list">
              <button id="export-fees-csv-option" class="ghost-button small-button" type="button">CSV</button>
              <button id="export-fees-excel-option" class="ghost-button small-button" type="button">Excel</button>
              <button id="export-fees-sepa-xml-option" class="ghost-button small-button" type="button">SEPA XML</button>
            </div>
          </details>
          <button id="toggle-fee-edit-mode" class="ghost-button" type="button">${feeEditMode ? "Exit edit mode" : "Enter edit mode"}</button>
        </div>
      </div>
      <div class="grid two-up">
        <article class="card finance-summary-card">
          <p>${formatMoney(totalPaid)} collected of ${formatMoney(totalTarget)} target.</p>
          <label class="filter-label" style="margin-top: 8px;">Choose fee quarter<select id="fee-period-select">${periods.map((period) => `<option value="${period}" ${period === selectedFeePeriod ? "selected" : ""}>${formatFeePeriod(period)}${period === currentQuarter ? " (current)" : ""}</option>`).join("")}</select></label>
        </article>
      </div>
      <article class="card filter-card fees-filter-sticky fees-filter-card" style="margin-bottom: 14px;">
        <details class="fee-filters-dropdown" ${feeFiltersExpanded ? "open" : ""}>
          <summary>
            <span class="member-filter-summary-label">Filters</span>
            <span class="member-filter-summary-meta">Status</span>
          </summary>
          <fieldset class="status-filter-group">
            <legend>Fee status</legend>
            <div class="status-filter-options">
              ${statuses.map((status) => `
                <label class="status-check">
                  <input type="checkbox" class="fee-status-checkbox" value="${status}" ${selectedFeeStatuses.includes(status) ? "checked" : ""} />
                  <span>${statusLabel(status)}</span>
                </label>
              `).join("") || `<span class="meta">No statuses for this quarter.</span>`}
            </div>
          </fieldset>
          <div class="button-row" style="margin-top: 10px;">
            <button id="clear-fee-filters" type="button" class="ghost-button">Reset fee filters</button>
          </div>
        </details>
      </article>
      ${feeEditMode ? `
        <article class="card filter-card" style="margin-bottom: 12px;">
          <p class="eyebrow">Bulk edit</p>
          <h3>Update fee status for selected members</h3>
          <div class="button-row">
            <button id="fee-select-visible" class="ghost-button" type="button">Select visible (${visibleMemberIds.length})</button>
            <button id="fee-clear-selection" class="ghost-button" type="button">Clear selection</button>
          </div>
          <div class="inline-form">
            <label>
              New status
              <select id="fee-bulk-status-select">
                ${["paid", "partial", "pending", "not_collected", "exempt", "exit", "not_applicable"].map((status) => `<option value="${status}" ${feeBulkStatus === status ? "selected" : ""}>${statusLabel(status)}</option>`).join("")}
              </select>
            </label>
            <button id="apply-fee-bulk-status" class="primary-button" type="button" ${selectedVisibleCount ? "" : "disabled"}>Apply to selected (${selectedVisibleCount})</button>
          </div>
        </article>
      ` : ""}
      <div class="table-wrap">
        <table>
          <thead><tr><th>Profile</th>${feeEditMode ? "<th>Select</th>" : ""}<th>${renderSortButton("fees", "firstName", "First name")}</th><th>${renderSortButton("fees", "lastName", "Last name")}</th><th>${renderSortButton("fees", "amount", "Amount")}</th><th>${renderSortButton("fees", "paid", "Paid")}</th><th>${renderSortButton("fees", "status", "Status")}</th></tr></thead>
          <tbody>
            ${visibleFees.map((fee) => `
              <tr>
                <td><button class="ghost-button small-button profile-icon-button open-user-page-button" type="button" data-member-id="${fee.memberId}" aria-label="Open profile"></button></td>
                ${feeEditMode ? `<td><input type="checkbox" class="fee-member-select" data-member-id="${fee.memberId}" ${selectedSet.has(String(fee.memberId)) ? "checked" : ""} /></td>` : ""}
                <td>${memberFirstName(fee.memberId) || "-"}</td>
                <td>${memberLastName(fee.memberId) || "-"}</td>
                <td>
                  ${String(feeInlineEditId) === String(fee.id)
                    ? `<input type="number" class="fee-row-input fee-row-amount" data-fee-id="${fee.id}" min="0" step="0.01" value="${Number(fee.amount || 0).toFixed(2)}" />`
                    : formatMoney(fee.amount)}
                </td>
                <td>
                  ${String(feeInlineEditId) === String(fee.id)
                    ? `<input type="number" class="fee-row-input fee-row-paid" data-fee-id="${fee.id}" min="0" step="0.01" value="${Number(fee.paidAmount || 0).toFixed(2)}" ${fee.status === "paid" ? "readonly" : ""} />`
                    : formatMoney(fee.paidAmount)}
                </td>
                <td>
                  ${String(feeInlineEditId) === String(fee.id)
                    ? `<select class="fee-row-status-select" data-fee-id="${fee.id}">${editableStatuses.map((status) => `<option value="${status}" ${status === fee.status ? "selected" : ""}>${statusLabel(status)}</option>`).join("")}</select><div class="action-row" style="margin-top: 8px;"><button type="button" class="primary-button small-button fee-row-save" data-fee-id="${fee.id}">Save</button><button type="button" class="ghost-button small-button fee-row-cancel">Cancel</button></div>`
                    : `<button type="button" class="status ${fee.status} fee-row-edit-trigger status-button" data-fee-id="${fee.id}" title="Click to edit">${statusLabel(fee.status)}</button>`}
                </td>
              </tr>
            `).join("") || `<tr><td colspan="${feeEditMode ? 7 : 6}" class="meta">No fee rows for this quarter.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderPasses() {
    if (shouldRequireAuth() && !authState.user) {
      return renderAuthGate();
    }
    if (!canAccess("playerPasses")) {
      return lockedState("Player pass data is hidden for this role.", "Only admins, coaches, and technical admins should see player pass details.");
    }
    const allPlayerMembers = state.members.filter((member) => (member.roles || []).includes("player"));
    const playerMembers = filteredPassMembers();
    const options = passFilterOptions();
    if (!allPlayerMembers.length) return emptyState("No player pass data yet", "Import the roster and Clubee export to populate this area.");

    const rows = [...playerMembers].sort((left, right) => {
      const leftDate = left.passExpiry ? new Date(`${left.passExpiry}T00:00:00`).getTime() : Number.POSITIVE_INFINITY;
      const rightDate = right.passExpiry ? new Date(`${right.passExpiry}T00:00:00`).getTime() : Number.POSITIVE_INFINITY;
      return leftDate - rightDate;
    });

    return `
      <div class="section-head">
        <div>
          <p class="eyebrow">Eligibility</p>
          <h3>Player passes</h3>
        </div>
        ${currentAccessRole === "admin" ? `<div class="button-row"><button type="button" class="ghost-button" id="open-pass-sync-review">Sync review</button></div>` : ""}
      </div>
      <article class="card filter-card members-filter-sticky members-filter-card" style="margin-bottom: 14px;">
        <details class="pass-filters-dropdown" ${passFiltersExpanded ? "open" : ""}>
          <summary>
            <span class="member-filter-summary-label">Filters</span>
            <span class="member-filter-summary-meta">Name, expiry, status, position, membership</span>
          </summary>
          <div style="margin-top: 10px;">
            <label>Search name
              <input id="pass-search-input" type="search" placeholder="e.g. Max Mustermann" value="${String(passFilters.search || "").replaceAll('"', '&quot;')}" />
            </label>
          </div>
          <div class="form-grid" style="margin-top: 10px;">
            <label>Expiry from
              <input id="pass-expiry-from" type="date" value="${String(passFilters.from || "")}" />
            </label>
            <label>Expiry to
              <input id="pass-expiry-to" type="date" value="${String(passFilters.to || "")}" />
            </label>
          </div>
          <div class="split" style="grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 10px;">
            <fieldset class="status-filter-group">
              <legend>Status</legend>
              <div class="status-filter-options">
                ${options.statuses.map((value) => `
                  <label class="status-check">
                    <input type="checkbox" class="pass-filter-checkbox" data-pass-filter="statuses" value="${value}" ${passFilters.statuses.includes(value) ? "checked" : ""} />
                    <span>${value}</span>
                  </label>
                `).join("")}
              </div>
            </fieldset>
            <fieldset class="status-filter-group">
              <legend>Position</legend>
              <div class="status-filter-options">
                ${options.positions.map((value) => `
                  <label class="status-check">
                    <input type="checkbox" class="pass-filter-checkbox" data-pass-filter="positions" value="${value}" ${passFilters.positions.includes(value) ? "checked" : ""} />
                    <span>${value}</span>
                  </label>
                `).join("") || `<span class="meta">No positions</span>`}
              </div>
            </fieldset>
            <fieldset class="status-filter-group">
              <legend>Membership</legend>
              <div class="status-filter-options">
                ${options.membership.map((value) => `
                  <label class="status-check">
                    <input type="checkbox" class="pass-filter-checkbox" data-pass-filter="membership" value="${value}" ${passFilters.membership.includes(value) ? "checked" : ""} />
                    <span>${value.replaceAll("_", " ")}</span>
                  </label>
                `).join("") || `<span class="meta">No membership states</span>`}
              </div>
            </fieldset>
          </div>
          <div class="button-row" style="margin-top: 10px;">
            <button id="clear-pass-filters" type="button" class="ghost-button">Clear pass filters</button>
          </div>
        </details>
      </article>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Profile</th>
              <th>First name</th>
              <th>Last name</th>
              <th>Position</th>
              <th>Expiry</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((member) => `
              <tr>
                <td><button class="ghost-button small-button profile-icon-button open-user-page-button" type="button" data-member-id="${member.id}" aria-label="Open profile"></button></td>
                <td><strong>${member.firstName || "-"}</strong></td>
                <td><strong>${member.lastName || "-"}</strong></td>
                <td>${formatList(member.positions, "-")}</td>
                <td class="${isPassExpiringSoon(member.passExpiry) ? "is-expiring-soon" : ""}">${member.passExpiry ? formatDate(member.passExpiry) : "No expiry date"}</td>
                <td>${statusPill(displayPassStatus(member.passStatus))}</td>
              </tr>
            `).join("") || `<tr><td colspan="6" class="meta">No pass rows match the selected filters.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderPassSyncReview() {
    if (shouldRequireAuth() && !authState.user) {
      return renderAuthGate();
    }
    if (currentAccessRole !== "admin") {
      return lockedState("Pass sync review is admin-only.", "Only admins can preview and approve Clubee updates.");
    }
    const preview = passSyncPreview;
    const changes = Array.isArray(preview?.changes) ? preview.changes : [];
    const selectedSet = new Set(selectedPassSyncMemberIds.map((id) => String(id)));

    return `
      <div class="section-head">
        <div>
          <p class="eyebrow">Clubee Sync</p>
          <h3>Review pass updates</h3>
          <p class="meta">Nothing is written until you click apply.</p>
        </div>
        <div class="button-row">
          <button type="button" class="ghost-button" id="preview-pass-sync-button">Preview changes</button>
          <button type="button" class="primary-button" id="apply-pass-sync-button" ${!changes.length || !selectedPassSyncMemberIds.length ? "disabled" : ""}>Apply selected</button>
        </div>
      </div>
      <article class="card" style="margin-bottom: 14px;">
        <div class="form-grid" style="margin-bottom: 10px;">
          <label>Clubee XLSX file
            <input id="pass-sync-file-input" type="file" accept=".xlsx,.xls" />
          </label>
        </div>
        <p class="meta" id="pass-sync-file-label">${passSyncUpload?.fileName ? `Selected file: ${passSyncUpload.fileName}` : "No file selected. If empty, server uses its configured default file path."}</p>
        ${preview ? `
          <div class="pill-row">
            ${plainPill(`Source: ${preview.sourceFilePath || "default"}`)}
            ${plainPill(`Rows read: ${preview.processedRows || 0}`)}
            ${plainPill(`Matched: ${preview.matchedRows || 0}`)}
            ${plainPill(`Changes: ${changes.length}`)}
            ${plainPill(`Unmatched: ${preview.unmatchedRows || 0}`)}
          </div>
          <div class="button-row" style="margin-top: 10px;">
            <button type="button" class="ghost-button small-button" id="select-all-pass-sync">Select all changes</button>
            <button type="button" class="ghost-button small-button" id="clear-pass-sync-selection">Clear selection</button>
          </div>
        ` : `<p class="meta">Click <strong>Preview changes</strong> to see exactly what would be updated.</p>`}
      </article>
      ${preview && preview.unmatchedNames?.length ? `<article class="card" style="margin-bottom: 14px;"><h3>Unmatched names</h3><p class="meta">${preview.unmatchedNames.join(", ")}</p></article>` : ""}
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Select</th>
              <th>Member</th>
              <th>Type</th>
              <th>Field changes</th>
            </tr>
          </thead>
          <tbody>
            ${changes.map((change) => `
              <tr>
                <td><input type="checkbox" class="pass-sync-select" data-member-id="${change.memberId}" ${selectedSet.has(String(change.memberId)) ? "checked" : ""} /></td>
                <td><strong>${change.memberName || "Unknown"}</strong><div class="meta">${change.memberEmail || "No email"}</div></td>
                <td>${statusPill(change.existingPass ? "pending" : "exempt", change.existingPass ? "update" : "create")}</td>
                <td>${(change.fieldChanges || []).map((fieldChange) => `<div class="meta">${passSyncFieldLabel(fieldChange.field)}: ${fieldChange.current || "-"} -> ${fieldChange.next || "-"}</div>`).join("")}</td>
              </tr>
            `).join("") || `<tr><td colspan="4" class="meta">No updates needed based on current Clubee export.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderEvents() {
    if (shouldRequireAuth() && !authState.user) {
      return renderAuthGate();
    }
    if (!state.events.length) return emptyState("No practices or games yet", "Next we can add local event CRUD and attendance invites.");
    return `...`;
  }

  function renderInvites() {
    if (shouldRequireAuth() && !authState.user) {
      return renderAuthGate();
    }
    if (!state.invites.length) return emptyState("No invite history yet", "Once events are editable, we can add attendance invitation tracking here.");
    return `...`;
  }

  function renderSettings() {
    if (shouldRequireAuth() && !authState.user) {
      return renderAuthGate();
    }
    const restrictions = bootstrapMeta.permissionsModel?.restrictedAreas || {};
    return `
      <div class="grid two-up">
        <article class="setup-card">
          <p class="eyebrow">Current mode</p>
          <h3>Local-first development</h3>
          <p>The app runs against the local SQLite API so we can move quickly before real auth and hosting are finalized.</p>
          <div class="pill-row">${plainPill(`Source: ${bootstrapMeta.source}`)}${plainPill(`Preview role: ${roleLabel(currentAccessRole)}`)}</div>
        </article>
        <article class="setup-card">
          <p class="eyebrow">Future auth</p>
          <h3>Register and login later</h3>
          <p>We are not wiring full authentication yet, but the local permissions preview and role model are already aligned with the future login system.</p>
          <div class="setup-list compact-list">
            <div class="setup-step"><span>1</span><div><strong>Fees</strong><p>${formatList(restrictions.fees, "No restriction")}</p></div></div>
            <div class="setup-step"><span>2</span><div><strong>Player passes</strong><p>${formatList(restrictions.playerPasses, "No restriction")}</p></div></div>
          </div>
        </article>
        ${currentAccessRole === "admin" ? `
        <article class="setup-card">
          <p class="eyebrow">Invitations</p>
          <h3>Invite an admin</h3>
          <p>Send an email invitation so the admin can set a password and sign in.</p>
          <div class="inline-form">
            <label>Email<input id="admin-invite-email" type="email" placeholder="admin@example.com" /></label>
            <label>Role<select id="admin-invite-role">${INVITE_ROLE_OPTIONS.map((role) => `<option value="${role}" ${role === authInviteRole ? "selected" : ""}>${roleLabel(role)}</option>`).join("")}</select></label>
          </div>
          <div class="button-row"><button type="button" class="primary-button" id="send-admin-invite">Send invite</button></div>
        </article>
        ` : ""}
      </div>
    `;
  }

  function viewsAllowedForRole(role) {
    const normalizedRole = String(role || "").trim().toLowerCase();
    if (normalizedRole === "admin") return ["dashboard", "members", "fees", "user", "passes", "pass-sync", "events", "invites", "settings", "recovery"];
    if (normalizedRole === "finance_admin") return ["dashboard", "members", "fees", "user", "events", "invites", "settings", "recovery"];
    if (normalizedRole === "coach") return ["dashboard", "members", "user", "passes", "events", "invites", "recovery"];
    if (normalizedRole === "tech_admin") return ["dashboard", "members", "user", "passes", "events", "invites", "recovery"];
    return ["dashboard", "members", "user", "events", "recovery"];
  }

  function canAccessView(viewId) {
    return viewsAllowedForRole(currentAccessRole).includes(String(viewId || "").trim());
  }

  function resolveAllowedView(nextViewId) {
    const normalizedView = String(nextViewId || "").trim();
    if (viewIds.includes(normalizedView) && canAccessView(normalizedView)) return normalizedView;
    if (canAccessView("dashboard")) return "dashboard";
    if (canAccessView("user")) return "user";
    return "dashboard";
  }

  function updateNavigationVisibility() {
    document.querySelectorAll(".nav-link[data-view]").forEach((link) => {
      const viewId = String(link.dataset.view || "").trim();
      const visible = canAccessView(viewId);
      link.style.display = visible ? "" : "none";
      if (!visible) link.classList.remove("active");
    });
  }

  function bindNavigation() {
    document.querySelectorAll(".nav-link[data-view]").forEach((link) => {
      link.onclick = function () {
        const nextView = link.dataset.view;
        if (!canAccessView(nextView)) {
          switchView(resolveAllowedView(nextView));
          return;
        }
        window.location.hash = nextView;
        switchView(nextView);
      };
    });

    const profileNavButton = document.getElementById("profile-nav-button");
    if (profileNavButton) {
      profileNavButton.onclick = function () {
        profileRouteMode = "own";
        selectedUserMemberId = "";
        if (!authState.user) {
          window.location.hash = "dashboard";
          mount();
          switchView("dashboard");
          return;
        }
        const ownMember = signedInMemberRecord();
        if (ownMember?.id) {
          selectedUserMemberId = String(ownMember.id);
          window.location.hash = "user/me";
          mount();
          switchView("user");
          return;
        }
        window.location.hash = "user";
        mount();
        switchView("user");
      };
    }
  }

  function switchView(nextViewId) {
    const finalView = resolveAllowedView(nextViewId);
    viewIds.forEach((viewId) => {
      const section = document.getElementById(viewId);
      if (section) section.classList.toggle("active", viewId === finalView);
    });
    document.querySelectorAll(".nav-link").forEach((link) => {
      link.classList.toggle("active", link.dataset.view === finalView);
    });
  }

  function getRouteView() {
    const hash = window.location.hash.replace("#", "").trim();
    if (/^user\//i.test(hash)) return "user";
    if (/^recovery/i.test(hash)) return "recovery";
    
    // Check for recovery token in URL params (both search and hash)
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace("#", ""));
    if ((params.has("type") && params.get("type") === "recovery") || (hashParams.has("type") && hashParams.get("type") === "recovery")) {
      return "recovery";
    }
    
    return viewIds.includes(hash) ? hash : "dashboard";
  }

  function openMemberDialog(member) {
    const dialog = document.getElementById("member-dialog");
    const form = document.getElementById("member-form");
    const title = document.getElementById("member-dialog-title");
    const submit = document.getElementById("member-submit-button");
    if (!dialog || !form) return;
    form.reset();
    const fallbackParts = splitNameParts(member?.name || "");
    form.elements.memberId.value = member?.id || "";
    form.elements.firstName.value = member?.firstName || fallbackParts.firstName || "";
    form.elements.lastName.value = member?.lastName || fallbackParts.lastName || "";
    form.elements.email.value = member?.email || "";
    const roleSet = new Set(member?.roles || ["player"]);
    form.querySelectorAll('input[name="roles"]').forEach((input) => {
      input.checked = roleSet.has(input.value);
    });
    const positionSet = new Set(member?.positions || []);
    form.querySelectorAll('input[name="positions"]').forEach((input) => {
      input.checked = positionSet.has(input.value);
    });
    form.elements.jerseyNumber.value = member?.jerseyNumber ?? "";
    form.elements.membershipStatus.value = member?.membershipStatus || "active";
    form.elements.passStatus.value = displayPassStatus(member?.passStatus || "valid");
    form.elements.passExpiry.value = member?.passExpiry || (!member ? defaultPassExpiryDate() : "");
    form.elements.notes.value = member?.notes || "";
    title.textContent = member ? `Edit ${member.name}` : "Add a club member";
    submit.textContent = member ? "Save changes" : "Save member";
    dialog.showModal();
  }

  function bindMemberActions() {
    const canManageMembers = currentAccessRole === "admin" || currentAccessRole === "coach";
    const openButton = document.getElementById("open-member-dialog");
    const toggleMergeModeButton = document.getElementById("toggle-member-admin-mode");
    const dialog = document.getElementById("member-dialog");
    const form = document.getElementById("member-form");
    const submitButton = document.getElementById("member-submit-button");
    const closeButton = document.querySelector(".ghost-icon");
    const cancelButton = document.querySelector(".dialog-actions .ghost-button");
    const rolesSelectAll = document.getElementById("roles-select-all");
    const rolesClearAll = document.getElementById("roles-clear-all");
    const positionsSelectAll = document.getElementById("positions-select-all");
    const positionsClearAll = document.getElementById("positions-clear-all");
    const dialogPassStatusInput = form?.elements?.passStatus || null;
    const dialogPassExpiryInput = form?.elements?.passExpiry || null;
    if (openButton) {
      openButton.onclick = function () {
        openMemberDialog(null);
      };
    }
    if (toggleMergeModeButton) {
      toggleMergeModeButton.onclick = function () {
        memberMergeMode = !memberMergeMode;
        mount();
        switchView("members");
      };
    }
    if (closeButton && dialog) {
      closeButton.onclick = function () {
        dialog.close();
      };
    }
    if (cancelButton && dialog) {
      cancelButton.onclick = function () {
        dialog.close();
      };
    }
    if (submitButton && form) {
      submitButton.onclick = function () {
        if (typeof form.requestSubmit === "function") {
          form.requestSubmit();
          return;
        }
        if (typeof form.onsubmit === "function") {
          form.onsubmit(new Event("submit", { cancelable: true }));
          return;
        }
        form.dispatchEvent(new Event("submit", { cancelable: true }));
      };
    }
    if (rolesSelectAll && form) {
      rolesSelectAll.onclick = function () {
        form.querySelectorAll('input[name="roles"]').forEach((input) => {
          input.checked = true;
        });
      };
    }
    if (rolesClearAll && form) {
      rolesClearAll.onclick = function () {
        form.querySelectorAll('input[name="roles"]').forEach((input) => {
          input.checked = false;
        });
      };
    }
    if (positionsSelectAll && form) {
      positionsSelectAll.onclick = function () {
        form.querySelectorAll('input[name="positions"]').forEach((input) => {
          input.checked = true;
        });
      };
    }
    if (positionsClearAll && form) {
      positionsClearAll.onclick = function () {
        form.querySelectorAll('input[name="positions"]').forEach((input) => {
          input.checked = false;
        });
      };
    }
    if (dialogPassStatusInput && dialogPassExpiryInput) {
      dialogPassStatusInput.onchange = function () {
        const status = String(dialogPassStatusInput.value || "").trim().toLowerCase();
        if (status === "missing") {
          dialogPassExpiryInput.value = "";
          return;
        }
        if (status === "valid" && !String(dialogPassExpiryInput.value || "").trim()) {
          dialogPassExpiryInput.value = defaultPassExpiryDate();
        }
      };
    }
    document.querySelectorAll(".edit-member-button").forEach((button) => {
      button.onclick = function () {
        if (!canManageMembers) return;
        const member = state.members.find((entry) => String(entry.id) === String(button.dataset.memberId));
        if (member) openMemberDialog(member);
      };
    });
    document.querySelectorAll(".member-inline-save-button").forEach((button) => {
      button.onclick = async function () {
        const member = state.members.find((entry) => String(entry.id) === String(button.dataset.memberId));
        if (!member) return;
        const memberId = String(member.id);
        const firstNameInput = document.querySelector(`.member-inline-first-name[data-member-id="${memberId}"]`);
        const lastNameInput = document.querySelector(`.member-inline-last-name[data-member-id="${memberId}"]`);
        const emailInput = document.querySelector(`.member-inline-email[data-member-id="${memberId}"]`);
        const jerseyInput = document.querySelector(`.member-inline-jersey[data-member-id="${memberId}"]`);
        const membershipInput = document.querySelector(`.member-inline-membership[data-member-id="${memberId}"]`);
        const passStatusInput = document.querySelector(`.member-inline-pass-status[data-member-id="${memberId}"]`);
        const passExpiryInput = document.querySelector(`.member-inline-pass-expiry[data-member-id="${memberId}"]`);
        if (!firstNameInput || !lastNameInput || !emailInput || !jerseyInput || !membershipInput || !passStatusInput || !passExpiryInput) {
          authState.status = "Could not save this row because required inline fields are missing. Try reopening Members view.";
          mount();
          switchView("members");
          return;
        }
        const selectedPositions = Array.from(document.querySelectorAll(`.member-inline-option[data-member-id="${memberId}"][data-member-multi="positions"]:checked`))
          .map((input) => String(input.value || "").trim().toUpperCase())
          .filter(Boolean);
        const selectedRoles = Array.from(document.querySelectorAll(`.member-inline-option[data-member-id="${memberId}"][data-member-multi="roles"]:checked`))
          .map((input) => String(input.value || "").trim())
          .filter(Boolean);
        const normalizedPassStatus = String(passStatusInput.value || "missing").trim().toLowerCase();
        const normalizedPassExpiry = normalizedPassStatus === "missing"
          ? ""
          : String(passExpiryInput.value || "").trim();
        try {
          await saveMember({
            memberId,
            firstName: String(firstNameInput.value || "").trim(),
            lastName: String(lastNameInput.value || "").trim(),
            email: String(emailInput.value || "").trim(),
            positions: Array.from(new Set(selectedPositions)),
            roles: selectedRoles.length ? Array.from(new Set(selectedRoles)) : ["player"],
            jerseyNumber: String(jerseyInput.value || "").trim(),
            membershipStatus: String(membershipInput.value || "active").trim(),
            passStatus: normalizedPassStatus,
            passExpiry: normalizedPassExpiry,
            notes: member.notes || ""
          });
          authState.status = `${member.name} was updated.`;
          mount();
          switchView("members");
        } catch (error) {
          authState.status = error.message;
          mount();
          switchView("members");
        }
      };
    });
    document.querySelectorAll(".member-inline-option").forEach((input) => {
      input.onchange = function () {
        const memberId = String(input.dataset.memberId || "");
        const kind = String(input.dataset.memberMulti || "");
        if (!memberId || !kind) return;
        const selectedCount = document.querySelectorAll(`.member-inline-option[data-member-id="${memberId}"][data-member-multi="${kind}"]:checked`).length;
        const details = document.querySelector(`.member-inline-multiselect[data-member-id="${memberId}"][data-member-multi="${kind}"]`);
        const summary = details ? details.querySelector("summary") : null;
        if (summary) {
          summary.textContent = selectedCount ? `${selectedCount} selected` : `Select ${kind}`;
        }
      };
    });
    document.querySelectorAll(".member-inline-pass-status").forEach((select) => {
      select.onchange = function () {
        const memberId = String(select.dataset.memberId || "").trim();
        if (!memberId) return;
        const expiryInput = document.querySelector(`.member-inline-pass-expiry[data-member-id="${memberId}"]`);
        if (!expiryInput) return;
        const status = String(select.value || "").trim().toLowerCase();
        if (status === "missing") {
          expiryInput.value = "";
          expiryInput.classList.remove("is-expiring-soon");
          return;
        }
        if (status === "valid" && !String(expiryInput.value || "").trim()) {
          expiryInput.value = defaultPassExpiryDate();
        }
      };
    });
    document.querySelectorAll(".delete-member-button").forEach((button) => {
      button.onclick = async function () {
        const member = state.members.find((entry) => String(entry.id) === String(button.dataset.memberId));
        if (!member) return;
        const confirmed = window.confirm(`Mark ${member.name} as deleted? The record will be hidden by default and can still be reviewed in admin mode.`);
        if (!confirmed) return;
        try {
          await removeMember(member.id);
          authState.status = `${member.name} was marked as deleted.`;
          mount();
        } catch (error) {
          authState.status = error.message;
          mount();
        }
      };
    });
    document.querySelectorAll(".undelete-member-button").forEach((button) => {
      button.onclick = async function () {
        const member = state.members.find((entry) => String(entry.id) === String(button.dataset.memberId));
        if (!member) return;
        const confirmed = window.confirm(`Restore ${member.name} from deleted state?`);
        if (!confirmed) return;
        try {
          await undeleteMember(member.id);
          authState.status = `${member.name} was restored.`;
          mount();
          switchView("members");
        } catch (error) {
          authState.status = error.message;
          mount();
          switchView("members");
        }
      };
    });
    document.querySelectorAll(".merge-member-button").forEach((button) => {
      button.onclick = async function () {
        const keepMember = state.members.find((entry) => String(entry.id) === String(button.dataset.memberId));
        if (!keepMember) return;

        const suggestions = state.members
          .filter((entry) => String(entry.id) !== String(keepMember.id))
          .map((entry) => ({
            member: entry,
            score: mergeSuggestionScore(keepMember, entry)
          }))
          .filter((entry) => entry.score >= 10)
          .sort((left, right) => right.score - left.score)
          .slice(0, 8)
          .map((entry) => entry.member);

        const defaultSuggestionId = suggestions.length ? String(suggestions[0].id) : "";

        const suggestionText = suggestions.length
          ? suggestions.map((entry) => `${entry.id}: ${entry.name}${entry.email ? ` (${entry.email})` : ""}`).join("\n")
          : "No close suggestions. You can still enter an ID manually.";

        const rawId = window.prompt(
          `Merge target: ${keepMember.name} (ID ${keepMember.id})\n\nEnter the MEMBER ID you want to merge INTO this record (that record will be removed).\n\nSuggestions:\n${suggestionText}`
          ,
          defaultSuggestionId
        );
        if (!rawId) return;
        const removeId = String(rawId).trim();
        if (!removeId || String(removeId) === String(keepMember.id)) {
          authState.status = "Please enter a valid different member ID to merge.";
          mount();
          switchView("members");
          return;
        }
        const removeMember = state.members.find((entry) => String(entry.id) === String(removeId));
        if (!removeMember) {
          authState.status = `Member ID ${removeId} was not found.`;
          mount();
          switchView("members");
          return;
        }

        const confirmed = window.confirm(`Merge ${removeMember.name} (ID ${removeMember.id}) into ${keepMember.name} (ID ${keepMember.id})? This cannot be undone.`);
        if (!confirmed) return;

        try {
          await mergeMemberRecords({
            keepMemberId: keepMember.id,
            removeMemberId: removeMember.id,
            firstName: keepMember.firstName,
            lastName: keepMember.lastName
          });
          authState.status = `Merged ${removeMember.name} into ${keepMember.name}.`;
          mount();
          switchView("members");
        } catch (error) {
          authState.status = error.message;
          mount();
          switchView("members");
        }
      };
    });
    document.querySelectorAll(".invite-member-button").forEach((button) => {
      button.onclick = async function (event) {
        event.preventDefault();
        event.stopPropagation();
        const previousScrollY = window.scrollY || 0;
        const previousScrollX = window.scrollX || 0;
        const member = memberById(button.dataset.memberId);
        if (!member || !member.email) return;
        const inviteState = memberInviteState(member);
        if (inviteState === "invited") {
          window.alert("You already invited this person. Wait until they activate their account.");
          return;
        }
        if (inviteState === "activated") {
          window.alert("This person already activated their account. No invite is needed.");
          return;
        }
        button.disabled = true;
        try {
          button.blur();
          await inviteMember(member.id);
          authState.status = `Invite sent to ${member.email}.`;
          if (shouldUseSupabaseData()) {
            await loadBootstrapData();
          } else {
            member.inviteSentAt = new Date().toISOString();
          }
          mount();
          switchView("members");
          requestAnimationFrame(() => {
            window.scrollTo(previousScrollX, previousScrollY);
          });
        } catch (error) {
          authState.status = error.message;
          mount();
          switchView("members");
          requestAnimationFrame(() => {
            window.scrollTo(previousScrollX, previousScrollY);
          });
        } finally {
          button.disabled = false;
        }
      };
    });
    if (form) {
      form.onsubmit = async function (event) {
        event.preventDefault();
        const formData = new FormData(form);
        const selectedRoles = formData
          .getAll("roles")
          .map((value) => String(value || "").trim())
          .filter(Boolean);
        const selectedPositions = formData
          .getAll("positions")
          .map((value) => String(value || "").trim().toUpperCase())
          .filter(Boolean);
        const payload = {
          memberId: String(formData.get("memberId") || "").trim(),
          firstName: String(formData.get("firstName") || "").trim(),
          lastName: String(formData.get("lastName") || "").trim(),
          email: String(formData.get("email") || "").trim(),
          roles: selectedRoles.length ? Array.from(new Set(selectedRoles)) : ["player"],
          positions: Array.from(new Set(selectedPositions)),
          jerseyNumber: String(formData.get("jerseyNumber") || "").trim(),
          membershipStatus: String(formData.get("membershipStatus") || "active"),
          passStatus: String(formData.get("passStatus") || "missing").trim(),
          passExpiry: String(formData.get("passExpiry") || "").trim(),
          notes: String(formData.get("notes") || "").trim()
        };
        if (!payload.firstName && !payload.lastName) {
          authState.status = "Please enter at least a first name or a last name.";
          mount();
          return;
        }
        try {
          await saveMember(payload);
          const displayName = `${payload.firstName} ${payload.lastName}`.trim();
          authState.status = payload.memberId ? `${displayName} was updated locally.` : `${displayName} was added locally.`;
          dialog.close();
          window.location.hash = "members";
          mount();
          switchView("members");
        } catch (error) {
          authState.status = error.message;
          mount();
        }
      };
    }
  }

  function bindUserPageActions() {
    document.querySelectorAll(".open-user-page-button").forEach((button) => {
      button.onclick = function () {
        profileRouteMode = "member";
        const memberId = String(button.dataset.memberId || "").trim();
        if (!memberId) return;
        selectedUserMemberId = memberId;
        window.location.hash = `user/${encodeURIComponent(memberId)}`;
        mount();
        switchView("user");
      };
    });

    const backButton = document.getElementById("back-to-members");
    if (backButton) {
      backButton.onclick = function () {
        profileRouteMode = "member";
        window.location.hash = "members";
        switchView("members");
      };
    }

    const saveButton = document.getElementById("save-user-profile");
    if (saveButton) {
      saveButton.onclick = async function () {
        const member = memberById(saveButton.dataset.memberId);
        if (!member) return;
        if (!canEditMemberProfile(member)) {
          authState.status = "You can only edit your own profile unless you are an admin.";
          mount();
          switchView("user");
          return;
        }
        const firstNameInput = document.getElementById("user-first-name");
        const lastNameInput = document.getElementById("user-last-name");
        const emailInput = document.getElementById("user-email");
        const jerseyInput = document.getElementById("user-jersey");
        if (!firstNameInput || !lastNameInput || !emailInput || !jerseyInput) return;
        try {
          await saveMember({
            memberId: member.id,
            firstName: String(firstNameInput.value || "").trim(),
            lastName: String(lastNameInput.value || "").trim(),
            email: String(emailInput.value || "").trim(),
            positions: member.positions || [],
            roles: member.roles && member.roles.length ? member.roles : ["player"],
            jerseyNumber: String(jerseyInput.value || "").trim(),
            membershipStatus: member.membershipStatus || "active",
            notes: member.notes || ""
          });
          authState.status = "User profile updated.";
          selectedUserMemberId = String(member.id);
          window.location.hash = `user/${encodeURIComponent(member.id)}`;
          mount();
          switchView("user");
        } catch (error) {
          authState.status = error.message;
          mount();
          switchView("user");
        }
      };
    }

    const saveSensitiveButton = document.getElementById("save-user-sensitive");
    if (saveSensitiveButton) {
      saveSensitiveButton.onclick = async function () {
        const member = memberById(saveSensitiveButton.dataset.memberId);
        if (!member) return;
        if (currentAccessRole !== "admin") {
          authState.status = "Only admins can update IBAN and quarter payment statuses.";
          mount();
          switchView("user");
          return;
        }
        const ibanInput = document.getElementById("user-sensitive-iban");
        const statusInputs = Array.from(document.querySelectorAll(".user-sensitive-fee-status"));
        const statusByFeeId = {};
        statusInputs.forEach((input) => {
          const feeId = String(input.dataset.feeId || "").trim();
          if (feeId) statusByFeeId[feeId] = input.value;
        });
        try {
          await updateMemberSensitiveFinance({
            memberId: member.id,
            iban: String(ibanInput?.value || "").trim(),
            statusByFeeId
          });
          authState.status = "Sensitive finance fields updated.";
          selectedUserMemberId = String(member.id);
          window.location.hash = `user/${encodeURIComponent(member.id)}`;
          mount();
          switchView("user");
        } catch (error) {
          authState.status = error.message;
          mount();
          switchView("user");
        }
      };
    }

    const saveRolePositionButton = document.getElementById("save-user-role-position");
    if (saveRolePositionButton) {
      saveRolePositionButton.onclick = async function () {
        const member = memberById(saveRolePositionButton.dataset.memberId);
        if (!member) return;
        if (currentAccessRole !== "admin") {
          authState.status = "Only admins can update role and position.";
          mount();
          switchView("user");
          return;
        }
        const selectedRoles = Array.from(document.querySelectorAll(".user-role-option:checked"))
          .map((input) => String(input.value || "").trim())
          .filter(Boolean);
        const selectedPositions = Array.from(document.querySelectorAll(".user-position-option:checked"))
          .map((input) => String(input.value || "").trim().toUpperCase())
          .filter(Boolean);
        try {
          await saveMember({
            memberId: member.id,
            firstName: member.firstName || "",
            lastName: member.lastName || "",
            email: member.email || "",
            positions: Array.from(new Set(selectedPositions)),
            roles: selectedRoles.length ? Array.from(new Set(selectedRoles)) : ["player"],
            jerseyNumber: member.jerseyNumber ?? "",
            membershipStatus: member.membershipStatus || "active",
            notes: member.notes || ""
          });
          authState.status = "Role and position updated.";
          selectedUserMemberId = String(member.id);
          window.location.hash = `user/${encodeURIComponent(member.id)}`;
          mount();
          switchView("user");
        } catch (error) {
          authState.status = error.message;
          mount();
          switchView("user");
        }
      };
    }

    const saveNotesButton = document.getElementById("save-user-notes");
    if (saveNotesButton) {
      saveNotesButton.onclick = async function () {
        const member = memberById(saveNotesButton.dataset.memberId);
        if (!member) return;
        if (currentAccessRole !== "admin") {
          authState.status = "Only admins can update notes.";
          mount();
          switchView("user");
          return;
        }
        const notesInput = document.getElementById("user-notes");
        try {
          await saveMember({
            memberId: member.id,
            firstName: member.firstName || "",
            lastName: member.lastName || "",
            email: member.email || "",
            positions: member.positions || [],
            roles: member.roles && member.roles.length ? member.roles : ["player"],
            jerseyNumber: member.jerseyNumber ?? "",
            membershipStatus: member.membershipStatus || "active",
            notes: String(notesInput?.value || "").trim()
          });
          authState.status = "Notes updated.";
          selectedUserMemberId = String(member.id);
          window.location.hash = `user/${encodeURIComponent(member.id)}`;
          mount();
          switchView("user");
        } catch (error) {
          authState.status = error.message;
          mount();
          switchView("user");
        }
      };
    }

  }

  function bindFeeFilters() {
    const filtersDropdown = document.querySelector(".fee-filters-dropdown");
    if (filtersDropdown) {
      filtersDropdown.ontoggle = function () {
        feeFiltersExpanded = filtersDropdown.open;
      };
    }
    const select = document.getElementById("fee-period-select");
    if (select) {
      select.onchange = function (event) {
        selectedFeePeriod = event.target.value;
        selectedFeeStatuses = defaultFeeStatuses();
        feeInlineEditId = null;
        saveStoredValue(FEE_FILTER_KEY, selectedFeePeriod);
        saveStatusFilter();
        mount();
        switchView("fees");
      };
    }
    document.querySelectorAll(".fee-status-checkbox").forEach((checkbox) => {
      checkbox.onchange = function () {
        selectedFeeStatuses = Array.from(document.querySelectorAll(".fee-status-checkbox:checked")).map((input) => input.value);
        feeInlineEditId = null;
        saveStatusFilter();
        mount();
        switchView("fees");
      };
    });
  }

  function bindTableExports() {
    const exportMembersCsvButton = document.getElementById("export-members-csv-option");
    if (exportMembersCsvButton) {
      exportMembersCsvButton.onclick = function () {
        const columns = [
          { key: "id", label: "ID" },
          { key: "firstName", label: "First name" },
          { key: "lastName", label: "Last name" },
          { key: "email", label: "Email" },
          { key: "positions", label: "Positions" },
          { key: "roles", label: "Roles" },
          { key: "jerseyNumber", label: "Jersey" },
          { key: "membershipStatus", label: "Membership" },
          { key: "passStatus", label: "Pass status" },
          { key: "passExpiry", label: "Pass expiry" },
          { key: "deletedAt", label: "Deleted at" }
        ];
        downloadCsv(columns, memberExportRows(), "members.csv");
      };
    }

    const exportMembersExcelButton = document.getElementById("export-members-excel-option");
    if (exportMembersExcelButton) {
      exportMembersExcelButton.onclick = function () {
        const columns = [
          { key: "id", label: "ID" },
          { key: "firstName", label: "First name" },
          { key: "lastName", label: "Last name" },
          { key: "email", label: "Email" },
          { key: "positions", label: "Positions" },
          { key: "roles", label: "Roles" },
          { key: "jerseyNumber", label: "Jersey" },
          { key: "membershipStatus", label: "Membership" },
          { key: "passStatus", label: "Pass status" },
          { key: "passExpiry", label: "Pass expiry" },
          { key: "deletedAt", label: "Deleted at" }
        ];
        downloadExcel(columns, memberExportRows(), "members.xls");
      };
    }

    const exportFeesCsvButton = document.getElementById("export-fees-csv-option");
    if (exportFeesCsvButton) {
      exportFeesCsvButton.onclick = function () {
        const columns = [
          { key: "memberId", label: "Member ID" },
          { key: "firstName", label: "First name" },
          { key: "lastName", label: "Last name" },
          { key: "feePeriod", label: "Quarter" },
          { key: "amount", label: "Amount" },
          { key: "paidAmount", label: "Paid" },
          { key: "status", label: "Status" },
          { key: "iban", label: "IBAN" }
        ];
        downloadCsv(columns, feeExportRows(), "membership-finance.csv");
      };
    }

    const exportFeesExcelButton = document.getElementById("export-fees-excel-option");
    if (exportFeesExcelButton) {
      exportFeesExcelButton.onclick = function () {
        const columns = [
          { key: "memberId", label: "Member ID" },
          { key: "firstName", label: "First name" },
          { key: "lastName", label: "Last name" },
          { key: "feePeriod", label: "Quarter" },
          { key: "amount", label: "Amount" },
          { key: "paidAmount", label: "Paid" },
          { key: "status", label: "Status" },
          { key: "iban", label: "IBAN" }
        ];
        downloadExcel(columns, feeExportRows(), "membership-finance.xls");
      };
    }

    const exportFeesSepaXmlButton = document.getElementById("export-fees-sepa-xml-option");
    if (exportFeesSepaXmlButton) {
      exportFeesSepaXmlButton.onclick = async function () {
        try {
          const period = currentFeePeriod();
          if (!period) {
            throw new Error("Please select a quarter first.");
          }
          await downloadFromApi(apiUrl(`/api/fees/export-sepa-xml?period=${encodeURIComponent(period)}`), `SEPA_Lastschrift_${period}.xml`);
          authState.status = "SEPA XML exported.";
          mount();
          switchView("fees");
        } catch (error) {
          const isGithubPages = /\.github\.io$/i.test(window.location.hostname || "");
          const baseMessage = String(error?.message || "SEPA export failed.");
          authState.status = isGithubPages
            ? `${baseMessage} SEPA XML requires a running backend API (the /api route is not available on static GitHub Pages alone).`
            : baseMessage;
          mount();
          switchView("fees");
        }
      };
    }
  }

  function bindAuthActions() {
    const signInButton = document.getElementById("auth-sign-in");
    if (signInButton) {
      signInButton.onclick = async function () {
        if (authState.pendingAction) return;
        const emailInput = document.getElementById("auth-email");
        const passwordInput = document.getElementById("auth-password");
        const email = String(emailInput?.value || "").trim();
        const password = String(passwordInput?.value || "").trim();
        if (!email) {
          authState.status = "Enter your email address first.";
          showToast(authState.status, "error");
          mount();
          return;
        }
        if (!password) {
          authState.status = "Enter your password first.";
          showToast(authState.status, "error");
          mount();
          return;
        }
        try {
          authState.pendingAction = "sign-in";
          authState.status = "Signing you in...";
          mount();
          await signInWithEmailPassword(email, password);
          try {
            await promoteInvitedMemberOnFirstSignIn();
          } catch {
            // Non-blocking: login should still complete even if invite flag cleanup fails.
          }
          await loadBootstrapData();
          authState.status = `Signed in as ${authDisplayName() || authState.user?.email || "user"}.`;
          showToast(authState.status, "success");
        } catch (error) {
          authState.status = error.message || "Sign in failed.";
          showToast(authState.status, "error");
        } finally {
          authState.pendingAction = "";
          mount();
        }
      };
    }

    const resetPasswordButton = document.getElementById("auth-reset-password");
    if (resetPasswordButton) {
      resetPasswordButton.onclick = async function () {
        if (authState.pendingAction) return;
        const emailInput = document.getElementById("auth-email");
        const email = String(emailInput?.value || "").trim();
        if (!email) {
          authState.status = "Enter your email address first.";
          showToast(authState.status, "error");
          mount();
          return;
        }
        try {
          authState.pendingAction = "reset-password";
          authState.status = "Sending password reset email...";
          mount();
          await sendResetPasswordEmail(email);
          authState.status = `Password reset email sent to ${email}.`;
          showToast(authState.status, "success");
        } catch (error) {
          authState.status = error.message || "Could not send password reset email.";
          showToast(authState.status, "error");
        } finally {
          authState.pendingAction = "";
          mount();
        }
      };
    }

    const signOutButton = document.getElementById("auth-sign-out");
    if (signOutButton) {
      signOutButton.onclick = async function () {
        if (authState.pendingAction) return;
        try {
          authState.pendingAction = "sign-out";
          authState.status = "Signing out...";
          mount();
          await signOut();
          authState.status = "Signed out.";
          showToast(authState.status, "info");
        } catch (error) {
          authState.status = error.message || "Sign out failed.";
          showToast(authState.status, "error");
        } finally {
          authState.pendingAction = "";
          mount();
        }
      };
    }

    const adminInviteRoleSelect = document.getElementById("admin-invite-role");
    if (adminInviteRoleSelect) {
      adminInviteRoleSelect.onchange = function (event) {
        authInviteRole = String(event.target.value || "admin");
      };
    }

    const adminInviteButton = document.getElementById("send-admin-invite");
    if (adminInviteButton) {
      adminInviteButton.onclick = async function () {
        if (authState.pendingAction) return;
        const emailInput = document.getElementById("admin-invite-email");
        const email = String(emailInput?.value || "").trim();
        if (!email) {
          authState.status = "Enter an email address first.";
          mount();
          return;
        }
        try {
          authState.pendingAction = "invite-admin";
          authState.status = `Sending invite to ${email}...`;
          mount();
          await inviteAdmin(email, email.split("@")[0] || email, [authInviteRole]);
          authState.status = `Invite sent to ${email}. They must set their password before signing in.`;
          showToast(authState.status, "success");
        } catch (error) {
          authState.status = error.message || "Could not send invite.";
          showToast(authState.status, "error");
        } finally {
          authState.pendingAction = "";
          mount();
        }
      };
    }
  }

  function bindRecoveryActions() {
    const submitButton = document.getElementById("recovery-submit");
    if (submitButton) {
      submitButton.onclick = async function () {
        if (recoveryState.loading) return;
        const passwordInput = document.getElementById("recovery-password");
        const confirmInput = document.getElementById("recovery-password-confirm");
        const password = String(passwordInput?.value || "").trim();
        const confirm = String(confirmInput?.value || "").trim();
        
        if (!password) {
          recoveryState.status = "Password is required.";
          mount();
          return;
        }
        if (password.length < 6) {
          recoveryState.status = "Password must be at least 6 characters.";
          mount();
          return;
        }
        if (password !== confirm) {
          recoveryState.status = "Passwords do not match.";
          mount();
          return;
        }
        
        try {
          await setRecoveryPassword(password);
          mount();
        } catch (error) {
          recoveryState.status = error.message;
          mount();
        }
      };
    }
    
    const cancelButton = document.getElementById("recovery-cancel");
    if (cancelButton) {
      cancelButton.onclick = function () {
        window.location.hash = "#dashboard";
      };
    }

    const backToSignInButton = document.getElementById("recovery-back-to-sign-in");
    if (backToSignInButton) {
      backToSignInButton.onclick = function () {
        window.location.hash = "#dashboard";
      };
    }
  }

  function bindFeeEditModeActions() {
    const toggleButton = document.getElementById("toggle-fee-edit-mode");
    if (toggleButton) {
      toggleButton.onclick = function () {
        feeEditMode = !feeEditMode;
        if (!feeEditMode) {
          selectedFeeMemberIds = [];
        }
        mount();
        switchView("fees");
      };
    }
    const clearButton = document.getElementById("clear-fee-filters");
    if (clearButton) {
      clearButton.onclick = function () {
        selectedFeeStatuses = defaultFeeStatuses();
        feeInlineEditId = null;
        saveStatusFilter();
        mount();
        switchView("fees");
      };
    }

    const bulkStatusSelect = document.getElementById("fee-bulk-status-select");
    if (bulkStatusSelect) {
      bulkStatusSelect.onchange = function (event) {
        feeBulkStatus = event.target.value;
      };
    }

    const visibleRows = sortedVisibleFees();
    const visibleMemberIds = Array.from(new Set(visibleRows.map((fee) => String(fee.memberId))));

    const selectVisibleButton = document.getElementById("fee-select-visible");
    if (selectVisibleButton) {
      selectVisibleButton.onclick = function () {
        selectedFeeMemberIds = visibleMemberIds;
        mount();
        switchView("fees");
      };
    }

    const clearSelectionButton = document.getElementById("fee-clear-selection");
    if (clearSelectionButton) {
      clearSelectionButton.onclick = function () {
        selectedFeeMemberIds = [];
        mount();
        switchView("fees");
      };
    }

    document.querySelectorAll(".fee-member-select").forEach((checkbox) => {
      checkbox.onchange = function () {
        const memberId = String(checkbox.dataset.memberId || "");
        const selectedSet = new Set(selectedFeeMemberIds.map(String));
        if (checkbox.checked) selectedSet.add(memberId);
        else selectedSet.delete(memberId);
        selectedFeeMemberIds = Array.from(selectedSet);
        mount();
        switchView("fees");
      };
    });

    const applyButton = document.getElementById("apply-fee-bulk-status");
    if (applyButton) {
      applyButton.onclick = async function () {
        const memberIds = selectedFeeMemberIds.map((value) => String(value || "").trim()).filter(Boolean);
        if (!memberIds.length) {
          return;
        }
        try {
          await updateFeeStatusesBulk({
            feePeriod: currentFeePeriod(),
            status: feeBulkStatus,
            memberIds
          });
          authState.status = `Updated ${memberIds.length} fee records to ${statusLabel(feeBulkStatus)}.`;
          selectedFeeMemberIds = [];
          mount();
          switchView("fees");
        } catch (error) {
          authState.status = error.message;
          mount();
          switchView("fees");
        }
      };
    }

    document.querySelectorAll(".fee-row-edit-trigger").forEach((button) => {
      button.onclick = function () {
        feeInlineEditId = String(button.dataset.feeId || "");
        mount();
        switchView("fees");
      };
    });

    document.querySelectorAll(".fee-row-cancel").forEach((button) => {
      button.onclick = function () {
        feeInlineEditId = null;
        mount();
        switchView("fees");
      };
    });

    document.querySelectorAll(".fee-row-status-select").forEach((select) => {
      select.onchange = function () {
        const feeId = String(select.dataset.feeId || "");
        const amountInput = document.querySelector(`.fee-row-amount[data-fee-id="${feeId}"]`);
        const paidInput = document.querySelector(`.fee-row-paid[data-fee-id="${feeId}"]`);
        if (!amountInput || !paidInput) return;
        if (select.value === "paid") {
          paidInput.value = amountInput.value;
          paidInput.readOnly = true;
        } else {
          paidInput.readOnly = false;
        }
      };
    });

    document.querySelectorAll(".fee-row-amount").forEach((amountInput) => {
      amountInput.onchange = function () {
        const feeId = String(amountInput.dataset.feeId || "");
        const statusSelect = document.querySelector(`.fee-row-status-select[data-fee-id="${feeId}"]`);
        const paidInput = document.querySelector(`.fee-row-paid[data-fee-id="${feeId}"]`);
        if (!statusSelect || !paidInput) return;
        if (statusSelect.value === "paid") {
          paidInput.value = amountInput.value;
        }
      };
    });

    document.querySelectorAll(".fee-row-save").forEach((button) => {
      button.onclick = async function () {
        const feeId = String(button.dataset.feeId || "").trim();
        const statusSelect = document.querySelector(`.fee-row-status-select[data-fee-id="${feeId}"]`);
        const amountInput = document.querySelector(`.fee-row-amount[data-fee-id="${feeId}"]`);
        const paidInput = document.querySelector(`.fee-row-paid[data-fee-id="${feeId}"]`);
        if (!feeId || !statusSelect || !amountInput || !paidInput) return;
        try {
          await updateFeeRow({
            feeId,
            status: statusSelect.value,
            amount: Number(amountInput.value || 0),
            paidAmount: Number(paidInput.value || 0),
            note: ""
          });
          authState.status = `${memberName(sortedVisibleFees().find((fee) => String(fee.id) === feeId)?.memberId)} fee updated.`;
          feeInlineEditId = null;
          mount();
          switchView("fees");
        } catch (error) {
          authState.status = error.message;
          mount();
          switchView("fees");
        }
      };
    });
  }

  function bindMemberFilters() {
    const filtersDropdown = document.querySelector(".member-filters-dropdown");
    if (filtersDropdown) {
      filtersDropdown.ontoggle = function () {
        memberFiltersExpanded = filtersDropdown.open;
      };
    }
    document.querySelectorAll(".member-filter-checkbox").forEach((checkbox) => {
      checkbox.onchange = function () {
        const next = { positions: [], roles: [], membership: [], showDeleted: memberFilters.showDeleted, search: memberFilters.search };
        document.querySelectorAll(".member-filter-checkbox:checked").forEach((input) => {
          const target = input.dataset.memberFilter;
          if (target && next[target]) {
            next[target].push(input.value);
          }
        });
        if (!next.membership.length) {
          next.membership = ["active"];
        }
        memberFilters = next;
        saveMemberFilters();
        mount();
        switchView("members");
      };
    });
    const showDeletedToggle = document.getElementById("show-deleted-members");
    if (showDeletedToggle) {
      showDeletedToggle.onchange = function () {
        memberFilters = {
          ...memberFilters,
          showDeleted: Boolean(showDeletedToggle.checked)
        };
        saveMemberFilters();
        mount();
        switchView("members");
      };
    }
    const searchInput = document.getElementById("member-search-input");
    if (searchInput) {
      searchInput.oninput = function () {
        const rawValue = String(searchInput.value || "");
        const cursorStart = Number.isFinite(searchInput.selectionStart) ? searchInput.selectionStart : rawValue.length;
        const cursorEnd = Number.isFinite(searchInput.selectionEnd) ? searchInput.selectionEnd : rawValue.length;
        memberFilters = {
          ...memberFilters,
          search: rawValue
        };
        saveMemberFilters();
        mount();
        switchView("members");
        const nextSearchInput = document.getElementById("member-search-input");
        if (nextSearchInput) {
          nextSearchInput.focus();
          const safeStart = Math.min(cursorStart, nextSearchInput.value.length);
          const safeEnd = Math.min(cursorEnd, nextSearchInput.value.length);
          nextSearchInput.setSelectionRange(safeStart, safeEnd);
        }
      };
    }
    const clearButton = document.getElementById("clear-member-filters");
    if (clearButton) {
      clearButton.onclick = function () {
        memberFilters = { positions: [], roles: [], membership: ["active"], showDeleted: false, search: "" };
        saveMemberFilters();
        mount();
        switchView("members");
      };
    }
  }

  function bindPassFilters() {
    const filtersDropdown = document.querySelector(".pass-filters-dropdown");
    if (filtersDropdown) {
      filtersDropdown.ontoggle = function () {
        passFiltersExpanded = filtersDropdown.open;
      };
    }

    document.querySelectorAll(".pass-filter-checkbox").forEach((checkbox) => {
      checkbox.onchange = function () {
        const next = { statuses: [], positions: [], membership: [] };
        document.querySelectorAll(".pass-filter-checkbox:checked").forEach((input) => {
          const target = input.dataset.passFilter;
          if (target && next[target]) {
            next[target].push(input.value);
          }
        });
        passFilters = {
          ...passFilters,
          statuses: next.statuses,
          positions: next.positions,
          membership: next.membership
        };
        savePassFilters();
        mount();
        switchView("passes");
      };
    });

    const searchInput = document.getElementById("pass-search-input");
    if (searchInput) {
      searchInput.oninput = function () {
        const rawValue = String(searchInput.value || "");
        const cursorStart = Number.isFinite(searchInput.selectionStart) ? searchInput.selectionStart : rawValue.length;
        const cursorEnd = Number.isFinite(searchInput.selectionEnd) ? searchInput.selectionEnd : rawValue.length;
        passFilters = {
          ...passFilters,
          search: rawValue
        };
        savePassFilters();
        mount();
        switchView("passes");
        const nextSearchInput = document.getElementById("pass-search-input");
        if (nextSearchInput) {
          nextSearchInput.focus();
          const safeStart = Math.min(cursorStart, nextSearchInput.value.length);
          const safeEnd = Math.min(cursorEnd, nextSearchInput.value.length);
          nextSearchInput.setSelectionRange(safeStart, safeEnd);
        }
      };
    }

    const fromInput = document.getElementById("pass-expiry-from");
    if (fromInput) {
      fromInput.onchange = function () {
        const rawValue = String(fromInput.value || "").trim();
        const normalizedDate = normalizePassFilterDate(rawValue);
        const isCleared = rawValue === "";
        if (!normalizedDate && !isCleared) {
          return;
        }
        passFilters = {
          ...passFilters,
          from: isCleared ? "" : normalizedDate
        };
        savePassFilters();
        mount();
        switchView("passes");
      };
    }

    const toInput = document.getElementById("pass-expiry-to");
    if (toInput) {
      toInput.onchange = function () {
        const rawValue = String(toInput.value || "").trim();
        const normalizedDate = normalizePassFilterDate(rawValue);
        const isCleared = rawValue === "";
        if (!normalizedDate && !isCleared) {
          return;
        }
        passFilters = {
          ...passFilters,
          to: isCleared ? "" : normalizedDate
        };
        savePassFilters();
        mount();
        switchView("passes");
      };
    }

    const clearButton = document.getElementById("clear-pass-filters");
    if (clearButton) {
      clearButton.onclick = function () {
        passFilters = {
          search: "",
          from: "",
          to: "",
          statuses: [],
          positions: [],
          membership: ["active"]
        };
        savePassFilters();
        mount();
        switchView("passes");
      };
    }

    const openSyncReviewButton = document.getElementById("open-pass-sync-review");
    if (openSyncReviewButton) {
      openSyncReviewButton.onclick = function () {
        window.location.hash = "pass-sync";
        switchView("pass-sync");
      };
    }
  }

  function bindPassSyncActions() {
    const fileInput = document.getElementById("pass-sync-file-input");
    if (fileInput) {
      fileInput.onchange = async function () {
        const file = fileInput.files && fileInput.files[0];
        if (!file) {
          passSyncUpload = null;
          return;
        }
        try {
          const fileBase64 = await fileToBase64(file);
          passSyncUpload = {
            fileName: String(file.name || "clubee.xlsx"),
            fileBase64
          };
          passSyncPreview = null;
          selectedPassSyncMemberIds = [];
          authState.status = `Loaded sync source file: ${passSyncUpload.fileName}`;
          mount();
          switchView("pass-sync");
        } catch (error) {
          authState.status = error.message;
          mount();
          switchView("pass-sync");
        }
      };
    }

    const previewButton = document.getElementById("preview-pass-sync-button");
    if (previewButton) {
      previewButton.onclick = async function () {
        if (authState.pendingAction) return;
        try {
          authState.pendingAction = "preview-pass-sync";
          authState.status = "Loading Clubee pass changes...";
          mount();
          passSyncPreview = await previewClubeePassSync();
          selectedPassSyncMemberIds = (passSyncPreview?.changes || [])
            .map((change) => String(change.memberId || "").trim())
            .filter(Boolean);
          authState.status = `Preview ready: ${(passSyncPreview?.changes || []).length} change(s).`;
        } catch (error) {
          authState.status = error.message;
        } finally {
          authState.pendingAction = "";
          mount();
          switchView("pass-sync");
        }
      };
    }

    const applyButton = document.getElementById("apply-pass-sync-button");
    if (applyButton) {
      applyButton.onclick = async function () {
        if (authState.pendingAction) return;
        const memberIds = Array.from(new Set(selectedPassSyncMemberIds.map((id) => String(id || "").trim()).filter(Boolean)));
        if (!memberIds.length) {
          authState.status = "Select at least one change to apply.";
          mount();
          switchView("pass-sync");
          return;
        }
        const confirmed = window.confirm(`Apply ${memberIds.length} selected Clubee pass update(s)?`);
        if (!confirmed) return;
        try {
          authState.pendingAction = "apply-pass-sync";
          authState.status = "Applying selected Clubee pass updates...";
          mount();
          const summary = await applyClubeePassSync(memberIds);
          passSyncPreview = await previewClubeePassSync();
          selectedPassSyncMemberIds = (passSyncPreview?.changes || [])
            .map((change) => String(change.memberId || "").trim())
            .filter(Boolean);
          authState.status = `Applied ${Number(summary?.appliedCount || 0)} update(s).`;
        } catch (error) {
          authState.status = error.message;
        } finally {
          authState.pendingAction = "";
          mount();
          switchView("pass-sync");
        }
      };
    }

    document.querySelectorAll(".pass-sync-select").forEach((checkbox) => {
      checkbox.onchange = function () {
        const memberId = String(checkbox.dataset.memberId || "").trim();
        if (!memberId) return;
        const selected = new Set(selectedPassSyncMemberIds.map((id) => String(id || "").trim()).filter(Boolean));
        if (checkbox.checked) selected.add(memberId);
        else selected.delete(memberId);
        selectedPassSyncMemberIds = Array.from(selected);
      };
    });

    const selectAllButton = document.getElementById("select-all-pass-sync");
    if (selectAllButton) {
      selectAllButton.onclick = function () {
        selectedPassSyncMemberIds = (passSyncPreview?.changes || [])
          .map((change) => String(change.memberId || "").trim())
          .filter(Boolean);
        mount();
        switchView("pass-sync");
      };
    }

    const clearSelectionButton = document.getElementById("clear-pass-sync-selection");
    if (clearSelectionButton) {
      clearSelectionButton.onclick = function () {
        selectedPassSyncMemberIds = [];
        mount();
        switchView("pass-sync");
      };
    }
  }

  function bindTableSorts() {
    document.querySelectorAll(".sort-button").forEach((button) => {
      button.onclick = function () {
        const table = button.dataset.sortTable;
        const key = button.dataset.sortKey;
        if (!table || !key) return;
        const current = tableSort[table] || { key: "", direction: "asc" };
        const direction = current.key === key && current.direction === "asc" ? "desc" : "asc";
        tableSort = {
          ...tableSort,
          [table]: { key, direction }
        };
        saveTableSort();
        mount();
      };
    });
  }

  function setupMembersStickyHeader() {
    if (typeof teardownMembersStickyHeader === "function") {
      teardownMembersStickyHeader();
      teardownMembersStickyHeader = null;
    }

    const membersView = document.getElementById("members");
    if (!membersView || !membersView.classList.contains("active")) return;
    const tableWrap = membersView.querySelector(".table-wrap");
    const table = tableWrap ? tableWrap.querySelector("table") : null;
    const thead = table ? table.querySelector("thead") : null;
    if (!tableWrap || !table || !thead) return;

    const sticky = document.createElement("div");
    sticky.className = "members-sticky-header";
    const stickyTable = document.createElement("table");
    stickyTable.className = "members-sticky-header-table";
    const clonedHead = thead.cloneNode(true);
    stickyTable.appendChild(clonedHead);
    sticky.appendChild(stickyTable);
    document.body.appendChild(sticky);

    const sync = function () {
      const wrapRect = tableWrap.getBoundingClientRect();
      const tableRect = table.getBoundingClientRect();
      const topOffset = 0;
      const headHeight = thead.getBoundingClientRect().height || 0;
      const show = tableRect.top < topOffset && tableRect.bottom > topOffset + headHeight;

      sticky.style.display = show ? "block" : "none";
      if (!show) return;

      sticky.style.left = `${wrapRect.left}px`;
      sticky.style.width = `${wrapRect.width}px`;

      const originalCells = thead.querySelectorAll("th");
      const clonedCells = clonedHead.querySelectorAll("th");
      originalCells.forEach((cell, index) => {
        const width = cell.getBoundingClientRect().width;
        if (!clonedCells[index]) return;
        clonedCells[index].style.width = `${width}px`;
        clonedCells[index].style.minWidth = `${width}px`;
        clonedCells[index].style.maxWidth = `${width}px`;
      });

      stickyTable.style.width = `${table.getBoundingClientRect().width}px`;
      stickyTable.style.transform = `translateX(${-tableWrap.scrollLeft}px)`;
    };

    const onScroll = function () {
      sync();
    };
    const onResize = function () {
      sync();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    tableWrap.addEventListener("scroll", onScroll, { passive: true });
    sync();

    teardownMembersStickyHeader = function () {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      tableWrap.removeEventListener("scroll", onScroll);
      sticky.remove();
    };
  }

  function setupFeesStickyHeader() {
    if (typeof teardownFeesStickyHeader === "function") {
      teardownFeesStickyHeader();
      teardownFeesStickyHeader = null;
    }

    const feesView = document.getElementById("fees");
    if (!feesView || !feesView.classList.contains("active")) return;
    const tableWrap = feesView.querySelector(".table-wrap");
    const table = tableWrap ? tableWrap.querySelector("table") : null;
    const thead = table ? table.querySelector("thead") : null;
    if (!tableWrap || !table || !thead) return;

    const sticky = document.createElement("div");
    sticky.className = "fees-sticky-header";
    const stickyTable = document.createElement("table");
    stickyTable.className = "fees-sticky-header-table";
    const clonedHead = thead.cloneNode(true);
    stickyTable.appendChild(clonedHead);
    sticky.appendChild(stickyTable);
    document.body.appendChild(sticky);

    const sync = function () {
      const wrapRect = tableWrap.getBoundingClientRect();
      const tableRect = table.getBoundingClientRect();
      const topOffset = 0;
      const headHeight = thead.getBoundingClientRect().height || 0;
      const show = tableRect.top < topOffset && tableRect.bottom > topOffset + headHeight;

      sticky.style.display = show ? "block" : "none";
      if (!show) return;

      sticky.style.left = `${wrapRect.left}px`;
      sticky.style.width = `${wrapRect.width}px`;

      const originalCells = thead.querySelectorAll("th");
      const clonedCells = clonedHead.querySelectorAll("th");
      originalCells.forEach((cell, index) => {
        const width = cell.getBoundingClientRect().width;
        if (!clonedCells[index]) return;
        clonedCells[index].style.width = `${width}px`;
        clonedCells[index].style.minWidth = `${width}px`;
        clonedCells[index].style.maxWidth = `${width}px`;
      });

      stickyTable.style.width = `${table.getBoundingClientRect().width}px`;
      stickyTable.style.transform = `translateX(${-tableWrap.scrollLeft}px)`;
    };

    const onScroll = function () {
      sync();
    };
    const onResize = function () {
      sync();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    tableWrap.addEventListener("scroll", onScroll, { passive: true });
    sync();

    teardownFeesStickyHeader = function () {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      tableWrap.removeEventListener("scroll", onScroll);
      sticky.remove();
    };
  }

  function setupPassesStickyHeader() {
    if (typeof teardownPassesStickyHeader === "function") {
      teardownPassesStickyHeader();
      teardownPassesStickyHeader = null;
    }

    const passesView = document.getElementById("passes");
    if (!passesView || !passesView.classList.contains("active")) return;
    const tableWrap = passesView.querySelector(".table-wrap");
    const table = tableWrap ? tableWrap.querySelector("table") : null;
    const thead = table ? table.querySelector("thead") : null;
    if (!tableWrap || !table || !thead) return;

    const sticky = document.createElement("div");
    sticky.className = "passes-sticky-header";
    const stickyTable = document.createElement("table");
    stickyTable.className = "passes-sticky-header-table";
    const clonedHead = thead.cloneNode(true);
    stickyTable.appendChild(clonedHead);
    sticky.appendChild(stickyTable);
    document.body.appendChild(sticky);

    const sync = function () {
      const wrapRect = tableWrap.getBoundingClientRect();
      const tableRect = table.getBoundingClientRect();
      const topOffset = 0;
      const headHeight = thead.getBoundingClientRect().height || 0;
      const show = tableRect.top < topOffset && tableRect.bottom > topOffset + headHeight;

      sticky.style.display = show ? "block" : "none";
      if (!show) return;

      sticky.style.left = `${wrapRect.left}px`;
      sticky.style.width = `${wrapRect.width}px`;

      const originalCells = thead.querySelectorAll("th");
      const clonedCells = clonedHead.querySelectorAll("th");
      originalCells.forEach((cell, index) => {
        const width = cell.getBoundingClientRect().width;
        if (!clonedCells[index]) return;
        clonedCells[index].style.width = `${width}px`;
        clonedCells[index].style.minWidth = `${width}px`;
        clonedCells[index].style.maxWidth = `${width}px`;
      });

      stickyTable.style.width = `${table.getBoundingClientRect().width}px`;
      stickyTable.style.transform = `translateX(${-tableWrap.scrollLeft}px)`;
    };

    const onScroll = function () {
      sync();
    };
    const onResize = function () {
      sync();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    tableWrap.addEventListener("scroll", onScroll, { passive: true });
    sync();

    teardownPassesStickyHeader = function () {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      tableWrap.removeEventListener("scroll", onScroll);
      sticky.remove();
    };
  }

  function bindDashboardActions() {
    const athleteProfileBtn = document.getElementById("athlete-view-profile-btn");
    if (athleteProfileBtn) {
      athleteProfileBtn.onclick = function () {
        profileRouteMode = "own";
        switchView("user");
      };
    }
  }

  function mount() {
    try {
      ensureValidFeeFilter();
      reconcileFeeStatusFilter();
      if (feeInlineEditId) {
        const visibleFeeIds = new Set(sortedVisibleFees().map((fee) => String(fee.id)));
        if (!visibleFeeIds.has(String(feeInlineEditId))) {
          feeInlineEditId = null;
        }
      }
      const visibleIds = new Set(sortedVisibleFees().map((fee) => String(fee.memberId)));
      selectedFeeMemberIds = selectedFeeMemberIds.filter((memberId) => visibleIds.has(String(memberId)));
      renderHeroNotice();
      document.getElementById("dashboard").innerHTML = renderDashboard();
      bindDashboardActions();
      document.getElementById("members").innerHTML = renderMembers();
      document.getElementById("fees").innerHTML = renderFees();
      document.getElementById("user").innerHTML = renderUserPage();
      document.getElementById("passes").innerHTML = renderPasses();
      document.getElementById("pass-sync").innerHTML = renderPassSyncReview();
      document.getElementById("events").innerHTML = renderEvents();
      document.getElementById("invites").innerHTML = renderInvites();
      document.getElementById("settings").innerHTML = renderSettings();
      document.getElementById("recovery").innerHTML = renderRecoveryGate();
      bindMemberActions();
      bindUserPageActions();
      bindMemberFilters();
      bindFeeFilters();
      bindPassFilters();
      bindPassSyncActions();
      bindFeeEditModeActions();
      bindAuthActions();
      bindRecoveryActions();
      bindChangePasswordAction();
      bindTableExports();
      bindTableSorts();
      updateNavigationVisibility();
      switchView(getRouteView());
      setupMembersStickyHeader();
      setupFeesStickyHeader();
      setupPassesStickyHeader();
    } catch (error) {
      console.error("Emperors bundle mount failed", error);
      const dashboard = document.getElementById("dashboard");
      if (dashboard) dashboard.innerHTML = `<article class="setup-card"><p class="eyebrow">Startup issue</p><h3>App bundle error</h3><p>${error.message}</p></article>`;
      switchView("dashboard");
    }
  }

  function bindChangePasswordAction() {
    const changePasswordButton = document.getElementById("change-password-button");
    if (changePasswordButton) {
      changePasswordButton.onclick = function () {
        window.location.hash = "#recovery";
        setTimeout(() => mount(), 100);
      };
    }
  }

  function unregisterServiceWorkers() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => registrations.forEach((registration) => registration.unregister()));
    }
  }

  bindNavigation();
  bindButtonFeedback();
  window.addEventListener("hashchange", function () {
    updateNavigationVisibility();
    switchView(getRouteView());
    setupMembersStickyHeader();
    setupFeesStickyHeader();
    setupPassesStickyHeader();
  });
  if (supabaseClient) {
    const { data } = await supabaseClient.auth.getSession();
    syncAuthSession(data?.session || null);
    supabaseClient.auth.onAuthStateChange(function (_event, session) {
      syncAuthSession(session || null);
      Promise.resolve()
        .then(() => promoteInvitedMemberOnFirstSignIn())
        .then(() => loadBootstrapData())
        .then(() => mount())
        .catch((error) => {
          authState.status = error.message;
          mount();
        });
    });
  } else {
    syncAuthSession(null);
  }
  await loadBootstrapData();
  mount();
  unregisterServiceWorkers();
})();
