/* eslint-disable no-console */
import { prisma } from '../src/server/db';

/**
 * Resets per-campaign daily ad spend at the start of a UTC day. Call hourly
 * (cheap query) and only zero out rows whose `spentTodayResetAt` is older
 * than the current UTC midnight — idempotent so multiple invocations in the
 * same day don't double-reset.
 *
 *   pnpm --filter @onsective/web cron:ads-reset
 *
 * Wire this into BullMQ's repeatable jobs the same way as cron:payouts when
 * the rollout is finalized.
 */

async function main() {
  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  const result = await prisma.adCampaign.updateMany({
    where: {
      OR: [{ spentTodayResetAt: null }, { spentTodayResetAt: { lt: todayUtc } }],
    },
    data: {
      spentTodayMinor: 0,
      spentTodayResetAt: todayUtc,
      // Reactivate campaigns that were EXHAUSTED yesterday — they get a
      // fresh budget today.
      status: 'ACTIVE',
    },
  });

  console.log(`[ads-reset] reset ${result.count} campaigns at ${todayUtc.toISOString()}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[ads-reset] failed:', err);
    process.exit(1);
  });
