import nodemailer, { type Transporter } from 'nodemailer';
import { Resend } from 'resend';

let smtpCached: Transporter | null = null;
let resendCached: Resend | null = null;

function getResend(): Resend | null {
  if (resendCached) return resendCached;
  if (!process.env.RESEND_API_KEY) return null;
  resendCached = new Resend(process.env.RESEND_API_KEY);
  return resendCached;
}

function getSmtp(): Transporter | null {
  if (smtpCached) return smtpCached;
  if (!process.env.SMTP_HOST) return null;
  smtpCached = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: process.env.SMTP_SECURE !== 'false',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return smtpCached;
}

const FROM = () => process.env.EMAIL_FROM ?? 'no-reply@onsective.com';
const REPLY_TO = () => process.env.EMAIL_REPLY_TO;

function shell(title: string, body: string): string {
  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #0f172a;">
    <p style="margin: 0 0 24px; font-size: 18px; font-weight: 600; letter-spacing: -0.01em;">Onsective<span style="color:#f59e0b;">.</span></p>
    <h2 style="margin: 0 0 16px; font-size: 22px; font-weight: 600;">${title}</h2>
    <div style="font-size: 15px; line-height: 1.6; color: #334155;">${body}</div>
    <hr style="margin: 32px 0; border: 0; border-top: 1px solid #e2e8f0;" />
    <p style="font-size: 12px; color: #94a3b8;">If you didn't expect this email, ignore it or contact ${process.env.EMAIL_REPLY_TO ?? 'help@onsective.com'}.</p>
  </div>`;
}

function codeBlock(code: string): string {
  return `<p style="font-size: 32px; font-weight: 700; letter-spacing: 0.18em; padding: 18px 28px; background: #f1f5f9; border-radius: 10px; display: inline-block; margin: 12px 0;">${code}</p>`;
}

async function send(opts: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  // 1. Resend if configured (HTTP API, no port issues, best deliverability)
  const resend = getResend();
  if (resend) {
    const { error } = await resend.emails.send({
      from: FROM(),
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
      replyTo: REPLY_TO(),
    });
    if (error) throw new Error(`Resend: ${error.message ?? 'unknown error'}`);
    return;
  }

  // 2. SMTP fallback
  const smtp = getSmtp();
  if (smtp) {
    await smtp.sendMail({
      from: FROM(),
      replyTo: REPLY_TO(),
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    return;
  }

  // 3. Dev fallback
  // eslint-disable-next-line no-console
  console.log(`[email→${opts.to}] ${opts.subject}: ${opts.text}`);
}

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  await send({
    to,
    subject: 'Your Onsective verification code',
    text: `Your Onsective code is ${code}. It expires in 10 minutes.`,
    html: shell(
      'Your verification code',
      `Use the code below to continue.${codeBlock(code)}<p style="font-size: 13px; color: #64748b;">Expires in 10 minutes.</p>`,
    ),
  });
}

export async function sendTwoFactorEmail(to: string, code: string): Promise<void> {
  await send({
    to,
    subject: 'Confirm your sign-in to Onsective',
    text: `Your sign-in code is ${code}. It expires in 10 minutes. If you didn't try to sign in, change your password immediately.`,
    html: shell(
      'Confirm your sign-in',
      `Someone just signed in to your account with a password. Enter this code on the sign-in page to complete it.${codeBlock(code)}<p style="font-size: 13px; color: #64748b;">If this wasn't you, <strong>change your password immediately</strong>.</p>`,
    ),
  });
}

export async function sendLockoutEmail(to: string, unlockAt: Date): Promise<void> {
  const when = unlockAt.toUTCString();
  await send({
    to,
    subject: 'Your Onsective account has been temporarily locked',
    text: `Too many failed sign-in attempts. Account locked until ${when}. Reset your password if this wasn't you.`,
    html: shell(
      'Account temporarily locked',
      `<p>We detected too many failed sign-in attempts and temporarily locked your account. It will unlock automatically at <strong>${when}</strong>.</p>
       <p>If this wasn't you, please reset your password right away:</p>
       <p style="margin: 16px 0;"><a href="${process.env.NEXT_PUBLIC_APP_URL ?? ''}/en/forgot" style="display:inline-block;background:#0f172a;color:white;padding:12px 20px;border-radius:9999px;text-decoration:none;font-weight:600;font-size:14px;">Reset password</a></p>`,
    ),
  });
}

export async function sendNewDeviceLoginEmail(
  to: string,
  meta: { ip: string | null; userAgent: string | null; at: Date },
): Promise<void> {
  const when = meta.at.toUTCString();
  await send({
    to,
    subject: 'New sign-in to your Onsective account',
    text: `New sign-in at ${when} from ${meta.ip ?? 'unknown IP'} (${meta.userAgent ?? 'unknown device'}). If this wasn't you, reset your password.`,
    html: shell(
      'New sign-in detected',
      `<p>We just signed you in from a new device or location.</p>
       <ul style="font-size: 14px; color: #334155;">
         <li><strong>When:</strong> ${when}</li>
         <li><strong>IP:</strong> ${meta.ip ?? 'unknown'}</li>
         <li><strong>Device:</strong> ${meta.userAgent ?? 'unknown'}</li>
       </ul>
       <p>If this wasn't you, reset your password immediately.</p>`,
    ),
  });
}

export async function sendOtpSms(to: string, code: string): Promise<void> {
  // TODO Phase 1: Twilio (or MSG91 for IN)
  // eslint-disable-next-line no-console
  console.log(`[sms→${to}] Your Onsective code is ${code} (expires in 10 min).`);
}
