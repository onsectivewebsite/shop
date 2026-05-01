/* eslint-disable no-console */
import { prisma } from '../src/server/db';
import {
  emailCampaignQueue,
  EMAIL_CAMPAIGN_SEND_JOB,
  getRedisConnection,
} from '../src/server/queue';

/**
 * Scheduler. Picks SCHEDULED campaigns whose `scheduledFor` has arrived and
 * adds them to the BullMQ send queue. The worker handles the actual SMTP
 * dispatch and flips status to SENDING/SENT.
 *
 *   pnpm --filter @onsective/web cron:email-campaigns
 *
 * Run minutely from system cron / pm2-cron — the BullMQ jobId is stable per
 * campaign so a re-run before the worker pulls the job is harmless.
 */

async function main() {
  const due = await prisma.emailCampaign.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledFor: { lte: new Date() },
    },
    select: { id: true },
    take: 50,
  });

  if (due.length === 0) {
    console.log('[email-campaigns] nothing due');
    return;
  }

  const queue = emailCampaignQueue();
  for (const c of due) {
    await queue.add(
      EMAIL_CAMPAIGN_SEND_JOB,
      { campaignId: c.id },
      {
        // Stable id keeps replays idempotent against the queue itself; the
        // worker does its own DRAFT/SCHEDULED → SENDING gate against the DB.
        jobId: `email-campaign:${c.id}`,
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
        attempts: 1,
      },
    );
  }

  console.log(`[email-campaigns] enqueued ${due.length} campaigns`);
  await queue.close();
  await getRedisConnection().quit();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[email-campaigns] failed:', err);
    process.exit(1);
  });
