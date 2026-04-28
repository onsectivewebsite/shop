import Link from 'next/link';
import { ForgotForm } from '@/components/auth/forgot-form';

export const metadata = { title: 'Reset your password' };

export default function ForgotPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-normal tracking-tight text-slate-950">
          Reset your password
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter your account email and we&rsquo;ll send a 6-digit code to set a
          new password.
        </p>
      </div>
      <ForgotForm />
      <p className="text-center text-sm text-slate-600">
        Remembered it?{' '}
        <Link href="/login" className="font-medium text-slate-900 underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
