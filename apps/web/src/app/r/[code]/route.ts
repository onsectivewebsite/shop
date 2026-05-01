import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { REFERRAL_COOKIE_NAME, REFERRAL_COOKIE_TTL_DAYS } from '@/server/auth';
import { prisma } from '@/server/db';

/**
 * Catch-all share-link landing page. /r/<code> records the code in a
 * 30-day cookie and bounces the visitor to the homepage. The cookie is
 * read at signup time and turned into a `ReferralAttribution` row when the
 * new account verifies its email.
 *
 * We intentionally don't 404 on an unknown code — the user may have typed
 * it slightly wrong, and getting them to the homepage is better than a
 * dead end. We DO confirm the code exists before setting the cookie so
 * we never persist a typo as a referral.
 */

export async function GET(
  _req: Request,
  { params }: { params: { code: string } },
) {
  const code = params.code.trim().toUpperCase();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  if (code.length < 6 || code.length > 12) {
    return NextResponse.redirect(`${baseUrl}/`);
  }

  const exists = await prisma.referralCode.findUnique({
    where: { code },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.redirect(`${baseUrl}/`);
  }

  cookies().set(REFERRAL_COOKIE_NAME, code, {
    httpOnly: false, // readable by client JS — useful for showing "you've been invited" banners
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: REFERRAL_COOKIE_TTL_DAYS * 24 * 60 * 60,
  });

  // Land them on /signup with a hint so the form can announce "you'll
  // unlock a perk on signup" once the second-sided incentive ships.
  return NextResponse.redirect(`${baseUrl}/?ref=${encodeURIComponent(code)}`);
}
