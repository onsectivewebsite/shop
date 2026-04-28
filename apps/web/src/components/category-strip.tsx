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

export function CategoryStrip({
  categories,
  title,
}: {
  categories: Array<{ id: string; slug: string; name: string }>;
  title: string;
}) {
  return (
    <section className="mt-12">
      <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
      <div className="mt-6 grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-7">
        {categories.map((c) => {
          const Icon = ICONS[c.slug] ?? Package;
          return (
            <Link
              key={c.id}
              href={`/category/${c.slug}`}
              className="group flex flex-col items-center gap-3 rounded-lg border border-slate-200 bg-white p-5 transition-colors hover:border-brand-300 hover:bg-brand-50"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                <Icon size={24} />
              </span>
              <span className="text-center text-sm font-medium text-slate-700">{c.name}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
