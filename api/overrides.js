export default async function handler(req, res) {
  // Auth check
  const cookieHeader = req.headers.cookie || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => { const [k,...v] = c.trim().split('='); return [k, v.join('=')]; })
  );
  const auth = cookies['dashboard-auth'] || req.headers['x-dashboard-secret'];
  if (auth !== process.env.DASHBOARD_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const kvUrl  = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;

  if (req.method === 'GET') {
    try {
      const r = await fetch(`${kvUrl}/get/meta-overrides`, {
        headers: { Authorization: `Bearer ${kvToken}` },
      });
      const json = await r.json();
      const raw = json.result;
      if (!raw) return res.status(200).json({ ok: true, data: {} });
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return res.status(200).json({ ok: true, data });
    } catch(e) {
      return res.status(200).json({ ok: true, data: {} });
    }
  }

  if (req.method === 'POST') {
    try {
      const r = await fetch(`${kvUrl}/set/meta-overrides`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${kvToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: JSON.stringify(req.body) }),
      });
      if (!r.ok) return res.status(500).json({ error: 'KV write failed' });
      return res.status(200).json({ ok: true });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).end();
}
