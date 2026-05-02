'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button, Card, CardContent, Skeleton } from '@onsective/ui';
import { trpc } from '@/lib/trpc';
import { formatMoney } from '@/lib/utils';

export default function CartPage() {
  const { data: cart, isLoading } = trpc.cart.get.useQuery();
  // Only signed-in buyers have a save-for-later shelf; the query stays
  // disabled (returns undefined) when there's no user, matching
  // protectedProcedure's contract on the server.
  const savedQuery = trpc.cart.listSaved.useQuery(undefined, {
    // Cheap probe — if it fails (UNAUTHORIZED), we just don't show the shelf.
    retry: false,
  });
  const utils = trpc.useUtils();
  const invalidateAll = () => {
    utils.cart.get.invalidate();
    utils.cart.listSaved.invalidate();
  };
  const updateQty = trpc.cart.updateQty.useMutation({
    onSuccess: () => utils.cart.get.invalidate(),
  });
  const saveForLater = trpc.cart.saveForLater.useMutation({
    onSuccess: invalidateAll,
  });
  const moveToCart = trpc.cart.moveToCart.useMutation({
    onSuccess: invalidateAll,
  });
  const removeSaved = trpc.cart.removeSaved.useMutation({
    onSuccess: () => utils.cart.listSaved.invalidate(),
  });
  const saved = savedQuery.data ?? [];

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
      <div className="container-page py-16">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900">Your cart is empty</h1>
          <p className="mt-2 text-slate-600">Pick up where you left off.</p>
          <Button asChild className="mt-6">
            <Link href="/">Continue shopping</Link>
          </Button>
        </div>
        {saved.length > 0 && (
          <SavedSection
            saved={saved}
            onMove={(id) => moveToCart.mutate({ savedItemId: id })}
            onRemove={(id) => removeSaved.mutate({ savedItemId: id })}
            moveError={moveToCart.error?.message ?? null}
          />
        )}
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
                <div className="flex flex-col items-end gap-2">
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
                  {savedQuery.data !== undefined && (
                    <button
                      type="button"
                      onClick={() => saveForLater.mutate({ itemId: item.id })}
                      disabled={saveForLater.isLoading}
                      className="text-xs font-medium text-cta-700 hover:underline disabled:opacity-50"
                    >
                      Save for later
                    </button>
                  )}
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

      {saved.length > 0 && (
        <SavedSection
          saved={saved}
          onMove={(id) => moveToCart.mutate({ savedItemId: id })}
          onRemove={(id) => removeSaved.mutate({ savedItemId: id })}
          moveError={moveToCart.error?.message ?? null}
        />
      )}
    </div>
  );
}

type SavedItem = {
  id: string;
  qty: number;
  priceSnapshot: number;
  currency: string;
  variant: {
    id: string;
    title: string | null;
    priceAmount: number;
    currency: string;
    stockQty: number;
    reservedQty: number;
    isActive: boolean;
    product: {
      title: string;
      slug: string;
      images: string[];
      seller: { displayName: string; vacationMode: boolean; vacationUntil: Date | null };
    };
  };
};

function SavedSection({
  saved,
  onMove,
  onRemove,
  moveError,
}: {
  saved: SavedItem[];
  onMove: (id: string) => void;
  onRemove: (id: string) => void;
  moveError: string | null;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-slate-900">
        Saved for later ({saved.length})
      </h2>
      {moveError && (
        <p className="mt-2 text-sm text-error-600">{moveError}</p>
      )}
      <ul className="mt-4 space-y-3">
        {saved.map((s) => {
          const cover = s.variant.product.images[0];
          const available = s.variant.stockQty - s.variant.reservedQty;
          const onVacation =
            s.variant.product.seller.vacationMode &&
            (!s.variant.product.seller.vacationUntil ||
              new Date(s.variant.product.seller.vacationUntil) > new Date());
          const movable = s.variant.isActive && available >= s.qty && !onVacation;
          const priceMoved =
            s.variant.priceAmount !== s.priceSnapshot &&
            s.variant.currency === s.currency;

          return (
            <Card key={s.id}>
              <CardContent className="flex items-center gap-4 p-4">
                {cover ? (
                  <div className="relative h-16 w-16 flex-none overflow-hidden rounded-md border border-slate-100">
                    <Image src={cover} alt="" fill sizes="64px" className="object-cover" />
                  </div>
                ) : (
                  <div className="h-16 w-16 flex-none rounded-md bg-slate-100" />
                )}
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/product/${s.variant.product.slug}`}
                    className="block truncate text-sm font-medium text-slate-900 hover:underline"
                  >
                    {s.variant.product.title}
                  </Link>
                  {s.variant.title && (
                    <p className="text-xs text-slate-500">{s.variant.title}</p>
                  )}
                  <p className="mt-1 text-sm font-semibold tabular-nums">
                    {formatMoney(s.variant.priceAmount, s.variant.currency)}
                    {priceMoved && (
                      <span className="ml-2 text-xs font-normal text-slate-400 line-through">
                        {formatMoney(s.priceSnapshot, s.currency)}
                      </span>
                    )}
                    <span className="ml-2 text-xs font-normal text-slate-400">× {s.qty}</span>
                  </p>
                  {!s.variant.isActive && (
                    <p className="mt-1 text-xs text-error-600">Listing removed</p>
                  )}
                  {s.variant.isActive && available < s.qty && (
                    <p className="mt-1 text-xs text-amber-700">Out of stock</p>
                  )}
                  {onVacation && (
                    <p className="mt-1 text-xs text-amber-700">Seller on vacation</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button
                    type="button"
                    disabled={!movable}
                    onClick={() => onMove(s.id)}
                    className="text-xs font-medium text-cta-700 hover:underline disabled:cursor-not-allowed disabled:text-slate-400"
                  >
                    Move to cart
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(s.id)}
                    className="text-xs text-slate-500 hover:text-slate-900"
                  >
                    Remove
                  </button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </ul>
    </section>
  );
}
