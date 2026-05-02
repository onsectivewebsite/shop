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
  // Captured once before placeOrder fires so the sidebar can show the FX
  // deduction line even though sessionStorage gets cleared right after.
  const [appliedFx, setAppliedFx] = useState<boolean>(false);

  const place = trpc.checkout.placeOrder.useMutation({
    onSuccess: (data) => {
      // Credit covered the whole order — no Stripe step. Bounce to success.
      if (data.paid) {
        router.replace(`/checkout/success?order=${data.orderNumber}`);
        return;
      }
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
      // The note + cross-currency-credit toggle are captured on the shipping
      // page and stashed in sessionStorage so they survive the navigation to
      // /checkout/pay without a server round-trip just to hold them.
      const note = sessionStorage.getItem('checkout.buyerNote') ?? '';
      const useFx = sessionStorage.getItem('checkout.useFx') === '1';
      setAppliedFx(useFx && !!summary.crossCurrencyOption);
      place.mutate({
        shippingAddressId: id,
        buyerNote: note.trim().length > 0 ? note : undefined,
        useCrossCurrencyCredit: useFx,
      });
      // Clear so a subsequent back-navigation doesn't accidentally reuse
      // stale state on the next placeOrder.
      sessionStorage.removeItem('checkout.buyerNote');
      sessionStorage.removeItem('checkout.useFx');
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
          {summary.creditApplied > 0 && (
            <Row
              label="Onsective credit"
              value={`−${formatMoney(summary.creditApplied, summary.currency)}`}
              tone="credit"
            />
          )}
          {appliedFx && summary.crossCurrencyOption && (
            <Row
              label={`${summary.crossCurrencyOption.fromCurrency} credit`}
              value={`−${formatMoney(
                summary.crossCurrencyOption.toAmountMinor,
                summary.currency,
              )}`}
              tone="credit"
            />
          )}
          <hr className="border-slate-200" />
          <Row
            label="Total"
            value={formatMoney(
              summary.total -
                (appliedFx ? summary.crossCurrencyOption?.toAmountMinor ?? 0 : 0),
              summary.currency,
            )}
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

function Row({
  label,
  value,
  bold,
  tone,
}: {
  label: string;
  value: string;
  bold?: boolean;
  tone?: 'credit';
}) {
  return (
    <div className={`flex justify-between text-sm ${bold ? 'font-semibold' : ''}`}>
      <span className={tone === 'credit' ? 'text-emerald-700' : 'text-slate-600'}>
        {label}
      </span>
      <span className={`tabular-nums ${tone === 'credit' ? 'text-emerald-700' : ''}`}>
        {value}
      </span>
    </div>
  );
}
