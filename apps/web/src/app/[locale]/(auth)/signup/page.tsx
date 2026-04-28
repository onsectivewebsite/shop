import { SignupForm } from '@/components/auth/signup-form';

export const metadata = { title: 'Create account' };

export default function SignupPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
        <p className="mt-1 text-sm text-slate-600">
          Start buying from sellers worldwide.
        </p>
      </div>
      <SignupForm />
    </div>
  );
}
