'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Label } from '@onsective/ui';
import { trpc } from '@/lib/trpc';

export function ForgotForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const request = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: () => {
      router.push(`/reset?email=${encodeURIComponent(email)}`);
    },
    onError: (e) => setError(e.message),
  });

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
          autoComplete="email"
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
        {request.isLoading ? 'Sending…' : 'Send reset code'}
      </Button>
    </form>
  );
}
