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

## Build

Create the static frontend bundle:

```bash
npm run build
```

This writes the deployable frontend to:

- `dist/`

## GitHub Pages

Deploy the frontend from `dist/` or via your existing GitHub Actions workflow.

For GitHub Pages production:

- frontend stays static
- Appwrite handles auth and data
- Appwrite Functions handle invite and SEPA server-side work

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

## Security Notes

- Never put Appwrite admin API keys in frontend files
- Keep Appwrite function secrets only in Appwrite environment variables
- If any admin key was exposed in chat/history, rotate it in Appwrite Console
