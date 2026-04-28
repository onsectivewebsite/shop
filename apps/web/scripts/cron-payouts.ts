/* eslint-disable no-console */
import {
  PAYOUTS_SWEEP_JOB,
  payoutsQueue,
  getRedisConnection,
} from '../src/server/queue';

/**
 * Registers (or refreshes) the hourly repeatable sweep job. Run once at boot
 * and any time the schedule changes — fixed jobId makes it idempotent.
 *
 *   pnpm --filter @onsective/web cron:payouts
 */

async function main() {
  const queue = payoutsQueue();
  const repeatJobId = 'sweep-cron';

  // Drop any existing repeatable with the same id so a schedule change takes effect.
  const existing = await queue.getRepeatableJobs();
  for (const r of existing) {
    if (r.id === repeatJobId) {
      await queue.removeRepeatableByKey(r.key);
    }
  }

  await queue.add(
    PAYOUTS_SWEEP_JOB,
    {},
    {
      repeat: { pattern: '0 * * * *' }, // top of every hour, UTC
      jobId: repeatJobId,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    },
  );

  console.log('[payouts] hourly sweep scheduled');
  await queue.close();
  await getRedisConnection().quit();
}

main().catch((err) => {
  console.error('[payouts] failed to schedule cron:', err);
  process.exit(1);
});
