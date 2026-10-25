const { parseBody, appwriteConfig, appwriteRequest } = require('../shared/runtime');
module.exports = async ({ req, res }) => {
  const body = parseBody(req);
  const ids = [...new Set(Array.isArray(body.ids) ? body.ids.map(String) : [])];
  if (!ids.length || ids.length > 20 || ids.some(id => !/^[\w.-]{1,36}$/.test(id))) return res.json({ ok: false, error: 'Select between 1 and 20 registrations.' }, 400);
  const key = String(process.env.MAILGUN_API_KEY || '');
  const domain = String(process.env.MAILGUN_DOMAIN || '');
  const host = String(process.env.MAILGUN_API_BASE_URL || 'https://api.eu.mailgun.net').replace(/\/+$/, '');
  if (!key || !domain) return res.json({ ok: false, error: 'Mailgun is not configured.' }, 500);
  const entries = await Promise.all(ids.map(async id => {
    try {
      const db = encodeURIComponent(appwriteConfig().databaseId);
      const collection = encodeURIComponent(process.env.APPWRITE_TRYOUT_REGISTRATIONS_COLLECTION_ID || 'tryout_registrations');
      const registration = await appwriteRequest(`/databases/${db}/collections/${collection}/documents/${encodeURIComponent(id)}`);
      if (!registration.response.ok) throw new Error('Registration could not be read.');
      const email = String(registration.payload.email || '').trim();
      if (!email) throw new Error('No email address on file.');
      const url = new URL(`${host}/v3/${encodeURIComponent(domain)}/events`);
      url.searchParams.set('recipient', email); url.searchParams.set('limit', '25'); url.searchParams.set('ascending', 'no');
      const response = await fetch(url, { headers: { Authorization: `Basic ${Buffer.from(`api:${key}`).toString('base64')}` } });
      const data = await response.json();
      if (!response.ok) throw new Error('Mailgun delivery lookup failed.');
      return { id, email, events: (data.items || []).slice(0,25).map(event => ({ event: event.event, severity: event.severity || '', timestamp: event.timestamp, subject: event.message?.headers?.subject || '', reason: event['delivery-status']?.description || '' })) };
    } catch (error) { return { id, error: error.message }; }
  }));
  return res.json({ ok: true, entries });
};
