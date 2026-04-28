'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Input, Label } from '@onsective/ui';
import { trpc } from '@/lib/trpc';

export function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reset = trpc.auth.resetPassword.useMutation({
    onSuccess: () => router.push('/'),
    onError: (e) => setError(e.message),
  });

  const passwordsMatch = password.length >= 10 && password === confirm;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        if (!passwordsMatch) {
          setError('Passwords do not match (min 10 characters).');
          return;
        }
        reset.mutate({ email, code, password });
      }}
      className="space-y-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="code">6-digit code</Label>
        <Input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          className="text-center text-2xl tracking-widest"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-error-600">
          {error}
        </p>
      )}
      <Button
        type="submit"
        className="w-full"
        disabled={reset.isLoading || !passwordsMatch || code.length !== 6}
      >
        {reset.isLoading ? 'Updating…' : 'Reset password and sign in'}
      </Button>
    </form>
  );
}
