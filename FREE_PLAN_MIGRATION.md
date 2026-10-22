# Appwrite Free readiness — 22 October 2026

Production has already been consolidated. The Education subscription is unchanged.
Target switch: the weekend of 31 October / 1 November 2026.

## Completed and verified

| Resource | Live configuration | Target |
|---|---|---|
| Organization members / projects | 1 owner / 1 project | Within Free limits |
| Database | `emperors` | 1 |
| Storage bucket | `media` (58 files) | 1 |
| Functions | `emperors-public`, `emperors-admin` | 2 |
| Web platforms | localhost, emperors.page, www.emperors.page | 3 |
| Webhooks / teams / topics | 0 / 0 / 0 | Within Free limits |
| Organization domains | 3; two unused external zones await approval to remove | 1 |

The six retired functions and five original picture buckets were backed up and deleted.
All 58 copied files were verified byte-for-byte using SHA-256, including their effective
permissions, before the originals were removed. The obsolete `felpower.github.io` platform
was removed after checking its redirect to emperors.page.

Production configuration now only contains the consolidated setup. Do not recreate the
old functions/buckets or switch back to the retired configuration. Their old source files
are historical references. Deploy the two resources in `appwrite.json` only.

Both functions use Mailgun for custom invite/reset/tryout/contact mail. They do not depend
on paid Appwrite custom SMTP for these flows. Required environment variables were checked.
The public roster and validation routes were exercised live without sending emails;
the admin endpoint correctly rejects an anonymous execution. No schedules or event triggers
are configured. Runtime memory is 512 MB; both functions have Git path filters set to their
own source directories, preventing frontend-only commits from rebuilding the backends.

The console's last-30-days figures at verification were about 519 MB bandwidth,
891 MB storage and 1.1 GB-hours compute. Usage reports can lag after deletion.
Future usage is variable; this is a readiness check, not a guarantee against future quotas.

## Remaining domain cleanup

The Free selector currently reports no project resource overages. Its remaining blocker
is organization domains (3/1). Keep `api.emperors.page`. Remove only the unused, unverified
third-party DNS zones `felpower-software.com` and `vrraiders.com` from Appwrite after approval.
Both zones were exported to ignored `migration-reports/free-*-zone.txt` files.
The former uses external Hosttech nameservers; the latter did not resolve during the check.
Removing these Appwrite zones does not cancel registrations at their external registrar.

## Switching the plan

1. Open https://appwrite.io/upgrade?orgId=69dd0e351860e33460fe.
2. Select **Free** and verify there are no over-limit resources or domains.
3. Enter the required feedback, for example: `Education benefit ending; project prepared for Free.`
4. Click **Change plan** yourself at the intended time. The console states the change is immediate.
5. Check login, roster/images, a normal admin action and invite/password-reset functionality.

The subscription has deliberately not been changed during preparation.
The original Education billing screen displayed a cycle of 10 October–9 November;
that does not establish the Education benefit expiry. Use the actual benefit notice for that date.

## Backups and maintenance

Appwrite's downgrade preview explicitly says its scheduled database backup policies will
stop running on Free and the Backups management screen will not be available.
A verified local snapshot was taken on 22 October: 20 collections, 2,569 documents, 58 files,
and both current function configurations. No users, memberships, fees or registrations
were changed by this cleanup.

Run a fresh manual snapshot whenever needed:

```powershell
npm run backup:appwrite
```

This writes a new folder under ignored `migration-reports/appwrite-snapshot-*`.
`snapshot.dpapi` contains collection schemas/documents, file metadata/permissions and function
settings/variables. It is encrypted for the current Windows account using DPAPI and verified
by decryption before `summary.json` is written. Pictures are stored under `files/` in that
private local folder. Keep the folder private: function source archives and picture backups
are not encrypted. DPAPI metadata requires this Windows account/profile to decrypt.
This is a logical application snapshot, not Appwrite native point-in-time recovery or an
export of Auth password hashes/sessions. It does not replace an independent disaster-recovery plan.

The retired function settings/variables are encrypted in
`migration-reports/free-final-backup-2026-10-22T10-22-06-226Z/manifest.dpapi`.
That folder also holds their active source archives and copies of the original bucket files.
No secrets or user snapshots are committed to Git.

Check project resources without deleting anything:

```powershell
npm run free-plan:check
```

Clean old inactive deployments when needed (retains the active deployment plus one rollback):

```powershell
node scripts/cleanup-function-deployments.mjs --function=emperors-admin --keep=1 --apply
node scripts/cleanup-function-deployments.mjs --function=emperors-public --keep=1 --apply
```

Free projects can be paused after inactivity. Open the console regularly and check its
usage dashboard, particularly storage and compute. No reminder or scheduled automation
was created during this migration.

Official references: https://appwrite.io/pricing,
https://appwrite.io/docs/advanced/billing/free,
https://appwrite.io/changelog/entry/2026-02-20-1.
