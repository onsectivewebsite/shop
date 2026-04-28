import Link from 'next/link';
import { Suspense } from 'react';
import { ResetForm } from '@/components/auth/reset-form';

export const metadata = { title: 'Set a new password' };

export default function ResetPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-normal tracking-tight text-slate-950">
          Set a new password
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          We sent a 6-digit code to your email. Enter it below along with your
          new password.
        </p>
      </div>
      <Suspense>
        <ResetForm />
      </Suspense>
      <p className="text-center text-sm text-slate-600">
        Didn&rsquo;t get the code?{' '}
        <Link href="/forgot" className="font-medium text-slate-900 underline-offset-4 hover:underline">
          Send again
        </Link>
      </p>
    </div>
  );
}
