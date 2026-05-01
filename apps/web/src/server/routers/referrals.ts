import { router, protectedProcedure } from '../trpc';
import {
  getOrMintReferralCode,
  getReferralStats,
  getCreditBalances,
} from '../auth';

export const referralsRouter = router({
  // Lazy-mints the user's code if they don't have one yet, then returns
  // both the code and the totals. One call covers the page render.
  me: protectedProcedure.query(async ({ ctx }) => {
    const [code, stats, balances] = await Promise.all([
      getOrMintReferralCode(ctx.user!.id),
      getReferralStats(ctx.user!.id),
      getCreditBalances(ctx.user!.id),
    ]);
    return { code, stats, balances };
  }),
});
