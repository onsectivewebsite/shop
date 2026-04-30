import {
  recordLoginEvent,
  isSuspiciousLogin,
  issueRevocationToken,
  type LoginMethod,
} from './auth';
import { prisma } from './db';
import { sendNewDeviceLoginEmail, sendSuspiciousLoginEmail } from './notifications';

/**
 * Side-effects that run after every successful sign-in: write an audit
 * row, fire the new-device email when the IP/UA shifted, and fire the
 * suspicious-country email + mint a revocation token when the country
 * has never been seen before.
 *
 * Intentionally non-fatal — a failure here must NOT block the user from
 * actually signing in. The caller has already issued a session.
 */
export async function runPostLoginChecks(args: {
  user: { id: string; email: string; lastLoginIp: string | null; lastLoginUserAgent: string | null };
  method: LoginMethod;
  ip: string | null;
  userAgent: string | null;
  at: Date;
  /**
   * When true, send the new-device email even if the IP/UA matches and we
   * have no prior login history. Used by recovery-code logins, which bypass
   * 2FA and should always notify.
   */
  forceNotify?: boolean;
}): Promise<void> {
  try {
    const country = await recordLoginEvent({
      userId: args.user.id,
      ip: args.ip,
      userAgent: args.userAgent,
      method: args.method,
      success: true,
    });

    const suspicious = await isSuspiciousLogin({
      userId: args.user.id,
      countryCode: country,
    });

    if (suspicious) {
      const { token } = await issueRevocationToken(args.user.id);
      const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://itsnottechy.cloud';
      const revokeUrl = `${base}/security/revoke?token=${encodeURIComponent(token)}`;
      try {
        await sendSuspiciousLoginEmail(args.user.email, {
          ip: args.ip,
          country,
          userAgent: args.userAgent,
          at: args.at,
          revokeUrl,
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[login-security] suspicious email failed:', err);
      }
      // The suspicious email already covers the alert; suppress the
      // lighter-weight new-device email so the user doesn't get two.
      return;
    }

    const isNewDevice = args.ip !== args.user.lastLoginIp || args.userAgent !== args.user.lastLoginUserAgent;
    if (args.forceNotify || (isNewDevice && args.user.lastLoginIp)) {
      try {
        await sendNewDeviceLoginEmail(args.user.email, {
          ip: args.ip,
          userAgent: args.userAgent,
          at: args.at,
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[login-security] new-device email failed:', err);
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[login-security] post-login checks failed (continuing):', err);
  }
}

/**
 * Hard remediation when the user clicks "It wasn't me" in the alert email.
 * Revokes every session, clears the password (forcing reset on next sign-in),
 * disables passkeys, and removes 2FA SMS so the attacker can't intercept the
 * recovery flow on a hijacked phone. Returns true on success.
 */
export async function applyEmergencyLockdown(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId } }),
    prisma.passkey.deleteMany({ where: { userId } }),
    prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: null,
        twoFactorSms: false,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    }),
  ]);
}
