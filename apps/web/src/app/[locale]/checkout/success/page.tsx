import Link from 'next/link';
import { Button, Card, CardContent } from '@onsective/ui';

export const metadata = { title: 'Order placed' };

export default function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: { order?: string; payment_intent?: string; payment_intent_client_secret?: string };
}) {
  const orderNumber = searchParams.order;

  return (
    <div className="mx-auto max-w-xl text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-success-500/10 text-3xl text-success-600">
        ✓
      </div>
      <h1 className="text-3xl font-bold text-slate-900">Order placed</h1>
      <p className="mt-2 text-slate-600">
        Your payment is confirmed. We&apos;ve emailed your receipt.
      </p>

      {orderNumber && (
        <Card className="mt-8 text-left">
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">Order number</p>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{orderNumber}</p>
            <p className="mt-4 text-sm text-slate-600">
              Sellers will pack and ship within 1–2 business days. You&apos;ll get a tracking link
              when it leaves the warehouse.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="mt-8 flex justify-center gap-3">
        <Button variant="outline" asChild>
          <Link href="/orders">View my orders</Link>
        </Button>
        <Button asChild>
          <Link href="/">Keep shopping</Link>
        </Button>
      </div>
    </div>
  );
}
