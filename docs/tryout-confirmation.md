# Automatic tryout confirmation email

Tryout → Bulk email → **Edit automatic registration email** opens an admin-only editor for the confirmation sent immediately after a first registration. Subject, plain-text message and a sample preview are editable independently of the bulk invitation/reminder composer. Supported placeholders are `{{firstName}}`, `{{lastName}}`, `{{email}}`, `{{tryoutDate}}` and `{{tryoutDateEn}}`. Dates come from Next tryout, read afresh when registering.

Saving does not send any emails. The saved template applies to subsequent first registrations. Duplicate registrations retain the existing behaviour: update the record without sending another confirmation. Existing recipients are contacted through the separate bulk workflow.

Templates are stored in the existing `tryout_settings` table as document `confirmation-email`, key `confirmation_email`, using `confirmation_subject` and `confirmation_body`. The original bilingual text is retained until an administrator saves a custom template. A settings read failure does not fall back to potentially outdated wording; registration still succeeds and the existing `emailed: false` result reports the confirmation failure.

Run `node scripts/setup-tryout-confirmation.mjs` before deployment. This only adds optional fields; it does not change the existing message or any registrations. Synchronize shared helpers and deploy both existing functions. No additional service or function is needed.
