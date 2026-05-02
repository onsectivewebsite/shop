import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@onsective/ui';
import { prisma } from '@/server/db';
import { getSession } from '@/server/auth/session';
import { ProductGallery } from '@/components/product/gallery';
import { Buybox, type BuyboxVariant } from '@/components/product/buybox';
import { RelatedAds } from '@/components/product/related-ads';
import { WishlistHeart } from '@/components/wishlist-heart';
import { ReviewsSection } from '@/components/product/reviews-section';
import { QASection } from '@/components/product/qa-section';
import { RecentlyViewedTracker } from '@/components/recently-viewed-tracker';
import { RecentlyViewedRow } from '@/components/recently-viewed-row';
import { MoreFromSeller } from '@/components/product/more-from-seller';
import { isOnVacation } from '@/server/vacation';
import { RateLimited } from '@/components/rate-limited';
import { pageReadLimit } from '@/server/page-rate-limit';

type Props = { params: { locale: string; slug: string } };

export async function generateMetadata({ params }: Props) {
  const product = await prisma.product.findUnique({
    where: { slug: params.slug },
    select: { title: true, brand: true, description: true },
  });
  if (!product) return { title: 'Product not found' };
  return {
    title: product.brand ? `${product.title} — ${product.brand}` : product.title,
    description: product.description.slice(0, 160),
  };
}

export default async function ProductPage({ params }: Props) {
  const limit = await pageReadLimit();
  if (!limit.ok) return <RateLimited retryAfter={limit.retryAfterSeconds} />;

  const product = await prisma.product.findUnique({
    where: { slug: params.slug },
    include: {
      variants: {
        where: { isActive: true },
        select: {
          id: true,
          title: true,
          sku: true,
          priceAmount: true,
          mrpAmount: true,
          currency: true,
          stockQty: true,
          reservedQty: true,
        },
      },
      seller: {
        select: {
          id: true,
          displayName: true,
          slug: true,
          ratingAvg: true,
          ratingCount: true,
          vacationMode: true,
          vacationMessage: true,
          vacationUntil: true,
        },
      },
      category: { select: { slug: true, name: true } },
    },
  });

  if (!product || product.status !== 'ACTIVE') notFound();
  if (product.variants.length === 0) notFound();

  const variants: BuyboxVariant[] = product.variants;

  // Load saved-state for the wishlist heart so the SSR matches the user's state.
  const session = await getSession();
  const savedToWishlist = session
    ? Boolean(
        await prisma.wishlistItem.findUnique({
          where: { userId_productId: { userId: session.user.id, productId: product.id } },
          select: { id: true },
        }),
      )
    : false;

  return (
    <div className="container-page py-8">
      <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href={`/${params.locale}`} className="hover:text-slate-900">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link
              href={`/${params.locale}/category/${product.category.slug}`}
              className="hover:text-slate-900"
            >
              {product.category.name}
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="line-clamp-1 font-medium text-slate-900">{product.title}</li>
        </ol>
      </nav>

      <div className="mt-6 grid gap-8 md:grid-cols-2 lg:gap-12">
        <ProductGallery images={product.images} title={product.title} />

        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                {product.brand && (
                  <p className="text-sm uppercase tracking-wide text-slate-500">{product.brand}</p>
                )}
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  {product.title}
                </h1>
              </div>
              <WishlistHeart productId={product.id} initialSaved={savedToWishlist} size="md" />
            </div>
            <p className="text-sm text-slate-600">
              Sold by{' '}
              <Link
                href={`/${params.locale}/seller/${product.seller.slug}`}
                className="font-medium text-slate-900 hover:underline"
              >
                {product.seller.displayName}
              </Link>
              {product.seller.ratingCount > 0 && (
                <>
                  {' · '}
                  <span>
                    ★ {product.seller.ratingAvg.toFixed(1)} ({product.seller.ratingCount} reviews)
                  </span>
                </>
              )}
            </p>
          </div>

          {isOnVacation(product.seller) ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">
                {product.seller.displayName} is on vacation
                {product.seller.vacationUntil &&
                  ` until ${product.seller.vacationUntil.toLocaleDateString()}`}
              </p>
              {product.seller.vacationMessage && (
                <p className="mt-1 whitespace-pre-line text-sm text-amber-800">
                  {product.seller.vacationMessage}
                </p>
              )}
              <p className="mt-2 text-xs text-amber-700">
                Save it to your wishlist and we&apos;ll remind you when they&apos;re back.
              </p>
            </div>
          ) : (
            <Buybox locale={params.locale} variants={variants} />
          )}

          {product.bullets.length > 0 && (
            <ul className="space-y-2 border-t border-slate-200 pt-5 text-sm text-slate-700">
              {product.bullets.map((b, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-brand-600" aria-hidden>
                    •
                  </span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <RelatedAds locale={params.locale} productId={product.id} categoryId={product.categoryId} />
      <MoreFromSeller
        locale={params.locale}
        sellerId={product.seller.id}
        sellerSlug={product.seller.slug}
        sellerName={product.seller.displayName}
        excludeId={product.id}
      />
      <RecentlyViewedTracker productId={product.id} />
      <RecentlyViewedRow locale={params.locale} excludeId={product.id} />

      <ReviewsSection productId={product.id} />
      <QASection productId={product.id} />

      <section className="mt-12 max-w-3xl">
        <h2 className="text-lg font-semibold text-slate-900">About this product</h2>
        <div className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">
          {product.description}
        </div>
        <div className="mt-6 flex flex-wrap gap-2 text-xs text-slate-500">
          <Badge variant="outline">Ships from {product.countryCode}</Badge>
          {product.attributes && typeof product.attributes === 'object' && Object.entries(product.attributes as Record<string, string>).map(([k, v]) => (
            <Badge key={k} variant="outline">
              {k}: {v}
            </Badge>
          ))}
        </div>
      </section>
    </div>
  );
}
