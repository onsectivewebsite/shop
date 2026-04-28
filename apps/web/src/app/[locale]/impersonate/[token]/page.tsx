import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { prisma } from '@/server/db';
import { SESSION_COOKIE_NAME, issueSession } from '@onsective/auth';

/**
 * Consumes a console-issued impersonation magic-link and creates a special
 * web session. The session inherits the target user's identity but carries
 * `impersonationSessionId` — every mutation through tRPC rejects when set.
 *
 * Single-use semantics: a token may only be consumed once (`tokenConsumedAt`).
 * After the PM ends the impersonation in the console, `endedAt` is set and
 * the next session lookup deletes the web session cookie.
 */
export const dynamic = 'force-dynamic';

export default async function ImpersonateConsumePage({
  params,
}: {
  params: { locale: string; token: string };
}) {
  const imp = await prisma.impersonationSession.findUnique({
    where: { id: params.token },
  });

  if (!imp || imp.endedAt || imp.tokenConsumedAt) {
    redirect(`/${params.locale}`);
  }

  const { token, expiresAt } = await issueSession(imp.targetUserId, {});
  // Manually attach the impersonation reference to the brand-new session row.
  await prisma.session.updateMany({
    where: { userId: imp.targetUserId, impersonationSessionId: null, expiresAt },
    data: { impersonationSessionId: imp.id },
  });
  await prisma.impersonationSession.update({
    where: { id: imp.id },
    data: { tokenConsumedAt: new Date() },
  });

  cookies().set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  });

  redirect(`/${params.locale}`);
}
