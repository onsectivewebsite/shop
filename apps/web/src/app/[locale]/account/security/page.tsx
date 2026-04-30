import { redirect } from 'next/navigation';
import { getSession } from '@/server/auth';
import { RecoveryCodesManager } from '@/components/account/recovery-codes-manager';
import { Sms2FAManager } from '@/components/account/sms-2fa-manager';
import { DataExportSection } from '@/components/account/data-export-section';
import { DeleteAccountSection } from '@/components/account/delete-account-section';

export const metadata = { title: 'Security' };
export const dynamic = 'force-dynamic';

export default async function SecurityPage({ params }: { params: { locale: string } }) {
  const session = await getSession();
  if (!session) redirect(`/${params.locale}/login`);

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Security</h1>
          <p className="mt-2 text-sm text-slate-500">
            Manage how you sign in and recover access to your account.
          </p>
        </header>
        <RecoveryCodesManager />
        <Sms2FAManager />
        <DataExportSection />
        <DeleteAccountSection />
      </div>
    </div>
  );
}
