import { prisma } from '@/server/db';
import { SponsoredCard } from '@/components/sponsored-card';

const SLOT_COUNT = 4;

/**
 * "Sponsored related products" rail on the PDP. Server-rendered slate
 * matched on the host product's category (cheap proxy for relevance until
 * we have proper embedding similarity). Excludes the host product itself.
 */
export async function RelatedAds({
  locale,
  productId,
  categoryId,
}: {
  locale: string;
  productId: string;
  categoryId: string;
}) {
  const now = new Date();
  const candidates = await prisma.adCampaign.findMany({
    where: {
      status: 'ACTIVE',
      placement: 'PDP_RELATED',
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      product: { categoryId, NOT: { id: productId } },
    },
    include: {
      product: {
        select: {
          id: true,
          slug: true,
          title: true,
          brand: true,
          images: true,
          variants: {
            where: { isActive: true },
            orderBy: { priceAmount: 'asc' },
            take: 1,
            select: { priceAmount: true, mrpAmount: true, currency: true },
          },
        },
      },
    },
    orderBy: { bidCpcMinor: 'desc' },
    take: 50,
  });

  const slots = candidates
    .filter((c) => c.spentTodayMinor < c.dailyBudgetMinor)
    .filter((c) => !c.totalBudgetMinor || c.spentTotalMinor < c.totalBudgetMinor)
    .slice(0, SLOT_COUNT);

  if (slots.length === 0) return null;

  return (
    <section className="mt-12">
      <h2 className="text-lg font-semibold text-slate-900">You might also like</h2>
      <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {slots.map((s) => (
          <li key={s.id}>
            <SponsoredCard
              campaignId={s.id}
              placement="PDP_RELATED"
              locale={locale}
              product={s.product}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
