import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getSession } from '@/server/auth/session';
import { prisma } from '@/server/db';
import { BuyAgainGrid, type BuyAgainItem } from '@/components/account/buy-again-grid';

export const metadata = { title: 'Buy again' };
export const dynamic = 'force-dynamic';

const TERMINAL_OK = ['PAID', 'CONFIRMED', 'PARTIALLY_SHIPPED', 'SHIPPED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'COMPLETED'] as const;

export default async function BuyAgainPage({
  params,
}: {
  params: { locale: string };
}) {
  const session = await getSession();
  if (!session) redirect(`/${params.locale}/login`);

  // Pull every paid OrderItem the user owns. We then dedupe by variantId on
  // the way out — same SKU bought twice shows once, with `timesBought` = 2.
  // Limit raw rows so a power user with hundreds of orders doesn't blow up
  // the page; the surface tops out around 36 unique variants.
  const rows = await prisma.orderItem.findMany({
    where: {
      order: { buyerId: session.user.id },
      status: { in: [...TERMINAL_OK] },
      // Only show items still listable. Variant filter via the relation
      // keeps the join one query rather than a fan-out.
      variant: {
        isActive: true,
        product: { status: 'ACTIVE' },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      variantId: true,
      variantTitle: true,
      unitPrice: true,
      createdAt: true,
      variant: {
        select: {
          stockQty: true,
          reservedQty: true,
          currency: true,
          product: {
            select: {
              id: true,
              slug: true,
              title: true,
              images: true,
            },
          },
        },
      },
    },
  });

  // Group by variant: last-bought date wins for sort order; count = times.
  const byVariant = new Map<string, BuyAgainItem>();
  for (const r of rows) {
    const existing = byVariant.get(r.variantId);
    if (existing) {
      existing.timesBought += 1;
      // Already sorted desc by createdAt — first match is the most recent.
      continue;
    }
    byVariant.set(r.variantId, {
      productId: r.variant.product.id,
      productSlug: r.variant.product.slug,
      productTitle: r.variant.product.title,
      productImage: r.variant.product.images[0] ?? null,
      variantId: r.variantId,
      variantTitle: r.variantTitle,
      priceAmount: r.unitPrice,
      currency: r.variant.currency,
      stockQty: r.variant.stockQty,
      reservedQty: r.variant.reservedQty,
      lastBoughtAt: r.createdAt,
      timesBought: 1,
    });
  }
  const items = Array.from(byVariant.values()).slice(0, 36);

  return (
    <div className="container-page py-12 md:py-16">
      <Link
        href={`/${params.locale}/account`}
        className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900"
      >
        <ArrowLeft size={14} /> Back to account
      </Link>

      <header className="mt-4">
        <h1 className="font-display text-4xl font-medium tracking-tight text-stone-950 md:text-5xl">
          Buy again
        </h1>
        <p className="mt-2 text-sm text-stone-600">
          Things you've ordered before, ready to re-order in one tap.
        </p>
      </header>

      <div className="mt-10">
        <BuyAgainGrid locale={params.locale} items={items} />
      </div>
    </div>
  );
}
