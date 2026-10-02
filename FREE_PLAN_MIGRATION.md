# Moving EmperorsPlatform to the Appwrite Free plan

Deadline: **before 1 Nov 2026** (end of the Education plan). Everything below runs while the
project still has Pro-level limits, so the new resources exist next to the old ones and the
switch is a one-line config change that can be rolled back.

| Free plan limit | Before | After |
|---|---|---|
| Databases (1) | 1 | 1 |
| Buckets (1) | 5 | 1 – `media` |
| Functions (2) | 6 | 2 – `emperors-public`, `emperors-admin` |
| Platforms (3) | 4 | 3 – drop `felpower.github.io` |
| Webhooks (2) | ? | check in Console › Settings › Webhooks |
| Storage (2 GB) | 6.98 GB (old builds) | ~0.1 GB after deployment cleanup |

## What changed in the repo

**Functions** (`appwrite/functions/`)

| Function | Execute | Tasks (`task` field in the payload) | Was |
|---|---|---|---|
| `emperors-public` | `any` | `contact`, `log`, `passwordReset` | ContactEmail, LogClientEvent, *(new)* |
| `emperors-admin` | `users` | `invite`, `passSync`, `sepaExport`, `tryoutEmail`, `setPassword` | CreateAuthAccount, PassSyncFunction, SepaExport, TryoutEmail, *(new)* |

* The router is `src/main.js`; each old function lives on almost unchanged in `src/tasks/`.
  The field is called `task`, not `action`, because pass sync already uses `action: preview|apply`.
  Without `task` the router infers it from the payload, so old frontends keep working.
* `emperors-admin` checks the caller's roles server-side (`src/auth.js`, member_roles → roles_json →
  user labels; admin can do everything). Defaults mirror the UI:
  invite = admin/coach/finance_admin/tech_admin · passSync = admin · sepaExport = admin/finance_admin ·
  tryoutEmail = admin/coach · setPassword = any signed-in user (own account, only inside an open link window).
  Override with the variable `ADMIN_TASK_ROLES`, e.g. `{"tryoutEmail":["admin"]}`.
* Shared code lives in `appwrite/functions/shared/` and is **copied** into both functions
  (`npm run functions:sync-shared`; CI fails if a copy is stale), because each function only deploys its own folder.
* Each function has its own tiny `package.json` (public: no deps, admin: `xlsx`). The old functions built from
  the repo root and installed express/sqlite3/… every time – that is where the 85–147 MB per build came from.
* No event or schedule triggers exist in the code. `setup-free-plan-functions.mjs` carries over any it finds
  in the Console and warns about them.

**Invite / password-reset emails without custom SMTP** (Free has no custom SMTP or templates):
the functions create a one-time login token (`POST /users/{id}/tokens`) and mail
`https://emperors.page/recovery?mode=token&kind=invite|reset&userId=…&secret=…` through Mailgun with the
club templates (`appwrite/templates/*.html`). The recovery page signs in with that token and calls
`setPassword`. Links: invite 72 h (`INVITE_LINK_TTL_SECONDS`), reset 1 h (`RESET_LINK_TTL_SECONDS`);
reset requests are throttled to one per 2 min per account and never reveal whether an email exists.
Links only ever point at hosts in `AUTH_LINK_ALLOWED_HOSTS` (default emperors.page, www.emperors.page, localhost).

**Storage**: all pictures go to one bucket `media`. File ids are kept (avatar-…, equipment-…, hof-…, rp_…,
random team-logo ids are unique), so only stored URLs change. If the old buckets had different permissions,
`media` uses file security and every file keeps exactly its old effective permissions; new uploads get
the permissions from `storageFilePermissions` in the config.

**Frontend**: `src/appwrite-config.js` has a switch `CLUBHUB_USE_FREE_PLAN_SETUP` (false = old setup).
All function calls now send `task`; uploads pass explicit permissions; the recovery page understands `mode=token`.

**Scripts** (all read the API key from `.env`; nothing deletes unless stated):

| Command | Does |
|---|---|
| `node scripts/setup-free-plan-functions.mjs [--dry-run]` | creates the 2 functions, copies settings, Git connection (+ path filter) and readable variables; prints what to set by hand |
| `node scripts/migrate-storage-to-single-bucket.mjs [--dry-run]` | creates `media`, copies all files (content, name, permissions), rewrites stored URLs in all tables, writes a report to `migration-reports/` – idempotent, never deletes |
| `node scripts/cleanup-function-deployments.mjs [--apply] [--keep=N] [--function=ID]` | deletes inactive deployments (dry run without `--apply`); active deployment is always kept |
| `node scripts/sync-function-shared.mjs [--check]` | copies shared function code into both functions |

The API key needs: `functions.read/write`, `buckets.read/write`, `files.read/write`, `databases.read`,
`collections.read`, `documents.read/write` (or the `tables/rows` equivalents), `users.read`.

## Deployments: only rebuild what changed

Both new functions stay connected to Git, with a **build trigger path filter**
(Console › Functions › *function* › Settings › Configuration › Git settings):

* `emperors-public` → root `appwrite/functions/public`, path filter `appwrite/functions/public/**`
* `emperors-admin`  → root `appwrite/functions/admin`, path filter `appwrite/functions/admin/**`

The setup script tries to set this through the API (`providerPaths`); if the API refuses it, it tells you to
set it in the Console. Check it once: push a commit that only touches `index.html` → no new deployment;
push one that touches `appwrite/functions/admin/` → only `emperors-admin` builds.
(Alternative without Git: `appwrite push functions --function-id emperors-admin` using `appwrite.json` –
note that a CLI push also applies the settings in `appwrite.json`.)

