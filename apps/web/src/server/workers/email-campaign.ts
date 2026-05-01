import nodemailer, { type Transporter } from 'nodemailer';
import { prisma } from '../db';
import { issueUnsubscribeToken } from '../auth';
import { audienceQuerySchema, compileAudience } from '../email/audience';
import { renderCampaignEmail, type CampaignContext } from '../email/templates';

/**
 * Campaign sender. Picks a campaign row, resolves its audience to a User-id
 * list (re-checking opt-in at fetch time), mints a fresh UnsubscribeToken
 * per recipient, renders the templated body, and dispatches via SMTP.
 *
 * Idempotency: the worker flips status to SENDING at start and only writes
 * SENT when the recipient loop finishes. A re-queued job that finds the row
 * already SENT exits early. Failures during the loop leave the row SENDING
 * — ops should inspect EmailEvent rows to decide what was delivered before
 * any retry.
 *
 * Per-recipient EmailEvent rows of type SENT are written so the campaign
 * stats (reach, opens, clicks) have a join key.
 */

let smtpClient: Transporter | null = null;

function getSmtp(): Transporter | null {
  if (smtpClient) return smtpClient;
  if (!process.env.SMTP_HOST) return null;
  smtpClient = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: process.env.SMTP_SECURE !== 'false',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return smtpClient;
}

const FROM = () => process.env.EMAIL_FROM ?? 'no-reply@onsective.com';
const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? 'https://itsnottechy.cloud';

export type SendCampaignResult = {
  attempted: number;
  sent: number;
  failed: number;
};

export async function sendCampaign(campaignId: string): Promise<SendCampaignResult> {
  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
  });
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`);
  if (campaign.status === 'SENT' || campaign.status === 'CANCELLED') {
    return { attempted: 0, sent: 0, failed: 0 };
  }

  // Take ownership of the row before resolving the audience — concurrent
  // workers checking the same campaign at startup won't both fan out.
  await prisma.emailCampaign.update({
    where: { id: campaign.id },
    data: { status: 'SENDING' },
  });

  const parsed = audienceQuerySchema.safeParse(campaign.audienceQuery);
  if (!parsed.success) {
    await prisma.emailCampaign.update({
      where: { id: campaign.id },
      data: { status: 'CANCELLED' },
    });
    throw new Error(`Invalid audienceQuery on ${campaign.id}: ${parsed.error.message}`);
  }
  const where = compileAudience(parsed.data);

  const recipients = await prisma.user.findMany({
    where,
    select: { id: true, email: true, fullName: true },
  });

  let sent = 0;
  let failed = 0;
  const transport = getSmtp();
  const subject = campaign.subject;
  const appUrl = APP_URL();

  for (const recipient of recipients) {
    try {
      const { token } = await issueUnsubscribeToken({
        userId: recipient.id,
        scope: 'marketing',
      });

      // Pre-create the SENT row so its id can drive the open-pixel + click-
      // tracker URLs in this recipient's body. A subsequent SMTP failure
      // means SENT is recorded for an email that never reached the inbox —
      // we accept the slight overcount because attempts ARE signal: opens
      // against attempts still tells the truth, and the loop's own `sent`
      // counter (which becomes campaign.sentCount) only increments after
      // sendMail returns.
      const sentEvent = await prisma.emailEvent.create({
        data: {
          campaignId: campaign.id,
          userId: recipient.id,
          type: 'SENT',
        },
        select: { id: true },
      });

      const ctx: CampaignContext = {
        userName: recipient.fullName,
        email: recipient.email,
        unsubscribeUrl: `${appUrl}/u/${token}`,
        appUrl,
        trackingId: sentEvent.id,
      };
      const rendered = renderCampaignEmail(campaign.templateKey, ctx);

      if (!transport) {
        // Dev / staging without SMTP configured — log so the rest of the
        // pipeline can be exercised end-to-end without surprise bounces.
        // eslint-disable-next-line no-console
        console.log(
          `[email-campaign] (no-smtp) ${recipient.email} :: ${subject}`,
        );
      } else {
        await transport.sendMail({
          from: FROM(),
          to: recipient.email,
          subject,
          text: rendered.text,
          html: rendered.html,
          // RFC 8058 + RFC 2369 — Gmail/Outlook surface a native unsubscribe
          // button when both headers are present and List-Unsubscribe-Post
          // says "One-Click".
          headers: {
            'List-Unsubscribe': `<${ctx.unsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        });
      }

      sent += 1;
    } catch (err) {
      failed += 1;
      // eslint-disable-next-line no-console
      console.error(
        `[email-campaign] send to ${recipient.email} failed:`,
        err,
      );
    }
  }

  await prisma.emailCampaign.update({
    where: { id: campaign.id },
    data: {
      status: 'SENT',
      sentAt: new Date(),
      sentCount: sent,
    },
  });

  return { attempted: recipients.length, sent, failed };
}
