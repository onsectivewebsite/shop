import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/server/auth';
import { ReferralsManager } from '@/components/account/referrals-manager';

export const metadata = { title: 'Referrals' };
export const dynamic = 'force-dynamic';

export default async function ReferralsPage({ params }: { params: { locale: string } }) {
  const session = await getSession();
  if (!session) redirect(`/${params.locale}/login?next=/${params.locale}/account/referrals`);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-baseline justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Referrals</h1>
            <p className="mt-2 text-sm text-slate-500">
              Earn credit when friends sign up via your link and place their first
              order.
            </p>
          </div>
          <Link
            href={`/${params.locale}/account`}
            className="text-sm font-medium text-slate-700 underline-offset-4 hover:text-slate-900 hover:underline"
          >
            ← Account
          </Link>
        </header>
        <ReferralsManager baseUrl={baseUrl} />
      </div>
    </div>
  );
}