---

## Cut-over checklist

### Phase 0 – preparation (no user-visible change)

- [ ] In the Console, **disconnect Git from the 6 old functions** (Settings › Git). Their current deployment keeps
      running; they just stop rebuilding on every push. (Reversible: reconnect.)
- [ ] Commit and push this change as is (`CLUBHUB_USE_FREE_PLAN_SETUP = false`). The site behaves exactly as before.
- [ ] `node scripts/cleanup-function-deployments.mjs` → check the list → `node scripts/cleanup-function-deployments.mjs --apply`
      (*deletes old builds – irreversible, only inactive ones*). Storage should drop from ~7 GB to well under 1 GB.
- [ ] `node scripts/setup-free-plan-functions.mjs --dry-run`, then without `--dry-run`.
- [ ] Set the variables the script lists as "SET BY HAND" (secrets: `APPWRITE_API_KEY`, `MAILGUN_API_KEY`,
      `SEPA_CREDITOR_*`, …). Both functions need `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_FROM_EMAIL`
      (public: contact + reset mails, admin: tryout + invite mails) and `APPWRITE_DATABASE_ID`.
      The `APPWRITE_API_KEY` of **emperors-public** now also needs `users.read` + `users.write` (password reset) –
      the key copied from LogClientEvent may only have row/document scopes. emperors-admin's key needs
      `users.read/write` and `documents.read/write` (or `rows.*`).
- [ ] Check the Git root directory + path filter of both functions, then create the first deployment
      (Console › Deployments › Create deployment, or push a commit touching their folders). Build must be green.
- [ ] Quick smoke test in the Console › emperors-public › Execute, body `{"task":"log","event":{"level":"info","message":"smoke test"}}`
      → `ok: true`, new row in diagnostics_logs.
- [ ] `node scripts/migrate-storage-to-single-bucket.mjs --dry-run` – read the report (permission mode, file count,
      rows that will change, warnings). Then run it without `--dry-run`. Re-running is safe.
- [ ] Paste the printed `storageFilePermissions` block into `CLUBHUB_FREE_PLAN_SETUP` in `src/appwrite-config.js`.
- [ ] Optional dry run of the whole new setup **locally** (that's why localhost stays a platform): set the switch to
      `true` without committing, run the site on localhost and go through the tests below.

### Phase 1 – switch (one commit)

- [ ] In `src/appwrite-config.js` set `CLUBHUB_USE_FREE_PLAN_SETUP = true` and bump `appwrite-config.js?v=…` in `index.html`. Push.
- [ ] Run the tests below. **Rollback** = set the switch back to `false` and push (old functions and buckets still exist).

### Phase 2 – clean up (after ~1 week without problems, before 1 Nov)

- [ ] Run the storage migration once more (picks up files uploaded to old buckets during the transition, idempotent).
- [ ] Delete the 6 old functions and the 5 old buckets by hand in the Console (*irreversible*).
- [ ] Remove platform `felpower.github.io` (Console › Overview › Platforms): with the `emperors.page` CNAME,
      GitHub Pages redirects the github.io URL to emperors.page, so no browser request comes from that origin.
      Check first: opening the github.io URL must end on emperors.page. Keep `localhost` for local development/testing
      and both `emperors.page` + `www.emperors.page`.
- [ ] Webhooks: at most 2.
- [ ] Remove the old function sources from the repo in a separate commit: root `index.js`, `LogClientEvent.js`,
      `pass-sync-function.js`, `appwrite/functions/contact-email`, `sepa-export`, `tryout-email`.
- [ ] Usage page: storage < 2 GB, 1 bucket, 2 functions, 3 platforms → switch the organization to Free.

### Tests after the switch

Public (signed out):
- [ ] Roster, Hall of Fame, team logos and equipment photos load (network tab: URLs contain `/buckets/media/`).
- [ ] Contact form → email arrives at the recipient.
- [ ] "Forgot password?" → Mailgun email with the club template → link opens `/recovery` → set password → sign in with it.
      A second request within 2 minutes sends nothing; an unknown address shows the same success message.
- [ ] An expired/used link shows a clear error and "request a new one".

Signed in:
- [ ] Admin: invite a test member → invite email (72 h link) → set password → member is linked (`profile_id`, `invite_sent_at`).
- [ ] Admin/coach: create a member with email → auth user is created without email.
- [ ] Upload own profile picture; a second user sees it; replace it again (delete + upload must work).
- [ ] Equipment photo and Hall-of-Fame photo: upload, replace, remove.
- [ ] Pass sync: preview + apply with a Clubee XLSX.
- [ ] SEPA export for a quarter downloads valid XML.
- [ ] Tryout email to yourself.
- [ ] Diagnostics (Settings): remote logs connected.
- [ ] Role checks: a player account gets "not allowed" for SEPA/invite; a coach can invite and send tryout mails but not export SEPA.
- [ ] Deployments: a frontend-only commit creates no function deployment.

## Known limits / follow-ups

* **Free projects are paused after 7 days without "development activity in the Console"**
  ([changelog](https://appwrite.io/changelog/entry/2026-02-20-1)). Users report pauses despite daily app traffic.
  Open the Console at least weekly (calendar reminder), and know that a paused project is reactivated from the Console.
* Collection permissions currently let any signed-in user write `member_roles`/`members`, so the server-side
  role check can be bypassed by a malicious member. Tightening collection permissions is a separate task.
* The repo-root `server.mjs`/SQLite backend is not part of the Appwrite setup and was not changed.
