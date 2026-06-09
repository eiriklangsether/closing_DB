export default async function handler(req, res) {
  const secret = req.headers['x-dashboard-secret'];
  if (secret !== process.env.DASHBOARD_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!process.env.QB_ACCESS_TOKEN || !process.env.QB_REALM_ID) {
    return res.status(200).json({ ok: false, error: 'Token not configured' });
  }

  try {
    const t0 = Date.now();
    const r = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${process.env.QB_REALM_ID}/companyinfo/${process.env.QB_REALM_ID}`,
      { headers: { Authorization: `Bearer ${process.env.QB_ACCESS_TOKEN}`, Accept: 'application/json' } }
    );
    const latency = Date.now() - t0;
    const data = await r.json();
    return res.status(200).json({ ok: r.ok, status: r.status, latency, data });
  } catch (e) {
    return res.status(200).json({ ok: false, error: e.message });
  }
}
