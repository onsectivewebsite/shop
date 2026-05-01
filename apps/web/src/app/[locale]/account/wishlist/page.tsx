import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Heart, Star } from 'lucide-react';

const CARD_SIZES = '(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw';
import { prisma } from '@/server/db';
import { getSession } from '@/server/auth/session';
import { WishlistHeart } from '@/components/wishlist-heart';
import { WishlistShareCard } from '@/components/account/wishlist-share-card';

export const metadata = { title: 'Wishlist' };
export const dynamic = 'force-dynamic';

function formatMoney(amountMinor: number, currency: string): string {
  const v = amountMinor / 100;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(v);
  } catch {
    return `${v.toFixed(2)} ${currency}`;
  }
}

export default async function WishlistPage({ params }: { params: { locale: string } }) {
  const session = await getSession();
  if (!session) redirect(`/${params.locale}/login`);

  const items = await prisma.wishlistItem.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      product: {
        select: {
          id: true,
          slug: true,
          title: true,
          status: true,
          ratingAvg: true,
          ratingCount: true,
          images: true,
          category: { select: { name: true, slug: true } },
          variants: {
            take: 1,
            orderBy: { priceAmount: 'asc' },
            select: { priceAmount: true, mrpAmount: true, currency: true, stockQty: true },
          },
        },
      },
    },
  });

  // Drop items whose product was archived/deleted server-side. The schema's
  // onDelete: Cascade handles real deletes; this filter handles ARCHIVED/REJECTED.
  const live = items.filter((i) => i.product && i.product.status === 'ACTIVE');
  const archived = items.filter((i) => i.product && i.product.status !== 'ACTIVE');

  return (
    <div className="container-page py-12 md:py-16">
      <Link
        href={`/${params.locale}/account`}
        className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900"
      >
        <ArrowLeft size={14} /> Back to account
      </Link>

      <div className="mt-4">
        <h1 className="font-display text-4xl font-medium tracking-tight text-stone-950 md:text-5xl">
          Wishlist
        </h1>
        <p className="mt-2 text-sm text-stone-600">
          {live.length} saved item{live.length === 1 ? '' : 's'}.
        </p>
      </div>

      {live.length > 0 && (
        <div className="mt-8 max-w-2xl">
          <WishlistShareCard
            baseUrl={
              process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
            }
          />
        </div>
      )}

      {live.length === 0 ? (
        <div className="mt-12 rounded-3xl border border-dashed border-stone-300 bg-white p-12 text-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-stone-100 text-stone-700">
            <Heart size={22} strokeWidth={1.75} />
          </span>
          <h2 className="mt-6 font-display text-2xl font-medium text-stone-950">
            Nothing saved yet
          </h2>
          <p className="mt-2 max-w-md mx-auto text-sm text-stone-600">
            Tap the heart on any product to save it here for later.
          </p>
          <Link
            href={`/${params.locale}/categories`}
            className="mt-6 inline-flex h-11 items-center rounded-full bg-stone-900 px-6 text-sm font-semibold text-white transition-colors hover:bg-stone-800"
          >
            Browse categories
          </Link>
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {live.map((it) => {
            const p = it.product;
            const v = p.variants[0];
            const cover = (p.images as string[])[0] ?? null;
            const hasMrp = v?.mrpAmount && v.mrpAmount > v.priceAmount;
            return (
              <article
                key={it.id}
                className="group overflow-hidden rounded-2xl border border-stone-200/60 bg-white"
              >
                <Link href={`/${params.locale}/product/${p.slug}`} className="block">
                  <div className="relative aspect-square overflow-hidden bg-stone-100">
                    {cover && (
                      <Image
                        src={cover}
                        alt=""
                        fill
                        sizes={CARD_SIZES}
                        className="object-cover transition-transform group-hover:scale-105"
                      />
                    )}
                    <div className="absolute right-2 top-2">
                      <WishlistHeart productId={p.id} initialSaved size="sm" />
                    </div>
                    {hasMrp && (
                      <span className="absolute left-2 top-2 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">
                        -{Math.round(((v.mrpAmount! - v.priceAmount) / v.mrpAmount!) * 100)}%
                      </span>
                    )}
                  </div>
                </Link>
                <div className="space-y-1.5 p-3">
                  {p.category && (
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                      {p.category.name}
                    </p>
                  )}
                  <Link href={`/${params.locale}/product/${p.slug}`}>
                    <p className="line-clamp-2 text-sm font-medium text-stone-900 hover:text-stone-700">
                      {p.title}
                    </p>
                  </Link>
                  {p.ratingCount > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-stone-500">
                      <span className="flex items-center text-amber-500">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            size={11}
                            strokeWidth={0}
                            fill={i < Math.round(p.ratingAvg ?? 0) ? 'currentColor' : 'none'}
                            stroke="currentColor"
                            className={i < Math.round(p.ratingAvg ?? 0) ? '' : 'text-stone-300'}
                          />
                        ))}
                      </span>
                      ({p.ratingCount.toLocaleString()})
                    </div>
                  )}
                  {v && (
                    <div className="flex items-baseline gap-2 pt-1">
                      <span className="text-base font-bold text-stone-950">
                        {formatMoney(v.priceAmount, v.currency)}
                      </span>
                      {hasMrp && (
                        <span className="text-xs text-stone-400 line-through">
                          {formatMoney(v.mrpAmount!, v.currency)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {archived.length > 0 && (
        <section className="mt-16">
          <h2 className="font-display text-xl font-medium text-stone-950">
            No longer available ({archived.length})
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            These items were taken down by the seller. Tap the heart to clear them.
          </p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {archived.map((it) => (
              <li
                key={it.id}
                className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-4 opacity-70"
              >
                <p className="line-clamp-1 text-sm text-stone-700">{it.product.title}</p>
                <WishlistHeart productId={it.product.id} initialSaved size="sm" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
