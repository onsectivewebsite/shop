import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button, Skeleton } from '@onsective/ui';
import { prisma } from '@/server/db';
import { CategoryStrip } from '@/components/category-strip';

// Server-side data fetching — runs on the server, no waterfall.
async function getHomeData() {
  const [categories, productCount] = await Promise.all([
    prisma.category.findMany({
      where: { parentId: null, isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, slug: true, name: true },
    }),
    prisma.product.count({ where: { status: 'ACTIVE' } }),
  ]);
  return { categories, productCount };
}

export default async function HomePage() {
  const t = await getTranslations('home');
  const { categories, productCount } = await getHomeData();

  return (
    <div className="container-page py-8">
      <section className="overflow-hidden rounded-xl bg-gradient-to-br from-brand-600 to-brand-900 p-8 text-white sm:p-12 md:p-16">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            {t('hero.headline')}
          </h1>
          <p className="mt-4 text-lg text-brand-100">{t('hero.subheadline')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button variant="cta" size="lg" asChild>
              <Link href="/category/electronics">{t('hero.ctaPrimary')}</Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              asChild
              className="border-white/30 bg-transparent text-white hover:bg-white/10"
            >
              <Link href="/sell">{t('hero.ctaSecondary')}</Link>
            </Button>
          </div>
        </div>
      </section>

      <CategoryStrip categories={categories} title={t('sections.shopByCategory')} />

      <section className="mt-12">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-900">{t('sections.trending')}</h2>
          <Link href="/trending" className="text-sm font-medium text-brand-600 hover:underline">
            {t('sections.seeAll')} →
          </Link>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <article key={i} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <Skeleton className="aspect-square rounded-none" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-12 rounded-lg border border-brand-200 bg-brand-50 p-6 text-sm text-brand-900">
        <p className="font-semibold">🚧 Phase 0 → Phase 1</p>
        <p className="mt-1 text-brand-800">
          Auth, tRPC, cart, seller dashboard, and admin console are now wired up.
          Catalog has {productCount} active products. Onboard a seller to populate.
        </p>
      </section>
    </div>
  );
}
