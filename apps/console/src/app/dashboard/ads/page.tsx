import { prisma } from '@onsective/db';
import { Badge, Card, CardContent } from '@onsective/ui';
import { approveAdAction, rejectAdAction } from './actions';

export const metadata = { title: 'Ads moderation · Console' };

export default async function ConsoleAdsPage() {
  const drafts = await prisma.adCampaign.findMany({
    where: { status: 'DRAFT' },
    orderBy: { createdAt: 'asc' },
    include: {
      seller: { select: { displayName: true, slug: true } },
      product: { select: { title: true, slug: true, brand: true, images: true } },
    },
    take: 100,
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Ads moderation — Pending ({drafts.length})</h1>
      <p className="mt-1 text-sm text-slate-500">
        Approve to flip the campaign to ACTIVE. Rejecting marks the campaign ENDED with an
        audit trail.
      </p>

      {drafts.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="p-12 text-center text-sm text-slate-500">
            Queue is clear. ✅
          </CardContent>
        </Card>
      ) : (
        <ul className="mt-6 space-y-3">
          {drafts.map((c) => (
            <li key={c.id}>
              <Card>
                <CardContent className="grid gap-4 p-5 sm:grid-cols-[1fr_auto]">
                  <div>
                    <p className="text-xs text-slate-500">{c.seller.displayName}</p>
                    <p className="text-sm font-semibold">{c.name}</p>
                    <p className="text-xs text-slate-600">
                      Promoting <span className="font-medium">{c.product.title}</span>
                      {' · '}
                      placement {c.placement}
                      {' · '}
                      bid {(c.bidCpcMinor / 100).toFixed(2)} {c.currency}
                      {' · '}
                      daily {(c.dailyBudgetMinor / 100).toFixed(2)} {c.currency}
                    </p>
                    {c.keywords.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {c.keywords.map((k) => (
                          <Badge key={k} variant="outline">
                            {k}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 self-start">
                    <form action={approveAdAction.bind(null, c.id)}>
                      <button
                        type="submit"
                        className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
                      >
                        Approve
                      </button>
                    </form>
                    <details className="rounded-md border border-slate-200 p-2">
                      <summary className="cursor-pointer text-xs font-medium text-error-700">
                        Reject…
                      </summary>
                      <form
                        action={rejectAdAction.bind(null, c.id)}
                        className="mt-2 space-y-2"
                      >
                        <input
                          name="reason"
                          required
                          maxLength={500}
                          placeholder="Reason"
                          className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                        />
                        <button
                          type="submit"
                          className="rounded-md bg-error-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-error-700"
                        >
                          Confirm reject
                        </button>
                      </form>
                    </details>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
