# Google sign-in

Google sign-in uses the existing Appwrite Auth service; no additional Appwrite
function, database, bucket, paid identity service, or Google billing account is needed.

- Google Cloud project: `uni-wien-emperors-512718` (Uni Wien Emperors).
- OAuth web client: `Emperors Website`.
- Appwrite Google provider: browser sign-in enabled, native sign-in disabled.
- Callback: copy the exact Redirect URI from Appwrite Auth → Social providers → Google.
- The client secret is stored only in Appwrite, never in this repository.
- Website switch: `googleSignInEnabled` in `src/appwrite-config.js`.

## Existing accounts and invitations

Members must use the Google account with the same email as their existing
Emperors account. Appwrite links the OAuth identity to that account. Roles still
come from the existing member and role records; Google does not assign roles.

Appwrite Auth → Policies → Users has an intentional user limit of **1**. The
project already has more users, so this blocks new **client-side** registrations,
including Google auto-registration, while existing users can still sign in.
Admin invitations create accounts through the server Users API, which does not
apply that client registration limit. Do not remove this restriction when enabling
another provider: authenticated users have access to internal member resources.

The Google Cloud app is in production and requests only `openid`, basic profile
and email scopes. Google consent remains an individual user's action. No Gmail,
Contacts, Calendar or Drive access is requested.

## Validation

Check the Google redirect uses the expected client and callback, then verify an
existing member can sign in and keeps their role. A Google user without an existing
Appwrite account must be rejected. Keep email/password sign-in available.
