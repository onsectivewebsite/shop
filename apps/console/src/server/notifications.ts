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
  const text = `Your Onsective password reset code is ${code}. It expires in 10 minutes.`;
  const html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #0f172a;">
    <p style="margin: 0 0 24px; font-size: 18px; font-weight: 600;">Onsective<span style="color:#f59e0b;">.</span></p>
    <h2 style="margin: 0 0 16px; font-size: 22px;">Password reset code</h2>
    <p style="font-size: 15px; line-height: 1.6; color: #334155;">Use the code below to set a new password.</p>
    <p style="font-size: 32px; font-weight: 700; letter-spacing: 0.18em; padding: 18px 28px; background: #f1f5f9; border-radius: 10px; display: inline-block; margin: 12px 0;">${code}</p>
    <p style="font-size: 13px; color: #64748b;">Expires in 10 minutes.</p>
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
