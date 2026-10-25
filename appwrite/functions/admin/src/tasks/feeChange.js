const { parseBody, header, appwriteConfig, appwriteRequest, queryParam } = require('../shared/runtime');
const statuses = new Set(['paid','paid_rookie_fee','paid_with_fee','partial','pending','not_collected','deferred','exempt','exit','not_applicable']);
module.exports = async ({ req, res }) => {
  const body = parseBody(req);
  const db = encodeURIComponent(appwriteConfig().databaseId);
  const base = `/databases/${db}/collections`;
  const audit = `${base}/diagnostics_logs/documents`;
  const check = async (path, options) => {
    const result = await appwriteRequest(path, options);
    if (!result.response.ok) throw new Error(result.payload.message || 'Database request failed.');
    return result.payload;
  };
  try {
    if (body.action === 'history') {
      const queries = [ { method: 'equal', attribute: 'scope', values: ['finance-audit'] }, { method: 'orderDesc', attribute: '$createdAt' }, { method: 'limit', values: [50] } ];
      const result = await check(`${audit}?${queries.map(queryParam).join('&')}`);
      return res.json({ ok: true, entries: (result.documents || []).map(row => ({ logged_at: row.logged_at, message: row.message, details: row.details })) });
    }
    const id = String(body.feeId || '');
    if (!/^[\w.-]{1,36}$/.test(id)) return res.json({ ok: false, error: 'Invalid fee ID.' }, 400);
    const input = body.patch || {};
    const patch = {};
    for (const key of ['status','amount_cents','paid_cents','status_note','iban']) {
      if (!Object.hasOwn(input, key)) continue;
      if (key === 'status' && !statuses.has(input[key])) return res.json({ ok: false, error: 'Invalid fee status.' }, 400);
      if (key.endsWith('_cents') && (!Number.isSafeInteger(input[key]) || input[key] < 0 || input[key] > 100000000)) return res.json({ ok: false, error: 'Invalid contribution amount.' }, 400);
      if (['status_note','iban'].includes(key) && input[key] !== null && (typeof input[key] !== 'string' || input[key].length > (key === 'iban' ? 64 : 2000))) return res.json({ ok: false, error: 'Invalid fee details.' }, 400);
      patch[key] = input[key];
    }
    if (!Object.keys(patch).length) return res.json({ ok: false, error: 'No changes supplied.' }, 400);
    const userId = header(req, 'x-appwrite-user-id');
    const [before, actor] = await Promise.all([check(`${base}/membership_fees/documents/${encodeURIComponent(id)}`), check(`/users/${encodeURIComponent(userId)}`)]);
    const updated = await check(`${base}/membership_fees/documents/${encodeURIComponent(id)}`, { method: 'PATCH', body: { data: patch } });
    let auditWarning = '';
    const changes = {};
    for (const key of ['status','amount_cents','paid_cents']) if (Object.hasOwn(patch, key) && before[key] !== updated[key]) changes[key] = { from: before[key], to: updated[key] };
    if (Object.keys(changes).length) {
      try {
        await check(audit, { method: 'POST', body: { documentId: 'unique()', data: {
          logged_at: new Date().toISOString(), level: 'info', scope: 'finance-audit',
          message: `${String(actor.name || 'Administrator').slice(0,100)} changed contribution ${id}`,
          details: JSON.stringify({ feeId: id, memberId: before.member_id, feePeriod: before.fee_period, changes }),
          user_id: userId, member_id: before.member_id || null, access_role: null, user_email: null, route: null, origin: 'admin-function'
        } } });
      } catch { auditWarning = 'Contribution saved, but the history entry could not be saved. Do not repeat the payment change; contact an administrator.'; }
    }
    return res.json({ ok: true, row: updated, auditWarning });
  } catch (error) { return res.json({ ok: false, error: error.message || 'Contribution operation failed.' }, 500); }
};
