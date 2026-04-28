'use client';

import Link from 'next/link';
import { Button, Card, CardContent, Skeleton } from '@onsective/ui';
import { trpc } from '@/lib/trpc';
import { formatMoney } from '@/lib/utils';

export default function CartPage() {
  const { data: cart, isLoading } = trpc.cart.get.useQuery();
  const utils = trpc.useUtils();
  const updateQty = trpc.cart.updateQty.useMutation({
    onSuccess: () => utils.cart.get.invalidate(),
  });

  if (isLoading) {
    return (
      <div className="container-page py-8">
        <Skeleton className="h-8 w-48" />
        <div className="mt-6 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="container-page py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Your cart is empty</h1>
        <p className="mt-2 text-slate-600">Pick up where you left off.</p>
        <Button asChild className="mt-6">
          <Link href="/">Continue shopping</Link>
        </Button>
      </div>
    );
  }

  const subtotal = cart.items.reduce((acc, it) => acc + it.priceSnapshot * it.qty, 0);
  const currency = cart.currency;

  return (
    <div className="container-page py-8">
      <h1 className="text-2xl font-bold text-slate-900">Your cart ({cart.items.length})</h1>
      <div className="mt-6 grid gap-8 md:grid-cols-[1fr_360px]">
        <ul className="space-y-4">
          {cart.items.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="h-20 w-20 flex-shrink-0 rounded-md bg-slate-100" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">
                    {item.variant.product.title}
                  </p>
                  <p className="text-sm text-slate-500">{item.variant.title}</p>
                  <p className="mt-1 font-semibold tabular-nums">
                    {formatMoney(item.priceSnapshot, item.currency)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    aria-label="Decrease"
                    onClick={() => updateQty.mutate({ itemId: item.id, qty: item.qty - 1 })}
                    className="h-8 w-8 rounded border border-slate-300 hover:bg-slate-100"
                  >
                    −
                  </button>
                  <span className="w-8 text-center tabular-nums">{item.qty}</span>
                  <button
                    aria-label="Increase"
                    onClick={() => updateQty.mutate({ itemId: item.id, qty: item.qty + 1 })}
                    className="h-8 w-8 rounded border border-slate-300 hover:bg-slate-100"
                  >
                    +
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </ul>

        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Subtotal</span>
              <span className="font-semibold tabular-nums">{formatMoney(subtotal, currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Shipping</span>
              <span className="text-slate-500">calculated at checkout</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Tax</span>
              <span className="text-slate-500">calculated at checkout</span>
            </div>
            <hr className="border-slate-200" />
            <Button variant="cta" size="lg" className="w-full" asChild>
              <Link href="/checkout/address">Proceed to checkout</Link>
            </Button>
            <p className="text-center text-xs text-slate-500">🔒 Secured by Stripe</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
