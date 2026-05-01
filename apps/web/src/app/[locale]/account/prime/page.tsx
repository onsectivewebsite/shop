import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/server/auth';
import { PrimeManager } from '@/components/account/prime-manager';

export const metadata = { title: 'Onsective Prime' };
export const dynamic = 'force-dynamic';

export default async function PrimePage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { status?: string };
}) {
  const session = await getSession();
  if (!session) redirect(`/${params.locale}/login?next=/${params.locale}/account/prime`);

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-baseline justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Prime</h1>
            <p className="mt-2 text-sm text-slate-500">
              Member benefits across Onsective. Manage your subscription here.
            </p>
          </div>
          <Link
            href={`/${params.locale}/account`}
            className="text-sm font-medium text-slate-700 underline-offset-4 hover:text-slate-900 hover:underline"
          >
            ← Account
          </Link>
        </header>

        {searchParams.status === 'success' && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            Welcome to Prime. Your perks are live — start with{' '}
            <Link
              href={`/${params.locale}`}
              className="font-medium underline-offset-2 hover:underline"
            >
              free 2-day shipping today
            </Link>
            .
          </div>
        )}
        {searchParams.status === 'cancelled' && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Checkout was cancelled. Nothing was charged.
          </div>
        )}

        <PrimeManager />
      </div>
    </div>
  );
}
