# Rookie join registration

Public URL /join, /join/ or /join.html. No login, file upload, IBAN or SEPA requirement. The public page says a member record will be created/assigned after club review, without a website login, password or invitation. Existing tryout data is visible only to authorised administrators, never through unauthenticated name/email lookup.

## Setup and deployment
`node scripts/setup-join-intake.mjs` creates private join_submissions (no client permissions) in the existing database. Uses existing emperors-public / emperors-admin; no new function or bucket. `node scripts/sync-function-shared.mjs` also copies the existing frontend club-workflows source into shared and both functions, so membership/payment enums and contribution tariffs have one source.

## Intake
Required first/last name, contact email, phone, age, rookie quarter, actual transferred amount and date, membership request / transfer / privacy acknowledgements. Period options are current and next two club quarters (January belongs to prior-year Q4). Contribution prices are read from fee_rates through the public info task; no fixed rookie amount fallback. Server records authoritative expected amount at submission time. Stable reference + fingerprint makes retries idempotent, daily email-hash limit prevents repeated submissions. Public response contains only the reference; no member/tryout data. It creates no member, auth account, fee, email or payment.

## Admin review
Dashboard new/incomplete count; Membership Finance → Rookie registrations. Name matches propose an existing member and/or tryout. Admin confirms identity and actual transfer, selecting the correct record. A tryout's linked member takes precedence; conflicting assignments are blocked. Existing identical name or email blocks new duplicate creation. Exited/inactive/coach members, exemptions or effective exit records require separate resolution. Existing full payments and special fee statuses are never overwritten.

Approval saves an immutable processing plan before changes. New member gets a deterministic ID, player role, rookie season (September–August), then active status after payment handling. No profile_id/Auth account is created. New member name comes from selected tryout; current contact email comes from this registration. Existing emails, roles, profile links and private bank details remain unchanged. Phone and age/tryout details are private. A selected tryout is marked joined and linked; referral/source fields remain unchanged. Paid Rookie Fee still does not qualify as a full paid quarter for referral rewards.

One fee row for the selected member/quarter is created or an unpaid ordinary row is updated: paid_rookie_fee, amount_cents = paid_cents = authoritative expected rookie rate. An already matching paid rookie row is reused without double counting. Normal paid rows, partial positive payments, exemptions etc. block approval. Actual reported amount must equal the expected rate; mismatches require Finance to resolve before approval. No bank debit occurs. Audit has actual original and resulting fields, not an invented unpaid starting point.

Partial failures remain processing and Retry approval reuses member/fee IDs and the original plan. Approved retry returns success without repeating changes. No mail is sent. Invalid/duplicate rejection requires a reason and cannot discard a processing approval. If fee handling succeeds but tryout linking fails, retry finishes without another member or fee.

## SEPA later
Member checklist detects a fully paid rookie quarter from existing fee rows, defers missing IBAN/signature/document warnings during it (including an upcoming already-paid rookie quarter), and labels Rookie quarter — SEPA later. Afterwards the usual checks apply. No new permanent exemption is created. /sepa now explains continued membership/future debit authorisation and the original joining month; it does not restart membership. New confirmation version 2026-10-30-continuation-v1 is stored, while earlier confirmation text remains supported and unchanged for old clients/documents.
