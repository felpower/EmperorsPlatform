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
- loan_jersey (boolean, optional, default false) - true when the player is wearing a club loaner (Leihjersey)
- side_of_ball (string, optional) values: offense, defense, both - lets two players share a jersey number as long as they're not on the same side of the ball

Recommended extra columns for better parity:

- email (string, optional)
- first_name (string, optional)
- last_name (string, optional)
- positions_json (string, optional, store JSON array)
- roles_json (string, optional, store JSON array)
- rosterImage (string, optional, Appwrite Storage file id from the RosterPictures bucket)
- membership_status (string, optional) values: active, pending, inactive
- notes (string, optional)
- profile_id (string, optional)
- invite_sent_at (datetime, optional)
- activated_at (datetime, optional) - set when member first activates their account
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

## 8) tryout_registrations

Table ID:

- tryout_registrations

Columns:

- first_name (string, required)
- last_name (string, required)
- email (string, required)
- phone (string, optional)
- age (integer, required)
- uni_wien_student (string, required) values: yes, accepted_or_starting, no, prefer_to_discuss
- study_program (string, optional)
- previous_football_experience (string, required)
- football_experience_details (string, optional)
- other_sports (string, optional)
- preferred_position (string, optional)
- height_cm (integer, optional)
- weight_kg (integer, optional)
- availability_notes (string, optional)
- referred_by (string, optional; roster name or free-form source)
- contact_consent (boolean, required)
- tryout_cycle (string, required) example: next
- status (string, required) example: new, contacted, invited
- source (string, optional)
- submitted_at (datetime, required)

Public signup requirement:

- allow create("any")
- allow read/update/delete for authenticated users or admins only

## 9) organization

Table ID:

- organization

Columns:

- head_of (string, required)
- verantwortung (string, optional)
- co_verantwortung (string, optional)
- aufgaben (string, optional)

The page is readable by signed-in members. Create, update, and delete permissions should be limited to admins.

## Permissions recommendation

For general application tables, authenticated-user permissions are the fastest migration path. Keep the `organization` table's create, update, and delete permissions restricted to admins.

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
- tryoutRegistrationsTableId
- organizationTableId

If you use different IDs, update src/appwrite-config.js accordingly.
