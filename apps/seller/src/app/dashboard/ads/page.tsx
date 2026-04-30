import { redirect } from 'next/navigation';
import { getSellerSession } from '@/server/auth';
import { prisma } from '@/server/db';
import { SellerShell } from '@/components/seller-shell';
import { AdsList, type SellerAdRow } from '@/components/ads-list';
import { NewCampaignForm } from '@/components/new-campaign-form';

export const metadata = { title: 'Sponsored ads' };
export const dynamic = 'force-dynamic';

const STATS_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;

export default async function AdsPage() {
  const session = await getSellerSession();
  if (!session) redirect('/login');

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    select: { id: true, status: true },
  });
  if (!seller) redirect('/apply');

  const since = new Date(Date.now() - STATS_LOOKBACK_MS);

  const [campaigns, products] = await Promise.all([
    prisma.adCampaign.findMany({
      where: { sellerId: seller.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        product: { select: { title: true, slug: true } },
      },
    }),
    prisma.product.findMany({
      where: { sellerId: seller.id, status: 'ACTIVE' },
      select: { id: true, title: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  // Fan out impression + click counts for all campaigns in two grouped queries
  // — avoids one round-trip per campaign.
  const ids = campaigns.map((c) => c.id);
  const [imprAgg, clickAgg] = await Promise.all([
    ids.length
      ? prisma.adImpression.groupBy({
          by: ['campaignId'],
          where: { campaignId: { in: ids }, occurredAt: { gte: since } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    ids.length
      ? prisma.adClick.groupBy({
          by: ['campaignId'],
          where: {
            campaignId: { in: ids },
            occurredAt: { gte: since },
            // Filtered (bot) clicks shouldn't show in seller-facing stats.
            filtered: false,
          },
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ]);
  const imprBy = new Map(imprAgg.map((g) => [g.campaignId, g._count._all]));
  const clickBy = new Map(clickAgg.map((g) => [g.campaignId, g._count._all]));

  const rows: SellerAdRow[] = campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    placement: c.placement,
    productTitle: c.product.title,
    productSlug: c.product.slug,
    bidCpcMinor: c.bidCpcMinor,
    dailyBudgetMinor: c.dailyBudgetMinor,
    totalBudgetMinor: c.totalBudgetMinor,
    spentTodayMinor: c.spentTodayMinor,
    spentTotalMinor: c.spentTotalMinor,
    currency: c.currency,
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    keywords: c.keywords,
    impressions: imprBy.get(c.id) ?? 0,
    clicks: clickBy.get(c.id) ?? 0,
  }));

  // Pick the seller's most-used currency as the form default. Falls back to
  // USD when there are no campaigns yet.
  const currencyCounts = campaigns.reduce<Record<string, number>>((acc, c) => {
    acc[c.currency] = (acc[c.currency] ?? 0) + 1;
    return acc;
  }, {});
  const defaultCurrency = Object.keys(currencyCounts).sort(
    (a, b) => (currencyCounts[b] ?? 0) - (currencyCounts[a] ?? 0),
  )[0] ?? 'USD';

  return (
    <SellerShell email={session.user.email} name={session.user.fullName ?? undefined}>
      <div className="container-page py-10 md:py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-stone-500">
              Promote your storefront
            </p>
            <h1 className="mt-3 font-display text-4xl font-medium leading-tight tracking-tight text-stone-950">
              Sponsored ads
            </h1>
            <p className="mt-2 max-w-xl text-sm text-stone-600">
              Bid CPC against competitors on search and category pages. You only pay
              for clicks. Onsective filters bots before billing — flagged clicks
              don't count against your spend.
            </p>
          </div>
          <NewCampaignForm
            products={products}
            defaultCurrency={defaultCurrency}
          />
        </div>

        {seller.status !== 'APPROVED' && (
          <p className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Your seller account is still under review. You can draft campaigns once
            you're approved.
          </p>
        )}

        <div className="mt-8">
          <AdsList campaigns={rows} />
        </div>
      </div>
    </SellerShell>
  );
}
