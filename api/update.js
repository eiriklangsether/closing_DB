export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = req.headers['x-dashboard-secret'];
  if (secret !== process.env.DASHBOARD_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const data = req.body;
  if (!data) {
    return res.status(400).json({ error: 'No data provided' });
  }

  const kv = await fetch(`${process.env.KV_REST_API_URL}/set/dashboard`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ value: JSON.stringify(data) }),
  });

  if (!kv.ok) {
    return res.status(500).json({ error: 'Failed to write to KV store' });
  }

  return res.status(200).json({ ok: true });
}
