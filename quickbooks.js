export const config = { runtime: 'edge' };

export default async function handler(req) {
  const { TRIPLETEX_TOKEN, TRIPLETEX_COMPANY_ID, DASHBOARD_SECRET } = process.env;

  const secret = req.headers.get('x-dashboard-secret');
  if (secret !== DASHBOARD_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const url = new URL(req.url);
  const path = url.searchParams.get('path') || '/v2/ledger/account';
  const query = url.searchParams.get('query') || 'from=0&count=1';

  const base = 'https://tripletex.no/v2';
  const token = Buffer.from(`0:${TRIPLETEX_TOKEN}`).toString('base64');

  try {
    const res = await fetch(`${base}${path}?${query}&companyId=${TRIPLETEX_COMPANY_ID}`, {
      headers: {
        Authorization: `Basic ${token}`,
        'Content-Type': 'application/json',
      },
    });
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
