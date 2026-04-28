'use client';

import { useRouter } from 'next/navigation';
import { Button, Card, CardContent } from '@onsective/ui';
import { trpc } from '@/lib/trpc';
import { formatMoney } from '@/lib/utils';

export default function CheckoutShippingPage() {
  const router = useRouter();
  const { data, isLoading } = trpc.checkout.summary.useQuery();

  if (isLoading || !data) {
    return <p className="text-slate-500">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900">Shipping method</h1>
      <p className="mt-1 text-sm text-slate-600">
        Real rates land in Phase 3. For v0, all orders ship Standard at $5/seller.
      </p>

      <Card className="mt-6">
        <CardContent className="p-4">
          <label className="flex items-start gap-3">
            <input type="radio" name="ship" defaultChecked className="mt-1" />
            <div className="flex-1">
              <p className="font-medium">Standard</p>
              <p className="text-sm text-slate-500">Delivery in 5–7 business days</p>
            </div>
            <p className="font-semibold tabular-nums">
              {formatMoney(data.shipping, data.currency)}
            </p>
          </label>
        </CardContent>
      </Card>

      <div className="mt-6 flex justify-end">
        <Button variant="cta" size="lg" onClick={() => router.push('/checkout/pay')}>
          Continue to payment →
        </Button>
      </div>
    </div>
  );
}
