import Link from 'next/link';
import { prisma } from '@/server/db';
import { ProductCard } from '@/components/product-card';

const SLOT_COUNT = 6;

/**
 * "More from {seller}" rail on the PDP. Closes the discovery loop with the
 * public seller storefront — buyer can either browse a curated row inline
 * or jump to the full storefront via the "View store →" link in the header.
 *
 * Sorted by salesCount so popular items lead. Quietly renders nothing when
 * the seller only has the host product listed.
 */
export async function MoreFromSeller({
  locale,
  sellerId,
  sellerSlug,
  sellerName,
  excludeId,
}: {
  locale: string;
  sellerId: string;
  sellerSlug: string;
  sellerName: string;
  excludeId: string;
}) {
  const products = await prisma.product.findMany({
    where: {
      sellerId,
      status: 'ACTIVE',
      NOT: { id: excludeId },
    },
    orderBy: [{ salesCount: 'desc' }, { createdAt: 'desc' }],
    take: SLOT_COUNT,
    select: {
      id: true,
      slug: true,
      title: true,
      brand: true,
      images: true,
      ratingAvg: true,
      ratingCount: true,
      variants: {
        where: { isActive: true },
        orderBy: { priceAmount: 'asc' },
        take: 1,
        select: { priceAmount: true, mrpAmount: true, currency: true },
      },
    },
  });

  if (products.length === 0) return null;

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">
          More from {sellerName}
        </h2>
        <Link
          href={`/${locale}/seller/${sellerSlug}`}
          className="text-sm font-medium text-brand-600 hover:underline"
        >
          View store →
        </Link>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {products.map((p) => (
          <li key={p.id}>
            <ProductCard locale={locale} product={p} />
          </li>
        ))}
      </ul>
    </section>
  );
}
