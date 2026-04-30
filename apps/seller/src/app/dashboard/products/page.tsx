import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Package } from 'lucide-react';
import { getSellerSession } from '@/server/auth';
import { prisma } from '@/server/db';
import { SellerShell } from '@/components/seller-shell';

export const metadata = { title: 'Products' };

const STATUS_BADGE: Record<string, { bg: string; fg: string; label: string }> = {
  DRAFT: { bg: 'bg-stone-100', fg: 'text-stone-700', label: 'Draft' },
  PENDING_REVIEW: { bg: 'bg-amber-100', fg: 'text-amber-900', label: 'In review' },
  ACTIVE: { bg: 'bg-emerald-100', fg: 'text-emerald-900', label: 'Live' },
  REJECTED: { bg: 'bg-red-100', fg: 'text-red-900', label: 'Rejected' },
  ARCHIVED: { bg: 'bg-stone-200', fg: 'text-stone-700', label: 'Archived' },
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const session = await getSellerSession();
  if (!session) redirect('/login');
  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } });
  if (!seller) redirect('/apply');

  const page = Math.max(1, Number(searchParams.page) || 1);
  const perPage = 24;
  const where = { sellerId: seller.id };

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
      include: { variants: { take: 1 } },
    }),
    prisma.product.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <SellerShell email={session.user.email} name={session.user.fullName ?? undefined}>
      <div className="container-page py-10 md:py-14">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900"
        >
          <ArrowLeft size={14} /> Back to dashboard
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-medium tracking-tight text-stone-950 md:text-5xl">
              Products
            </h1>
            <p className="mt-2 text-sm text-stone-600">
              {total} {total === 1 ? 'listing' : 'listings'}
            </p>
          </div>
          {seller.status === 'APPROVED' ? (
            <Link
              href="/dashboard/products/new"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-stone-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-stone-800"
            >
              <Plus size={16} strokeWidth={2} />
              List a new product
            </Link>
          ) : (
            <p className="rounded-full bg-amber-100 px-4 py-2 text-xs font-semibold text-amber-900">
              Listing unlocks after KYC approval
            </p>
          )}
        </div>

        {items.length === 0 ? (
          <div className="mt-12 flex flex-col items-center justify-center rounded-3xl border border-dashed border-stone-300 bg-white px-8 py-20 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-stone-100 text-stone-700">
              <Package size={22} strokeWidth={1.75} />
            </span>
            <h2 className="mt-6 font-display text-2xl font-medium text-stone-950">
              No products yet
            </h2>
            <p className="mt-2 max-w-md text-sm text-stone-600">
              {seller.status === 'APPROVED'
                ? 'Add your first product to start selling.'
                : 'Waiting on KYC approval. Once approved, you can list products here.'}
            </p>
            {seller.status === 'APPROVED' && (
              <Link
                href="/dashboard/products/new"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-stone-800"
              >
                List a new product
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((p) => {
                const v = p.variants[0];
                const status = STATUS_BADGE[p.status] ?? STATUS_BADGE.DRAFT;
                const cover = (p.images as string[])[0];
                return (
                  <article
                    key={p.id}
                    className="overflow-hidden rounded-2xl border border-stone-200 bg-white transition-all hover:border-stone-300 hover:shadow-[0_8px_24px_rgba(0,0,0,0.04)]"
                  >
                    <div className="aspect-[4/3] bg-stone-100">
                      {cover && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={cover}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="space-y-2 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="line-clamp-2 text-sm font-medium text-stone-900">{p.title}</p>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${status?.bg} ${status?.fg}`}
                        >
                          {status?.label}
                        </span>
                      </div>
                      <p className="text-xs text-stone-500">{p.brand ?? '—'}</p>
                      {v && (
                        <p className="text-sm font-bold text-stone-950">
                          {(v.priceAmount / 100).toFixed(2)} {v.currency} · stock {v.stockQty}
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            {totalPages > 1 && (
              <nav className="mt-12 flex items-center justify-center gap-2 text-sm">
                {page > 1 && (
                  <Link
                    href={`/dashboard/products?page=${page - 1}`}
                    className="rounded-full border border-stone-300 px-4 py-2 hover:border-stone-500"
                  >
                    ← Prev
                  </Link>
                )}
                <span className="text-stone-500">
                  Page {page} of {totalPages}
                </span>
                {page < totalPages && (
                  <Link
                    href={`/dashboard/products?page=${page + 1}`}
                    className="rounded-full border border-stone-300 px-4 py-2 hover:border-stone-500"
                  >
                    Next →
                  </Link>
                )}
              </nav>
            )}
          </>
        )}
      </div>
    </SellerShell>
  );
}
