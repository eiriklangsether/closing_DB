export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { password } = req.body;
  if (password !== process.env.DASHBOARD_SECRET) {
    return res.status(401).json({ error: 'Wrong password' });
  }
  res.setHeader('Set-Cookie', `dashboard-auth=${process.env.DASHBOARD_SECRET}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`);
  return res.status(200).json({ ok: true });
}
