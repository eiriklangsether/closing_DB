export default async function handler(req, res) {
  const cookieHeader = req.headers.cookie || '';
  const cookies = Object.fromEntries(cookieHeader.split(';').map(c => {
    const [k, ...v] = c.trim().split('=');
    return [k, v.join('=')];
  }));

  const authCookie = cookies['dashboard-auth'];
  const secret = req.headers['x-dashboard-secret'] || authCookie;

  if (secret !== process.env.DASHBOARD_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const kv = await fetch(`${process.env.KV_REST_API_URL}/get/dashboard`, {
      headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
    });

    const json = await kv.json();
    const result = json.result;

    if (result === null || result === undefined) {
      return res.status(200).json({ ok: true, data: null });
    }

    const data = typeof result === 'string' ? JSON.parse(result) : result;
    const finalData = data?.value ? (typeof data.value === 'string' ? JSON.parse(data.value) : data.value) : data;

    return res.status(200).json({ ok: true, data: finalData });
  } catch(e) {
    return res.status(200).json({ ok: false, error: e.message });
  }
}
