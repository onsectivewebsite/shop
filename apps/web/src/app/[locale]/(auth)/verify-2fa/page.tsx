import { Suspense } from 'react';
import Link from 'next/link';
import { Verify2FAForm } from '@/components/auth/verify-2fa-form';

export const metadata = { title: 'Confirm sign-in' };

export default function Verify2FAPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-normal tracking-tight text-slate-950">
          Confirm sign-in
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          For your security, we sent a 6-digit code to your email. Enter it
          below to finish signing in.
        </p>
      </div>
      <Suspense>
        <Verify2FAForm />
      </Suspense>
      <p className="text-center text-sm text-slate-600">
        Wrong account?{' '}
        <Link href="/login" className="font-medium text-slate-900 underline-offset-4 hover:underline">
          Sign in again
        </Link>
        .
      </p>
    </div>
  );
}
