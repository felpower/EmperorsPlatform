# Appwrite Auth Email Templates

These templates are styled for the current Uni Wien Emperors Appwrite invite/recovery flow.

Files:
- invite.html
- recovery.html

## How to apply in Appwrite Console

1. Open Appwrite Console.
2. Go to Auth -> Email templates.
3. Open the Invite template, paste invite.html.
4. Open the Recovery template, paste recovery.html.
5. Set subjects:
   - Invite: Set your Uni Wien Emperors password
   - Recovery: Reset your Uni Wien Emperors password

## Replace placeholders before saving

The HTML files intentionally use neutral placeholder markers so you can map to the exact variable names shown by your Appwrite project UI.

Replace all occurrences as follows using Appwrite's variable picker:

- [[APPWRITE_ACTION_URL]]
  - Replace with the Appwrite variable for the action link URL in that template.
  - This is the link that includes recovery/invite token parameters.

- [[APPWRITE_USER_EMAIL]]
  - Replace with the Appwrite variable for recipient email.

- [[APPWRITE_USER_NAME_OR_FALLBACK]]
  - Replace with the Appwrite variable for user name if available.
  - If your template variables do not include a name value, replace with "there".

## Notes

- Your server invite API already points recovery/invite links to /#recovery.
- Keep APPWRITE_ACTION_URL in both button href and fallback plain-text URL.
- If Appwrite requires strict handlebars/liquid syntax in your environment, insert variables only via the Appwrite variable picker to avoid syntax mismatch.
