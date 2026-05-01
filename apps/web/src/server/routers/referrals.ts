import { router, protectedProcedure } from '../trpc';
import { getOrMintReferralCode, getReferralStats } from '../auth';

export const referralsRouter = router({
  // Lazy-mints the user's code if they don't have one yet, then returns
  // both the code and the totals. One call covers the page render.
  me: protectedProcedure.query(async ({ ctx }) => {
    const code = await getOrMintReferralCode(ctx.user!.id);
    const stats = await getReferralStats(ctx.user!.id);
    return { code, stats };
  }),
});
