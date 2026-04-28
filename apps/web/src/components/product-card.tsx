import Link from 'next/link';
import { formatMoney } from '@/lib/utils';

type Props = {
  locale: string;
  product: {
    slug: string;
    title: string;
    brand: string | null;
    images: string[];
    variants: Array<{ priceAmount: number; mrpAmount: number | null; currency: string }>;
  };
};

export function ProductCard({ locale, product }: Props) {
  const v = product.variants[0];
  const cover = product.images[0];

  return (
    <Link
      href={`/${locale}/product/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-square overflow-hidden bg-slate-50">
        {cover ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={cover}
            alt={product.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
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
