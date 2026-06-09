import { NextResponse } from 'next/server';

export function middleware(req) {
  const url = req.nextUrl;
  
  // Skip API routes — they use their own secret header
  if (url.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get('dashboard-auth');
  if (cookie?.value === process.env.DASHBOARD_SECRET) {
    return NextResponse.next();
  }

  // Not authenticated — redirect to login
  if (url.pathname === '/login') {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL('/login', req.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
