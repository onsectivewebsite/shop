import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowRight, Star, Zap, Truck, RotateCcw, ShieldCheck } from 'lucide-react';
import { prisma } from '@/server/db';

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

const HERO_TILES = [
  {
    title: 'Electronics',
    href: '/category/electronics',
    items: ['Smartphones', 'Laptops', 'Audio', 'Wearables'],
    accent: 'from-sky-100 to-sky-50',
  },
  {
    title: 'Fashion',
    href: '/category/fashion',
    items: ['Men', 'Women', 'Shoes', 'Accessories'],
    accent: 'from-rose-100 to-rose-50',
  },
  {
    title: 'Home & Kitchen',
    href: '/category/home',
    items: ['Cookware', 'Bedding', 'Decor', 'Storage'],
    accent: 'from-amber-100 to-amber-50',
  },
  {
    title: 'Beauty',
    href: '/category/beauty',
    items: ['Skincare', 'Makeup', 'Fragrance', 'Hair'],
    accent: 'from-pink-100 to-pink-50',
  },
];

const PLACEHOLDER_PRODUCTS = [
  { name: 'Wireless noise-cancelling headphones', price: 17999, was: 24999, rating: 4.6, reviews: 1284, badge: 'Best Seller' },
  { name: 'Smart fitness tracker', price: 4999, was: 7499, rating: 4.4, reviews: 832, badge: 'Limited deal' },
  { name: 'Organic cotton bedsheet set', price: 3499, was: 5999, rating: 4.8, reviews: 2104, badge: '#1 in Bedding' },
  { name: 'Ceramic non-stick cookware (5 pc)', price: 8499, was: 12999, rating: 4.5, reviews: 612, badge: 'Top rated' },
  { name: 'Smart LED desk lamp', price: 2499, was: 3499, rating: 4.3, reviews: 412 },
  { name: 'Stainless-steel insulated bottle', price: 999, was: 1499, rating: 4.7, reviews: 5402 },
];

const TODAYS_DEALS = [
  { name: 'Up to 60% off — Headphones', tagline: 'Premium audio brands', accent: 'bg-sky-500' },
  { name: 'Up to 50% off — Skincare', tagline: 'Editor picks', accent: 'bg-rose-500' },
  { name: 'Buy 2 Save 30% — Books', tagline: 'New & bestselling', accent: 'bg-emerald-500' },
  { name: 'Up to 40% off — Cookware', tagline: 'Top-rated brands', accent: 'bg-amber-500' },
];

function formatINR(minor: number) {
  return `$${(minor / 100).toFixed(2)}`;
}

