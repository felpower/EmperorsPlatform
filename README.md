# Uni Wien Emperors Platform

This project is the current Appwrite-based team platform for Uni Wien Emperors.

## Current Architecture

- Frontend: static site hosted on GitHub Pages
- Backend: Appwrite
- Auth: Appwrite Accounts
- Data: Appwrite database collections
- Server-side tasks: Appwrite Functions

There is no Supabase in the active stack anymore.

## Core Runtime Files

- Frontend bundle: `app.bundle.js`
- Frontend config: `src/appwrite-config.js`
- Appwrite compat layer: `src/appwrite-backend-compat.js`
- Invite function: `index.js`
- Optional local dev server: `server.mjs`

## Appwrite Config

The frontend reads from:

- `src/appwrite-config.js`

Current config keys:

- `endpoint`
- `projectId`
- `databaseId`
- `apiBaseUrl`
- `inviteFunctionId`
- `passSyncFunctionId`
- `sepaExportFunctionId`
- collection and bucket IDs

## Collections Used

- `members`
- `member_roles`
- `player_passes`
- `membership_fees`
- `events`
- `event_recipients`
- `invites`
- `equipment_inventory`

Collection shape setup is documented in:

- `appwrite/TABLES_SETUP.md`

## Appwrite Functions

This repo now expects Appwrite Functions for server-side operations that should not run directly in the browser.

Current function-related files:

- Invite/account provisioning: `index.js`
- SEPA export: `appwrite/functions/sepa-export/index.js`

Setup guide:

- `APPWRITE_FUNCTIONS_SETUP.md`

## Local Development

Install dependencies:

```bash
npm install
```

Start the local server:

```bash
npm start
```

Open:

```text
http://localhost:4173
```

Local development still supports the Node server for convenience, including API-backed tasks like SEPA export and Clubee pass sync preview/apply.

## GitHub Pages

There is no build step. `.github/workflows/deploy-pages.yml` deploys the repo root directly to GitHub Pages on every push to `main` (`app.bundle.js`, `index.html`, `styles.css`, `src/`, `assets/`, etc. are served as-is).

For GitHub Pages production:

- frontend stays static
- Appwrite handles auth and data
- Appwrite Functions handle invite, contact email and SEPA server-side work

## Contact Form

The public `/contact` page sends notifications to `p.felbauer@emperors.at`.

Production with GitHub Pages:

- deploy `appwrite/functions/contact-email/index.js`
- set `contactFunctionId` in `src/appwrite-config.js`
- preferably reuse Mailgun with `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, and `MAILGUN_FROM_EMAIL`
- alternatively configure `RESEND_API_KEY` and `RESEND_FROM_EMAIL`, or set `CONTACT_WEBHOOK_URL`

Local/server deployments can also use `POST /api/contact` from `server.mjs` with:

- Resend: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
- SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_EMAIL`
- Webhook: `CONTACT_WEBHOOK_URL`

## Authentication and Invites

The current application supports:

- email/password sign-in
- invite-based account setup
- password reset / recovery
- role-based access control in the UI

Invite email templates live in:

- `appwrite/templates/invite.html`
- `appwrite/templates/recovery.html`

## SEPA Export

SEPA export is moving to Appwrite Functions.

Current options:

- Localhost/dev: existing `/api/fees/export-sepa-xml` route via `server.mjs`
- Appwrite/GitHub Pages production: configure `sepaExportFunctionId` and deploy `appwrite/functions/sepa-export/index.js`

Important:

- the SEPA function needs creditor environment variables before it can generate XML
- see `APPWRITE_FUNCTIONS_SETUP.md` for required variables

## Appwrite Setup Helpers

Available scripts:

- `npm run setup:appwrite`
- `npm run auth:create-user`
- `npm run smoke:appwrite:auth-members`
- `npm run smoke:appwrite:collections`
- `npm run smoke:appwrite:parity-members-fees`
- `node scripts/import-roster-pictures.mjs --extract-only`
- `node scripts/import-roster-pictures.mjs --apply`

The setup script derives sponsor CRM access from `member_roles` entries with role `admin`. For a fresh database without role rows, set `APPWRITE_ADMIN_USER_IDS` to comma-separated Appwrite user IDs. The `sponsor_outreach` and `sponsor_communications` collections remain inaccessible when no admin IDs are available.

Roster picture import expects:

- `APPWRITE_API_KEY` with database and storage write permissions
- `APPWRITE_ROSTER_BUCKET_ID` defaults to `RosterPictures`
- `members.rosterImage` as a string attribute containing the uploaded storage file id

## Security Notes

- Never put Appwrite admin API keys in frontend files
- Keep Appwrite function secrets only in Appwrite environment variables
- If any admin key was exposed in chat/history, rotate it in Appwrite Console


## Public website and statistics (October 2026)

`npm run build:public` produces `dist/site`. The GitHub Pages workflow deploys that directory, including per-route HTML metadata, private-route `noindex` shells and the custom 404. Only frontend files are included; backend code, environment files and CSV/Excel imports are excluded. Continue using `npm start` for local API development.

Public visitors can opt into basic page-view statistics. The existing `emperors-public` function's `log` task writes sanitized events with scope `web-analytics` into the existing admin-readable `diagnostics_logs` table. No extra Appwrite Function, database, SDK subscription or paid analytics plan is needed. Function executions and database operations count toward the existing plan limits. No public read permission was added.

Admins see **Setup → Website statistics**: page views for 7/30 days, using up to the newest 1,000 analytics records. These are consenting page views, not unique visitors or exact audience counts. Private routes, signed-in users, preview hosts, Do Not Track and Global Privacy Control are excluded. Query strings, hashes, names and account IDs are not stored in these events. **Privacy choices** allows visitors to withdraw consent; the preference is stored only on their device. Analytics records use the existing diagnostics retention process; this change does not automatically delete historical logs.

The API-created native Analytics property `emperors-public` is not connected to this implementation. The current Console/Explorer did not expose a documented native installation flow; usage charts remain available independently of these website counters.

Checklist: custom 404; existing first-screen tryout CTA plus mobile home CTA; route titles/descriptions, OG image and favicons; robots/sitemap for public pages; image alternatives; existing responsive layouts; loading and form errors; post-submission next-steps page; updated technical privacy information; optional statistics consent. Existing imprint/contact details remain authoritative. No invented club contract terms were added. Before publication, the owner should confirm the existing legal contact/controller details.

Validation: workflow and statistics privacy tests (`npm run test:workflows`); frontend build; HTTP/HTML checks; successful live storage smoke test with its temporary row removed. Visual browser verification was blocked by the in-app browser's localhost restriction. Changes are local until committed and deployed through the existing workflow.
