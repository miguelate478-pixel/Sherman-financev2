import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'sherman-finance-v2-jwt-secret-min-32-chars-secure'
);

const PUBLIC_PATHS = ['/login', '/api/auth/login'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next();

  // Allow static files
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) return NextResponse.next();

  // For API routes: check Authorization header
  if (pathname.startsWith('/api/')) {
    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
    }
    try {
      await jwtVerify(auth.slice(7), secret);
      return NextResponse.next();
    } catch {
      return NextResponse.json({ ok: false, error: 'Token inválido o expirado' }, { status: 401 });
    }
  }

  // For page routes: check cookie or redirect to dashboard (handled client-side)
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
