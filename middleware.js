export const config = {
  matcher: ['/', '/index.html'],
};

export default function middleware(req) {
  const secret = process.env.DASHBOARD_SECRET;
  const cookieHeader = req.headers.get('cookie') || '';

  // Parse dashboard-auth cookie
  const authCookie = cookieHeader
    .split(';')
    .map(c => c.trim())
    .find(c => c.startsWith('dashboard-auth='));
  const cookieValue = authCookie ? authCookie.split('=').slice(1).join('=') : null;

  // Valid cookie — pass through to origin
  if (secret && cookieValue === secret) {
    return; // undefined = continue
  }

  // No valid cookie — redirect to login page
  return Response.redirect(new URL('/login.html', req.url), 302);
}
