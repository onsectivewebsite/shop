'use client';

import { useState } from 'react';
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Button, Card, CardContent } from '@onsective/ui';
import { CreditCard, Star, Trash2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';

const PUBLISHABLE = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise: Promise<Stripe | null> = PUBLISHABLE
  ? loadStripe(PUBLISHABLE)
  : Promise.resolve(null);

const BRAND_LABEL: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  discover: 'Discover',
  jcb: 'JCB',
  diners: 'Diners Club',
  unionpay: 'UnionPay',
};

export function PaymentMethodsManager() {
  const list = trpc.me.paymentMethods.list.useQuery();
  const utils = trpc.useUtils();
  const [adding, setAdding] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const startAdd = trpc.me.paymentMethods.createSetupIntent.useMutation({
    onSuccess: ({ clientSecret }) => {
      setClientSecret(clientSecret);
      setAdding(true);
    },
  });

  const remove = trpc.me.paymentMethods.remove.useMutation({
    onSuccess: () => utils.me.paymentMethods.list.invalidate(),
  });

  const setDefault = trpc.me.paymentMethods.setDefault.useMutation({
    onSuccess: () => utils.me.paymentMethods.list.invalidate(),
  });

  if (!PUBLISHABLE) {
    return (
      <Card>
        <CardContent className="space-y-2 p-6">
          <p className="font-semibold text-error-600">Stripe not configured</p>
          <p className="text-sm text-slate-600">
            <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> isn't set, so saved
            payment methods are unavailable in this environment.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Saved cards</h2>
              <p className="mt-1 text-sm text-slate-600">
                Pre-load a card and check out faster next time. We never see
                the full number — Stripe stores it on PCI-compliant infrastructure.
              </p>
            </div>
            <Button
              type="button"
              variant="cta"
              onClick={() => startAdd.mutate()}
              disabled={startAdd.isLoading || adding}
            >
              {startAdd.isLoading ? 'Loading…' : 'Add card'}
            </Button>
          </div>

          {list.isLoading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : !list.data || list.data.length === 0 ? (
            <p className="text-sm text-slate-500">No saved cards yet.</p>
          ) : (
            <ul className="divide-y rounded-lg border border-slate-200 bg-white">
              {list.data.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                      <CreditCard size={16} strokeWidth={1.75} />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {BRAND_LABEL[m.brand] ?? m.brand} · ending {m.last4}
                      </p>
                      <p className="text-xs text-slate-500">
                        Expires{' '}
                        {String(m.expMonth).padStart(2, '0')}/{String(m.expYear).slice(-2)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.isDefault ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-900">
                        <Star size={10} strokeWidth={2.5} />
                        Default
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDefault.mutate({ paymentMethodId: m.id })}
                        disabled={setDefault.isLoading}
                      >
                        Set default
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (!confirm(`Remove ${BRAND_LABEL[m.brand] ?? m.brand} ending ${m.last4}?`)) return;
                        remove.mutate({ paymentMethodId: m.id });
                      }}
                      disabled={remove.isLoading}
                    >
                      <Trash2 size={14} strokeWidth={1.75} />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {adding && clientSecret && (
        <Card>
          <CardContent className="p-6">
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: { theme: 'stripe', variables: { colorPrimary: '#4F46E5' } },
              }}
            >
              <AddCardForm
                onDone={() => {
                  setAdding(false);
                  setClientSecret(null);
                  utils.me.paymentMethods.list.invalidate();
                }}
                onCancel={() => {
                  setAdding(false);
                  setClientSecret(null);
                }}
              />
            </Elements>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AddCardForm({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel: () => void;
}) {
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
        // confirmSetup is the SetupIntent equivalent of confirmPayment — it
        // attaches the entered card to the Customer and resolves with no
        // charge. We send no return_url because we want to stay on this
        // page; "if_required" tells Stripe to skip 3DS unless it's required.
        const result = await stripe.confirmSetup({
          elements,
          confirmParams: { return_url: window.location.href },
          redirect: 'if_required',
        });
        if (result.error) {
          setError(result.error.message ?? 'Could not save card.');
          setSubmitting(false);
          return;
        }
        onDone();
      }}
      className="space-y-4"
    >
      <PaymentElement />
      {error && <p className="text-sm text-error-600">{error}</p>}
      <div className="flex gap-3">
        <Button type="submit" variant="cta" disabled={!stripe || submitting}>
          {submitting ? 'Saving…' : 'Save card'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      <p className="text-center text-xs text-slate-500">🔒 Secured by Stripe</p>
    </form>
  );
}
