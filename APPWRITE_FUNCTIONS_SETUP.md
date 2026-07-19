# Appwrite Functions Setup

This project now uses Appwrite Functions for the server-side tasks that should not run in the browser.

## Functions In Repo

- Invite/account provisioning: `index.js`
- Contact form email: `appwrite/functions/contact-email/index.js`
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

## Contact Email Function

Purpose:

- receive the public contact form submission
- send an email notification to `p.felbauer@emperors.at`
- keep email provider secrets out of frontend files

Frontend config key:

- `contactFunctionId`

Required environment variables:

- `CONTACT_RECIPIENT_EMAIL` defaults to `p.felbauer@emperors.at`
- one delivery provider: Mailgun, Resend, or `CONTACT_WEBHOOK_URL`

Required for Mailgun delivery:

- `MAILGUN_API_KEY`
- `MAILGUN_DOMAIN`
- `MAILGUN_FROM_EMAIL`

Optional for Mailgun delivery:

- `MAILGUN_API_BASE_URL` defaults to the EU endpoint `https://api.eu.mailgun.net`; use `https://api.mailgun.net` for a US-region Mailgun domain

Required for Resend delivery:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

Optional environment variables:

- `CONTACT_FROM_EMAIL`
- `CONTACT_SUBJECT_PREFIX`

Notes:

- deploy the function with public execute permission if anonymous visitors should be able to use the contact form
- Mailgun can reuse the same verified sending domain as the invite email setup; its API key remains an Appwrite secret
- `RESEND_FROM_EMAIL` must be a sender/domain verified in Resend
- `CONTACT_WEBHOOK_URL` can point to a Make, Zapier, or custom webhook that sends the email

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
- `contactFunctionId`
- `contactRecipientEmail`
- `passSyncFunctionId`
- `sepaExportFunctionId`

If a function ID is blank, that feature will fall back only where a local/API path still exists.

## Recommended Production Setup

- invites via Appwrite Function
- contact notifications via Appwrite Function
- SEPA export via Appwrite Function
- pass sync via Appwrite Function if you want GitHub Pages to handle it without a separate backend
