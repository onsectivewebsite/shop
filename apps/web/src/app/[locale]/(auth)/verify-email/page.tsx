import { Suspense } from 'react';
import Link from 'next/link';
import { VerifyEmailForm } from '@/components/auth/verify-email-form';

export const metadata = { title: 'Verify your email' };

export default function VerifyEmailPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-normal tracking-tight text-slate-950">
          Verify your email
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          We sent a 6-digit code to your inbox. Enter it below to finish
          creating your account.
        </p>
      </div>
      <Suspense>
        <VerifyEmailForm />
      </Suspense>
      <p className="text-center text-sm text-slate-600">
        Didn&rsquo;t get it? Check spam, or{' '}
        <Link href="/signup" className="font-medium text-slate-900 underline-offset-4 hover:underline">
          start over
        </Link>
        .
      </p>
    </div>
  );
}
