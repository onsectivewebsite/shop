import Link from 'next/link';
import { prisma } from '@onsective/db';
import { Badge, Card, CardContent } from '@onsective/ui';
import { hideReviewAction, dismissReportsAction, unhideReviewAction } from './actions';

export const metadata = { title: 'Review moderation · Console' };
export const dynamic = 'force-dynamic';

const REASON_LABELS: Record<string, string> = {
  SPAM: 'Spam',
  OFFENSIVE: 'Offensive',
  OFF_TOPIC: 'Off topic',
  FAKE: 'Fake',
  OTHER: 'Other',
};

type Filter = 'reported' | 'hidden';

export default async function ReviewModerationPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const filter: Filter = searchParams.filter === 'hidden' ? 'hidden' : 'reported';

  const where =
    filter === 'hidden'
      ? { isHidden: true }
      : {
          // Reviews with at least one outstanding report. Hidden reviews are
          // shown under the Hidden tab; visible-but-flagged shows up here.
          isHidden: false,
          reports: { some: {} },
        };

  const reviews = await prisma.review.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: 100,
    include: {
      buyer: { select: { email: true, fullName: true } },
      product: { select: { title: true, slug: true } },
      reports: {
        select: { reason: true, note: true, createdAt: true, reporterId: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  const counts = {
    reported: await prisma.review.count({
      where: { isHidden: false, reports: { some: {} } },
    }),
    hidden: await prisma.review.count({ where: { isHidden: true } }),
  };

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Review moderation</h1>
          <p className="mt-1 text-sm text-slate-600">
            Buyers can flag a review. We review the queue, decide hide vs dismiss,
            and the storefront aggregates refresh accordingly.
          </p>
        </div>
      </div>

      <div className="mt-6 flex gap-2">
        <FilterPill
          href="/dashboard/reviews"
          label={`Reported${counts.reported ? ` · ${counts.reported}` : ''}`}
          active={filter === 'reported'}
        />
        <FilterPill
          href="/dashboard/reviews?filter=hidden"
          label={`Hidden${counts.hidden ? ` · ${counts.hidden}` : ''}`}
          active={filter === 'hidden'}
        />
      </div>

      {reviews.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="p-12 text-center text-sm text-slate-500">
            {filter === 'reported' ? 'Nothing flagged. ✅' : 'No hidden reviews.'}
          </CardContent>
        </Card>
      ) : (
        <ul className="mt-6 space-y-4">
          {reviews.map((r) => {
            const reasonCounts = r.reports.reduce<Record<string, number>>((acc, rep) => {
              acc[rep.reason] = (acc[rep.reason] ?? 0) + 1;
              return acc;
            }, {});
            return (
              <li key={r.id}>
                <div className="rounded-lg border border-slate-200 bg-white p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        <Link
                          href={`https://itsnottechy.cloud/product/${r.product.slug}`}
                          className="hover:underline"
                        >
                          {r.product.title}
                        </Link>
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {r.buyer.fullName ?? '—'} · {r.buyer.email} ·{' '}
                        {new Date(r.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge
                      variant={
                        r.isHidden
                          ? 'error'
                          : r.reports.length >= 3
                            ? 'warning'
                            : 'default'
                      }
                    >
                      {r.isHidden
                        ? 'Hidden'
                        : `${r.reports.length} ${r.reports.length === 1 ? 'flag' : 'flags'}`}
                    </Badge>
                  </div>

                  <div className="mt-4 rounded-md bg-stone-50 p-3 text-sm">
                    <p className="font-medium">
                      {'★'.repeat(r.rating)}
                      <span className="text-slate-300">{'★'.repeat(5 - r.rating)}</span>
                      {r.title && <span className="ml-2">{r.title}</span>}
                    </p>
                    {r.body && (
                      <p className="mt-2 whitespace-pre-line text-slate-700">{r.body}</p>
                    )}
                  </div>

                  {r.isHidden && r.hiddenReason && (
                    <p className="mt-3 text-xs italic text-slate-500">
                      Hidden reason: {r.hiddenReason}
                    </p>
                  )}

                  {r.reports.length > 0 && (
                    <div className="mt-3 text-xs text-slate-600">
                      <p className="font-medium text-slate-700">
                        Flags ({r.reports.length})
                      </p>
                      <ul className="mt-1 flex flex-wrap gap-2">
                        {Object.entries(reasonCounts).map(([reason, count]) => (
                          <li
                            key={reason}
                            className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900"
                          >
                            {REASON_LABELS[reason] ?? reason} × {count}
                          </li>
                        ))}
                      </ul>
                      {r.reports.some((rep) => rep.note) && (
                        <ul className="mt-2 space-y-1">
                          {r.reports
                            .filter((rep) => rep.note)
                            .map((rep, i) => (
                              <li key={i} className="italic text-slate-500">
                                "{rep.note}"
                              </li>
                            ))}
                        </ul>
                      )}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-3">
                    {!r.isHidden ? (
                      <>
                        <form
                          action={hideReviewAction.bind(null, r.id)}
                          className="flex flex-1 flex-wrap items-center gap-2"
                        >
                          <input
                            type="text"
                            name="reason"
                            placeholder="Reason for hiding (shown to buyer)"
                            required
                            maxLength={500}
                            className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
                          />
                          <button
                            type="submit"
                            className="rounded-md bg-error-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-error-700"
                          >
                            Hide
                          </button>
                        </form>
                        <form action={dismissReportsAction.bind(null, r.id)}>
                          <button
                            type="submit"
                            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Dismiss flags
                          </button>
                        </form>
                      </>
                    ) : (
                      <form action={unhideReviewAction.bind(null, r.id)}>
                        <button
                          type="submit"
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Unhide
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function FilterPill({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={
        active
          ? 'rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white'
          : 'rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100'
      }
    >
      {label}
    </Link>
  );
}
