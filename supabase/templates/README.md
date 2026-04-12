Paste the HTML files from this folder into the matching Supabase Auth email template fields.

Recommended subjects:

- [confirm-signup.html](./confirm-signup.html) -> `Confirm your Uni Wien Emperors email`
- [invite.html](./invite.html) -> `Set your Uni Wien Emperors password`
- [magic-link.html](./magic-link.html) -> `Sign in to Uni Wien Emperors`
- [change-email.html](./change-email.html) -> `Confirm your new Uni Wien Emperors email`
- [recovery.html](./recovery.html) -> `Reset your Uni Wien Emperors password`
- [reauthentication.html](./reauthentication.html) -> `Confirm reauthentication`
- [password-changed.html](./password-changed.html) -> `Your Uni Wien Emperors password changed`
- [email-changed.html](./email-changed.html) -> `Your Uni Wien Emperors email changed`

Where to use them in Supabase:

- Authentication -> Email Templates -> Confirm signup, Invite user, Magic Link, Change email address, Reset password, Reauthentication
- Authentication -> Email Templates -> Security notification emails for password changed and email changed

Important:

- The backend invite endpoint now redirects invited users to `/#recovery`, so they land in password setup first.
- The frontend marks `password_set = true` after a successful password setup and also normalizes older accounts after a successful email/password sign-in.
