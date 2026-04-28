'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Button, Card, CardContent } from '@onsective/ui';
import { trpc } from '@/lib/trpc';
import { formatMoney } from '@/lib/utils';

const PUBLISHABLE = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise: Promise<Stripe | null> = PUBLISHABLE
  ? loadStripe(PUBLISHABLE)
  : Promise.resolve(null);

export function PayForm() {
  const router = useRouter();
  const { data: summary } = trpc.checkout.summary.useQuery();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const place = trpc.checkout.placeOrder.useMutation({
    onSuccess: (data) => {
      setClientSecret(data.clientSecret);
      setOrderNumber(data.orderNumber);
    },
    onError: (e) => setError(e.message),
  });

  useEffect(() => {
    const id = sessionStorage.getItem('checkout.shippingAddressId');
    if (!id) {
      router.replace('/checkout/address');
      return;
    }
    if (!clientSecret && !place.isLoading && summary) {
      place.mutate({ shippingAddressId: id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary, clientSecret]);

  if (!PUBLISHABLE) {
    return (
      <Card>
        <CardContent className="space-y-2 p-6">
          <p className="font-semibold text-error-600">Stripe not configured</p>
          <p className="text-sm text-slate-600">
            Set <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> and{' '}
            <code>STRIPE_SECRET_KEY</code> in <code>.env</code>.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="space-y-2 p-6">
          <p className="font-semibold text-error-600">Could not start payment</p>
          <p className="text-sm text-slate-600">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!clientSecret || !summary) {
    return <p className="text-slate-500">Preparing your payment…</p>;
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_300px]">
      <Card>
        <CardContent className="p-6">
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: { theme: 'stripe', variables: { colorPrimary: '#4F46E5' } },
            }}
          >
            <InnerPayForm orderNumber={orderNumber} />
          </Elements>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Order summary
          </h2>
          <Row label="Subtotal" value={formatMoney(summary.subtotal, summary.currency)} />
          <Row label="Shipping" value={formatMoney(summary.shipping, summary.currency)} />
          <Row label="Tax" value={formatMoney(summary.tax, summary.currency)} />
          <hr className="border-slate-200" />
          <Row
            label="Total"
            value={formatMoney(summary.total, summary.currency)}
            bold
          />
        </CardContent>
      </Card>
    </div>
  );
}

function InnerPayForm({ orderNumber }: { orderNumber: string | null }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!stripe || !elements) return;
        setSubmitting(true);
        setError(null);
        const result = await stripe.confirmPayment({
          elements,
          confirmParams: {
            return_url: `${window.location.origin}/checkout/success?order=${orderNumber ?? ''}`,
          },
        });
        if (result.error) {
          setError(result.error.message ?? 'Payment failed.');
          setSubmitting(false);
        }
      }}
      className="space-y-4"
    >
      <PaymentElement />
      {error && <p className="text-sm text-error-600">{error}</p>}
      <Button variant="cta" size="lg" type="submit" disabled={!stripe || submitting} className="w-full">
        {submitting ? 'Processing…' : 'Pay now'}
      </Button>
      <p className="text-center text-xs text-slate-500">🔒 Secured by Stripe</p>
    </form>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between text-sm ${bold ? 'font-semibold' : ''}`}>
      <span className="text-slate-600">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
