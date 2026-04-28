'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@onsective/ui';
import { trpc } from '@/lib/trpc';

type Props = {
  hasAccount: boolean;
  payoutsEnabled: boolean;
  size?: 'sm' | 'md';
};

export function ConnectStripeCta({ hasAccount, payoutsEnabled, size = 'md' }: Props) {
  const params = useParams<{ locale: string }>();
  const [error, setError] = useState<string | null>(null);
  const start = trpc.seller.connect.startOnboarding.useMutation({
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (e) => setError(e.message),
  });

  if (payoutsEnabled) {
    return (
      <p className="text-sm text-success-700">
        ✓ Stripe Connect linked — payouts enabled.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        variant="cta"
        size={size}
        onClick={() => start.mutate({ locale: params?.locale ?? 'en' })}
        disabled={start.isLoading}
      >
        {start.isLoading
          ? 'Redirecting…'
          : hasAccount
            ? 'Continue Stripe onboarding →'
            : 'Connect Stripe to receive payouts →'}
      </Button>
      {error && <p className="text-sm text-error-600">{error}</p>}
    </div>
  );
}
