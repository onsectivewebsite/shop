/**
 * Marketing-email template registry. Each campaign references a key here;
 * the resolver returns the rendered subject + HTML + text given the recipient
 * context (userName, unsubscribe URL, etc).
 *
 * Why a registry rather than free-form HTML on the campaign row: we want
 * every marketing email to share the same chrome (header, footer, unsubscribe
 * link), and we want code review on the body before it ships to thousands
 * of inboxes. Authors choose a key in the console; copy lives here.
 */

export type CampaignContext = {
  userName: string | null;
  email: string;
  unsubscribeUrl: string;
  appUrl: string;
};

export type RenderedEmail = {
  text: string;
  html: string;
};

const FRAME = (body: string, ctx: CampaignContext): string => `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; color: #0f172a;">
    <p style="margin: 0 0 24px; font-size: 18px; font-weight: 600; letter-spacing: -0.01em;">
      Onsective<span style="color:#f59e0b;">.</span>
    </p>
    <div style="font-size: 15px; line-height: 1.6; color: #334155;">${body}</div>
    <hr style="margin: 32px 0; border: 0; border-top: 1px solid #e2e8f0;" />
    <p style="font-size: 11px; color: #94a3b8;">
      You're receiving this because you have an Onsective account. Don't want
      these emails? <a href="${ctx.unsubscribeUrl}" style="color:#475569;">Unsubscribe in one click</a>.
      Order updates and security alerts are sent regardless.
    </p>
  </div>
`;

const TEMPLATES: Record<string, (ctx: CampaignContext) => RenderedEmail> = {
  // Generic announcement — used when the console doesn't pick a more specific
  // template. Subject + body are passed through from the campaign row by the
  // worker before this fires; the template just frames the text.
  announcement: (ctx) => {
    const greet = ctx.userName ? `Hi ${ctx.userName.split(' ')[0]},` : 'Hi,';
    const text =
      `${greet}\n\n` +
      `We've got something new on Onsective worth your time. Open the marketplace to take a look:\n` +
      `${ctx.appUrl}\n\n` +
      `Unsubscribe: ${ctx.unsubscribeUrl}`;
    const body = `
      <p>${greet}</p>
      <p>We've got something new on Onsective worth your time.</p>
      <p style="margin: 16px 0;">
        <a href="${ctx.appUrl}" style="display:inline-block;background:#0f172a;color:white;padding:12px 20px;border-radius:9999px;text-decoration:none;font-weight:600;font-size:14px;">
          Visit Onsective
        </a>
      </p>
    `;
    return { text, html: FRAME(body, ctx) };
  },

  // Re-engagement: target users who haven't ordered in N days. Pairs with
  // an audienceQuery like { noOrderInLastDays: 90 }.
  winback: (ctx) => {
    const greet = ctx.userName ? `${ctx.userName.split(' ')[0]},` : 'Hi,';
    const text =
      `${greet} we miss you.\n\n` +
      `Sellers have shipped thousands of new arrivals since your last order. Take a look — we'll keep your wishlist where you left it: ${ctx.appUrl}\n\n` +
      `Unsubscribe: ${ctx.unsubscribeUrl}`;
    const body = `
      <p style="font-size: 18px; font-weight: 600;">${greet} we miss you.</p>
      <p>Sellers have shipped thousands of new arrivals since your last order. Your wishlist's still where you left it.</p>
      <p style="margin: 16px 0;">
        <a href="${ctx.appUrl}" style="display:inline-block;background:#0f172a;color:white;padding:12px 20px;border-radius:9999px;text-decoration:none;font-weight:600;font-size:14px;">
          See what's new
        </a>
      </p>
    `;
    return { text, html: FRAME(body, ctx) };
  },
};

export const TEMPLATE_KEYS = Object.keys(TEMPLATES);

export function renderCampaignEmail(
  templateKey: string,
  ctx: CampaignContext,
): RenderedEmail {
  const fn = TEMPLATES[templateKey];
  if (!fn) {
    throw new Error(`Unknown email template: ${templateKey}`);
  }
  return fn(ctx);
}
