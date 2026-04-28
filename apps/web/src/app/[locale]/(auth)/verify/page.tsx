import { OtpForm } from '@/components/auth/otp-form';

export const metadata = { title: 'Verify' };

export default function VerifyPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Sign in with a code</h1>
        <p className="mt-1 text-sm text-slate-600">
          Passwordless. We&apos;ll email you a 6-digit code.
        </p>
      </div>
      <OtpForm />
    </div>
  );
}
