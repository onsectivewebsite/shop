/* eslint-disable no-console */
import { Worker, type Job } from 'bullmq';
import {
  EMAIL_CAMPAIGN_QUEUE_NAME,
  EMAIL_CAMPAIGN_SEND_JOB,
  getRedisConnection,
  type EmailCampaignSendJob,
} from '../src/server/queue';
import { sendCampaign } from '../src/server/workers/email-campaign';

/**
 * Long-running BullMQ worker for marketing campaigns. Run as its own
 * process:
 *
 *   pnpm --filter @onsective/web worker:email-campaign
 *
 * Concurrency is 1 — campaigns are infrequent (handful per week max) and a
 * single worker keeps SMTP connection load predictable. The bottleneck is
 * the upstream provider, not the worker.
 */

const worker = new Worker<EmailCampaignSendJob>(
  EMAIL_CAMPAIGN_QUEUE_NAME,
  async (job: Job<EmailCampaignSendJob>) => {
    if (job.name === EMAIL_CAMPAIGN_SEND_JOB) {
      const result = await sendCampaign(job.data.campaignId);
      console.log(
        `[email-campaign] ${job.data.campaignId} sent=${result.sent}/${result.attempted}, failed=${result.failed}`,
      );
      return result;
    }
    console.warn(`[email-campaign] unknown job name: ${job.name}`);
  },
  { connection: getRedisConnection(), concurrency: 1 },
);

worker.on('failed', (job, err) => {
  console.error(`[email-campaign] job ${job?.id} (${job?.data.campaignId}) failed:`, err);
});

worker.on('error', (err) => {
  console.error('[email-campaign] worker error:', err);
});

const shutdown = async (signal: string) => {
  console.log(`[email-campaign] received ${signal}, draining…`);
  await worker.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

console.log('[email-campaign] worker started, listening for jobs');