export default async function HomePage() {
  const t = await getTranslations('home');
  const { productCount } = await getHomeData();
  const showLive = productCount > 0;

  return (
    <div className="bg-slate-100 pb-20">
      {/* HERO BANNER */}
      <section className="relative overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 py-10 text-white">
        <div className="container-page">
          <div className="grid gap-8 md:grid-cols-3">
            <div className="md:col-span-2">
              <p className="inline-flex items-center gap-2 rounded-full bg-amber-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-300">
                <Zap size={14} /> Today only — Spring Sale
              </p>
              <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl md:text-5xl">
                Up to 60% off across thousands of items.
              </h1>
              <p className="mt-3 max-w-xl text-base text-slate-300">
                Free shipping on orders over $50. Easy 30-day returns. Trusted by
                buyers in 80+ countries.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href="/deals"
                  className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-6 py-3 text-sm font-bold text-slate-900 transition-colors hover:bg-amber-300"
                >
                  Shop the deals <ArrowRight size={14} />
                </Link>
                <Link
                  href="/sell"
                  className="text-sm font-semibold text-white underline-offset-4 hover:underline"
                >
                  Sell on Onsective →
                </Link>
              </div>
            </div>
            <div className="hidden grid-cols-2 gap-3 md:grid">
              {TODAYS_DEALS.slice(0, 4).map((d) => (
                <div
                  key={d.name}
                  className="flex flex-col justify-between rounded-lg bg-white p-4 text-slate-900"
                >
                  <p className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[11px] font-bold uppercase text-white ${d.accent}`}>
                    Deal
                  </p>
                  <p className="mt-2 text-sm font-bold">{d.name}</p>
                  <p className="text-xs text-slate-500">{d.tagline}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* TOP TILES — categories */}
      <section className="container-page -mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {HERO_TILES.map((tile) => (
          <article
            key={tile.title}
            className={`overflow-hidden rounded-lg bg-gradient-to-br ${tile.accent} p-5 shadow-sm`}
          >
            <h3 className="text-lg font-bold text-slate-900">{tile.title}</h3>
            <ul className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-700">
              {tile.items.map((item) => (
                <li key={item}>
                  <Link href={tile.href} className="hover:underline">
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href={tile.href}
              className="mt-4 inline-block text-xs font-semibold text-slate-900 underline-offset-4 hover:underline"
            >
              Shop {tile.title.toLowerCase()} →
            </Link>
          </article>
        ))}
      </section>

      {/* TODAY'S DEALS STRIP */}
      <Section title="Today's Deals" cta="See all deals" href="/deals">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          {PLACEHOLDER_PRODUCTS.slice(0, 6).map((p) => (
            <ProductCard key={p.name} {...p} />
          ))}
        </div>
      </Section>

      {/* BEST SELLERS */}
      <Section title="Best Sellers" cta="See top 100" href="/best-sellers">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          {PLACEHOLDER_PRODUCTS.slice().reverse().map((p) => (
            <ProductCard key={p.name} {...p} />
          ))}
        </div>
      </Section>

      {/* TRUST STRIP */}
      <Section title="Why Onsective" cta="Learn more" href="/about">
        <div className="grid gap-3 rounded-lg bg-white p-6 sm:grid-cols-3">
          <Trust icon={Truck} title="Free shipping" sub="On orders over $50" />
          <Trust icon={RotateCcw} title="Easy returns" sub="30-day window" />
          <Trust icon={ShieldCheck} title="Buyer protection" sub="100% guarantee" />
        </div>
      </Section>

      {/* SELLER STRIP */}
      <Section title="For sellers" cta="Apply to sell" href="/sell">
        <div className="grid gap-4 rounded-lg bg-gradient-to-br from-slate-950 to-slate-800 p-8 text-white md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
              Onsective for makers
            </p>
            <h3 className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">
              Reach buyers across 80+ countries.
            </h3>
            <p className="mt-3 max-w-md text-sm text-slate-300">
              List in minutes. We handle payments, fraud detection, and global
              logistics so you can focus on what you make.
            </p>
            <Link
              href="/sell"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-900 hover:bg-amber-300"
            >
              Start selling <ArrowRight size={14} />
            </Link>
          </div>
          <dl className="grid grid-cols-3 gap-4 self-end">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Commission</dt>
              <dd className="mt-1 text-2xl font-bold">8–15%</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Payouts</dt>
              <dd className="mt-1 text-2xl font-bold">Weekly</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Markets</dt>
              <dd className="mt-1 text-2xl font-bold">80+</dd>
            </div>
          </dl>
        </div>
      </Section>

      {!showLive && (
        <div className="container-page mt-8">
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <strong>Heads up:</strong> the products and prices on this page are
            placeholders — real listings appear automatically as sellers onboard.
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  cta,
  href,
  children,
}: {
  title: string;
  cta: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section className="container-page mt-6">
      <div className="rounded-lg bg-white p-5">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          <Link
            href={href}
            className="text-sm font-semibold text-sky-700 hover:text-sky-900 hover:underline"
          >
            {cta} →
          </Link>
        </div>
        {children}
      </div>
    </section>
  );
}

function ProductCard({
  name,
  price,
  was,
  rating,
  reviews,
  badge,
}: {
  name: string;
  price: number;
  was: number;
  rating: number;
  reviews: number;
  badge?: string;
}) {
  const discount = Math.round(((was - price) / was) * 100);
  return (
    <article className="group overflow-hidden rounded-lg border border-transparent bg-white transition-all hover:border-slate-200 hover:shadow-md">
      <div className="relative aspect-square overflow-hidden bg-slate-100">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-100" />
        {badge && (
          <span className="absolute left-2 top-2 rounded bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-900">
            {badge}
          </span>
        )}
        <span className="absolute right-2 top-2 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">
          -{discount}%
        </span>
      </div>
      <div className="space-y-1.5 p-3">
        <p className="line-clamp-2 text-sm font-medium text-slate-900 group-hover:text-sky-700">
          {name}
        </p>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="flex items-center text-amber-500">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={12}
                strokeWidth={0}
                fill={i < Math.round(rating) ? 'currentColor' : 'none'}
                stroke="currentColor"
                className={i < Math.round(rating) ? '' : 'text-slate-300'}
              />
            ))}
          </span>
          <span className="text-slate-500">({reviews.toLocaleString()})</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-base font-bold text-slate-900">{formatINR(price)}</span>
          <span className="text-xs text-slate-400 line-through">{formatINR(was)}</span>
        </div>
      </div>
    </article>
  );
}

function Trust({
  icon: Icon,
  title,
  sub,
}: {
  icon: typeof Truck;
  title: string;
  sub: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-50 text-sky-700">
        <Icon size={20} />
      </span>
      <div>
        <p className="text-sm font-bold text-slate-900">{title}</p>
        <p className="text-xs text-slate-500">{sub}</p>
      </div>
    </div>
  );
}
