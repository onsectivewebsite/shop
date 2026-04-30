import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Package, Search } from 'lucide-react';

export const metadata = { title: 'Track your order' };

async function lookupOrderAction(formData: FormData): Promise<void> {
  'use server';
  const orderNumber = String(formData.get('orderNumber') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  if (!orderNumber || !email) return;
  redirect(
    `/en/track/${encodeURIComponent(orderNumber)}?email=${encodeURIComponent(email)}`,
  );
}

export default function TrackLandingPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <div className="bg-stone-50">
      <section className="container-page py-16 md:py-24">
        <div className="mx-auto max-w-xl">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-stone-900 text-white">
            <Package size={20} strokeWidth={1.75} />
          </span>
          <h1 className="mt-6 font-display text-4xl font-medium leading-tight tracking-tight text-stone-950 md:text-5xl">
            Track your order
          </h1>
          <p className="mt-4 text-base text-stone-600">
            Enter your order number and the email it was placed with. No account
            required.
          </p>

          <form action={lookupOrderAction} className="mt-10 space-y-4 rounded-3xl border border-stone-200 bg-white p-8">
            <div>
              <label className="block text-sm font-medium text-stone-700">
                Order number
              </label>
              <input
                name="orderNumber"
                required
                placeholder="ONS-2026-00001"
                className="mt-1 h-11 w-full rounded-md border border-stone-300 bg-white px-3 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700">Email</label>
              <input
                name="email"
                type="email"
                required
                placeholder="you@example.com"
                className="mt-1 h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
              />
              <p className="mt-1 text-xs text-stone-500">
                Same email used to place the order — we use it to confirm the order is yours.
              </p>
            </div>

            {searchParams.error === 'not-found' && (
              <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-900">
                That order number wasn&rsquo;t found, or the email doesn&rsquo;t match the
                buyer on file.
              </p>
            )}

            <button
              type="submit"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-stone-900 px-6 text-sm font-semibold text-white transition-colors hover:bg-stone-800"
            >
              <Search size={14} strokeWidth={2} />
              Track order
            </button>
          </form>

          <p className="mt-8 text-sm text-stone-600">
            Have an account?{' '}
            <Link href="/account/orders" className="font-medium text-stone-900 underline-offset-4 hover:underline">
              Sign in to see all your orders →
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
