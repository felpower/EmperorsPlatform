# Appwrite Functions Setup

This project now uses Appwrite Functions for the server-side tasks that should not run in the browser.

## Functions In Repo

- Invite/account provisioning: `index.js`
- SEPA export: `appwrite/functions/sepa-export/index.js`

## Invite Function

Purpose:

- ensure an Appwrite auth user exists
- send password setup / recovery email
- link the user to a member row

Frontend config key:

- `inviteFunctionId`

Required environment variables:

- `APPWRITE_ENDPOINT`
- `APPWRITE_PROJECT_ID`
- `APPWRITE_API_KEY`
- `APPWRITE_DATABASE_ID`
- `APPWRITE_MEMBERS_COLLECTION_ID`
- `PUBLIC_SITE_URL`

Recommended:

- set execution permissions so your signed-in admins can run it

## SEPA Export Function

Purpose:

- read `members` and `membership_fees`
- build a SEPA XML export for a selected quarter
- return the XML as base64 to the frontend for download

Frontend config key:

- `sepaExportFunctionId`

Required environment variables:

- `APPWRITE_ENDPOINT`
- `APPWRITE_PROJECT_ID`
- `APPWRITE_API_KEY`
- `APPWRITE_DATABASE_ID`
- `APPWRITE_MEMBERS_COLLECTION_ID`
- `APPWRITE_MEMBERSHIP_FEES_COLLECTION_ID`
- `SEPA_CREDITOR_NAME`
- `SEPA_CREDITOR_IBAN`
- `SEPA_CREDITOR_ID`

Optional environment variables:

- `SEPA_CREDITOR_BIC`
- `SEPA_SEQUENCE_TYPE`
- `SEPA_LOCAL_INSTRUMENT`
- `SEPA_COLLECTION_DATE`
- `SEPA_DEFAULT_MANDATE_DATE`
- `SEPA_CURRENCY`

Notes:

- transactions are generated only for debit-ready fee rows
- paid/exempt/exit/non-applicable rows are skipped
- partial rows export only the outstanding amount
- rows without IBAN are skipped

## Deploying a Function

In Appwrite Console:

1. Create a new Node.js function
2. Paste the matching file content from this repo
3. Set the required environment variables
4. Deploy the function
5. Copy the function ID into `src/appwrite-config.js`

## Frontend Wiring

`src/appwrite-config.js` now supports:

- `inviteFunctionId`
- `passSyncFunctionId`
- `sepaExportFunctionId`

If a function ID is blank, that feature will fall back only where a local/API path still exists.

## Recommended Production Setup

- invites via Appwrite Function
- SEPA export via Appwrite Function
- pass sync via Appwrite Function if you want GitHub Pages to handle it without a separate backend
