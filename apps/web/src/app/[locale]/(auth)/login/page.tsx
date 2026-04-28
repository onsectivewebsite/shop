import { LoginForm } from '@/components/auth/login-form';

export const metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Sign in</h1>
        <p className="mt-1 text-sm text-slate-600">Welcome back.</p>
      </div>
      <LoginForm />
    </div>
  );
}
