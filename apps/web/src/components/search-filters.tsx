import Link from 'next/link';
import { SlidersHorizontal, X } from 'lucide-react';

type Props = {
  q: string;
  locale: string;
  minPrice: number | null;
  maxPrice: number | null;
  brand: string;
  minRating: number | null;
};

const RATINGS = [
  { v: null, label: 'Any' },
  { v: 4.5, label: '4.5+' },
  { v: 4, label: '4+' },
  { v: 3, label: '3+' },
];

function isFiltered({ minPrice, maxPrice, brand, minRating }: Props): boolean {
  return Boolean(minPrice || maxPrice || brand || minRating);
}

export function SearchFilters(props: Props) {
  const filtered = isFiltered(props);
  const clearHref = `/${props.locale}/search?q=${encodeURIComponent(props.q)}`;

  return (
    <aside className="rounded-3xl border border-stone-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-700">
          <SlidersHorizontal size={12} /> Filters
        </p>
        {filtered && (
          <Link
            href={clearHref}
            className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-900"
          >
            <X size={11} /> Clear
          </Link>
        )}
      </div>

      <form method="get" className="mt-5 space-y-5">
        <input type="hidden" name="q" value={props.q} />

        <div>
          <p className="text-xs font-medium text-stone-700">Price (cents)</p>
          <div className="mt-2 flex items-center gap-2">
            <input
              name="minPrice"
              type="number"
              min={0}
              defaultValue={props.minPrice ?? ''}
              placeholder="Min"
              className="h-10 w-full rounded-md border border-stone-300 bg-white px-2 text-sm tabular-nums"
            />
            <span className="text-stone-400">—</span>
            <input
              name="maxPrice"
              type="number"
              min={0}
              defaultValue={props.maxPrice ?? ''}
              placeholder="Max"
              className="h-10 w-full rounded-md border border-stone-300 bg-white px-2 text-sm tabular-nums"
            />
          </div>
          <p className="mt-1 text-[11px] text-stone-500">
            $19.99 = 1999. We store money in minor units.
          </p>
        </div>

        <div>
          <p className="text-xs font-medium text-stone-700">Brand</p>
          <input
            name="brand"
            defaultValue={props.brand}
            placeholder="e.g. Sony"
            className="mt-2 h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
          />
          <p className="mt-1 text-[11px] text-stone-500">Partial match, case-insensitive.</p>
        </div>

        <fieldset>
          <legend className="text-xs font-medium text-stone-700">Seller rating</legend>
          <div className="mt-2 space-y-1.5">
            {RATINGS.map((r) => (
              <label
                key={String(r.v)}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-stone-50"
              >
                <input
                  type="radio"
                  name="minRating"
                  value={r.v ?? ''}
                  defaultChecked={(props.minRating ?? null) === r.v}
                  className="border-stone-300 text-stone-900"
                />
                <span className="flex items-center gap-1">
                  {r.label}
                  {r.v !== null && <span className="text-amber-500">★</span>}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <button
          type="submit"
          className="h-10 w-full rounded-full bg-stone-900 text-sm font-semibold text-white transition-colors hover:bg-stone-800"
        >
          Apply filters
        </button>
      </form>
    </aside>
  );
}
