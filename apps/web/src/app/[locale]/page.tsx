import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowUpRight } from 'lucide-react';
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
  const { categories, productCount } = await getHomeData();

  return (
    <div>
      {/* HERO — full-bleed, generous, single statement */}
      <section className="relative bg-white">
        <div className="container-page">
          <div className="grid min-h-[78vh] grid-cols-1 items-center gap-16 py-24 md:grid-cols-12 md:py-32">
            <div className="md:col-span-7">
              <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-slate-500">
                A worldwide marketplace
              </p>
              <h1 className="mt-10 font-display text-[64px] font-normal leading-[0.98] tracking-[-0.03em] text-slate-950 sm:text-[88px] md:text-[112px] lg:text-[132px]">
                Things <em className="italic font-display font-normal text-slate-400">worth</em>
                <br />
                owning.
              </h1>
              <p className="mt-12 max-w-md text-base leading-relaxed text-slate-600">
                A small, deliberate selection from the world&rsquo;s independent
                makers — sourced for quality, not quantity.
              </p>
              <div className="mt-16 flex flex-wrap items-center gap-8">
                <Link
                  href="/category/electronics"
                  className="group inline-flex items-center gap-3 border-b border-slate-900 pb-1 text-[13px] font-medium uppercase tracking-[0.18em] text-slate-900 transition-opacity hover:opacity-60"
                >
                  Browse the catalogue
                  <ArrowUpRight
                    size={14}
                    strokeWidth={1.5}
                    className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1"
                  />
                </Link>
                <Link
                  href="/sell"
                  className="text-[13px] font-medium uppercase tracking-[0.18em] text-slate-500 transition-colors hover:text-slate-900"
                >
                  Become a maker
                </Link>
              </div>
            </div>
            <div className="hidden md:col-span-5 md:block">
              <div className="relative aspect-[4/5] overflow-hidden rounded-sm bg-slate-100">
                <div className="absolute inset-0 bg-gradient-to-br from-stone-200 via-stone-100 to-amber-50" />
                <div
                  className="absolute inset-0 opacity-[0.06]"
                  style={{
                    backgroundImage:
                      'radial-gradient(circle at 1px 1px, #0f172a 1px, transparent 0)',
                    backgroundSize: '20px 20px',
                  }}
                />
                <div className="absolute bottom-8 left-8 right-8">
                  <p className="font-display text-2xl font-normal italic leading-tight text-slate-700">
                    &ldquo;Buy less, but better.&rdquo;
                  </p>
                  <p className="mt-3 text-xs uppercase tracking-[0.24em] text-slate-500">
                    The Onsective philosophy
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* THIN DIVIDER */}
      <div className="container-page">
        <div className="border-t border-slate-200" />
      </div>

      {/* CATEGORIES — editorial list, no cards */}
      <section className="bg-white">
        <div className="container-page py-32 md:py-40">
          <div className="grid grid-cols-1 gap-16 md:grid-cols-12">
            <div className="md:col-span-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-slate-500">
                Departments
              </p>
              <h2 className="mt-8 font-display text-5xl font-normal leading-[1.05] tracking-[-0.02em] text-slate-950 md:text-6xl">
                Eight rooms.
                <br />
                <em className="italic text-slate-400">Quietly</em> curated.
              </h2>
            </div>
            <ul className="md:col-span-8 md:pl-8">
              {categories.map((c, i) => (
                <li
                  key={c.id}
                  className={i === 0 ? 'border-y border-slate-200' : 'border-b border-slate-200'}
                >
                  <Link
                    href={`/category/${c.slug}`}
                    className="group flex items-baseline justify-between gap-8 py-8 transition-colors"
                  >
                    <div className="flex items-baseline gap-8">
                      <span className="font-display text-sm tabular-nums text-slate-400">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="font-display text-3xl font-normal tracking-[-0.01em] text-slate-900 transition-colors group-hover:text-slate-500 md:text-4xl">
                        {c.name}
                      </span>
                    </div>
                    <ArrowUpRight
                      size={20}
                      strokeWidth={1}
                      className="text-slate-400 transition-all group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-slate-900"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* MANIFESTO — quiet block, single statement */}
      <section className="bg-stone-50">
        <div className="container-page py-32 md:py-44">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-slate-500">
              Our standard
            </p>
            <p className="mt-12 font-display text-3xl font-normal leading-[1.25] tracking-[-0.01em] text-slate-900 sm:text-4xl md:text-5xl">
              Every piece in the catalogue is{' '}
              <em className="italic text-slate-500">vetted, photographed,</em> and
              shipped against a single standard — the one we&rsquo;d hold for
              ourselves.
            </p>
          </div>
        </div>
      </section>

      {/* DROP — empty state or product strip */}
      <section className="bg-white">
        <div className="container-page py-32 md:py-40">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-slate-500">
                Latest
              </p>
              <h2 className="mt-8 font-display text-5xl font-normal leading-[1.05] tracking-[-0.02em] text-slate-950 md:text-6xl">
                The current drop.
              </h2>
            </div>
            <Link
              href="/trending"
              className="group hidden items-center gap-2 text-[13px] font-medium uppercase tracking-[0.18em] text-slate-500 transition-colors hover:text-slate-900 sm:inline-flex"
            >
              View all
              <ArrowUpRight
                size={14}
                strokeWidth={1.5}
                className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </Link>
          </div>

          {productCount === 0 ? (
            <div className="mt-20 grid grid-cols-1 gap-px bg-slate-200 sm:grid-cols-2 md:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex aspect-[3/4] flex-col items-center justify-center bg-white p-10 text-center"
                >
                  <p className="font-display text-xs uppercase tracking-[0.32em] text-slate-300">
                    Coming
                  </p>
                  <p className="mt-3 font-display text-3xl italic font-normal text-slate-300">
                    soon
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-16 grid grid-cols-1 gap-12 sm:grid-cols-2 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <article key={i} className="group">
                  <div className="aspect-[4/5] bg-slate-100" />
                  <p className="mt-4 font-display text-base text-slate-900">Product name</p>
                  <p className="mt-1 text-sm text-slate-500">$00</p>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CLOSING — split letter / sellers */}
      <section className="border-t border-slate-200 bg-white">
        <div className="container-page py-32 md:py-44">
          <div className="grid grid-cols-1 gap-20 md:grid-cols-12">
            <div className="md:col-span-7">
              <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-slate-500">
                For makers
              </p>
              <h2 className="mt-10 font-display text-5xl font-normal leading-[1.05] tracking-[-0.02em] text-slate-950 md:text-6xl">
                Sell to a quiet,{' '}
                <em className="italic text-slate-400">discerning</em> world.
              </h2>
              <p className="mt-10 max-w-xl text-base leading-relaxed text-slate-600">
                We carry a small number of sellers. We promote them honestly. We
                pay weekly. We handle the cross-border tax and the support tickets
                so the maker stays the maker.
              </p>
              <Link
                href="/sell"
                className="group mt-12 inline-flex items-center gap-3 border-b border-slate-900 pb-1 text-[13px] font-medium uppercase tracking-[0.18em] text-slate-900 transition-opacity hover:opacity-60"
              >
                Apply to sell
                <ArrowUpRight
                  size={14}
                  strokeWidth={1.5}
                  className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1"
                />
              </Link>
            </div>
            <div className="md:col-span-5 md:pl-8">
              <dl className="space-y-12 border-l border-slate-200 pl-8">
                <Stat label="Commission" value="8 — 15%" sub="Tiered by category. No subscription." />
                <Stat label="Payouts" value="Weekly" sub="Direct to bank via Stripe Connect." />
                <Stat label="Markets" value="80+" sub="With customs handled centrally." />
              </dl>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-[0.32em] text-slate-400">
        {label}
      </dt>
      <dd className="mt-3 font-display text-4xl font-normal tracking-[-0.02em] text-slate-900">
        {value}
      </dd>
      <p className="mt-3 text-sm text-slate-500">{sub}</p>
    </div>
  );
}
