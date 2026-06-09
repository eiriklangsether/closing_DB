export default async function handler(req, res) {
  const secret = req.headers['x-dashboard-secret'];
  if (secret !== process.env.DASHBOARD_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!process.env.TRIPLETEX_TOKEN) {
    return res.status(200).json({ ok: false, error: 'Token not configured' });
  }

  const token = btoa(`0:${process.env.TRIPLETEX_TOKEN}`);

  try {
    const t0 = Date.now();
    const r = await fetch(
      `https://tripletex.no/v2/ledger/account?from=0&count=1&companyId=${process.env.TRIPLETEX_COMPANY_ID}`,
      { headers: { Authorization: `Basic ${token}` } }
    );
    const latency = Date.now() - t0;
    const data = await r.json();
    return res.status(200).json({ ok: r.ok, status: r.status, latency, data });
  } catch (e) {
    return res.status(200).json({ ok: false, error: e.message });
  }
}
