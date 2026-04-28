import { notFound } from 'next/navigation';
import { prisma } from '@onsective/db';
import { Badge, Card, CardContent, Button } from '@onsective/ui';
import {
  approveReturnAction,
  rejectReturnAction,
  markReceivedAction,
  markRefundedAction,
} from './actions';

export const metadata = { title: 'Return · Console' };

export default async function ConsoleReturnDetail({ params }: { params: { id: string } }) {
  const r = await prisma.return.findUnique({
    where: { id: params.id },
    include: {
      buyer: { select: { email: true, fullName: true } },
      seller: { select: { displayName: true, slug: true } },
      orderItem: {
        include: {
          order: { select: { orderNumber: true, currency: true, totalAmount: true } },
        },
      },
    },
  });
  if (!r) notFound();

  return (
    <div className="p-8">
      <header className="flex items-start justify-between">
        <div>
          <p className="font-mono text-xs text-slate-500">{r.rmaNumber}</p>
          <h1 className="text-2xl font-bold">Return — {r.orderItem.productTitle}</h1>
          <p className="text-sm text-slate-500">
            Order {r.orderItem.order.orderNumber} · qty {r.qty}/{r.orderItem.qty}
          </p>
        </div>
        <Badge>{r.status}</Badge>
      </header>

      <Card className="mt-6">
        <CardContent className="grid gap-3 p-6 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase text-slate-500">Buyer</p>
            <p>{r.buyer.fullName ?? r.buyer.email}</p>
            <p className="text-xs text-slate-500">{r.buyer.email}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">Seller</p>
            <p>{r.seller.displayName}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">Reason</p>
            <p>{r.reason}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">Refund amount</p>
            <p className="tabular-nums">
              {r.refundAmount ? (r.refundAmount / 100).toFixed(2) : '—'} {r.currency}
            </p>
          </div>
          {r.buyerNote && (
            <div className="sm:col-span-2">
              <p className="text-xs uppercase text-slate-500">Buyer note</p>
              <p className="whitespace-pre-line">{r.buyerNote}</p>
            </div>
          )}
          {r.decisionNote && (
            <div className="sm:col-span-2">
              <p className="text-xs uppercase text-slate-500">Decision note</p>
              <p className="whitespace-pre-line">{r.decisionNote}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <section className="mt-8 space-y-3">
        {r.status === 'REQUESTED' && (
          <>
            <form action={approveReturnAction.bind(null, r.id)} className="rounded-md border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold">Approve return</p>
              <input
                name="note"
                placeholder="Optional note to buyer"
                maxLength={500}
                className="mt-2 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
              />
              <Button type="submit" variant="cta" size="sm" className="mt-3">
                Approve
              </Button>
            </form>
            <form action={rejectReturnAction.bind(null, r.id)} className="rounded-md border border-error-200 bg-error-50 p-4">
              <p className="text-sm font-semibold text-error-700">Reject return</p>
              <textarea
                name="note"
                required
                rows={2}
                maxLength={500}
                placeholder="Reason (visible to buyer)"
                className="mt-2 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
              />
              <Button type="submit" variant="destructive" size="sm" className="mt-3">
                Reject
              </Button>
            </form>
          </>
        )}

        {r.status === 'APPROVED' && (
          <form action={markReceivedAction.bind(null, r.id)} className="rounded-md border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold">Mark as received</p>
            <p className="text-xs text-slate-500">Confirm the package arrived back at the warehouse / seller.</p>
            <Button type="submit" variant="cta" size="sm" className="mt-3">
              Mark received
            </Button>
          </form>
        )}

        {r.status === 'RECEIVED' && (
          <>
            <form action={markRefundedAction.bind(null, r.id)} className="rounded-md border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold">Issue refund</p>
              <p className="text-xs text-slate-500">
                Creates a Refund row + flips the OrderItem to REFUNDED. Stripe refund is queued.
              </p>
              <Button type="submit" variant="cta" size="sm" className="mt-3">
                Refund {(r.refundAmount! / 100).toFixed(2)} {r.currency}
              </Button>
            </form>
            <form action={rejectReturnAction.bind(null, r.id)} className="rounded-md border border-error-200 bg-error-50 p-4">
              <p className="text-sm font-semibold text-error-700">Reject after inspection</p>
              <textarea
                name="note"
                required
                rows={2}
                maxLength={500}
                placeholder="Inspection failure reason"
                className="mt-2 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
              />
              <Button type="submit" variant="destructive" size="sm" className="mt-3">
                Reject post-inspection
              </Button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
