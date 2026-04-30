import { randomInt, createHash } from 'node:crypto';
import { prisma } from '@onsective/db';

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;

export type OtpChannel = 'email' | 'sms';
export type OtpPurpose =
  | 'login'
  | 'verify'
  | 'password_reset'
  | 'login_2fa'
  | 'account_delete';

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export async function issueOtp(args: {
  destination: string;
  channel: OtpChannel;
  purpose: OtpPurpose;
  userId?: string;
}): Promise<{ code: string; expiresAt: Date }> {
  const code = generateCode();
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await prisma.otp.updateMany({
    where: { destination: args.destination, purpose: args.purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  await prisma.otp.create({
    data: {
      destination: args.destination,
      channel: args.channel,
      purpose: args.purpose,
      codeHash,
      expiresAt,
      userId: args.userId,
    },
  });

  return { code, expiresAt };
}

export async function verifyOtp(args: {
  destination: string;
  purpose: OtpPurpose;
  code: string;
}): Promise<{ valid: boolean; userId: string | null }> {
  const codeHash = hashCode(args.code);
  const otp = await prisma.otp.findFirst({
    where: {
      destination: args.destination,
      purpose: args.purpose,
      consumedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!otp) return { valid: false, userId: null };
  if (otp.expiresAt < new Date()) return { valid: false, userId: null };
  if (otp.attempts >= OTP_MAX_ATTEMPTS) return { valid: false, userId: null };

  if (otp.codeHash !== codeHash) {
    await prisma.otp.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    return { valid: false, userId: null };
  }

  await prisma.otp.update({
    where: { id: otp.id },
    data: { consumedAt: new Date() },
  });

  return { valid: true, userId: otp.userId };
}
