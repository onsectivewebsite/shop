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

const FROM = () => process.env.EMAIL_FROM ?? 'no-reply@onsective.com';
const REPLY_TO = () => process.env.EMAIL_REPLY_TO;

function shell(title: string, body: string): string {
  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #0f172a;">
    <p style="margin: 0 0 24px; font-size: 18px; font-weight: 600;">Onsective<span style="color:#10b981;"> Sellers</span></p>
    <h2 style="margin: 0 0 16px; font-size: 22px;">${title}</h2>
    <div style="font-size: 15px; line-height: 1.6; color: #334155;">${body}</div>
  </div>`;
}

async function send(opts: { to: string; subject: string; text: string; html: string }) {
  const t = getTransporter();
  if (!t) {
    // eslint-disable-next-line no-console
    console.log(`[email→${opts.to}] ${opts.subject}: ${opts.text}`);
    return;
  }
  await t.sendMail({
    from: FROM(),
    replyTo: REPLY_TO(),
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
}

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  await send({
    to,
    subject: 'Your Onsective verification code',
    text: `Your code is ${code}. It expires in 10 minutes.`,
    html: shell(
      'Verification code',
      `<p>Use the code below to continue.</p><p style="font-size:32px;font-weight:700;letter-spacing:0.18em;padding:18px 28px;background:#f1f5f9;border-radius:10px;display:inline-block;margin:12px 0;">${code}</p><p style="font-size:13px;color:#64748b;">Expires in 10 minutes.</p>`,
    ),
  });
}
