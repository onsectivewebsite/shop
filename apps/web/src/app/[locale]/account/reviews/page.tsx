import { redirect } from 'next/navigation';
import { getSession } from '@/server/auth';
import { MyReviews } from '@/components/account/my-reviews';

export const metadata = { title: 'Your reviews' };
export const dynamic = 'force-dynamic';

export default async function ReviewsPage({ params }: { params: { locale: string } }) {
  const session = await getSession();
  if (!session) redirect(`/${params.locale}/login`);

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Your reviews</h1>
          <p className="mt-2 text-sm text-slate-500">
            Reviews you've left across the marketplace. Edit or delete within 30 days.
          </p>
        </header>
        <MyReviews />
      </div>
    </div>
  );
}
