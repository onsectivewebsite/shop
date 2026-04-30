import Link from 'next/link';
import Image from 'next/image';
import { Star } from 'lucide-react';
import { formatMoney } from '@/lib/utils';

// Roughly matches a 6-col grid at desktop, 3-col at tablet, 2-col at mobile.
// Tells the optimizer how big the rendered image actually is so it doesn't
// pick the largest variant for every viewport.
const CARD_SIZES = '(min-width: 1024px) 16vw, (min-width: 768px) 33vw, 50vw';

type Props = {
  locale: string;
  product: {
    slug: string;
    title: string;
    brand: string | null;
    images: string[];
    // Optional so older call sites that don't select these still compile.
    // When ratingCount is 0 or omitted, the rating line is suppressed.
    ratingAvg?: number;
    ratingCount?: number;
    variants: Array<{ priceAmount: number; mrpAmount: number | null; currency: string }>;
  };
};

export function ProductCard({ locale, product }: Props) {
  const v = product.variants[0];
  const cover = product.images[0];
  const showRating = (product.ratingCount ?? 0) > 0;

  return (
    <Link
      href={`/${locale}/product/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-square overflow-hidden bg-slate-50">
        {cover ? (
          <Image
            src={cover}
            alt={product.title}
            fill
            sizes={CARD_SIZES}
            className="object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">
            No image
          </div>
        )}
      </div>
      <div className="space-y-1 p-3">
        {product.brand && (
          <p className="text-xs uppercase tracking-wide text-slate-500">{product.brand}</p>
        )}
        <h3 className="line-clamp-2 text-sm font-medium text-slate-900">{product.title}</h3>
        {showRating && (
          <div className="flex items-center gap-1.5 pt-0.5 text-xs text-slate-500">
            <span className="flex items-center text-amber-500">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  size={11}
                  strokeWidth={0}
                  fill={i < Math.round(product.ratingAvg ?? 0) ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  className={i < Math.round(product.ratingAvg ?? 0) ? '' : 'text-slate-300'}
                />
              ))}
            </span>
            ({(product.ratingCount ?? 0).toLocaleString()})
          </div>
        )}
        {v && (
          <p className="pt-1 text-base font-semibold tabular-nums text-slate-900">
            {formatMoney(v.priceAmount, v.currency)}
            {v.mrpAmount && v.mrpAmount > v.priceAmount && (
              <span className="ml-2 text-sm font-normal text-slate-400 line-through">
                {formatMoney(v.mrpAmount, v.currency)}
              </span>
            )}
          </p>
        )}
      </div>
    </Link>
  );
}
