import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  ArrowUpRight,
  Smartphone,
  Sparkles,
  Shirt,
  Home as HomeIcon,
  BookOpen,
  ToyBrick,
  ShoppingBasket,
  Dumbbell,
  Star,
  Truck,
  ShieldCheck,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { prisma } from '@/server/db';

async function getHomeData() {
  const [productCount] = await Promise.all([
    prisma.product.count({ where: { status: 'ACTIVE' } }),
  ]);
  return { productCount };
}

type CategoryTile = {
  name: string;
  slug: string;
  count: string;
  icon: LucideIcon;
  bg: string;
  fg: string;
};

const CATEGORIES: CategoryTile[] = [
  { name: 'Electronics', slug: 'electronics', count: '12,840 items', icon: Smartphone, bg: 'bg-sky-100', fg: 'text-sky-900' },
  { name: 'Beauty', slug: 'beauty', count: '8,210 items', icon: Sparkles, bg: 'bg-pink-100', fg: 'text-pink-900' },
  { name: 'Fashion', slug: 'fashion', count: '24,617 items', icon: Shirt, bg: 'bg-violet-100', fg: 'text-violet-900' },
  { name: 'Home & Kitchen', slug: 'home', count: '15,420 items', icon: HomeIcon, bg: 'bg-emerald-100', fg: 'text-emerald-900' },
  { name: 'Books', slug: 'books', count: '6,981 items', icon: BookOpen, bg: 'bg-amber-100', fg: 'text-amber-900' },
  { name: 'Toys & Kids', slug: 'toys', count: '4,256 items', icon: ToyBrick, bg: 'bg-cyan-100', fg: 'text-cyan-900' },
  { name: 'Grocery', slug: 'grocery', count: '11,134 items', icon: ShoppingBasket, bg: 'bg-lime-100', fg: 'text-lime-900' },
  { name: 'Sports', slug: 'sports', count: '7,503 items', icon: Dumbbell, bg: 'bg-orange-100', fg: 'text-orange-900' },
];

type SampleProduct = {
  name: string;
  price: number;
  was: number;
  rating: number;
  reviews: number;
  category: string;
  bg: string;
  badge?: string;
};

const SAMPLE_PRODUCTS: SampleProduct[] = [
  { name: 'Sony WH-1000XM5 Wireless Headphones', price: 24999, was: 32999, rating: 4.7, reviews: 2841, category: 'Electronics', bg: 'bg-sky-100', badge: 'Best Seller' },
  { name: 'Vitamin C Brightening Serum 30ml', price: 1899, was: 2999, rating: 4.6, reviews: 4128, category: 'Beauty', bg: 'bg-pink-100', badge: 'Editor pick' },
  { name: 'Linen Oversized Shirt — Sand', price: 4499, was: 6999, rating: 4.5, reviews: 612, category: 'Fashion', bg: 'bg-violet-100' },
  { name: 'Ceramic Non-stick Pan Set (5 pc)', price: 8999, was: 14999, rating: 4.8, reviews: 932, category: 'Home', bg: 'bg-emerald-100', badge: 'Top rated' },
  { name: 'Atomic Habits — James Clear', price: 599, was: 999, rating: 4.9, reviews: 18420, category: 'Books', bg: 'bg-amber-100' },
  { name: 'Wooden Building Blocks (100 pc)', price: 1999, was: 2999, rating: 4.6, reviews: 412, category: 'Toys', bg: 'bg-cyan-100' },
  { name: 'Stainless Insulated Bottle 1L', price: 999, was: 1499, rating: 4.7, reviews: 5402, category: 'Sports', bg: 'bg-orange-100', badge: '#1 in Bottles' },
  { name: 'Cold-pressed Olive Oil 500ml', price: 799, was: 1199, rating: 4.4, reviews: 234, category: 'Grocery', bg: 'bg-lime-100' },
];

function fmt(minor: number) {
  return `$${(minor / 100).toFixed(2)}`;
}

