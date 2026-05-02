import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/server/auth';
import { PaymentMethodsManager } from '@/components/account/payment-methods-manager';

export const metadata = { title: 'Payment methods' };
export const dynamic = 'force-dynamic';

export default async function PaymentMethodsPage({
  params,
}: {
  params: { locale: string };
}) {
  const session = await getSession();
  if (!session) {
    redirect(`/${params.locale}/login?next=/${params.locale}/account/payment-methods`);
  }

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex items-baseline justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Payment methods
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Saved cards for one-tap checkout. Stored on Stripe; we keep
              brand + last-four for display only.
            </p>
          </div>
          <Link
            href={`/${params.locale}/account`}
            className="text-sm font-medium text-slate-700 underline-offset-4 hover:text-slate-900 hover:underline"
          >
            ← Account
          </Link>
        </header>
        <PaymentMethodsManager />
      </div>
    </div>
  );
}
