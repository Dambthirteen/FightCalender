import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const getSecret = () =>
  new TextEncoder().encode(process.env.JWT_SECRET ?? 'fight-calender-dev-secret');

const PUBLIC_PATHS = ['/login', '/api/auth', '/api/setup', '/api/admin/reset'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next();
  if (pathname.startsWith('/_next') || pathname === '/favicon.ico') return NextResponse.next();

  const token = request.cookies.get('fightcal_session')?.value;
  if (!token) return NextResponse.redirect(new URL('/login', request.url));

  try {
    await jwtVerify(token, getSecret());
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
