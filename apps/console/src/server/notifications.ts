import nodemailer, { type Transporter } from 'nodemailer';

let cached: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (cached) return cached;
  if (!process.env.SMTP_HOST) return null;
  cached = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: process.env.SMTP_SECURE !== 'false',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return cached;
}

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  const t = getTransporter();
  if (!t) {
    // eslint-disable-next-line no-console
    console.log(`[email→${to}] Onsective password reset code: ${code} (expires in 10 min).`);
    return;
  }
  const subject = 'Onsective password reset code';
  const text = `Your Onsective password reset code is ${code}.\n\nThis code expires in 10 minutes. If you didn't request it, ignore this email.`;
  const html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
    <h2 style="margin: 0 0 16px;">Password reset code</h2>
    <p style="font-size: 16px; line-height: 1.5;">Your Onsective password reset code is</p>
    <p style="font-size: 32px; font-weight: 700; letter-spacing: 0.15em; padding: 16px 24px; background: #f4f4f5; border-radius: 8px; display: inline-block; margin: 8px 0 16px;">${code}</p>
    <p style="font-size: 14px; color: #71717a;">This code expires in 10 minutes. If you didn't request it, ignore this email.</p>
  </div>`;
  await t.sendMail({
    from: process.env.EMAIL_FROM ?? 'no-reply@onsective.com',
    replyTo: process.env.EMAIL_REPLY_TO,
    to,
    subject,
    text,
    html,
  });
}
