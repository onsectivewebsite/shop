'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { startAuthentication } from '@simplewebauthn/browser';
import { Button, Input, Label } from '@onsective/ui';
import { trpc } from '@/lib/trpc';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [passkeyBusy, setPasskeyBusy] = useState(false);

  const login = trpc.auth.login.useMutation({
    onSuccess: () => router.push('/'),
    onError: (e) => setError(e.message),
  });

  const passkeyRequest = trpc.auth.passkeys.requestAuthentication.useMutation();
  const passkeyVerify = trpc.auth.passkeys.verifyAuthentication.useMutation({
    onSuccess: () => router.push('/'),
  });

  async function signInWithPasskey() {
    setError(null);
    setPasskeyBusy(true);
    try {
      const options = await passkeyRequest.mutateAsync({
        email: email.trim() || undefined,
      });
      const response = await startAuthentication({ optionsJSON: options });
      await passkeyVerify.mutateAsync({
        email: email.trim() || undefined,
        response,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Passkey sign-in failed.';
      setError(msg.startsWith('NotAllowedError') ? 'Cancelled or not allowed.' : msg);
    } finally {
      setPasskeyBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        login.mutate({ email, password });
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
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link href="/forgot" className="text-sm text-brand-600 hover:underline">
            Forgot?
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={10}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-error-600">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={login.isLoading}>
        {login.isLoading ? 'Signing in…' : 'Sign in'}
      </Button>

      <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        or
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={signInWithPasskey}
        disabled={passkeyBusy}
      >
        {passkeyBusy ? 'Waiting for authenticator…' : 'Sign in with passkey'}
      </Button>

      <p className="text-center text-sm text-slate-600">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="font-medium text-brand-600 hover:underline">
          Sign up
        </Link>
      </p>
    </form>
  );
}
