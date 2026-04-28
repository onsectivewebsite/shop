import { NextResponse, type NextRequest } from 'next/server';

/**
 * IP allowlist enforcement (defense-in-depth).
 *
 * Set CONSOLE_IP_ALLOWLIST in env as a comma-separated list. Empty = no restriction (dev).
 * In prod, lock down to office VPN / named ranges per SECURITY.md §2.2.
 */
const RAW = process.env.CONSOLE_IP_ALLOWLIST ?? '';
const ALLOWLIST = RAW.split(',').map((s) => s.trim()).filter(Boolean);

export function middleware(req: NextRequest) {
  if (ALLOWLIST.length === 0) return NextResponse.next();

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    '';

  if (!ip || !ALLOWLIST.includes(ip)) {
    return new NextResponse('Forbidden', { status: 403 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|favicon|api/auth/login).*)'],
};
