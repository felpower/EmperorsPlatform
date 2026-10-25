# Club workflow improvements

The player homepage obtains only the caller's own contributions and player pass through the `myOverview` task. It never accepts a member ID from the browser. The Special Teams button opens the existing read-only Apps Script search.

Finance prepares the XML once, displays the included members, exclusions, total, collection date and estimated mandate dates, and requires a separate download click. Local contribution/member changes invalidate the prepared snapshot. Downloading does not submit a banking transaction.

New single and bulk contribution status/amount edits use the `feeChange` admin task. It records actor, timestamp and before/after values in diagnostics with reserved scope `finance-audit`. Notes and IBANs are excluded. The history button reads the latest 50 entries on demand. This is an operational history of changes through the new interface, not an immutable accounting ledger or a reconstruction of historical edits. If saving the history fails after a successful contribution update, the payment change remains saved and a persistent warning is shown. Existing clients/API integrations can still write directly; those writes are outside this history.

The `finance_scope_created` index on diagnostics (`scope` length 64 ASC, `$createdAt` DESC) supports bounded history reads. The public diagnostics endpoint rejects the reserved scope.

Tryout delivery inspection reads the latest 25 retained Mailgun events for each selected registration (1–20 at a time). It never sends a message or changes registration status. Events include their subject and timestamp so earlier campaigns remain distinguishable. Accepted, delivered and failed are reported as Mailgun events; delivered is not proof that the recipient read the message. Mailgun retention limits may leave no events. The existing invitation/reminder workflow and manual send confirmation remain in place.

Organization and Hall of Fame data load when their pages are opened. Mobile cards keep long values and actions within their width. No additional Appwrite function, database or paid service was introduced.
