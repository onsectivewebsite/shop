import { z } from 'zod';
import type { Prisma } from '@onsective/db';

/**
 * Declarative audience definition. Compiled to a Prisma where clause at send
 * time so the segment can be re-resolved (a campaign scheduled for next
 * Tuesday picks up users who joined in between authoring and send).
 *
 * Keep this tight on purpose — every clause we add is one more thing the
 * console UI has to expose and one more way an unintended audience can ship.
 * Add fields when there's a real campaign that needs them.
 */
export const audienceQuerySchema = z.object({
  // Match every opted-in user. Mutually exclusive with the other filters at
  // a UI level; backend ANDs everything that's set.
  all: z.boolean().optional(),
  // ISO country code: 'US', 'IN', etc.
  country: z.string().length(2).toUpperCase().optional(),
  // Joined the marketplace at most N days ago.
  joinedWithinDays: z.number().int().min(1).max(3650).optional(),
  // Joined more than N days ago — used for re-engagement series targeting
  // longer-tenured users.
  joinedBeforeDays: z.number().int().min(1).max(3650).optional(),
  // Placed at least one paid order in the last N days. The Order side is
  // expressed via a relation predicate so a buyer with multiple orders only
  // counts once.
  placedOrderInLastDays: z.number().int().min(1).max(365).optional(),
  // No paid order in the last N days — the lapse window for win-backs.
  noOrderInLastDays: z.number().int().min(1).max(3650).optional(),
  // Active Prime members only.
  isPrime: z.boolean().optional(),
});

export type AudienceQuery = z.infer<typeof audienceQuerySchema>;

const PAID_ORDER_STATUSES = [
  'PAID',
  'CONFIRMED',
  'PARTIALLY_SHIPPED',
  'SHIPPED',
  'PARTIALLY_DELIVERED',
  'DELIVERED',
  'COMPLETED',
] as const;

/**
 * Compile an AudienceQuery into a Prisma User.where clause. The clause
 * always pins:
 *   - emailMarketingOptIn: true (consent gate, non-negotiable)
 *   - status: ACTIVE (don't email DELETED or SUSPENDED accounts)
 *   - emailVerified: not null (don't email unverified throwaways)
 */
export function compileAudience(query: AudienceQuery): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {
    emailMarketingOptIn: true,
    status: 'ACTIVE',
    emailVerified: { not: null },
  };

  if (query.country) {
    where.countryCode = query.country;
  }

  const now = Date.now();
  if (query.joinedWithinDays) {
    const since = new Date(now - query.joinedWithinDays * 24 * 60 * 60 * 1000);
    where.createdAt = { ...(where.createdAt as object | undefined), gte: since };
  }
  if (query.joinedBeforeDays) {
    const before = new Date(now - query.joinedBeforeDays * 24 * 60 * 60 * 1000);
    where.createdAt = { ...(where.createdAt as object | undefined), lte: before };
  }

  if (query.placedOrderInLastDays) {
    const since = new Date(now - query.placedOrderInLastDays * 24 * 60 * 60 * 1000);
    where.orders = {
      some: {
        status: { in: [...PAID_ORDER_STATUSES] },
        placedAt: { gte: since },
      },
    };
  }

  if (query.noOrderInLastDays) {
    const since = new Date(now - query.noOrderInLastDays * 24 * 60 * 60 * 1000);
    where.orders = {
      ...(where.orders as object | undefined),
      none: {
        status: { in: [...PAID_ORDER_STATUSES] },
        placedAt: { gte: since },
      },
    };
  }

  if (query.isPrime) {
    where.primeMembership = {
      status: 'ACTIVE',
      currentPeriodEnd: { gt: new Date() },
    };
  }

  return where;
}
