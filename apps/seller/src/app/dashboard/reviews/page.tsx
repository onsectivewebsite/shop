import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSellerSession } from '@/server/auth';
import { prisma } from '@/server/db';
import { SellerShell } from '@/components/seller-shell';
import { ReviewsList, type SellerReviewRow } from '@/components/reviews-list';

export const metadata = { title: 'Reviews' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

type Filter = 'all' | 'unanswered' | 'answered';

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const session = await getSellerSession();
  if (!session) redirect('/login');

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    select: { id: true, ratingAvg: true, ratingCount: true },
  });
  if (!seller) redirect('/apply');

  const filter: Filter =
    searchParams.filter === 'answered'
      ? 'answered'
      : searchParams.filter === 'unanswered'
        ? 'unanswered'
        : 'all';

  const replyClause =
    filter === 'unanswered'
      ? { sellerReply: null }
      : filter === 'answered'
        ? { sellerReply: { not: null } }
        : {};

  const [unansweredCount, items] = await Promise.all([
    prisma.review.count({
      where: {
        product: { sellerId: seller.id },
        sellerReply: null,
        isHidden: false,
      },
    }),
    prisma.review.findMany({
      where: {
        product: { sellerId: seller.id },
        isHidden: false,
        ...replyClause,
      },
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      select: {
        id: true,
        rating: true,
        title: true,
        body: true,
        sellerReply: true,
        sellerRepliedAt: true,
        createdAt: true,
        buyer: { select: { fullName: true } },
        product: { select: { title: true, slug: true } },
      },
    }),
  ]);

  const rows: SellerReviewRow[] = items.map((r) => ({
    id: r.id,
    rating: r.rating,
    title: r.title,
    body: r.body,
    sellerReply: r.sellerReply,
    sellerRepliedAt: r.sellerRepliedAt,
    createdAt: r.createdAt,
    productTitle: r.product.title,
    productSlug: r.product.slug,
    buyerName: redactName(r.buyer.fullName),
  }));

  return (
    <SellerShell email={session.user.email} name={session.user.fullName ?? undefined}>
      <div className="container-page py-10 md:py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-stone-500">
              Buyer feedback
            </p>
            <h1 className="mt-3 font-display text-4xl font-medium leading-tight tracking-tight text-stone-950">
              Reviews
            </h1>
            <p className="mt-2 text-sm text-stone-600">
              {seller.ratingCount > 0
                ? `${seller.ratingAvg.toFixed(2)} average · ${seller.ratingCount} ${
                    seller.ratingCount === 1 ? 'review' : 'reviews'
                  }`
                : 'No reviews yet.'}
              {unansweredCount > 0 && (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                  {unansweredCount} awaiting response
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="mt-8 flex gap-2">
          <FilterPill href="/dashboard/reviews" label="All" active={filter === 'all'} />
          <FilterPill
            href="/dashboard/reviews?filter=unanswered"
            label={`Unanswered${unansweredCount ? ` · ${unansweredCount}` : ''}`}
            active={filter === 'unanswered'}
          />
          <FilterPill
            href="/dashboard/reviews?filter=answered"
            label="Answered"
            active={filter === 'answered'}
          />
        </div>

        <div className="mt-6">
          <ReviewsList reviews={rows} />
        </div>
      </div>
    </SellerShell>
  );
}

function FilterPill({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={
        active
          ? 'rounded-full bg-stone-900 px-4 py-1.5 text-xs font-medium text-white'
          : 'rounded-full border border-stone-300 px-4 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100'
      }
    >
      {label}
    </Link>
  );
}

function redactName(name: string | null): string {
  if (!name) return 'Onsective shopper';
  const parts = name.trim().split(/\s+/);
  const first = parts[0] ?? '';
  const lastInitial = parts.length > 1 ? `${parts[parts.length - 1]!.charAt(0)}.` : '';
  return `${first} ${lastInitial}`.trim() || 'Onsective shopper';
}
