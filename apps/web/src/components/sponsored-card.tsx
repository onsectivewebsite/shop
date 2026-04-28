'use client';

import { useEffect, useRef } from 'react';
import { ProductCard } from '@/components/product-card';
import { trpc } from '@/lib/trpc';

type SponsoredProduct = {
  slug: string;
  title: string;
  brand: string | null;
  images: string[];
  variants: Array<{ priceAmount: number; mrpAmount: number | null; currency: string }>;
};

/**
 * Sponsored variant of <ProductCard> — fires `ads.trackImpression` on first
 * mount and `ads.trackClick` on click. The "Sponsored" label is mandatory
 * disclosure in most jurisdictions; don't remove it.
 */
export function SponsoredCard({
  campaignId,
  query,
  placement,
  locale,
  product,
}: {
  campaignId: string;
  query?: string;
  placement: 'SEARCH_RESULTS' | 'PDP_RELATED' | 'HOME_FEATURED';
  locale: string;
  product: SponsoredProduct;
}) {
  const trackImpression = trpc.ads.trackImpression.useMutation();
  const trackClick = trpc.ads.trackClick.useMutation();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    trackImpression.mutate({ campaignId, query, placement });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  return (
    <div
      className="relative"
      onClickCapture={() => {
        // Capture-phase so the click registers even if <Link> immediately
        // unmounts the tree on navigation.
        trackClick.mutate({ campaignId });
      }}
    >
      <span className="absolute left-2 top-2 z-10 rounded bg-slate-900/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
        Sponsored
      </span>
      <ProductCard locale={locale} product={product} />
    </div>
  );
}
