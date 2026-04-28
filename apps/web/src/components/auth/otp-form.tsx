'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Label } from '@onsective/ui';
import { trpc } from '@/lib/trpc';

export function OtpForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'request' | 'verify'>('request');
  const [error, setError] = useState<string | null>(null);

  const request = trpc.auth.requestEmailOtp.useMutation({
    onSuccess: () => setStage('verify'),
    onError: (e) => setError(e.message),
  });

  const verify = trpc.auth.verifyEmailOtp.useMutation({
    onSuccess: () => router.push('/'),
    onError: (e) => setError(e.message),
  });

  if (stage === 'request') {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          request.mutate({ email });
        }}
        className="space-y-4"
      >
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-error-600">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={request.isLoading}>
          {request.isLoading ? 'Sending…' : 'Send me a code'}
        </Button>
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        verify.mutate({ email, code });
      }}
      className="space-y-4"
    >
      <p className="text-sm text-slate-600">
        We sent a 6-digit code to <span className="font-medium">{email}</span>.
        <br />
        <span className="text-xs text-slate-500">
          (Dev mode: check your server console.)
        </span>
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="code">Code</Label>
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
      {error && (
        <p role="alert" className="text-sm text-error-600">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={verify.isLoading || code.length !== 6}>
        {verify.isLoading ? 'Verifying…' : 'Verify and sign in'}
      </Button>
      <button
        type="button"
        onClick={() => setStage('request')}
        className="block w-full text-center text-sm text-slate-500 hover:text-brand-600"
      >
        Use a different email
      </button>
    </form>
  );
}
