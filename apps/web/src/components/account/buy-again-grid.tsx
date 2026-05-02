'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@onsective/ui';
import { trpc } from '@/lib/trpc';
import { formatMoney } from '@/lib/utils';

const CARD_SIZES = '(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw';

export type BuyAgainItem = {
  productId: string;
  productSlug: string;
  productTitle: string;
  productImage: string | null;
  variantId: string;
  variantTitle: string | null;
  priceAmount: number;
  currency: string;
  stockQty: number;
  reservedQty: number;
  lastBoughtAt: Date;
  timesBought: number;
};

export function BuyAgainGrid({
  locale,
  items,
}: {
  locale: string;
  items: BuyAgainItem[];
}) {
  const utils = trpc.useUtils();
  const [busyVariantId, setBusyVariantId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    variantId: string;
    ok: boolean;
    msg: string;
  } | null>(null);

  const addItem = trpc.cart.addItem.useMutation({
    onSuccess: (_data, vars) => {
      utils.cart.get.invalidate();
      setFeedback({ variantId: vars.variantId, ok: true, msg: 'Added to cart' });
      setBusyVariantId(null);
    },
    onError: (err, vars) => {
      setFeedback({ variantId: vars.variantId, ok: false, msg: err.message });
      setBusyVariantId(null);
    },
  });

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-12 text-center">
        <p className="font-display text-2xl font-medium text-stone-950">
          Nothing to re-order yet
        </p>
        <p className="mt-2 max-w-md mx-auto text-sm text-stone-600">
          Once you've placed an order, the items show up here so re-buying takes
          a single tap.
        </p>
        <Link
          href={`/${locale}`}
          className="mt-6 inline-block rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Browse the marketplace
        </Link>
      </div>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((it) => {
        const available = it.stockQty - it.reservedQty;
        const inStock = available > 0;
        const fb = feedback?.variantId === it.variantId ? feedback : null;
        return (
          <li
            key={it.variantId}
            className="overflow-hidden rounded-2xl border border-stone-200/60 bg-white"
          >
            <Link
              href={`/${locale}/product/${it.productSlug}`}
              className="group block"
            >
              <div className="relative aspect-square overflow-hidden bg-stone-100">
                {it.productImage && (
                  <Image
                    src={it.productImage}
                    alt=""
                    fill
                    sizes={CARD_SIZES}
                    className="object-cover transition-transform group-hover:scale-105"
                  />
                )}
              </div>
            </Link>
            <div className="space-y-3 p-4">
              <div>
                <Link
                  href={`/${locale}/product/${it.productSlug}`}
                  className="line-clamp-2 text-sm font-medium text-stone-950 hover:underline"
                >
                  {it.productTitle}
                </Link>
                {it.variantTitle && (
                  <p className="mt-0.5 text-xs text-stone-500">{it.variantTitle}</p>
                )}
              </div>
              <div className="flex items-baseline justify-between">
                <p className="text-base font-bold tabular-nums text-stone-950">
                  {formatMoney(it.priceAmount, it.currency)}
                </p>
                <p className="text-[11px] text-stone-500">
                  {it.timesBought === 1
                    ? `Bought ${new Date(it.lastBoughtAt).toLocaleDateString()}`
                    : `Bought ${it.timesBought}× · last ${new Date(it.lastBoughtAt).toLocaleDateString()}`}
                </p>
              </div>
              <Button
                variant="cta"
                size="sm"
                className="w-full"
                disabled={!inStock || busyVariantId === it.variantId}
                onClick={() => {
                  setBusyVariantId(it.variantId);
                  setFeedback(null);
                  addItem.mutate({ variantId: it.variantId, qty: 1 });
                }}
              >
                {!inStock
                  ? 'Out of stock'
                  : busyVariantId === it.variantId
                    ? 'Adding…'
                    : 'Buy again'}
              </Button>
              {fb && (
                <p
                  className={`text-center text-xs ${
                    fb.ok ? 'text-emerald-700' : 'text-error-600'
                  }`}
                >
                  {fb.msg}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
