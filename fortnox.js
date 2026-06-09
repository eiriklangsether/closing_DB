export const config = { runtime: 'edge' };

export default async function handler(req) {
  const { QB_ACCESS_TOKEN, QB_REALM_ID, DASHBOARD_SECRET } = process.env;

  const secret = req.headers.get('x-dashboard-secret');
  if (secret !== DASHBOARD_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const res = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${QB_REALM_ID}/companyinfo/${QB_REALM_ID}`,
      {
        headers: {
          Authorization: `Bearer ${QB_ACCESS_TOKEN}`,
          Accept: 'application/json',
        },
      }
    );
    const data = await res.json();
    return new Response(JSON.stringify({ ok: res.ok, status: res.status, data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
