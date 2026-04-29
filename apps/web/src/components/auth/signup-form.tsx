'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Input, Label } from '@onsective/ui';
import { trpc } from '@/lib/trpc';
import { PasswordInput } from './password-input';

export function SignupForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    countryCode: 'US',
  });
  const [error, setError] = useState<string | null>(null);

  const signup = trpc.auth.signupWithEmail.useMutation({
    onSuccess: (data) =>
      router.push(`/verify-email?email=${encodeURIComponent(data.email)}`),
    onError: (e) => setError(e.message),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        signup.mutate(form);
      }}
      className="space-y-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor="fullName">Full name</Label>
        <Input
          id="fullName"
          required
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          autoComplete="name"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          autoComplete="email"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <PasswordInput
          id="password"
          required
          minLength={10}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          autoComplete="new-password"
        />
        <p className="text-xs text-slate-500">At least 10 characters.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="country">Country</Label>
        <select
          id="country"
          value={form.countryCode}
          onChange={(e) => setForm({ ...form, countryCode: e.target.value })}
          className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <option value="US">United States</option>
          <option value="IN">India</option>
          <option value="GB">United Kingdom</option>
          <option value="CA">Canada</option>
        </select>
      </div>

      {error && (
        <p role="alert" className="text-sm text-error-600">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={signup.isLoading}>
        {signup.isLoading ? 'Creating…' : 'Create account'}
      </Button>

      <p className="text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-slate-900 underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
