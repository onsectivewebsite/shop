import Link from 'next/link';
import { consumeUnsubscribeToken } from '@/server/auth';
import { prisma } from '@/server/db';

export const metadata = { title: 'Unsubscribed' };
export const dynamic = 'force-dynamic';

/**
 * One-click unsubscribe landing. Server-component on purpose — the consume
 * happens during render, so even mail clients that prefetch link previews
 * (Gmail, Outlook) end up flipping the user's opt-in. consumeUnsubscribeToken
 * is idempotent so a second click after the prefetch doesn't surface as an
 * error.
 *
 * Lives at /u/<token> rather than /unsubscribe?token=… because email
 * clients sometimes wrap query strings, and a path-based URL survives that
 * cleanly.
 */
export default async function UnsubscribePage({
  params,
}: {
  params: { token: string };
}) {
  const userId = await consumeUnsubscribeToken(params.token).catch(() => null);

  // Look up the email so the confirmation page can address the user. We do
  // this AFTER the consume so even unauthenticated link clicks (the common
  // case from a mail client) work — no session required.
  let email: string | null = null;
  if (userId) {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    email = u?.email ?? null;
  }

  return (
    <div className="container-page py-20">
      <div className="mx-auto max-w-xl space-y-6">
        {userId ? (
          <>
            <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-emerald-700">
              Done
            </p>
            <h1 className="font-display text-4xl font-normal tracking-tight text-slate-950 md:text-5xl">
              You've unsubscribed.
            </h1>
            <p className="text-[15px] text-slate-700">
              {email ? (
                <>
                  We won't send any more marketing emails to{' '}
                  <strong>{email}</strong>. Order updates, security alerts, and
                  other transactional messages still go through — those are
                  exempt from email-marketing rules and from this preference.
                </>
              ) : (
                <>
                  We won't send marketing emails to this address. Order updates and
                  security alerts still go through.
                </>
              )}
            </p>
            <p className="text-sm text-slate-600">
              Changed your mind? Re-enable from{' '}
              <Link
                href="/account/notifications"
                className="font-medium text-slate-900 underline-offset-4 hover:underline"
              >
                Account → Notifications
              </Link>{' '}
              once you're signed in.
            </p>
          </>
        ) : (
          <>
            <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-error-700">
              Couldn't unsubscribe
            </p>
            <h1 className="font-display text-4xl font-normal tracking-tight text-slate-950 md:text-5xl">
              This link has expired.
            </h1>
            <p className="text-[15px] text-slate-700">
              Unsubscribe links are valid for one year. Sign in and turn off
              marketing emails directly from{' '}
              <Link
                href="/account/notifications"
                className="font-medium text-slate-900 underline-offset-4 hover:underline"
              >
                Account → Notifications
              </Link>
              .
            </p>
          </>
        )}
      </div>
    </div>
  );
}
