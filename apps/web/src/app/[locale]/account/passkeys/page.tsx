import { redirect } from 'next/navigation';
import { getSession } from '@/server/auth';
import { PasskeyManager } from '@/components/account/passkey-manager';

export const metadata = { title: 'Passkeys' };
export const dynamic = 'force-dynamic';

export default async function PasskeysPage({ params }: { params: { locale: string } }) {
  const session = await getSession();
  if (!session) redirect(`/${params.locale}/login`);

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Passkeys</h1>
          <p className="mt-2 text-sm text-slate-500">
            Replace your password with a passkey for faster, phishing-resistant sign-in.
          </p>
        </header>
        <PasskeyManager />
      </div>
    </div>
  );
}
