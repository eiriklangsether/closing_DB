export default async function handler(req, res) {
  const secret = req.headers['x-dashboard-secret'];
  if (secret !== process.env.DASHBOARD_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const kv = await fetch(`${process.env.KV_REST_API_URL}/get/dashboard`, {
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
    },
  });

  if (!kv.ok) {
    return res.status(500).json({ error: 'Failed to read from KV store' });
  }

  const { result } = await kv.json();
  if (!result) {
    return res.status(200).json({ ok: true, data: null });
  }

  return res.status(200).json({ ok: true, data: JSON.parse(result) });
}
