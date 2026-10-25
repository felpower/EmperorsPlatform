const { header, appwriteConfig, appwriteRequest, queryParam } = require('../shared/runtime');
module.exports = async ({ req, res }) => {
  try {
    const userId = header(req, 'x-appwrite-user-id');
    if (!userId) return res.json({ ok: false, error: 'Sign in first.' }, 401);
    const db = encodeURIComponent(appwriteConfig().databaseId);
    const base = `/databases/${db}/collections`;
    const list = async (collection, attribute, value, limit) => {
      const queries = [{ method:'equal', attribute, values:[value] }, { method:'limit', values:[limit] }];
      const { response, payload } = await appwriteRequest(`${base}/${encodeURIComponent(collection)}/documents?${queries.map(queryParam).join('&')}`);
      if (!response.ok) throw new Error('Your personal overview could not be loaded.');
      if (collection === "membership_fees" && Number(payload.total || 0) > limit) throw new Error("Too many contributions for the summary. Please ask Finance to check your account.");
      return payload.documents || [];
    };
    const members = await list(appwriteConfig().membersCollectionId, 'profile_id', userId, 2);
    if (members.length !== 1) return res.json({ ok: true, linked: false });
    const member = members[0];
    const [fees, passes] = await Promise.all([list('membership_fees','member_id',member.$id,100), list('player_passes','member_id',member.$id,1)]);
    return res.json({ ok: true, linked: true, pass: passes.length ? { status: passes[0].pass_status, expires: passes[0].expires_on } : null, fees: fees.map(row => ({ period:row.fee_period, status:row.status, amount:Number(row.amount_cents || 0)/100, paid:Number(row.paid_cents || 0)/100 })) });
  } catch (error) { return res.json({ ok:false, error:error.message },500); }
};
