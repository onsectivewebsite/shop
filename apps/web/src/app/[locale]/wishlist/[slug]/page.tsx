import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Heart } from 'lucide-react';
import { prisma } from '@/server/db';
import { getSession } from '@/server/auth/session';
import { lookupPublicWishlist } from '@/server/wishlist-share';

export const dynamic = 'force-dynamic';

const CARD_SIZES = '(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw';

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

export async function generateMetadata({
  params,
}: {
  params: { locale: string; slug: string };
}) {
  const share = await lookupPublicWishlist({ slug: params.slug, viewerUserId: null });
  if (!share) return { title: 'Wishlist' };
  return {
    title: `${share.ownerName}'s wishlist`,
    description: `Items ${share.ownerName} loves on Onsective.`,
  };
}

export default async function PublicWishlistPage({
  params,
}: {
  params: { locale: string; slug: string };
}) {
  const session = await getSession();
  const share = await lookupPublicWishlist({
    slug: params.slug,
    viewerUserId: session?.user.id ?? null,
  });
  if (!share) notFound();

  const items = await prisma.wishlistItem.findMany({
    where: { userId: share.ownerId },
    orderBy: { createdAt: 'desc' },
    take: 100,
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
          variants: {
            take: 1,
            orderBy: { priceAmount: 'asc' },
            select: { priceAmount: true, mrpAmount: true, currency: true, stockQty: true },
          },
        },
      },
    },
  });

  // Hide products the seller pulled — the wishlist owner kept them but the
  // public viewer shouldn't be confused by inactive listings.
  const visible = items.filter((it) => it.product.status === 'ACTIVE');

  return (
    <div className="container-page py-12 md:py-16">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-500">
              Public wishlist
            </p>
            <h1 className="mt-3 font-display text-4xl font-normal tracking-tight text-slate-950 md:text-5xl">
              {share.ownerName}'s wishlist
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {visible.length === 0
                ? 'Empty for now.'
                : `${visible.length} ${visible.length === 1 ? 'item' : 'items'} they love`}
              {share.viewCount > 0 && ` · ${share.viewCount.toLocaleString()} views`}
            </p>
          </div>
          <Link
            href={`/${params.locale}`}
            className="text-sm font-medium text-slate-700 underline-offset-4 hover:text-slate-900 hover:underline"
          >
            Browse Onsective →
          </Link>
        </header>

        {visible.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <Heart size={32} strokeWidth={1.5} className="mx-auto text-slate-300" />
            <p className="mt-4 text-sm text-slate-500">
              {share.ownerName} hasn't saved anything yet. Check back later.
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {visible.map((it) => {
              const v = it.product.variants[0];
              const cover = it.product.images[0];
              const hasMrp = v && v.mrpAmount && v.mrpAmount > v.priceAmount;
              return (
                <li
                  key={it.id}
                  className="overflow-hidden rounded-2xl border border-stone-200/60 bg-white"
                >
                  <Link
                    href={`/${params.locale}/product/${it.product.slug}`}
                    className="group block"
                  >
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
                      {hasMrp && (
                        <span className="absolute left-2 top-2 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">
                          {Math.round(((v!.mrpAmount! - v!.priceAmount) / v!.mrpAmount!) * 100)}% off
                        </span>
                      )}
                    </div>
                    <div className="p-4">
                      <p className="line-clamp-2 text-sm font-medium text-slate-900">
                        {it.product.title}
                      </p>
                      {v && (
                        <div className="mt-2 flex items-baseline gap-2">
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
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
