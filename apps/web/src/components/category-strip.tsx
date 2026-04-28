import Link from 'next/link';
import {
  Smartphone,
  Shirt,
  Home as HomeIcon,
  Sparkles,
  BookOpen,
  ToyBrick,
  ShoppingBasket,
  Dumbbell,
  Package,
  ArrowUpRight,
  type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  electronics: Smartphone,
  fashion: Shirt,
  home: HomeIcon,
  beauty: Sparkles,
  books: BookOpen,
  toys: ToyBrick,
  grocery: ShoppingBasket,
  sports: Dumbbell,
};

const TINTS: Record<string, string> = {
  electronics: 'bg-indigo-50 text-indigo-700',
  fashion: 'bg-rose-50 text-rose-700',
  home: 'bg-amber-50 text-amber-700',
  beauty: 'bg-pink-50 text-pink-700',
  books: 'bg-emerald-50 text-emerald-700',
  toys: 'bg-sky-50 text-sky-700',
  grocery: 'bg-lime-50 text-lime-700',
  sports: 'bg-orange-50 text-orange-700',
};

export function CategoryStrip({
  categories,
  title,
}: {
  categories: Array<{ id: string; slug: string; name: string }>;
  title: string;
}) {
  return (
    <section className="mt-20">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Browse
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            {title}
          </h2>
        </div>
        <Link
          href="/categories"
          className="hidden items-center gap-1 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 sm:inline-flex"
        >
          All categories <ArrowUpRight size={16} />
        </Link>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4">
        {categories.map((c) => {
          const Icon = ICONS[c.slug] ?? Package;
          const tint = TINTS[c.slug] ?? 'bg-slate-100 text-slate-700';
          return (
            <Link
              key={c.id}
              href={`/category/${c.slug}`}
              className="group relative flex h-40 flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)]"
            >
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-xl ${tint}`}
              >
                <Icon size={22} strokeWidth={1.75} />
              </span>
              <div>
                <p className="text-base font-semibold text-slate-900">{c.name}</p>
                <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-500 transition-colors group-hover:text-slate-900">
                  Shop now
                  <ArrowUpRight
                    size={12}
                    className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  />
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
