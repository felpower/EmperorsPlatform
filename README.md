# ClubHub Team Platform

This repository contains the first working starter for your football team platform.

## Appwrite Migration (appwrite-ui branch)

This branch keeps the original UI and routes data/auth through Appwrite via a compatibility layer.

Current Appwrite config file:

- `src/appwrite-config.js`

Configured values:

- `endpoint`: `https://fra.cloud.appwrite.io/v1`
- `projectId`: `69dd0fdd00336ea1b4b5`
- `databaseId`: `69dd11140002e2b4254a`
- `membersTableId`: `members`

For full feature parity (fees, passes, events, invites, role-driven views), create these additional tables in the same Appwrite database:

- `member_roles`
- `player_passes`
- `membership_fees`
- `events`
- `event_recipients`
- `invites`

The compatibility layer maps these legacy names automatically from:

- `src/appwrite-backend-compat.js`

Detailed table blueprint:

- `appwrite/TABLES_SETUP.md`

Terminal setup option:

- `npm run setup:appwrite`

Required environment variables:

- `APPWRITE_API_KEY`
- `APPWRITE_PROJECT_ID` (optional, defaults to current project)
- `APPWRITE_DATABASE_ID` (optional, defaults to current database)
- `APPWRITE_ENDPOINT` (optional, defaults to FRA cloud endpoint)

Important data model note:

- Appwrite is not a SQL database like Supabase Postgres. It uses database collections/documents (table-like, but not SQL dumps/restores).
- Migration from Supabase is still straightforward with API-based copy scripts.

Members-first migration command (Supabase -> Appwrite):

- `npm run migrate:members:supabase-to-appwrite`
- `npm run migrate:fees:supabase-to-appwrite`
- `npm run migrate:events:supabase-to-appwrite`

Required variables for that migration:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APPWRITE_API_KEY`
- `APPWRITE_PROJECT_ID` (optional)
- `APPWRITE_DATABASE_ID` (optional)
- `APPWRITE_ENDPOINT` (optional)

Validation commands:

- `npm run smoke:appwrite:auth-members`
- `npm run smoke:appwrite:collections`

Security note:

- If an API key was shared in chat or terminal history, rotate it in Appwrite Console before production use.

## Why this setup

The best low-cost option for your case is:

- Frontend: GitHub Pages or your small hosttech server
- Backend: Supabase
- Notifications later: email first, browser push second, Android app wrapper only if you still want it

Why this is the best fit:

- Cheap to start
- Works as a website first
- Supports multiple roles per user
- Easy to extend with new features later
- Lets us import your current Google Sheets / CSV data

## What is already included

- A deployable static web app
- A PWA manifest and service worker starter
- Demo dashboard for members, fees, passes, events, and invites
- Local demo persistence in the browser
- A production-ready Supabase SQL schema with roles and row-level security
- A frontend Supabase config placeholder in `src/supabase-config.js`

## Local preview

You can open `index.html` directly, but a local web server is better for service worker testing.

Example with Node:

```bash
npx serve .
```

Then open the shown local address in your browser.

## Clubee pass sync review

The Node backend supports a safe two-step Clubee pass sync flow:

1. Preview changes (read-only)
2. Apply only selected changes (explicit admin action)

You can provide the Clubee source in two ways:

1. Upload an `.xlsx` file from the Pass Sync Review page
2. Leave upload empty to use the server's default Clubee file path

- Default file path:
  - `assets/uni-wien-emperors_dfcbbd998dee66426d1889d1fd42cc61.xlsx`
- No automatic overwrite on bootstrap.
- Updates are written only through the explicit apply endpoint.
- Works in both modes:
  - local SQLite backend
  - hosted backend connected to Supabase (requires server-side `SUPABASE_SERVICE_ROLE_KEY`)

Optional environment variables:

- `CLUBEE_XLSX_PATH` to override the Clubee export file location

Manual API endpoints:

- `POST /api/passes/sync-clubee/preview` (read-only preview)
- `POST /api/passes/sync-clubee/apply` (writes selected changes)

## Suggested production architecture

### Phase 1

- Static frontend on GitHub Pages
- Supabase Auth for login
- Supabase Postgres for data
- Email invitations for practices and games

### Phase 2

- Browser push notifications for Android and desktop
- CSV / Google Sheets importer
- Better dashboards and filters

### Phase 3

- Optional Android app wrapper using Capacitor
- Camera upload for documents or player pass attachments
- Treasurer automation and reminders

## Database setup

Use the SQL file:

- [supabase/schema.sql](./supabase/schema.sql)

That schema supports:

- Members
- Roles
- Multiple roles per user
- Membership fee tracking
- Player pass expiry tracking
- Events
- Invite recipients and responses

## Supabase project values

The frontend config file is:

- [src/supabase-config.js](./src/supabase-config.js)

Important:

- The publishable key is safe for the frontend
- Do not put your database password or service-role key into browser code
- Use your database password only in Supabase tools, SQL clients, or CLI commands

## Important note about GitHub Pages

GitHub Pages is a static host. That means:

- The website itself can live there
- The database and authentication cannot
- Supabase handles the backend parts

## Recommended next steps

1. Create a Supabase project
2. Run `supabase/schema.sql`
3. Connect this frontend to Supabase
4. Import your existing club data from Google Sheets or CSV
5. Add login and invitation flow

When you want, I can do the next step and wire this starter to a real Supabase backend.

## Authentication and invites

The current build now includes:

- Email/password sign-in with Supabase Auth
- Admin invitation emails for new admins
- Member invitation emails for existing roster entries
- Automatic profile and role provisioning when an invited user first signs in
- Hosted deployments load app data from Supabase
- Localhost still uses the local SQLite API for development

Server-side invite emails require these environment variables on the Node server:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PUBLIC_SITE_URL` if you want invite links to point to a specific deployed site

The frontend only needs the public Supabase URL and anon key.

Important:

- GitHub Pages can host the static frontend
- Invite emails still need a backend with the Supabase service role key
- The local demo mode still works on `localhost`
