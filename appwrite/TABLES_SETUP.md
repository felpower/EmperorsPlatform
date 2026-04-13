# Appwrite Tables Setup (appwrite-ui)

This document defines the Appwrite tables needed so the existing UI on branch appwrite-ui can run with Appwrite as backend.

Database ID in use:

- 69dd11140002e2b4254a

Project ID in use:

- 69dd0fdd00336ea1b4b5

## 1) members (already created)

Table ID:

- members

Columns:

- displayName (string, required)
- jerseyNumber (integer, optional)

Recommended extra columns for better parity:

- email (string, optional)
- first_name (string, optional)
- last_name (string, optional)
- positions_json (string, optional, store JSON array)
- roles_json (string, optional, store JSON array)
- membership_status (string, optional) values: active, pending, inactive
- notes (string, optional)
- profile_id (string, optional)
- invite_sent_at (datetime, optional)
- deleted_at (datetime, optional)

## 2) member_roles

Table ID:

- member_roles

Columns:

- profile_id (string, required)
- role_code (string, required)

Allowed role_code values:

- player
- coach
- admin
- finance_admin
- tech_admin
- staff

## 3) player_passes

Table ID:

- player_passes

Columns:

- member_id (string, required)
- pass_status (string, required) values: valid, expiring, expired, missing, pending
- expires_on (datetime, optional)
- federation_reference (string, optional)
- notes (string, optional)
- updated_at (datetime, optional)

## 4) membership_fees

Table ID:

- membership_fees

Columns:

- member_id (string, required)
- fee_period (string, required) example: Q2_2026
- season_label (string, required) example: 2026
- amount_cents (integer, required)
- paid_cents (integer, required)
- status (string, required) values: paid, partial, pending, not_collected, exempt, exit, not_applicable
- iban (string, optional)
- status_note (string, optional)
- due_date (datetime, optional)
- created_at (datetime, optional)

## 5) events

Table ID:

- events

Columns:

- title (string, required)
- event_type (string, required) values: practice, game, meeting
- starts_at (datetime, required)
- location (string, optional)
- notes (string, optional)
- created_by (string, optional)
- created_at (datetime, optional)

## 6) event_recipients

Table ID:

- event_recipients

Columns:

- event_id (string, required)
- member_id (string, required)
- response (string, required) values: pending, confirmed, maybe, declined
- responded_at (datetime, optional)

## 7) invites

Table ID:

- invites

Columns:

- event_id (string, required)
- channel (string, required) values: email, push
- sent_by (string, optional)
- sent_at (datetime, optional)
- recipient_count (integer, required)

## Permissions recommendation

For now (fastest path), set table read/write permissions so authenticated users can operate while we finish migration and testing.

After feature parity is stable, tighten permissions by role with table-level permissions and app logic.

## Config mapping

These table IDs are already mapped in src/appwrite-config.js:

- membersTableId
- memberRolesTableId
- playerPassesTableId
- membershipFeesTableId
- eventsTableId
- eventRecipientsTableId
- invitesTableId

If you use different IDs, update src/appwrite-config.js accordingly.
