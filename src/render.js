function memberName(state, memberId) {
  return state.members.find((member) => member.id === memberId)?.name ?? "Unknown";
}

function formatDate(dateText) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(dateText));
}

function statusPill(value) {
  return `<span class="status ${value}">${value.replaceAll("_", " ")}</span>`;
}

function renderDashboard(state) {
  const activeMembers = state.members.filter(
    (member) => member.membershipStatus === "active"
  ).length;
  const expiringPasses = state.members.filter(
    (member) => member.passStatus === "expiring" || member.passStatus === "expired"
  ).length;
  const outstandingFees = state.fees
    .filter((fee) => fee.status !== "paid")
    .reduce((sum, fee) => sum + (fee.amount - fee.paidAmount), 0);
  const upcomingEvents = state.events.length;

  return `
    <div class="grid metrics">
      <article class="metric-card">
        <p class="eyebrow">Active members</p>
        <strong>${activeMembers}</strong>
        <p>Players, coaches, and admins with active status.</p>
      </article>
      <article class="metric-card">
        <p class="eyebrow">Pass renewals</p>
        <strong>${expiringPasses}</strong>
        <p>Members whose player pass needs attention soon.</p>
      </article>
      <article class="metric-card">
        <p class="eyebrow">Outstanding fees</p>
        <strong>EUR ${outstandingFees}</strong>
        <p>Open amount still to collect this season.</p>
      </article>
      <article class="metric-card">
        <p class="eyebrow">Upcoming events</p>
        <strong>${upcomingEvents}</strong>
        <p>Practices and games already planned.</p>
      </article>
    </div>

    <div class="split">
      <article class="list-card">
        <div class="section-head">
          <div>
            <p class="eyebrow">What needs action</p>
            <h3>Operational checklist</h3>
          </div>
        </div>
        <div class="list">
          ${state.members
            .filter((member) => member.passStatus !== "valid" || member.feeStatus !== "paid")
            .map(
              (member) => `
                <div class="list-item">
                  <div>
                    <strong>${member.name}</strong>
                    <div class="meta">
                      Pass ${member.passStatus} · Fee ${member.feeStatus}
                    </div>
                  </div>
                  <div class="pill-row">
                    ${statusPill(member.passStatus)}
                    ${statusPill(member.feeStatus)}
                  </div>
                </div>
              `
            )
            .join("")}
        </div>
      </article>

      <article class="list-card">
        <div class="section-head">
          <div>
            <p class="eyebrow">Next up</p>
            <h3>Upcoming sessions</h3>
          </div>
        </div>
        <div class="list">
          ${state.events
            .map(
              (event) => `
                <div class="list-item">
                  <div>
                    <strong>${event.title}</strong>
                    <div class="meta">
                      ${formatDate(event.date)} · ${event.location}
                    </div>
                  </div>
                  <div class="pill-row">
                    <span class="pill">${event.type}</span>
                    <span class="pill">${event.attending.length} attending</span>
                  </div>
                </div>
              `
            )
            .join("")}
        </div>
      </article>
    </div>
  `;
}

