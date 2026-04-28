import { redirect } from 'next/navigation';
import { getSession } from '@/server/auth';
import { OrgManager } from '@/components/account/org-manager';

export const metadata = { title: 'Organization' };
export const dynamic = 'force-dynamic';

export default async function OrganizationPage({ params }: { params: { locale: string } }) {
  const session = await getSession();
  if (!session) redirect(`/${params.locale}/login`);

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Organization</h1>
          <p className="mt-2 text-sm text-slate-500">
            Buy on behalf of your team. Net-30 invoicing and tax exemptions are available once
            ops approves your account.
          </p>
        </header>
        <OrgManager />
      </div>
    </div>
  );
}
