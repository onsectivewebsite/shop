'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@onsective/db';
import { getConsoleSession } from '@/server/auth';
import { audit } from '@/lib/audit';

const TEMPLATE_KEYS = ['announcement', 'winback'] as const;

// Mirror of apps/web/src/server/email/audience.ts. Kept in sync by hand for
// now — small enough that schema duplication beats a cross-app shared
// package. If this drifts the worker's parser will reject the row at send.
const audienceQuerySchema = z.object({
  all: z.boolean().optional(),
  country: z.string().length(2).toUpperCase().optional(),
  joinedWithinDays: z.number().int().min(1).max(3650).optional(),
  joinedBeforeDays: z.number().int().min(1).max(3650).optional(),
  placedOrderInLastDays: z.number().int().min(1).max(365).optional(),
  noOrderInLastDays: z.number().int().min(1).max(3650).optional(),
  isPrime: z.boolean().optional(),
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  subject: z.string().trim().min(1).max(180),
  templateKey: z.enum(TEMPLATE_KEYS),
  audience: audienceQuerySchema,
  scheduledFor: z.coerce.date().nullable(),
});

export async function createCampaignAction(input: unknown): Promise<{ id: string }> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? 'Invalid campaign');
  }
  const data = parsed.data;
  const status = data.scheduledFor ? 'SCHEDULED' : 'DRAFT';

  const created = await prisma.emailCampaign.create({
    data: {
      name: data.name,
      subject: data.subject,
      templateKey: data.templateKey,
      audienceQuery: data.audience,
      scheduledFor: data.scheduledFor,
      status,
      createdById: session.user.id,
    },
    select: { id: true },
  });

  await audit({
    actorId: session.user.id,
    action: 'email.campaign.create',
    targetType: 'emailCampaign',
    targetId: created.id,
    metadata: {
      templateKey: data.templateKey,
      status,
      scheduledFor: data.scheduledFor?.toISOString() ?? null,
    },
  });

  revalidatePath('/dashboard/campaigns');
  return { id: created.id };
}

/**
 * Flip an existing DRAFT to SCHEDULED with `scheduledFor=now` so the cron
 * picks it up on the next tick. We don't enqueue directly from the console
 * (the BullMQ producer lives in the web app to keep Redis ownership in one
 * place); the worst-case wait is one cron interval.
 */
export async function sendNowAction(campaignId: string): Promise<void> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');

  const updated = await prisma.emailCampaign.updateMany({
    where: { id: campaignId, status: { in: ['DRAFT', 'SCHEDULED'] } },
    data: { status: 'SCHEDULED', scheduledFor: new Date() },
  });
  if (updated.count === 0) {
    throw new Error('Campaign cannot be sent from its current state.');
  }

  await audit({
    actorId: session.user.id,
    action: 'email.campaign.send_now',
    targetType: 'emailCampaign',
    targetId: campaignId,
  });

  revalidatePath('/dashboard/campaigns');
}

export async function cancelCampaignAction(campaignId: string): Promise<void> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');

  const updated = await prisma.emailCampaign.updateMany({
    where: { id: campaignId, status: { in: ['DRAFT', 'SCHEDULED'] } },
    data: { status: 'CANCELLED' },
  });
  if (updated.count === 0) {
    throw new Error('Campaign already past the cancel window.');
  }

  await audit({
    actorId: session.user.id,
    action: 'email.campaign.cancel',
    targetType: 'emailCampaign',
    targetId: campaignId,
  });

  revalidatePath('/dashboard/campaigns');
}

/**
 * Audience size preview. Re-runs the same compileAudience contract as the
 * worker (consent gate + ACTIVE + verified email) so what the author sees
 * here matches what actually gets sent.
 */
export async function previewAudienceAction(
  audience: unknown,
): Promise<{ size: number }> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');

  const parsed = audienceQuerySchema.safeParse(audience);
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? 'Invalid audience');
  }
  const q = parsed.data;
  const now = Date.now();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    emailMarketingOptIn: true,
    status: 'ACTIVE',
    emailVerified: { not: null },
  };
  if (q.country) where.countryCode = q.country;
  if (q.joinedWithinDays) {
    where.createdAt = { ...where.createdAt, gte: new Date(now - q.joinedWithinDays * 86_400_000) };
  }
  if (q.joinedBeforeDays) {
    where.createdAt = { ...where.createdAt, lte: new Date(now - q.joinedBeforeDays * 86_400_000) };
  }
  const PAID = ['PAID', 'CONFIRMED', 'PARTIALLY_SHIPPED', 'SHIPPED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'COMPLETED'];
  if (q.placedOrderInLastDays) {
    where.orders = {
      some: {
        status: { in: PAID },
        placedAt: { gte: new Date(now - q.placedOrderInLastDays * 86_400_000) },
      },
    };
  }
  if (q.noOrderInLastDays) {
    where.orders = {
      ...where.orders,
      none: {
        status: { in: PAID },
        placedAt: { gte: new Date(now - q.noOrderInLastDays * 86_400_000) },
      },
    };
  }
  if (q.isPrime) {
    where.primeMembership = {
      status: 'ACTIVE',
      currentPeriodEnd: { gt: new Date() },
    };
  }

  const size = await prisma.user.count({ where });
  return { size };
}
