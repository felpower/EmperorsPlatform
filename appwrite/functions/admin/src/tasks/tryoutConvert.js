const crypto = require("node:crypto");
const { parseBody, appwriteConfig, appwriteRequest, queryParam } = require("../shared/runtime");

// A stable member id makes retrying a partially completed conversion safe.
module.exports = async ({ req, res, log }) => {
  const body = parseBody(req);
  const id = String(body.submissionId || "").trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$/.test(id)) return res.json({ ok: false, error: "Invalid submission id." }, 400);
  const config = appwriteConfig();
  const base = `/databases/${encodeURIComponent(config.databaseId)}/collections`;
  const submissions = `${base}/${encodeURIComponent(process.env.APPWRITE_TRYOUT_REGISTRATIONS_COLLECTION_ID || "tryout_registrations")}/documents`;
  const members = `${base}/${encodeURIComponent(config.membersCollectionId)}/documents`;
  const fail = (result, fallback) => res.json({ ok: false, error: result.payload?.message || fallback }, result.response.status >= 400 ? result.response.status : 500);
  try {
    const submission = await appwriteRequest(`${submissions}/${encodeURIComponent(id)}`);
    if (!submission.response.ok) return fail(submission, "Registration not found.");
    const row = submission.payload;
    if (!row.contact_consent) return res.json({ ok: false, error: "This registration has no contact consent. Review it before creating a membership." }, 400);
    if (!["attended", "joined"].includes(row.status)) return res.json({ ok: false, error: "Mark participation as Attended before creating a member." }, 400);
    const email = String(row.email || "").trim().toLowerCase();
    if (!email) return res.json({ ok: false, error: "A registration email is required." }, 400);
    const matching = await appwriteRequest(`${members}?${queryParam({ method: "equal", attribute: "email", values: [email] })}&${queryParam({ method: "limit", values: [100] })}`);
    if (!matching.response.ok) return fail(matching, "Could not check existing members.");
    let matches = (matching.payload.documents || []).filter((member) => !member.deleted_at);
    // Older imports may contain mixed-case email addresses; compare canonically.
    if (!matches.length) {
      for (let offset = 0; ; offset += 100) {
        const page = await appwriteRequest(`${members}?${queryParam({ method: "limit", values: [100] })}&${queryParam({ method: "offset", values: [offset] })}`);
        if (!page.response.ok) return fail(page, "Could not check existing members.");
        const items = page.payload.documents || [];
        matches.push(...items.filter((member) => !member.deleted_at && String(member.email || "").trim().toLowerCase() === email));
        if (items.length < 100 || matches.length > 1) break;
      }
    }
    const stableId = `tryout-${crypto.createHash("sha256").update(email).digest("hex").slice(0, 28)}`;
    let memberId = String(row.linked_member_id || "");
    if (!memberId && matches.length > 1) return res.json({ ok: false, error: "Multiple members use this email. Resolve the duplicate before converting." }, 409);
    if (!memberId && matches.length === 1) {
      memberId = matches[0].$id;
      if (["inactive", "exited"].includes(matches[0].membership_status)) return res.json({ ok: false, error: "This email belongs to an inactive or exited member. Reactivate that member explicitly before linking." }, 409);
    }
    if (!memberId) {
      const data = {
        displayName: [row.first_name, row.last_name].filter(Boolean).join(" ").trim(),
        first_name: String(row.first_name || ""), last_name: String(row.last_name || ""), email,
        membership_status: "pending", roles_json: JSON.stringify(["player"]), positions_json: "[]",
        notes: `Tryout registration ${id}\nPhone: ${row.phone || ""}\nAge: ${row.age || ""}\n${row.availability_notes || ""}`.slice(0, 2048)
      };
      if (!data.displayName) return res.json({ ok: false, error: "The participant's name is missing." }, 400);
      const created = await appwriteRequest(members, { method: "POST", body: { documentId: stableId, data } });
      if (!created.response.ok && created.response.status !== 409) return fail(created, "Could not create member.");
      memberId = stableId;
    }
    const member = await appwriteRequest(`${members}/${encodeURIComponent(memberId)}`);
    if (!member.response.ok || member.payload.deleted_at || String(member.payload.email || "").trim().toLowerCase() !== email) return res.json({ ok: false, error: "Could not verify the linked member." }, 409);
    if (row.status !== "joined" && ["exited", "inactive"].includes(member.payload.membership_status)) return res.json({ ok: false, error: "Reactivate the existing member explicitly before linking." }, 409);
    const linked = await appwriteRequest(`${submissions}/${encodeURIComponent(id)}`, { method: "PATCH", body: { data: { status: "joined", linked_member_id: memberId } } });
    if (!linked.response.ok) return res.json({ ok: false, memberId, error: `Member exists, but linking the registration failed: ${linked.payload?.message || "Database update failed"}. Retry conversion to finish linking; no second member will be created.` }, 500);
    return res.json({ ok: true, memberId, submission: linked.payload });
  } catch (error) {
    log(`Tryout conversion failed: ${error.message}`);
    return res.json({ ok: false, error: error.message || "Conversion failed." }, 500);
  }
};
