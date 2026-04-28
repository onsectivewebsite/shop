import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowRight, Truck, ShieldCheck, RotateCcw, Sparkles } from 'lucide-react';
import { prisma } from '@/server/db';
import { CategoryStrip } from '@/components/category-strip';

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
    <div className="container-page">
      {/* HERO */}
      <section className="relative mt-8 overflow-hidden rounded-3xl bg-slate-950 px-8 py-16 text-white sm:px-14 sm:py-20 md:px-20 md:py-28">
        {/* Decorative geometric accents */}
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-gradient-to-br from-amber-400/30 to-amber-600/0 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-gradient-to-tr from-indigo-500/25 to-indigo-500/0 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
          aria-hidden
        />

        <div className="relative max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur">
            <Sparkles size={12} className="text-amber-300" />
            A curated worldwide marketplace
          </span>
          <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
            {t('hero.headline')}
          </h1>
          <p className="mt-6 max-w-xl text-lg text-white/70 sm:text-xl">
            {t('hero.subheadline')}
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link
              href="/category/electronics"
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-slate-950 transition-all hover:bg-slate-100 hover:shadow-lg"
            >
              {t('hero.ctaPrimary')}
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/sell"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10"
            >
              {t('hero.ctaSecondary')}
            </Link>
          </div>

          {/* trust signals */}
          <div className="mt-14 grid max-w-2xl grid-cols-2 gap-y-5 sm:grid-cols-3">
            <TrustItem icon={Truck} label="Free shipping over $50" />
            <TrustItem icon={ShieldCheck} label="Buyer protection" />
            <TrustItem icon={RotateCcw} label="Easy 30-day returns" />
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <CategoryStrip categories={categories} title={t('sections.shopByCategory')} />

      {/* EDITORIAL SPLIT */}
      <section className="mt-24 grid gap-6 md:grid-cols-2">
        <FeatureCard
          tone="dark"
          eyebrow="New arrivals"
          title="Spring drop, freshly curated."
          body="Hand-picked pieces from the world's best independent makers — all in one place."
          href="/category/fashion"
          cta="Browse the drop"
        />
        <FeatureCard
          tone="light"
          eyebrow="For sellers"
          title="Reach buyers across 80+ countries."
          body="List in minutes. We handle payments, fraud, and global logistics so you can focus on craft."
          href="/sell"
          cta="Start selling"
        />
      </section>

      {/* TRENDING — placeholder until products land */}
      <section className="mt-24">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Discover
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              {t('sections.trending')}
            </h2>
          </div>
          <Link
            href="/trending"
            className="hidden items-center gap-1 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 sm:inline-flex"
          >
            {t('sections.seeAll')} <ArrowRight size={16} />
          </Link>
        </div>

        {productCount === 0 ? (
          <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-8 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white">
              <Sparkles size={22} strokeWidth={1.75} />
            </div>
            <h3 className="mt-5 text-xl font-semibold text-slate-900">
              The catalog opens soon
            </h3>
            <p className="mt-2 max-w-md text-sm text-slate-600">
              Onsective is onboarding its first sellers. Come back shortly — or apply to
              be among the first to list your products to a curated global audience.
            </p>
            <Link
              href="/sell"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
            >
              Apply to sell <ArrowRight size={14} />
            </Link>
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <article
                key={i}
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white"
              >
                <div className="aspect-square animate-pulse bg-slate-100" />
                <div className="space-y-2 p-3">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* CLOSING CTA */}
      <section className="my-24 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-100 to-slate-50 p-10 sm:p-14 md:p-20">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Onsective Membership
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
              Free shipping. Earlier drops. Better prices.
            </h2>
            <p className="mt-4 max-w-md text-base text-slate-600">
              Join Onsective Prime for unlimited free standard shipping, member-only
              prices, and 24-hour early access to every new collection.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/account/prime"
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
              >
                Try Prime free for 30 days <ArrowRight size={14} />
              </Link>
              <Link
                href="/account/prime"
                className="text-sm font-medium text-slate-700 underline-offset-4 transition-colors hover:text-slate-900 hover:underline"
              >
                Learn more
              </Link>
            </div>
          </div>
          <div className="relative hidden md:block">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-amber-200/50 to-rose-200/30 blur-3xl" />
            <div className="relative grid grid-cols-3 gap-3">
              {['Free shipping', 'Early access', 'Members-only', 'Curated picks', 'Easy returns', 'Priority support'].map(
                (label) => (
                  <div
                    key={label}
                    className="flex aspect-square items-center justify-center rounded-2xl bg-white p-4 text-center text-xs font-medium text-slate-700 shadow-sm"
                  >
                    {label}
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function TrustItem({ icon: Icon, label }: { icon: typeof Truck; label: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-white/70">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 backdrop-blur">
        <Icon size={16} strokeWidth={1.75} />
      </span>
      {label}
    </div>
  );
}

function FeatureCard({
  tone,
  eyebrow,
  title,
  body,
  href,
  cta,
}: {
  tone: 'dark' | 'light';
  eyebrow: string;
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  const isDark = tone === 'dark';
  return (
    <Link
      href={href}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-3xl p-10 transition-all hover:-translate-y-1 sm:p-12 md:min-h-[320px] ${
        isDark
          ? 'bg-slate-950 text-white hover:shadow-[0_20px_60px_rgba(2,6,23,0.45)]'
          : 'border border-slate-200 bg-white text-slate-900 hover:shadow-[0_20px_60px_rgba(0,0,0,0.08)]'
      }`}
    >
      <div>
        <p
          className={`text-xs font-semibold uppercase tracking-[0.18em] ${
            isDark ? 'text-amber-300' : 'text-slate-500'
          }`}
        >
          {eyebrow}
        </p>
        <h3 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h3>
        <p
          className={`mt-4 max-w-md text-base ${
            isDark ? 'text-white/70' : 'text-slate-600'
          }`}
        >
          {body}
        </p>
      </div>
      <span
        className={`mt-10 inline-flex w-fit items-center gap-2 text-sm font-semibold transition-transform group-hover:translate-x-1 ${
          isDark ? 'text-white' : 'text-slate-900'
        }`}
      >
        {cta} <ArrowRight size={16} />
      </span>
    </Link>
  );
}
