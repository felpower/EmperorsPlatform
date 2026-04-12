Use these templates in the Supabase dashboard under `Authentication -> Email Templates`.

Recommended subjects:
- Invite: `Set your Uni Wien Emperors password`
- Recovery: `Reset your Uni Wien Emperors password`

Recommended mapping:
- `invite.html` -> Invite template
- `recovery.html` -> Reset password / recovery template

Important:
- The backend invite endpoint now redirects invited users to `/#recovery`, so they land in password setup first.
- The frontend marks `password_set = true` after a successful password setup and also normalizes older accounts after a successful email/password sign-in.
