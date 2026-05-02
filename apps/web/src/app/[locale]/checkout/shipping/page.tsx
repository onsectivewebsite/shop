'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent } from '@onsective/ui';
import { trpc } from '@/lib/trpc';
import { formatMoney } from '@/lib/utils';

const NOTE_MAX = 500;

export default function CheckoutShippingPage() {
  const router = useRouter();
  const { data, isLoading } = trpc.checkout.summary.useQuery();
  const [note, setNote] = useState<string>('');
  const [useFx, setUseFx] = useState<boolean>(false);

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

      <Card className="mt-4">
        <CardContent className="space-y-2 p-4">
          <label htmlFor="buyer-note" className="text-sm font-medium text-slate-900">
            Note for the seller{' '}
            <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <textarea
            id="buyer-note"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
            rows={3}
            placeholder="Gift message, delivery instructions, accessibility notes…"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
          />
          <p className="text-right text-xs text-slate-400 tabular-nums">
            {note.length}/{NOTE_MAX}
          </p>
        </CardContent>
      </Card>

      {data.crossCurrencyOption && (
        <Card className="mt-4 border-emerald-200 bg-emerald-50">
          <CardContent className="space-y-2 p-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={useFx}
                onChange={(e) => setUseFx(e.target.checked)}
                className="mt-1"
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-900">
                  Apply your {data.crossCurrencyOption.fromCurrency} credit balance
                </p>
                <p className="mt-1 text-xs text-emerald-800">
                  You have{' '}
                  {formatMoney(
                    data.crossCurrencyOption.fromAmountMinor,
                    data.crossCurrencyOption.fromCurrency,
                  )}{' '}
                  in {data.crossCurrencyOption.fromCurrency}. Applying it now
                  saves{' '}
                  {formatMoney(
                    data.crossCurrencyOption.toAmountMinor,
                    data.currency,
                  )}{' '}
                  on this order at today&apos;s rate (1 {data.crossCurrencyOption.fromCurrency}{' '}
                  = {data.crossCurrencyOption.rate.toFixed(4)} {data.currency}).
                </p>
              </div>
            </label>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 flex justify-end">
        <Button
          variant="cta"
          size="lg"
          onClick={() => {
            // Stash the note + FX choice in sessionStorage so the pay-form
            // picks them up when it calls placeOrder. Cleared on submit so
            // navigating back later doesn't reuse stale state.
            const trimmed = note.trim();
            if (trimmed.length > 0) {
              sessionStorage.setItem('checkout.buyerNote', trimmed);
            } else {
              sessionStorage.removeItem('checkout.buyerNote');
            }
            sessionStorage.setItem('checkout.useFx', useFx ? '1' : '0');
            router.push('/checkout/pay');
          }}
        >
          Continue to payment →
        </Button>
      </div>
    </div>
  );
}
