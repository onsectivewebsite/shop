import Link from 'next/link';
import {
  consumeRevocationToken,
  issueOtp,
} from '@/server/auth';
import { prisma } from '@/server/db';
import { applyEmergencyLockdown } from '@/server/login-security';
import { sendOtpEmail } from '@/server/notifications';

export const metadata = { title: 'Lock my account' };
export const dynamic = 'force-dynamic';

/**
 * Single-use server-rendered page hit by the "It wasn't me" link in the
 * suspicious-login email. We don't show a confirmation step — the email
 * already gave the user a chance to ignore. Clicking the link is the
 * commitment.
 *
 * On a valid token we revoke every session, drop passkeys, scrub the
 * password hash, and email the user a fresh password-reset OTP. The
 * happy path lands them on this page with the "what we did" summary.
 */
export default async function RevokePage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token?.trim();

  if (!token) {
    return <FailureView reason="No token in this link." />;
  }

  const userId = await consumeRevocationToken(token);
  if (!userId) {
    return <FailureView reason="This link has already been used or has expired." />;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });
  if (!user) {
    return <FailureView reason="Account not found." />;
  }

  await applyEmergencyLockdown(userId);

  // Send a password-reset code so the user can complete recovery without
  // bouncing back through support.
  const { code } = await issueOtp({
    destination: user.email,
    channel: 'email',
    purpose: 'password_reset',
    userId,
  });
  try {
    await sendOtpEmail(user.email, code);
  } catch {
    // Best-effort — the user can still request a reset from /forgot.
  }

  return (
    <div className="container-page py-20">
      <div className="mx-auto max-w-xl space-y-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-emerald-700">
          Done
        </p>
        <h1 className="font-display text-4xl font-normal tracking-tight text-slate-950 md:text-5xl">
          Your account is locked.
        </h1>
        <ul className="space-y-2 text-[15px] text-slate-700">
          <li>· All active sessions on every device have been signed out.</li>
          <li>· Your password has been cleared.</li>
          <li>· Saved passkeys have been removed.</li>
          <li>· SMS two-factor (if enabled) has been disabled.</li>
        </ul>
        <p className="text-[15px] text-slate-700">
          We just emailed a 6-digit reset code to <strong>{user.email}</strong>. Use it
          to set a new password and sign back in. The code expires in 10 minutes.
        </p>
        <div className="flex gap-4 pt-2">
          <Link
            href="/forgot"
            className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Reset password
          </Link>
          <Link
            href="/"
            className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

function FailureView({ reason }: { reason: string }) {
  return (
    <div className="container-page py-20">
      <div className="mx-auto max-w-xl space-y-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-error-700">
          Couldn't lock account
        </p>
        <h1 className="font-display text-4xl font-normal tracking-tight text-slate-950 md:text-5xl">
          {reason}
        </h1>
        <p className="text-[15px] text-slate-600">
          If you still think your account is at risk, sign in and reset your password
          from{' '}
          <Link
            href="/forgot"
            className="font-medium text-slate-900 underline-offset-4 hover:underline"
          >
            the password reset flow
          </Link>
          . Or contact us at{' '}
          <a
            href="mailto:security@onsective.com"
            className="font-medium text-slate-900 underline-offset-4 hover:underline"
          >
            security@onsective.com
          </a>
          .
        </p>
      </div>
    </div>
  );
}
