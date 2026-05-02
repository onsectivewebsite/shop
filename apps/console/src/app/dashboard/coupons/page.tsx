import { redirect } from 'next/navigation';
import { prisma } from '@onsective/db';
import { getConsoleSession } from '@/server/auth';
import { createCouponAction, toggleCouponActiveAction } from './actions';

export const metadata = { title: 'Coupons' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 100;

function formatValue(c: {
  type: 'PERCENT' | 'FIXED_AMOUNT';
  value: number;
  currency: string | null;
}): string {
  if (c.type === 'PERCENT') return `${(c.value / 100).toFixed(2)}% off`;
  return `${(c.value / 100).toFixed(2)} ${c.currency ?? ''} off`;
}

function statusFor(c: {
  isActive: boolean;
  validFrom: Date;
  validUntil: Date | null;
  usedCount: number;
  maxUses: number | null;
}): { label: string; tone: 'green' | 'amber' | 'slate' } {
  const now = new Date();
  if (!c.isActive) return { label: 'Disabled', tone: 'slate' };
  if (c.validFrom > now) return { label: 'Scheduled', tone: 'amber' };
  if (c.validUntil && c.validUntil < now) return { label: 'Expired', tone: 'slate' };
  if (c.maxUses !== null && c.usedCount >= c.maxUses) {
    return { label: 'Exhausted', tone: 'slate' };
  }
  return { label: 'Active', tone: 'green' };
}

export default async function CouponsPage() {
  const session = await getConsoleSession();
  if (!session) redirect('/login');

  const coupons = await prisma.coupon.findMany({
    orderBy: { createdAt: 'desc' },
    take: PAGE_SIZE,
  });

  return (
    <div className="p-6 lg:p-10">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Coupons</h1>
        <p className="mt-1 text-sm text-slate-600">
          Promotional discount codes redeemable at checkout. Platform-wide;
          per-seller scoping isn&apos;t implemented yet.
        </p>
      </header>

      <section className="mb-8 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Create new coupon
        </h2>
        <form
          action={createCouponAction}
          className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <label className="block text-xs font-medium text-slate-700">
            Code
            <input
              name="code"
              required
              maxLength={64}
              placeholder="WELCOME10"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm uppercase"
            />
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Type
            <select
              name="type"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="PERCENT">Percent off</option>
              <option value="FIXED_AMOUNT">Fixed amount off</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Value (% or major units)
            <input
              name="value"
              type="number"
              step="0.01"
              required
              min="0"
              placeholder="10"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Currency (FIXED only)
            <input
              name="currency"
              maxLength={3}
              placeholder="USD"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm uppercase"
            />
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Min order (major)
            <input
              name="minOrder"
              type="number"
              step="0.01"
              min="0"
              placeholder="0 = no min"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Max discount (major, % only)
            <input
              name="maxDiscount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0 = no cap"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Max total uses
            <input
              name="maxUses"
              type="number"
              min="0"
              placeholder="0 = unlimited"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Expires at (ISO)
            <input
              name="validUntil"
              type="datetime-local"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="col-span-full block text-xs font-medium text-slate-700">
            Internal description
            <input
              name="description"
              maxLength={500}
              placeholder="Black Friday 2026 — site-wide 10% off"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="col-span-full">
            <button
              type="submit"
              className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Create coupon
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
          Existing coupons
        </h2>
        {coupons.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            No coupons yet.
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {coupons.map((c) => {
              const status = statusFor(c);
              return (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center gap-4 p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-semibold text-slate-900">
                      {c.code}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatValue(c)}
                      {c.minOrderMinor !== null &&
                        ` · min order ${(c.minOrderMinor / 100).toFixed(2)}`}
                      {c.maxDiscountMinor !== null &&
                        ` · cap ${(c.maxDiscountMinor / 100).toFixed(2)}`}
                      {' · '}
                      {c.usedCount} / {c.maxUses ?? '∞'} used
                      {c.validUntil &&
                        ` · expires ${c.validUntil.toLocaleDateString()}`}
                    </p>
                    {c.description && (
                      <p className="mt-1 text-xs text-slate-400">{c.description}</p>
                    )}
                  </div>
                  <span
                    className={
                      status.tone === 'green'
                        ? 'rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800'
                        : status.tone === 'amber'
                          ? 'rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800'
                          : 'rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600'
                    }
                  >
                    {status.label}
                  </span>
                  <form action={toggleCouponActiveAction.bind(null, c.id)}>
                    <button
                      type="submit"
                      className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      {c.isActive ? 'Disable' : 'Enable'}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
