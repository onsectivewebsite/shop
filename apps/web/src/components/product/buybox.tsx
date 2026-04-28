'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@onsective/ui';
import { trpc } from '@/lib/trpc';
import { formatMoney } from '@/lib/utils';

export type BuyboxVariant = {
  id: string;
  title: string | null;
  sku: string;
  priceAmount: number;
  mrpAmount: number | null;
  currency: string;
  stockQty: number;
  reservedQty: number;
};

type Props = {
  locale: string;
  variants: BuyboxVariant[];
};

export function Buybox({ locale, variants }: Props) {
  const router = useRouter();
  const initial = variants.find((v) => v.stockQty - v.reservedQty > 0) ?? variants[0];
  const [selectedId, setSelectedId] = useState<string>(initial?.id ?? '');
  const [qty, setQty] = useState(1);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const selected = useMemo(
    () => variants.find((v) => v.id === selectedId) ?? variants[0],
    [variants, selectedId],
  );

  const utils = trpc.useUtils();
  const addItem = trpc.cart.addItem.useMutation({
    onSuccess: () => {
      utils.cart.get.invalidate();
      setFeedback({ ok: true, msg: 'Added to cart.' });
    },
    onError: (e) => setFeedback({ ok: false, msg: e.message }),
  });

  if (!selected) {
    return <p className="text-sm text-slate-500">No variants available.</p>;
  }

  const available = selected.stockQty - selected.reservedQty;
  const inStock = available > 0;
  const maxQty = Math.min(available, 99);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <p className="text-3xl font-bold tabular-nums text-slate-900">
          {formatMoney(selected.priceAmount, selected.currency)}
        </p>
        {selected.mrpAmount && selected.mrpAmount > selected.priceAmount && (
          <p className="text-sm text-slate-500">
            <span className="line-through">{formatMoney(selected.mrpAmount, selected.currency)}</span>{' '}
            <span className="font-medium text-success-700">
              You save{' '}
              {formatMoney(selected.mrpAmount - selected.priceAmount, selected.currency)}
            </span>
          </p>
        )}
      </div>

      {variants.length > 1 && (
        <div className="space-y-1.5">
          <label htmlFor="variant" className="text-sm font-medium text-slate-700">
            Option
          </label>
          <select
            id="variant"
            value={selectedId}
            onChange={(e) => {
              setSelectedId(e.target.value);
              setQty(1);
              setFeedback(null);
            }}
            className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
          >
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.title ?? v.sku}
                {v.stockQty - v.reservedQty <= 0 ? ' — out of stock' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <p className={inStock ? 'text-sm font-medium text-success-700' : 'text-sm font-medium text-error-600'}>
        {inStock
          ? available <= 5
            ? `Only ${available} left in stock`
            : 'In stock'
          : 'Out of stock'}
      </p>

      {inStock && (
        <div className="space-y-1.5">
          <label htmlFor="qty" className="text-sm font-medium text-slate-700">
            Quantity
          </label>
          <select
            id="qty"
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            className="flex h-10 w-32 rounded-md border border-slate-300 bg-white px-3 text-sm"
          >
            {Array.from({ length: maxQty }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant="cta"
          size="lg"
          disabled={!inStock || addItem.isLoading}
          onClick={() => {
            setFeedback(null);
            addItem.mutate({ variantId: selected.id, qty });
          }}
        >
          {addItem.isLoading ? 'Adding…' : 'Add to cart'}
        </Button>
        <Button
          variant="outline"
          size="lg"
          disabled={!inStock || addItem.isLoading}
          onClick={async () => {
            setFeedback(null);
            try {
              await addItem.mutateAsync({ variantId: selected.id, qty });
              router.push(`/${locale}/cart`);
            } catch {
              /* error already surfaced by mutation onError */
            }
          }}
        >
          Buy now
        </Button>
      </div>

      {feedback && (
        <p className={feedback.ok ? 'text-sm text-success-700' : 'text-sm text-error-600'}>
          {feedback.msg}
        </p>
      )}
    </div>
  );
}
