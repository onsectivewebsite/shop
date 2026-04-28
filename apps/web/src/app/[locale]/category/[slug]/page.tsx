import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/server/db';
import { ProductCard } from '@/components/product-card';

const PER_PAGE = 24;

type Props = {
  params: { locale: string; slug: string };
  searchParams: { page?: string };
};

export async function generateMetadata({ params }: Props) {
  const cat = await prisma.category.findUnique({
    where: { slug: params.slug },
    select: { name: true },
  });
  return { title: cat ? cat.name : 'Category not found' };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const page = Math.max(1, Number(searchParams.page ?? 1) || 1);

  const category = await prisma.category.findUnique({
    where: { slug: params.slug },
    include: {
      parent: { select: { slug: true, name: true } },
      children: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: { slug: true, name: true },
      },
    },
  });
  if (!category || !category.isActive) notFound();

  const where = { categoryId: category.id, status: 'ACTIVE' as const };
  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        variants: {
          where: { isActive: true },
          take: 1,
          select: { priceAmount: true, mrpAmount: true, currency: true },
        },
      },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.product.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const buildHref = (p: number) =>
    `/${params.locale}/category/${params.slug}${p > 1 ? `?page=${p}` : ''}`;

  return (
    <div className="container-page py-8">
      <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href={`/${params.locale}`} className="hover:text-slate-900">
              Home
            </Link>
          </li>
          {category.parent && (
            <>
              <li aria-hidden>/</li>
              <li>
                <Link
                  href={`/${params.locale}/category/${category.parent.slug}`}
                  className="hover:text-slate-900"
                >
                  {category.parent.name}
                </Link>
              </li>
            </>
          )}
          <li aria-hidden>/</li>
          <li className="font-medium text-slate-900">{category.name}</li>
        </ol>
      </nav>

      <header className="mt-4 flex items-end justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{category.name}</h1>
        <p className="text-sm text-slate-500">
          {total === 0 ? 'No products' : `${total.toLocaleString()} products`}
        </p>
      </header>

      {category.children.length > 0 && (
        <ul className="mt-6 flex flex-wrap gap-2">
          {category.children.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/${params.locale}/category/${c.slug}`}
                className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {products.length === 0 ? (
        <div className="mt-12 rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
          No products in this category yet — check back soon.
        </div>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {products.map((p) => (
            <li key={p.id}>
              <ProductCard locale={params.locale} product={p} />
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <nav
          aria-label="Pagination"
          className="mt-10 flex items-center justify-between border-t border-slate-200 pt-4 text-sm"
        >
          {page > 1 ? (
            <Link href={buildHref(page - 1)} className="font-medium text-brand-600 hover:underline">
              ← Previous
            </Link>
          ) : (
            <span className="text-slate-400">← Previous</span>
          )}
          <span className="text-slate-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={buildHref(page + 1)} className="font-medium text-brand-600 hover:underline">
              Next →
            </Link>
          ) : (
            <span className="text-slate-400">Next →</span>
          )}
        </nav>
      )}
    </div>
  );
}
