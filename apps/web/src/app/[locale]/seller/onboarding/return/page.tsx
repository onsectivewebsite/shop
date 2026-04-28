import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardContent, Button } from '@onsective/ui';
import { getSession } from '@/server/auth';
import { prisma } from '@/server/db';
import { refreshAccountStatus } from '@/server/connect';

export const metadata = { title: 'Stripe onboarding' };
export const dynamic = 'force-dynamic';

export default async function OnboardingReturnPage({
  params,
}: {
  params: { locale: string };
}) {
  const session = await getSession();
  if (!session) redirect(`/${params.locale}/login`);

  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } });
  if (!seller) redirect(`/${params.locale}/seller`);
  if (!seller.stripeAccountId) redirect(`/${params.locale}/seller`);

  let status: Awaited<ReturnType<typeof refreshAccountStatus>> | null = null;
  let error: string | null = null;
  try {
    status = await refreshAccountStatus(seller.id);
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to refresh Stripe status.';
  }

  const ready = status?.payoutsEnabled === true;

  return (
    <div className="container-page py-12">
      <Card className="mx-auto max-w-xl">
        <CardContent className="space-y-4 p-8">
          <h1 className="text-2xl font-bold">
            {ready ? 'Stripe is ready' : 'Onboarding not complete'}
          </h1>

          {error && <p className="text-sm text-error-600">{error}</p>}

          {ready ? (
            <>
              <p className="text-sm text-slate-600">
                Your Stripe Connect account is fully set up. Payouts will land in your bank
                account on the schedule defined in Phase 2 (T+7 after delivery).
              </p>
              <div className="flex gap-3 pt-2">
                <Button asChild variant="cta">
                  <Link href={`/${params.locale}/seller/payouts`}>View payouts</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/${params.locale}/seller`}>Back to dashboard</Link>
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                Stripe still needs a few details before you can receive payouts. You can
                resume onboarding from the dashboard at any time.
              </p>
              {status && status.requirementsCurrentlyDue.length > 0 && (
                <div className="rounded-md border border-warning-200 bg-warning-50 p-3 text-xs text-warning-700">
                  <p className="font-semibold">Still due:</p>
                  <ul className="mt-1 list-disc pl-4">
                    {status.requirementsCurrentlyDue.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="pt-2">
                <Button asChild variant="cta">
                  <Link href={`/${params.locale}/seller`}>Back to dashboard</Link>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