export default async function HomePage() {
  const t = await getTranslations('home');
  const { productCount } = await getHomeData();

  return (
    <div className="bg-stone-50">
      {/* HERO — asymmetric bento with featured banner + spotlight + sell CTA */}
      <section className="container-page pt-6 pb-8">
        <div className="grid grid-cols-12 gap-3 md:gap-4">
          {/* Big banner — gradient, dark */}
          <div className="col-span-12 md:col-span-8 md:row-span-2">
            <div className="relative flex h-full min-h-[440px] flex-col justify-between overflow-hidden rounded-[28px] bg-stone-950 p-8 text-white sm:p-10 md:p-14">
              <div
                className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-pink-400/30 blur-3xl"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-emerald-400/25 blur-3xl"
                aria-hidden
              />
              <div className="relative">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80 backdrop-blur">
                  <Zap size={12} className="text-amber-300" />
                  Spring sale · up to 60% off
                </span>
                <h1 className="mt-8 font-display text-5xl font-medium leading-[1.0] tracking-tight sm:text-6xl md:text-7xl">
                  Everything you want.{' '}
                  <span className="italic font-normal text-pink-200">Everywhere.</span>
                </h1>
                <p className="mt-6 max-w-xl text-base text-white/70 md:text-lg">
                  Electronics, beauty, fashion, home, sports — sourced from
                  thousands of trusted sellers in 80+ countries.
                </p>
              </div>
              <div className="relative mt-10 flex flex-wrap items-center gap-3">
                <Link
                  href="/category/electronics"
                  className="group inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-stone-950 transition-all hover:bg-stone-100"
                >
                  Start shopping
                  <ArrowUpRight
                    size={14}
                    className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  />
                </Link>
                <Link
                  href="/deals"
                  className="text-sm font-medium text-white/80 underline-offset-4 transition-colors hover:text-white hover:underline"
                >
                  See today&rsquo;s deals →
                </Link>
              </div>
            </div>
          </div>

          {/* Spotlight product — pink */}
          <div className="col-span-6 md:col-span-4">
            <Link
              href="/product/sony-wh-1000xm5"
              className="group relative flex h-full min-h-[210px] flex-col justify-between overflow-hidden rounded-[28px] bg-pink-100 p-7 transition-transform hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-pink-900">
                <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-pink-700" />
                Trending in beauty
              </div>
              <div>
                <p className="text-xs font-medium text-pink-700">Editor&rsquo;s pick</p>
                <p className="mt-2 font-display text-2xl font-medium leading-tight tracking-tight text-pink-950 md:text-3xl">
                  Vitamin C serum
                </p>
                <p className="mt-2 text-sm text-pink-900/80">
                  4.6 ★ · 4,128 reviews · from $18.99
                </p>
              </div>
              <ArrowUpRight
                size={20}
                strokeWidth={1.5}
                className="absolute right-7 top-7 text-pink-900 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1"
              />
            </Link>
          </div>

          {/* Sell CTA — emerald */}
          <div className="col-span-6 md:col-span-4">
            <Link
              href="/sell"
              className="group relative flex h-full min-h-[210px] flex-col justify-between overflow-hidden rounded-[28px] bg-emerald-700 p-7 text-white transition-transform hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
                For sellers
              </div>
              <div>
                <p className="font-display text-2xl font-medium leading-tight tracking-tight md:text-3xl">
                  Reach buyers across <em className="italic">80+ countries</em>
                </p>
                <p className="mt-2 text-sm text-emerald-100/85">
                  We handle payments, fraud & shipping. You handle the craft.
                </p>
              </div>
              <ArrowUpRight
                size={20}
                strokeWidth={1.5}
                className="absolute right-7 top-7 text-white transition-transform group-hover:-translate-y-1 group-hover:translate-x-1"
              />
            </Link>
          </div>
        </div>
      </section>

      {/* CATEGORY GRID — 8 colored bento tiles */}
      <section className="container-page py-10 md:py-16">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-stone-500">
              Shop by category
            </p>
            <h2 className="mt-3 font-display text-4xl font-medium leading-tight tracking-tight text-stone-950 md:text-5xl">
              Eight worlds, <em className="italic">one</em> marketplace.
            </h2>
          </div>
          <Link
            href="/categories"
            className="hidden items-center gap-2 text-sm font-medium text-stone-700 underline-offset-4 transition-colors hover:text-stone-950 hover:underline sm:inline-flex"
          >
            All categories
            <ArrowUpRight size={14} strokeWidth={1.5} />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            return (
              <Link
                key={c.slug}
                href={`/category/${c.slug}`}
                className={`group relative flex h-44 flex-col justify-between overflow-hidden rounded-3xl ${c.bg} p-5 transition-transform hover:-translate-y-1`}
              >
                <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/70 ${c.fg}`}>
                  <Icon size={20} strokeWidth={1.75} />
                </span>
                <div>
                  <p className={`font-display text-xl font-medium tracking-tight ${c.fg}`}>
                    {c.name}
                  </p>
                  <p className={`mt-1 text-xs ${c.fg} opacity-70`}>{c.count}</p>
                </div>
                <ArrowUpRight
                  size={16}
                  strokeWidth={1.75}
                  className={`absolute right-5 top-5 ${c.fg} transition-transform group-hover:-translate-y-1 group-hover:translate-x-1`}
                />
              </Link>
            );
          })}
        </div>
      </section>

      {/* TRENDING NOW — colored product cards */}
      <ProductRow
        eyebrow="Trending now"
        title={'What’s flying off our shelves'}
        cta="See all bestsellers"
        href="/best-sellers"
        products={SAMPLE_PRODUCTS}
      />

      {/* DEAL OF THE DAY — full-bleed canvas */}
      <section className="container-page py-10 md:py-16">
        <div className="grid grid-cols-12 gap-3 md:gap-4">
          <div className="col-span-12 md:col-span-7">
            <div className="relative flex h-full min-h-[280px] flex-col justify-between overflow-hidden rounded-[28px] bg-amber-100 p-8 sm:p-10">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-900">
                <Clock /> Deal ends in 04 : 12 : 39
              </div>
              <div>
                <p className="text-xs font-medium text-amber-800">Today only</p>
                <p className="mt-2 font-display text-4xl font-medium leading-tight tracking-tight text-amber-950 sm:text-5xl">
                  Up to 50% off all kitchen
                </p>
                <p className="mt-2 max-w-md text-sm text-amber-900/80">
                  Cookware, knives, storage, small appliances — limited stock.
                </p>
              </div>
              <Link
                href="/category/home"
                className="group mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-amber-950 px-5 py-2.5 text-sm font-semibold text-amber-50 transition-colors hover:bg-amber-900"
              >
                Shop the deal
                <ArrowUpRight
                  size={14}
                  className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                />
              </Link>
            </div>
          </div>

          <div className="col-span-12 grid grid-cols-2 gap-3 md:col-span-5 md:gap-4">
            <DealMini bg="bg-pink-100" fg="text-pink-900" pct="-30%" name="Beauty bestsellers" />
            <DealMini bg="bg-sky-100" fg="text-sky-900" pct="-25%" name="Smart audio" />
            <DealMini bg="bg-violet-100" fg="text-violet-900" pct="-40%" name="Wardrobe refresh" />
            <DealMini bg="bg-orange-100" fg="text-orange-900" pct="-35%" name="Gym essentials" />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS — 3-step row */}
      <section className="container-page py-10 md:py-16">
        <div className="rounded-[32px] bg-stone-950 p-10 text-white sm:p-14 md:p-20">
          <div className="grid gap-12 md:grid-cols-12 md:gap-16">
            <div className="md:col-span-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-stone-500">
                How Onsective works
              </p>
              <h2 className="mt-6 font-display text-4xl font-medium leading-tight tracking-tight text-white md:text-5xl">
                Buy <em className="italic text-emerald-300">honestly</em>. Sell{' '}
                <em className="italic text-pink-300">globally</em>.
              </h2>
              <p className="mt-6 max-w-md text-sm text-white/70">
                We charge sellers a small 8–15% commission and pass everything
                else through. No subscriptions, no listing fees, no hidden cuts.
              </p>
            </div>
            <ol className="md:col-span-7 md:pt-2">
              <Step n="01" title="Sellers list products" body="With photos, variants, and inventory. Approval in 24h." />
              <Step n="02" title="Buyers shop & pay safely" body="Stripe-secured checkout. Buyer protection on every order." />
              <Step n="03" title="We handle the rest" body="Shipping, fraud, returns, taxes — and weekly seller payouts." />
            </ol>
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <section className="container-page py-10 md:py-16">
        <div className="grid gap-3 sm:grid-cols-3">
          <Trust icon={Truck} title="Free shipping" sub="On orders over $50, worldwide" />
          <Trust icon={ShieldCheck} title="Buyer protection" sub="Or your money back, every order" />
          <Trust icon={Star} title="Trusted sellers" sub="Each one verified before listing" />
        </div>
      </section>

      {/* CLOSING SELLER STRIP */}
      <section className="container-page pb-20 md:pb-32">
        <Link
          href="/sell"
          className="group relative flex flex-col justify-between gap-6 overflow-hidden rounded-[32px] bg-emerald-700 p-10 text-white transition-transform hover:-translate-y-0.5 sm:p-14 md:flex-row md:items-end md:p-16"
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-100">
              Sell on Onsective
            </p>
            <p className="mt-4 max-w-2xl font-display text-4xl font-medium leading-tight tracking-tight md:text-5xl">
              Got something to sell?{' '}
              <em className="italic text-emerald-200">List it in five minutes.</em>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-emerald-900 transition-all group-hover:bg-emerald-50">
              Apply to sell
              <ArrowUpRight size={14} strokeWidth={2} />
            </span>
          </div>
        </Link>
      </section>

      {productCount === 0 && (
        <div className="container-page pb-12 -mt-8">
          <div className="rounded-2xl border border-stone-200 bg-white px-5 py-3 text-xs text-stone-500">
            <strong className="text-stone-700">Note:</strong> products and counts on
            this page are placeholders — real listings appear automatically once
            sellers onboard their catalog.
          </div>
        </div>
      )}
    </div>
  );
}

function Clock() {
  return (
    <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-amber-700" aria-hidden />
  );
}

function ProductRow({
  eyebrow,
  title,
  cta,
  href,
  products,
}: {
  eyebrow: string;
  title: string;
  cta: string;
  href: string;
  products: SampleProduct[];
}) {
  return (
    <section className="container-page py-10 md:py-16">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-stone-500">
            {eyebrow}
          </p>
          <h2 className="mt-3 font-display text-3xl font-medium leading-tight tracking-tight text-stone-950 md:text-4xl">
            {title}
          </h2>
        </div>
        <Link
          href={href}
          className="hidden items-center gap-2 text-sm font-medium text-stone-700 underline-offset-4 transition-colors hover:text-stone-950 hover:underline sm:inline-flex"
        >
          {cta}
          <ArrowUpRight size={14} strokeWidth={1.5} />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4">
        {products.map((p, i) => (
          <ProductCard key={i} product={p} />
        ))}
      </div>
    </section>
  );
}

function ProductCard({ product }: { product: SampleProduct }) {
  const discount = Math.round(((product.was - product.price) / product.was) * 100);
  return (
    <Link
      href="#"
      className="group block overflow-hidden rounded-3xl border border-stone-200/60 bg-white transition-all hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-[0_12px_40px_rgba(0,0,0,0.06)]"
    >
      <div className={`relative aspect-square overflow-hidden ${product.bg}`}>
        {product.badge && (
          <span className="absolute left-3 top-3 rounded-full bg-stone-950 px-3 py-1 text-[10px] font-semibold text-white">
            {product.badge}
          </span>
        )}
        <span className="absolute right-3 top-3 rounded-full bg-rose-600 px-3 py-1 text-[10px] font-bold text-white">
          -{discount}%
        </span>
        <span className="absolute bottom-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-stone-700 opacity-0 transition-opacity group-hover:opacity-100">
          <Heart />
        </span>
      </div>
      <div className="space-y-1.5 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
          {product.category}
        </p>
        <p className="line-clamp-2 text-sm font-medium text-stone-900">
          {product.name}
        </p>
        <div className="flex items-center gap-1.5 text-xs text-stone-500">
          <span className="flex items-center text-amber-500">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={11}
                strokeWidth={0}
                fill={i < Math.round(product.rating) ? 'currentColor' : 'none'}
                stroke="currentColor"
                className={i < Math.round(product.rating) ? '' : 'text-stone-300'}
              />
            ))}
          </span>
          ({product.reviews.toLocaleString()})
        </div>
        <div className="flex items-baseline gap-2 pt-1">
          <span className="text-base font-bold text-stone-950">{fmt(product.price)}</span>
          <span className="text-xs text-stone-400 line-through">{fmt(product.was)}</span>
        </div>
      </div>
    </Link>
  );
}

function Heart() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
    </svg>
  );
}

function DealMini({ bg, fg, pct, name }: { bg: string; fg: string; pct: string; name: string }) {
  return (
    <Link
      href="/deals"
      className={`group relative flex h-full min-h-[130px] flex-col justify-between overflow-hidden rounded-3xl ${bg} p-5 transition-transform hover:-translate-y-1`}
    >
      <p className={`font-display text-2xl font-bold tracking-tight ${fg}`}>{pct}</p>
      <p className={`text-sm font-medium ${fg}`}>{name}</p>
      <ArrowUpRight
        size={14}
        strokeWidth={1.75}
        className={`absolute right-5 top-5 ${fg} transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5`}
      />
    </Link>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className="flex items-start gap-6 border-b border-white/10 py-7 last:border-b-0">
      <span className="font-display text-3xl font-medium tabular-nums text-white/40">
        {n}
      </span>
      <div>
        <p className="font-display text-2xl font-medium tracking-tight text-white">{title}</p>
        <p className="mt-2 max-w-md text-sm text-white/70">{body}</p>
      </div>
    </li>
  );
}

function Trust({
  icon: Icon,
  title,
  sub,
}: {
  icon: LucideIcon;
  title: string;
  sub: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-white p-5">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-950 text-white">
        <Icon size={20} strokeWidth={1.75} />
      </span>
      <div>
        <p className="text-sm font-semibold text-stone-950">{title}</p>
        <p className="text-xs text-stone-500">{sub}</p>
      </div>
    </div>
  );
}
