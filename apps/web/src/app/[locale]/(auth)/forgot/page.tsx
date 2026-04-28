import Link from 'next/link';

export const metadata = { title: 'Forgot password' };

export default function ForgotPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Forgot your password?</h1>
        <p className="mt-1 text-sm text-slate-600">
          Use a one-time code instead while we wire the password reset flow.
        </p>
      </div>
      <Link
        href="/verify"
        className="inline-flex h-10 items-center justify-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
      >
        Sign in with a code
      </Link>
    </div>
  );
}
