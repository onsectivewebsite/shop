import { router } from '../trpc';
import { authRouter } from './auth';
import { meRouter } from './me';
import { catalogRouter } from './catalog';
import { cartRouter } from './cart';
import { checkoutRouter } from './checkout';
import { orderRouter } from './order';
import { adminRouter } from './admin';
import { primeRouter } from './prime';
import { adsRouter } from './ads';
import { returnsRouter } from './returns';
import { organizationsRouter } from './organizations';
import { reviewsRouter } from './reviews';
import { qaRouter } from './qa';
import { referralsRouter } from './referrals';
import { messagesRouter } from './messages';
import { supportRouter } from './support';

// Seller-side surface lives in apps/seller (REST routes at
// /api/seller/* on seller.itsnottechy.cloud). The buyer app no longer
// proxies seller mutations.

export const appRouter = router({
  auth: authRouter,
  me: meRouter,
  catalog: catalogRouter,
  cart: cartRouter,
  checkout: checkoutRouter,
  order: orderRouter,
  admin: adminRouter,
  prime: primeRouter,
  ads: adsRouter,
  returns: returnsRouter,
  organizations: organizationsRouter,
  reviews: reviewsRouter,
  qa: qaRouter,
  referrals: referralsRouter,
  messages: messagesRouter,
  support: supportRouter,
});

export type AppRouter = typeof appRouter;
