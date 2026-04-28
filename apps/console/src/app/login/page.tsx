import { redirect } from 'next/navigation';
import { LoginForm } from './login-form';
import { getConsoleSession } from '@/server/auth';

export const metadata = { title: 'Sign in · Console' };

export default async function ConsoleLoginPage() {
  const session = await getConsoleSession();
  if (session) redirect('/dashboard');

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-brand-700">Onsective Console</h1>
        <p className="mt-1 text-sm text-slate-500">Internal staff only.</p>
        <div className="mt-6">
          <LoginForm />
        </div>
        <p className="mt-6 text-xs text-slate-400">
          Access is restricted to verified PMs and admins. All actions audited.
        </p>
      </div>
    </div>
  );
}
