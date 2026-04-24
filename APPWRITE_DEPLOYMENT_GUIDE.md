# Appwrite Deployment Guide

This project now targets:

- GitHub Pages for the frontend
- Appwrite for auth, data, storage, and functions

## Production Shape

```text
GitHub Pages (static frontend)
        |
        v
Appwrite
- Accounts
- Database collections
- Storage
- Functions
```

## 1. Frontend Config

Update:

- `src/appwrite-config.js`

Set the Appwrite values for your real project:

- `endpoint`
- `projectId`
- `databaseId`
- collection IDs
- bucket IDs
- `inviteFunctionId`
- `passSyncFunctionId`
- `sepaExportFunctionId`

`apiBaseUrl` is optional now and should only be used if you intentionally still run the Node server somewhere.

## 2. Build Frontend

```bash
npm run build
```

Deploy the contents of:

- `dist/`

to GitHub Pages.

## 3. Appwrite Permissions

Set proper collection permissions in Appwrite so the frontend can only read/write what each role should access.

Important examples:

- `membership_fees`: admin/finance only
- `player_passes`: admin/coach/tech admin only
- `members`: scoped appropriately for member self-access and admin management

## 4. Appwrite Functions

Recommended functions:

- invite/account provisioning
- SEPA export
- Clubee pass sync, if you want server-side processing

Current function code in this repo:

- Invite function: `index.js`
- SEPA export: `appwrite/functions/sepa-export/index.js`

See:

- `APPWRITE_FUNCTIONS_SETUP.md`

## 5. GitHub Pages

Use your current repo/pages workflow. The frontend can run entirely as a static site once Appwrite config is correct.

## Environment Variables

Frontend:

- no admin secrets
- only public Appwrite identifiers in `src/appwrite-config.js`

Appwrite Functions:

- keep `APPWRITE_API_KEY` in Appwrite Function env vars only
- keep all SEPA creditor values in Appwrite Function env vars only

## Troubleshooting

### Auth works locally but not on GitHub Pages

- check Appwrite platform/site URL settings
- check allowed redirect/recovery URLs
- check `src/appwrite-config.js`

### Invite works inconsistently

- inspect Appwrite Function logs for the invite function
- verify the function has correct admin key env vars
- verify the member row has the right `profile_id`, `invite_sent_at`, and email

### SEPA button is disabled on GitHub Pages

- set `sepaExportFunctionId` in `src/appwrite-config.js`
- deploy `appwrite/functions/sepa-export/index.js`
- add the required SEPA env vars in Appwrite

### Pass sync fails on GitHub Pages

- either configure `passSyncFunctionId`
- or intentionally provide a backend `apiBaseUrl`

## Production Goal

The intended production setup is a clean Appwrite-only backend behind a static GitHub Pages frontend.
