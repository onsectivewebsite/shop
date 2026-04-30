import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { prisma } from '@/server/db';

export const metadata = { title: 'All categories' };
export const dynamic = 'force-dynamic';

const TINTS: Record<string, { bg: string; fg: string }> = {
  electronics: { bg: 'bg-sky-100', fg: 'text-sky-900' },
  beauty: { bg: 'bg-pink-100', fg: 'text-pink-900' },
  fashion: { bg: 'bg-violet-100', fg: 'text-violet-900' },
  home: { bg: 'bg-emerald-100', fg: 'text-emerald-900' },
  books: { bg: 'bg-amber-100', fg: 'text-amber-900' },
  toys: { bg: 'bg-cyan-100', fg: 'text-cyan-900' },
  grocery: { bg: 'bg-lime-100', fg: 'text-lime-900' },
  sports: { bg: 'bg-orange-100', fg: 'text-orange-900' },
};

export default async function CategoriesIndexPage({
  params,
}: {
  params: { locale: string };
}) {
  // Pull active categories with their children + active product counts in
  // one round trip. The tree is small (8 top-level × N children), so an
  // in-memory join is fine.
  const allCategories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      parentId: true,
      _count: { select: { products: { where: { status: 'ACTIVE' } } } },
    },
  });

  const topLevel = allCategories.filter((c) => c.parentId === null);
  const childrenByParent = new Map<string, typeof allCategories>();
  for (const c of allCategories) {
    if (!c.parentId) continue;
    const arr = childrenByParent.get(c.parentId) ?? [];
    arr.push(c);
    childrenByParent.set(c.parentId, arr);
  }

  return (
    <div className="bg-stone-50">
      <section className="container-page py-16 md:py-20">
        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-stone-500">
          All categories
        </p>
        <h1 className="mt-6 font-display text-5xl font-medium leading-[1.05] tracking-tight text-stone-950 md:text-7xl">
          Eight worlds, <em className="italic">one</em> marketplace.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-stone-600">
          Pick a department to start. Each one drills into sub-categories — apparel
          splits into men&rsquo;s, women&rsquo;s, kids; electronics into audio, mobile,
          laptops; etc.
        </p>
      </section>

      <section className="container-page pb-24 md:pb-32">
        <div className="grid gap-6 md:grid-cols-2">
          {topLevel.map((cat) => {
            const tint = TINTS[cat.slug] ?? { bg: 'bg-stone-200', fg: 'text-stone-900' };
            const kids = childrenByParent.get(cat.id) ?? [];
            return (
              <article
                key={cat.id}
                className={`relative overflow-hidden rounded-3xl ${tint.bg} p-8 sm:p-10`}
              >
                <Link
                  href={`/${params.locale}/category/${cat.slug}`}
                  className="group flex items-center justify-between"
                >
                  <h2 className={`font-display text-3xl font-medium tracking-tight ${tint.fg} md:text-4xl`}>
                    {cat.name}
                  </h2>
                  <ArrowUpRight
                    size={22}
                    strokeWidth={1.5}
                    className={`${tint.fg} transition-transform group-hover:-translate-y-1 group-hover:translate-x-1`}
                  />
                </Link>
                <p className={`mt-2 text-sm ${tint.fg} opacity-70`}>
                  {cat._count.products.toLocaleString()}{' '}
                  {cat._count.products === 1 ? 'product' : 'products'}
                  {kids.length > 0 && ` · ${kids.length} sub-categories`}
                </p>
                {cat.description && (
                  <p className={`mt-4 max-w-md text-sm ${tint.fg} opacity-80`}>{cat.description}</p>
                )}

                {kids.length > 0 && (
                  <ul className="mt-8 grid grid-cols-2 gap-2 text-sm">
                    {kids.slice(0, 8).map((kid) => (
                      <li key={kid.id}>
                        <Link
                          href={`/${params.locale}/category/${kid.slug}`}
                          className={`group flex items-center justify-between rounded-xl bg-white/60 px-3 py-2 transition-colors hover:bg-white ${tint.fg}`}
                        >
                          <span className="truncate font-medium">{kid.name}</span>
                          <span className="text-xs opacity-50 group-hover:opacity-80">
                            {kid._count.products}
                          </span>
                        </Link>
                      </li>
                    ))}
                    {kids.length > 8 && (
                      <li className={`px-3 py-2 text-xs ${tint.fg} opacity-60`}>
                        +{kids.length - 8} more
                      </li>
                    )}
                  </ul>
                )}
              </article>
            );
          })}
        </div>

        {topLevel.length === 0 && (
          <div className="mt-12 rounded-3xl border border-dashed border-stone-300 bg-white p-12 text-center">
            <p className="font-display text-2xl font-medium text-stone-950">
              No categories yet
            </p>
            <p className="mt-2 text-sm text-stone-600">
              Run <code className="font-mono text-xs">pnpm db:seed</code> to populate the 8
              top-level categories.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
