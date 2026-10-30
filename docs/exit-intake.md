# Exit declarations

Public URL /exit, /exit/ and /exit.html. No login; signed PDF required, maximum 2 MiB. Existing public/admin functions and private media bucket. Setup: node scripts/setup-exit-intake.mjs before deploying.

## Policy authority
The original template prohibited rejoining for one year, without a repayment provision. The user requested a normal retrospective contribution rule with objective exceptions (including voluntary coaching) decided by the body authorised under the statutes. The text is a proposed club policy, not evidence that the competent ACSL body has adopted it. Confirm its adoption and consistency with the statutes/contribution regulations before relying on a demand. The broad property-claims release from the original is not carried over; valid outstanding contributions remain payable. No new debit authority is granted. Existing SEPA and pre-notification requirements still apply.

## Dates and billing
Quarter starts: 1 February, 1 May, 1 August, 1 November. Q4 year is its November start year. Future club-quarter starts only, no backdating. Vienna timezone. Server receipt timestamp retained; administrative review is identity/evidence checking and does not change the receipt date or determine whether an otherwise valid resignation takes legal effect.

Approval stores member_private.exit_effective_on; if already effective it also sets membership_status to exited. Future exits stay scheduled. Read-time status derives exited once effective, no cron needed. Public roster never exposes private dates. Both quarter generation and authoritative XML export exclude quarters beginning on/after the approved exit date, including existing unpaid future fee rows. Earlier debts, historical fees/payments, IBAN and mandate remain unchanged.

## Review and returning
Dashboard counter; Finance → Exit declarations. Only admins and finance admins. Authenticated private PDF preview reuses local PDF.js, no public file URLs. Unique full-name matching proposes a member, never email matching; reviewer confirms document, identity, date and applicable rules. Invalid/duplicate declarations require a reason. No discretion to refuse a valid resignation merely because inconvenient.

Return workflow records actual return date, full/partial/waived decision (outside 12 months also not_required), agreed amount and written decision reference, then clears the private exit date and reactivates. Requires explicit confirmation of authorised decision and written communication. Decision is saved before reactivation to allow safe retry after partial failure. No debt/fee row/payment is automatically created; Finance separately handles any agreed charge. The normal edit screen does not clear the private billing gate; use the return workflow.

Private collection exit_submissions, no direct client permissions. Idempotent reference/fingerprint and upload states uploading → new. No outgoing mail. Dashboard is the notification channel. Pending submissions are not automatically applied to members.
