import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Star } from 'lucide-react';
import { prisma } from '@/server/db';
import { ProductCard } from '@/components/product-card';
import { RateLimited } from '@/components/rate-limited';
import { pageReadLimit } from '@/server/page-rate-limit';

const PER_PAGE = 24;
// Price-based sort omitted on purpose — needs a raw-SQL JOIN on min variant
// price to be correct at pagination boundaries. Add it when a user asks.
type Sort = 'newest' | 'best-selling' | 'top-rated';

type Props = {
  params: { locale: string; slug: string };
  searchParams: { page?: string; sort?: string };
};

export async function generateMetadata({ params }: Props) {
  const seller = await prisma.seller.findUnique({
    where: { slug: params.slug },
    select: { displayName: true, description: true },
  });
  if (!seller) return { title: 'Seller not found' };
  return {
    title: `${seller.displayName} on Onsective`,
    description:
      seller.description ??
      `Shop products from ${seller.displayName} on Onsective.`,
  };
}

export default async function SellerStorefrontPage({ params, searchParams }: Props) {
  const limit = await pageReadLimit();
  if (!limit.ok) return <RateLimited retryAfter={limit.retryAfterSeconds} />;

  const page = Math.max(1, Number(searchParams.page ?? 1) || 1);
  const sort: Sort = parseSort(searchParams.sort);

  const seller = await prisma.seller.findUnique({
    where: { slug: params.slug },
    select: {
      id: true,
      displayName: true,
      description: true,
      logoUrl: true,
      countryCode: true,
      ratingAvg: true,
      ratingCount: true,
      status: true,
      createdAt: true,
    },
  });
  // SUSPENDED + REJECTED storefronts 404 — listings get hidden too via the
  // ACTIVE filter below, but we want the page itself to disappear so the
  // seller doesn't have a discoverable surface while sanctioned.
  if (!seller || (seller.status !== 'APPROVED' && seller.status !== 'KYC_SUBMITTED')) {
    notFound();
  }

  const where = { sellerId: seller.id, status: 'ACTIVE' as const };
  const orderBy = orderByForSort(sort);

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        variants: {
          where: { isActive: true },
          take: 1,
          orderBy: { priceAmount: 'asc' },
          select: { priceAmount: true, mrpAmount: true, currency: true },
        },
      },
      orderBy,
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.product.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const memberSince = seller.createdAt.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const buildHref = (p: number, s: Sort = sort) => {
    const sp = new URLSearchParams();
    if (p > 1) sp.set('page', String(p));
    if (s !== 'newest') sp.set('sort', s);
    const qs = sp.toString();
    return `/${params.locale}/seller/${params.slug}${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className="container-page py-8">
      <header className="rounded-lg border border-slate-200 bg-white p-6 md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          {seller.logoUrl ? (
            <div className="relative h-20 w-20 flex-none overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              <Image
                src={seller.logoUrl}
                alt={`${seller.displayName} logo`}
                fill
                sizes="80px"
                className="object-cover"
              />
            </div>
          ) : (
            <div className="flex h-20 w-20 flex-none items-center justify-center rounded-lg bg-slate-100 text-2xl font-semibold text-slate-500">
              {seller.displayName.charAt(0)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              {seller.displayName}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
              <span>From {seller.countryCode}</span>
              <span aria-hidden>·</span>
              <span>Member since {memberSince}</span>
              {seller.ratingCount > 0 && (
                <>
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Star
                      size={13}
                      strokeWidth={0}
                      fill="currentColor"
                      className="text-amber-500"
                    />
                    <span className="font-medium text-slate-700">
                      {seller.ratingAvg.toFixed(1)}
                    </span>
                    <span>({seller.ratingCount.toLocaleString()} reviews)</span>
                  </span>
                </>
              )}
              <span aria-hidden>·</span>
              <span>
                {total.toLocaleString()} product{total === 1 ? '' : 's'}
              </span>
            </div>
            {seller.description && (
              <p className="mt-4 max-w-2xl whitespace-pre-line text-sm text-slate-700">
                {seller.description}
              </p>
            )}
          </div>
        </div>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <SortPill href={buildHref(1, 'newest')} label="Newest" active={sort === 'newest'} />
        <SortPill
          href={buildHref(1, 'best-selling')}
          label="Best-selling"
          active={sort === 'best-selling'}
        />
        <SortPill
          href={buildHref(1, 'top-rated')}
          label="Top rated"
          active={sort === 'top-rated'}
        />
      </div>

      {products.length === 0 ? (
        <div className="mt-12 rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
          {seller.displayName} hasn&apos;t listed any products yet.
        </div>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {products.map((p) => (
            <li key={p.id}>
              <ProductCard
                locale={params.locale}
                product={{
                  slug: p.slug,
                  title: p.title,
                  brand: p.brand,
                  images: p.images,
                  ratingAvg: p.ratingAvg,
                  ratingCount: p.ratingCount,
                  variants: p.variants,
                }}
              />
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <nav
          aria-label="Pagination"
          className="mt-10 flex items-center justify-between border-t border-slate-200 pt-4 text-sm"
        >
          {page > 1 ? (
            <Link href={buildHref(page - 1)} className="font-medium text-brand-600 hover:underline">
              ← Previous
            </Link>
          ) : (
            <span className="text-slate-400">← Previous</span>
          )}
          <span className="text-slate-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={buildHref(page + 1)} className="font-medium text-brand-600 hover:underline">
              Next →
            </Link>
          ) : (
            <span className="text-slate-400">Next →</span>
          )}
        </nav>
      )}
    </div>
  );
}

function parseSort(value: string | undefined): Sort {
  switch (value) {
    case 'best-selling':
    case 'top-rated':
      return value;
    default:
      return 'newest';
  }
}

function orderByForSort(sort: Sort) {
  switch (sort) {
    case 'best-selling':
      return [{ salesCount: 'desc' as const }, { createdAt: 'desc' as const }];
    case 'top-rated':
      return [{ ratingAvg: 'desc' as const }, { ratingCount: 'desc' as const }];
    case 'newest':
    default:
      return [{ createdAt: 'desc' as const }];
  }
}

function SortPill({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? 'rounded-full bg-slate-900 px-4 py-1.5 text-xs font-medium text-white'
          : 'rounded-full border border-slate-300 bg-white px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50'
      }
    >
      {label}
    </Link>
  );
}
