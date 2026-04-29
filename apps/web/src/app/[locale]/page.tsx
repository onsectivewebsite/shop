import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowUpRight, Sparkles, Clock, Heart } from 'lucide-react';
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

export default async function HomePage() {
  const t = await getTranslations('home');
  const { productCount } = await getHomeData();

  return (
    <div className="bg-stone-50">
      {/* BENTO HERO — asymmetric grid */}
      <section className="container-page pt-6 pb-10">
        <div className="grid grid-cols-12 gap-3 md:gap-4">
          {/* Big editorial — emerald */}
          <div className="col-span-12 md:col-span-7 md:row-span-2">
            <div className="relative flex h-full min-h-[420px] flex-col justify-between overflow-hidden rounded-3xl bg-emerald-700 p-8 text-white sm:p-10 md:p-12">
              <div
                className="pointer-events-none absolute inset-0 opacity-30"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 80% 20%, rgba(252, 211, 77, 0.6), transparent 50%), radial-gradient(circle at 10% 90%, rgba(167, 243, 208, 0.5), transparent 50%)',
                }}
                aria-hidden
              />
              <div className="relative">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-emerald-50 backdrop-blur">
                  <Sparkles size={12} /> Spring Edition · 24
                </span>
                <h1 className="mt-8 font-display text-5xl font-medium leading-[1.02] tracking-tight sm:text-6xl md:text-7xl">
                  Slow shopping for{' '}
                  <span className="italic font-normal text-emerald-100">
                    fast lives.
                  </span>
                </h1>
                <p className="mt-6 max-w-md text-sm leading-relaxed text-emerald-50/90 md:text-base">
                  A small, deliberate marketplace of objects, garments, and
                  rituals — sourced from independent makers across 80+ countries.
                </p>
              </div>
              <div className="relative mt-10 flex flex-wrap items-center gap-3">
                <Link
                  href="/category/electronics"
                  className="group inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-emerald-900 transition-all hover:bg-emerald-50"
                >
                  Enter the catalogue
                  <ArrowUpRight
                    size={14}
                    className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  />
                </Link>
                <Link
                  href="/sell"
                  className="text-sm font-medium text-white/80 underline-offset-4 transition-colors hover:text-white hover:underline"
                >
                  Become a maker
                </Link>
              </div>
            </div>
          </div>

          {/* Live drop — terracotta */}
          <div className="col-span-6 md:col-span-5">
            <Link
              href="/drops/spring-24"
              className="group relative flex h-full min-h-[200px] flex-col justify-between overflow-hidden rounded-3xl bg-orange-200 p-6 transition-transform hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-orange-900">
                <span className="flex h-2 w-2 animate-pulse rounded-full bg-orange-700" />
                Live drop · ends in 04 : 12 : 39
              </div>
              <div>
                <p className="font-display text-3xl font-medium leading-tight tracking-tight text-orange-950 md:text-4xl">
                  The 12-piece <em className="italic">linen capsule</em>
                </p>
                <p className="mt-2 text-sm text-orange-900/80">
                  By Studio Atelier · Lisbon
                </p>
              </div>
              <ArrowUpRight
                size={20}
                strokeWidth={1.5}
                className="absolute right-6 top-6 text-orange-900 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1"
              />
            </Link>
          </div>

          {/* Maker of the week — cream */}
          <div className="col-span-6 md:col-span-5">
            <Link
              href="/maker/aimee-yano"
              className="group relative flex h-full min-h-[200px] flex-col justify-between overflow-hidden rounded-3xl bg-stone-200 p-6 transition-transform hover:-translate-y-0.5"
            >
              <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-stone-600">
                Maker of the week
              </span>
              <div>
                <p className="font-display text-3xl font-medium leading-tight tracking-tight text-stone-900 md:text-4xl">
                  Aimée <em className="italic">Yano</em>
                </p>
                <p className="mt-2 text-sm text-stone-600">
                  Hand-thrown ceramics · Kyoto
                </p>
              </div>
              <ArrowUpRight
                size={20}
                strokeWidth={1.5}
                className="absolute right-6 top-6 text-stone-700 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1"
              />
            </Link>
          </div>
        </div>
      </section>

      {/* MOOD STRIP — dark canvas */}
      <section className="container-page py-12 md:py-20">
        <div className="rounded-[40px] bg-stone-950 p-8 text-stone-50 sm:p-12 md:p-16">
          <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-stone-400">
            Six aesthetics, six rooms
          </p>
          <h2 className="mt-6 font-display text-4xl font-medium leading-[1.05] tracking-tight md:text-6xl">
            Shop by what you <em className="italic font-normal text-amber-300">feel</em>,
            not what you need.
          </h2>
          <div className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-3">
            {[
              { name: 'Quiet luxury', count: '482 pieces', tone: 'bg-stone-100 text-stone-900' },
              { name: 'Wabi-sabi', count: '316 pieces', tone: 'bg-amber-100 text-amber-950' },
              { name: 'Y2K revival', count: '624 pieces', tone: 'bg-fuchsia-200 text-fuchsia-950' },
              { name: 'Cyber utility', count: '241 pieces', tone: 'bg-slate-200 text-slate-950' },
              { name: 'Soft minimal', count: '802 pieces', tone: 'bg-rose-100 text-rose-950' },
              { name: 'Maximalist', count: '197 pieces', tone: 'bg-emerald-100 text-emerald-950' },
            ].map((m) => (
              <Link
                key={m.name}
                href={`/mood/${m.name.toLowerCase().replace(/\s+/g, '-')}`}
                className={`group relative flex h-32 flex-col justify-between overflow-hidden rounded-2xl ${m.tone} p-5 transition-transform hover:-translate-y-1`}
              >
                <p className="font-display text-2xl font-medium tracking-tight">
                  {m.name}
                </p>
                <p className="text-xs">{m.count}</p>
                <ArrowUpRight
                  size={16}
                  strokeWidth={1.5}
                  className="absolute right-5 top-5 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1"
                />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* THE WALL — varied product card sizes */}
      <section className="container-page py-12 md:py-20">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-stone-500">
              The wall · refreshed daily
            </p>
            <h2 className="mt-4 font-display text-4xl font-medium leading-[1.05] tracking-tight text-stone-950 md:text-5xl">
              Curated this <em className="italic">week</em>
            </h2>
          </div>
          <Link
            href="/wall"
            className="hidden items-center gap-2 text-sm font-medium text-stone-700 underline-offset-4 transition-colors hover:text-stone-900 hover:underline sm:inline-flex"
          >
            See the full wall
            <ArrowUpRight size={14} strokeWidth={1.5} />
          </Link>
        </div>

        {productCount === 0 ? (
          <WallSkeleton />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <article key={i} className="group">
                <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-stone-200" />
                <p className="mt-3 text-sm text-stone-900">Product {i + 1}</p>
                <p className="text-xs text-stone-500">$00</p>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* MAKERS STRIP — horizontal cards */}
      <section className="container-page py-12 md:py-20">
        <div className="grid gap-4 md:grid-cols-3">
          <MakerCard
            tone="bg-rose-100"
            country="Portugal"
            name="Lina Costa"
            craft="Linen weaver"
            quote="Every meter holds a thousand decisions."
          />
          <MakerCard
            tone="bg-amber-50"
            country="Vietnam"
            name="Hà Phạm"
            craft="Lacquer artist"
            quote="The wood teaches you patience first."
          />
          <MakerCard
            tone="bg-stone-100"
            country="Mexico"
            name="Diego Moya"
            craft="Volcanic stone"
            quote="What is heavy is meant to last."
          />
        </div>
      </section>

      {/* CLOSING — letter from founder */}
      <section className="container-page pb-24 md:pb-40">
        <div className="mx-auto max-w-3xl rounded-[32px] border border-stone-200 bg-white p-10 sm:p-14 md:p-20">
          <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-stone-500">
            A note from the founder
          </p>
          <p className="mt-10 font-display text-2xl font-normal leading-[1.4] tracking-[-0.005em] text-stone-900 sm:text-3xl">
            We started Onsective because the world doesn&rsquo;t need another
            marketplace — it needs a <em className="italic">smaller</em> one. One
            where the maker shows up. Where the photograph is real. Where the
            object is made to be kept.
          </p>
          <div className="mt-12 flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-700 text-white">
              <Heart size={18} fill="white" strokeWidth={0} />
            </span>
            <div>
              <p className="text-sm font-medium text-stone-900">The Onsective team</p>
              <p className="text-xs text-stone-500">Lisbon · Tokyo · Mumbai</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function MakerCard({
  tone,
  country,
  name,
  craft,
  quote,
}: {
  tone: string;
  country: string;
  name: string;
  craft: string;
  quote: string;
}) {
  return (
    <Link
      href={`/maker/${name.toLowerCase().replace(/\s+/g, '-')}`}
      className={`group flex flex-col justify-between overflow-hidden rounded-3xl ${tone} p-7 transition-transform hover:-translate-y-1`}
    >
      <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-stone-700">
        <Clock size={10} /> {country}
      </div>
      <p className="mt-10 font-display text-xl italic leading-snug text-stone-900">
        &ldquo;{quote}&rdquo;
      </p>
      <div className="mt-12 flex items-end justify-between">
        <div>
          <p className="font-display text-2xl font-medium text-stone-900">{name}</p>
          <p className="text-xs text-stone-700">{craft}</p>
        </div>
        <ArrowUpRight
          size={18}
          strokeWidth={1.5}
          className="text-stone-700 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1"
        />
      </div>
    </Link>
  );
}

function WallSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => {
        const tones = [
          'bg-stone-200',
          'bg-amber-100',
          'bg-rose-100',
          'bg-emerald-100',
          'bg-fuchsia-100',
          'bg-sky-100',
          'bg-stone-300',
          'bg-orange-100',
        ];
        return (
          <article key={i} className="group">
            <div
              className={`flex aspect-[4/5] flex-col items-center justify-center overflow-hidden rounded-2xl ${tones[i % tones.length]}`}
            >
              <p className="font-display text-xs uppercase tracking-[0.32em] text-stone-700/60">
                Coming
              </p>
              <p className="font-display text-3xl italic font-normal text-stone-700/70">
                soon
              </p>
            </div>
            <p className="mt-3 text-sm text-stone-900">—</p>
            <p className="text-xs text-stone-500">in stock soon</p>
          </article>
        );
      })}
    </div>
  );
}
