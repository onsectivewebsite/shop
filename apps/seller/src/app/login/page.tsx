import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSellerSession } from '@/server/auth';
import { LoginForm } from './login-form';
import { SellerShell } from '@/components/seller-shell';

export const metadata = { title: 'Sign in' };

export default async function SellerLoginPage() {
  const session = await getSellerSession();
  if (session) redirect('/');

  return (
    <SellerShell>
      <div className="container-page py-16 md:py-24">
        <div className="mx-auto w-full max-w-[420px] rounded-3xl border border-stone-200 bg-white p-8 sm:p-10">
          <h1 className="font-display text-3xl font-medium tracking-tight text-stone-950">
            Welcome back.
          </h1>
          <p className="mt-2 text-sm text-stone-600">Sign in to your seller account.</p>
          <div className="mt-8">
            <LoginForm />
          </div>
          <p className="mt-6 text-center text-sm text-stone-600">
            New here?{' '}
            <Link href="/signup" className="font-medium text-stone-900 underline-offset-4 hover:underline">
              Apply to sell
            </Link>
          </p>
        </div>
      </div>
    </SellerShell>
  );
}
