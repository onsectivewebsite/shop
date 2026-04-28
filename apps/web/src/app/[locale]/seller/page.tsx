import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@onsective/ui';
import { getSession } from '@/server/auth';
import { prisma } from '@/server/db';
import { ConnectStripeCta } from '@/components/seller/connect-stripe-cta';

export const metadata = { title: 'Seller dashboard' };

export default async function SellerDashboard() {
  const session = await getSession();
  if (!session) redirect('/login');

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      displayName: true,
      status: true,
      ratingAvg: true,
      ratingCount: true,
      stripeAccountId: true,
      stripePayoutsEnabled: true,
      _count: { select: { products: true, orderItems: true } },
    },
  });

  if (!seller) {
    return (
      <div className="container-page py-12 text-center">
        <h1 className="text-2xl font-bold">You&apos;re not a seller yet</h1>
        <p className="mt-2 text-slate-600">
          Apply to start selling. We&apos;ll wire the seller-onboarding flow in Phase 1
          (Sprint 0 ticket SEL-001).
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{seller.displayName}</h1>
          <p className="text-sm text-slate-500">Welcome back.</p>
        </div>
        <Badge variant={seller.status === 'APPROVED' ? 'success' : 'warning'}>
          {seller.status}
        </Badge>
      </header>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Active products" value={seller._count.products} />
        <Stat label="Total orders" value={seller._count.orderItems} />
        <Stat label="Rating" value={seller.ratingAvg.toFixed(2)} />
        <Stat label="Reviews" value={seller.ratingCount} />
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Action needed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2 text-sm text-slate-700">
            <li>📦 0 orders waiting to ship</li>
            <li>↩ 0 returns pending your approval</li>
          </ul>
          <ConnectStripeCta
            hasAccount={Boolean(seller.stripeAccountId)}
            payoutsEnabled={seller.stripePayoutsEnabled}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="p-6">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{value}</p>
      </CardContent>
    </Card>
  );
}
