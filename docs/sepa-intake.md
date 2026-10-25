# SEPA intake

Public form: `/sepa.html`. No club account, Google account or email verification is required. The contact email may differ from the roster email. The existing blank mandate PDF is copied unchanged from the supplied Google Drive template to `assets/sepa-mandate-template.pdf`.

The form collects player names, contact email, account holder, IBAN, approximate joining date, actual signature date and a signed PDF (maximum 2 MB). It validates dates and IBAN check digits. The supplied document still needs to be completed and signed; this is not a replacement of the signed mandate with a checkbox.

The anonymous `sepaSubmit` task matches a complete normalized first/last name only when exactly one non-deleted member matches. Email is not used for member matching. Abbreviations or ambiguous names remain unassigned for manual selection. A match associates the submission with the player, but does not change the player's bank details before Finance reviews the document.

The existing private `media` bucket stores documents with no file permissions. `sepa_submissions` has no client permissions. Neither signed-in ordinary members nor anonymous visitors can list submissions or fetch documents directly. Download/review is mediated by the role-checked `sepaReview` task (admin/finance_admin). No additional Appwrite function or bucket is required.

Membership Finance → **SEPA & missing bank details** opens the overview. It distinguishes missing/invalid IBAN, missing signature date, no document recorded in this app and pending submissions. Inactive/exited/coach records are excluded by default and can be included. Legacy IBAN values in fee rows are considered as fallback. Older signed documents held in Google Drive are not automatically imported and must not be interpreted as definitively absent merely because this app has no document reference.

Approval explicitly selects the member and writes IBAN, signature date, account holder and private file reference to `member_private`. It does not register payments, change fee amounts or membership dates. The actual account holder is used in SEPA XML; if none is recorded, existing exports retain their previous player-name fallback. Partial failure after saving bank details returns an explicit warning rather than pretending the bank write failed.

Submission IDs are random and held in page memory. Retrying the same submission after an interrupted upload reuses its reference and fingerprint; changed details need a new page/reference. There is a honeypot and a maximum of three submissions per contact email in 24 hours. These are basic abuse controls, not full bot protection. No intake email is sent.

Run `node scripts/setup-sepa-intake.mjs` before deploying to a new environment. This creates the private intake collection and index and adds `mandate_file_id` and `account_holder` to `member_private`. Run `npm run functions:sync-shared`, tests and the public build. Keep the Appwrite Education plan until the user's chosen changeover date; this feature does not change billing.
