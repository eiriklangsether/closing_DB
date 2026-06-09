export default async function handler(req, res) {
  const secret = req.headers['x-dashboard-secret'];
  if (secret !== process.env.DASHBOARD_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const consumerToken = process.env.TRIPLETEX_TOKEN;
  const employeeToken = process.env.TRIPLETEX_EMPLOYEE_TOKEN;
  const companyId = process.env.TRIPLETEX_COMPANY_ID || '1914191';

  if (!consumerToken || !employeeToken) {
    return res.status(200).json({ ok: false, error: 'Tokens not configured' });
  }

  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const expiry = tomorrow.toISOString().split('T')[0];

    const sessionRes = await fetch(
      `https://tripletex.no/v2/token/session/:create?consumerToken=${consumerToken}&employeeToken=${employeeToken}&expirationDate=${expiry}`,
      { method: 'PUT', headers: { 'Content-Type': 'application/json' } }
    );

    if (!sessionRes.ok) {
      const err = await sessionRes.text();
      return res.status(200).json({ ok: false, status: sessionRes.status, error: `Session token failed: ${err}` });
    }

    const sessionData = await sessionRes.json();
    const sessionToken = sessionData?.value?.token;

    if (!sessionToken) {
      return res.status(200).json({ ok: false, error: 'No session token returned' });
    }

    const credentials = btoa(`0:${sessionToken}`);
    const t0 = Date.now();
    const r = await fetch(
      `https://tripletex.no/v2/ledger/account?from=0&count=1&companyId=${companyId}`,
      { headers: { Authorization: `Basic ${credentials}` } }
    );
    const latency = Date.now() - t0;
    const data = await r.json();

    return res.status(200).json({ ok: r.ok, status: r.status, latency, data });
  } catch (e) {
    return res.status(200).json({ ok: false, error: e.message });
  }
}