function renderMembers(state) {
  return `
    <div class="section-head">
      <div>
        <p class="eyebrow">Club people</p>
        <h3>Members and role assignments</h3>
      </div>
      <button class="primary-button" id="open-member-dialog">Add member</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Roles</th>
            <th>Jersey</th>
            <th>Membership</th>
            <th>Pass</th>
            <th>Fee</th>
          </tr>
        </thead>
        <tbody>
          ${state.members
            .map(
              (member) => `
                <tr>
                  <td>
                    <strong>${member.name}</strong>
                    <div class="meta">${member.email}</div>
                  </td>
                  <td>${member.roles.map((role) => `<span class="pill">${role}</span>`).join(" ")}</td>
                  <td>${member.jerseyNumber ?? "—"}</td>
                  <td>${statusPill(member.membershipStatus)}</td>
                  <td>
                    ${statusPill(member.passStatus)}
                    <div class="meta">Expires ${formatDate(member.passExpiry)}</div>
                  </td>
                  <td>${statusPill(member.feeStatus)}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderFees(state) {
  const collected = state.fees.reduce((sum, fee) => sum + fee.paidAmount, 0);
  const target = state.fees.reduce((sum, fee) => sum + fee.amount, 0);

  return `
    <div class="grid two-up">
      <article class="card">
        <p class="eyebrow">Season overview</p>
        <h3>Membership fee progress</h3>
        <p>Collected <strong>EUR ${collected}</strong> of <strong>EUR ${target}</strong>.</p>
      </article>
      <article class="card">
        <p class="eyebrow">Suggestion</p>
        <h3>Finance workflow</h3>
        <p>
          Track one record per member and season, then automatically flag due,
          overdue, or paid status based on the remaining amount and due date.
        </p>
      </article>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Member</th>
            <th>Season</th>
            <th>Amount</th>
            <th>Paid</th>
            <th>Due date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${state.fees
            .map(
              (fee) => `
                <tr>
                  <td>${memberName(state, fee.memberId)}</td>
                  <td>${fee.season}</td>
                  <td>EUR ${fee.amount}</td>
                  <td>EUR ${fee.paidAmount}</td>
                  <td>${formatDate(fee.dueDate)}</td>
                  <td>${statusPill(fee.status)}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderPasses(state) {
  return `
    <div class="section-head">
      <div>
        <p class="eyebrow">Eligibility</p>
        <h3>Player pass status</h3>
      </div>
    </div>
    <div class="grid two-up">
      ${state.members
        .filter((member) => member.roles.includes("player"))
        .map(
          (member) => `
            <article class="card">
              <p class="eyebrow">#${member.jerseyNumber ?? "?"}</p>
              <h3>${member.name}</h3>
              <p>${statusPill(member.passStatus)}</p>
              <p>Expiry: ${formatDate(member.passExpiry)}</p>
              <p class="muted">${member.notes}</p>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderEvents(state) {
  return `
    <div class="section-head">
      <div>
        <p class="eyebrow">Planning</p>
        <h3>Practices and matches</h3>
      </div>
    </div>
    <div class="grid two-up">
      ${state.events
        .map(
          (event) => `
            <article class="card">
              <p class="eyebrow">${event.type}</p>
              <h3>${event.title}</h3>
              <p>${formatDate(event.date)} · ${event.location}</p>
              <div class="pill-row">
                <span class="pill">${event.attending.length} yes</span>
                <span class="pill">${event.maybe.length} maybe</span>
                <span class="pill">${event.unavailable.length} no</span>
              </div>
              <p class="muted">
                Invite status: ${event.inviteStatus}. Later we can trigger email
                and push notifications from Supabase Edge Functions or Firebase messaging.
              </p>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderInvites(state) {
  return `
    <div class="section-head">
      <div>
        <p class="eyebrow">Communication</p>
        <h3>Invite history</h3>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Event</th>
            <th>Channel</th>
            <th>Sent</th>
            <th>Recipients</th>
            <th>Opened</th>
            <th>Confirmed</th>
          </tr>
        </thead>
        <tbody>
          ${state.invites
            .map(
              (invite) => `
                <tr>
                  <td>${state.events.find((event) => event.id === invite.eventId)?.title ?? "Unknown event"}</td>
                  <td><span class="pill">${invite.channel}</span></td>
                  <td>${formatDate(invite.sentAt)}</td>
                  <td>${invite.recipients}</td>
                  <td>${invite.opens}</td>
                  <td>${invite.confirmations}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderSettings(appState) {
  const auth = appState?.auth ?? {
    mode: "demo",
    email: "",
    status: "Demo mode active.",
    canSync: false
  };

  return `
    <div class="grid two-up">
      <article class="setup-card">
        <p class="eyebrow">Best platform choice</p>
        <h3>Recommended production setup</h3>
        <p>
          Use GitHub Pages for the frontend and Supabase for authentication,
          database, storage, and row-level permissions. This is the lowest-cost
          stack that still supports real user accounts and future growth.
        </p>
        <div class="pill-row">
          <span class="pill">Web first</span>
          <span class="pill">PWA capable</span>
          <span class="pill">Low cost</span>
          <span class="pill">Expandable</span>
        </div>
      </article>
      <article class="setup-card">
        <p class="eyebrow">Notifications</p>
        <h3>How invites will work</h3>
        <p>
          Phase 1 uses email invites with response links. Phase 2 adds browser
          push for Android and desktop. If you later want a true mobile app, we
          can wrap the same platform with Capacitor.
        </p>
      </article>
    </div>

    <article class="setup-card auth-panel" style="margin-top: 18px;">
      <div>
        <p class="eyebrow">Supabase connection</p>
        <h3>Authentication and live data</h3>
        <p>${auth.status}</p>
      </div>

      <form id="auth-form" class="inline-form">
        <label>
          Email for magic link sign-in
          <input
            name="email"
            type="email"
            placeholder="you@club.com"
            value="${auth.email ?? ""}"
            required
          />
        </label>
        <button class="primary-button" type="submit">Send magic link</button>
      </form>

      <div class="button-row">
        <button id="load-live-data" class="ghost-button" type="button">Load live data</button>
        <button
          id="sync-demo-data"
          class="ghost-button"
          type="button"
          ${auth.canSync ? "" : "disabled"}
        >
          Sync demo members to Supabase
        </button>
        <button id="sign-out" class="ghost-button" type="button">Sign out</button>
      </div>
      <p class="muted">
        Magic link sign-in uses Supabase Auth in the browser. Admin-only operations
        still depend on the database schema and role assignments.
      </p>
    </article>

    <article class="setup-card" style="margin-top: 18px;">
      <p class="eyebrow">Implementation path</p>
      <h3>Suggested rollout</h3>
      <div class="setup-list">
        <div class="setup-step">
          <span>1</span>
          <div>
            <strong>Set up Supabase</strong>
            <div class="muted">Run the SQL in <code>supabase/schema.sql</code> and create your project.</div>
          </div>
        </div>
        <div class="setup-step">
          <span>2</span>
          <div>
            <strong>Deploy the frontend</strong>
            <div class="muted">Upload this folder to GitHub and publish with GitHub Pages.</div>
          </div>
        </div>
        <div class="setup-step">
          <span>3</span>
          <div>
            <strong>Import your Sheets data</strong>
            <div class="muted">We can map CSV exports into members, fees, passes, and events next.</div>
          </div>
        </div>
        <div class="setup-step">
          <span>4</span>
          <div>
            <strong>Invite users</strong>
            <div class="muted">Then we enable login, role-based access, and invite flows.</div>
          </div>
        </div>
      </div>
    </article>
  `;
}

window.ClubHubRender = {
  renderDashboard,
  renderEvents,
  renderFees,
  renderInvites,
  renderMembers,
  renderPasses,
  renderSettings
};
