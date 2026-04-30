'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button, Input, Label } from '@onsective/ui';
import { trpc } from '@/lib/trpc';

type Mode = 'code' | 'recovery';

export function Verify2FAForm() {
  const params = useSearchParams();
  const initialEmail = params.get('email') ?? '';
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState('');
  const [mode, setMode] = useState<Mode>('code');
  const [error, setError] = useState<string | null>(null);

  const verify = trpc.auth.verifyTwoFactor.useMutation({
    onSuccess: () => {
      window.location.href = '/';
    },
    onError: (e) => setError(e.message),
  });
  const verifyRecovery = trpc.auth.verifyRecoveryCode.useMutation({
    onSuccess: () => {
      window.location.href = '/account/security?recoveryUsed=1';
    },
    onError: (e) => setError(e.message),
  });

  const submitting = verify.isLoading || verifyRecovery.isLoading;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        if (mode === 'code') {
          verify.mutate({ email, code });
        } else {
          verifyRecovery.mutate({ email, code: recovery.trim() });
        }
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

      {mode === 'code' ? (
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
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="recovery">Recovery code</Label>
          <Input
            id="recovery"
            inputMode="text"
            autoComplete="one-time-code"
            spellCheck={false}
            required
            placeholder="xxxx-xxxx-xxxx-xx"
            value={recovery}
            onChange={(e) => setRecovery(e.target.value.toLowerCase())}
            className="text-center font-mono text-base tracking-wider"
          />
          <p className="text-xs text-slate-500">
            Using a recovery code consumes it permanently. Generate fresh codes from
            Account → Security after signing in.
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-error-600">
          {error}
        </p>
      )}

      <Button
        type="submit"
        className="w-full"
        disabled={
          submitting ||
          (mode === 'code' ? code.length !== 6 : recovery.replace(/-/g, '').length < 14)
        }
      >
        {submitting ? 'Verifying…' : 'Confirm sign-in'}
      </Button>

      <div className="pt-2 text-center text-sm">
        {mode === 'code' ? (
          <button
            type="button"
            className="text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline"
            onClick={() => {
              setMode('recovery');
              setError(null);
            }}
          >
            Use a recovery code instead
          </button>
        ) : (
          <button
            type="button"
            className="text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline"
            onClick={() => {
              setMode('code');
              setError(null);
            }}
          >
            Use the email code instead
          </button>
        )}
      </div>
    </form>
  );
}
