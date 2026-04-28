import { redirect } from 'next/navigation';
import { Card, CardContent } from '@onsective/ui';
import { getSession } from '@/server/auth';
import { prisma } from '@/server/db';
import { formatMoney } from '@/lib/utils';
import { ConnectStripeCta } from '@/components/seller/connect-stripe-cta';

export const metadata = { title: 'Payouts' };

export default async function SellerPayouts() {
  const session = await getSession();
  if (!session) redirect('/login');

  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } });
  if (!seller) redirect('/seller');

  const payouts = await prisma.payout.findMany({
    where: { sellerId: seller.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return (
    <div className="p-6 md:p-10">
      <h1 className="text-2xl font-bold text-slate-900">Payouts</h1>

      {!seller.stripePayoutsEnabled && (
        <Card className="mt-6 border-warning-200 bg-warning-50">
          <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-warning-800">
              <p className="font-semibold">Stripe Connect required</p>
              <p>You need to finish Stripe onboarding before payouts can be sent.</p>
            </div>
            <ConnectStripeCta
              hasAccount={Boolean(seller.stripeAccountId)}
              payoutsEnabled={seller.stripePayoutsEnabled}
              size="sm"
            />
          </CardContent>
        </Card>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">Available</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">$0.00</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">Pending (T+7)</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">$0.00</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">On hold</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">$0.00</p>
          </CardContent>
        </Card>
      </div>

      <h2 className="mt-12 text-xl font-semibold">History</h2>
      {payouts.length === 0 ? (
        <Card className="mt-4">
          <CardContent className="p-8 text-center text-sm text-slate-500">
            No payouts yet — payouts begin T+7 after the first delivered order
            (see Phase 2).
          </CardContent>
        </Card>
      ) : (
        <ul className="mt-4 divide-y rounded-lg border border-slate-200 bg-white">
          {payouts.map((p) => (
            <li key={p.id} className="flex items-center justify-between p-4 text-sm">
              <div>
                <p className="font-medium tabular-nums">
                  {formatMoney(p.amount, p.currency)}
                </p>
                <p className="text-slate-500">{p.scheduledFor.toDateString()}</p>
              </div>
              <span className="text-xs uppercase">{p.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
