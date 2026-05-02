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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Notify the buyer that the seller sent a new message. Mirrors the buyer-app
 * helper of the same name; lives here so the seller-side send path doesn't
 * need to cross app boundaries to dispatch mail.
 */
export async function sendNewMessageEmail(
  to: string,
  meta: {
    senderName: string;
    productTitle: string;
    orderNumber: string;
    bodyPreview: string;
    threadUrl: string;
  },
): Promise<void> {
  const preview =
    meta.bodyPreview.length > 280
      ? `${meta.bodyPreview.slice(0, 280).trim()}…`
      : meta.bodyPreview;

  await send({
    to,
    subject: `${meta.senderName} sent you a message about ${meta.productTitle}`,
    text:
      `${meta.senderName} sent you a new message about ${meta.productTitle} ` +
      `(order ${meta.orderNumber}):\n\n` +
      `${preview}\n\n` +
      `Open the conversation: ${meta.threadUrl}`,
    html: shell(
      `New message from ${escapeHtml(meta.senderName)}`,
      `<p style="font-size: 13px; color: #64748b;">About ${escapeHtml(meta.productTitle)} · order ${escapeHtml(meta.orderNumber)}</p>
       <blockquote style="margin: 16px 0; padding: 12px 16px; background: #f1f5f9; border-left: 3px solid #cbd5e1; font-size: 14px; color: #334155; white-space: pre-line;">${escapeHtml(preview)}</blockquote>
       <p style="margin: 20px 0;"><a href="${meta.threadUrl}" style="display:inline-block;background:#0f172a;color:white;padding:12px 20px;border-radius:9999px;text-decoration:none;font-weight:600;font-size:14px;">Open conversation</a></p>
       <p style="font-size: 12px; color: #94a3b8;">Reply directly in the conversation — replies to this email aren't read.</p>`,
    ),
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
