'use client';

import { useState } from 'react';
import { Button, Card, CardContent, Input, Label } from '@onsective/ui';
import { trpc } from '@/lib/trpc';

type Stage = 'idle' | 'awaiting-code';

export function DeleteAccountSection() {
  const eligibility = trpc.auth.deleteAccount.eligibility.useQuery();
  const [stage, setStage] = useState<Stage>('idle');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const request = trpc.auth.deleteAccount.request.useMutation({
    onSuccess: () => {
      setStage('awaiting-code');
      setError(null);
    },
    onError: (e) => setError(e.message),
  });
  const confirm = trpc.auth.deleteAccount.confirm.useMutation({
    onSuccess: () => {
      window.location.href = '/?account_deleted=1';
    },
    onError: (e) => setError(e.message),
  });

  const data = eligibility.data;
  const blocked = data && !data.canDelete;

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div>
          <h2 className="text-lg font-semibold text-error-700">Delete account</h2>
          <p className="mt-2 text-sm text-slate-600">
            Permanently scrubs your profile, addresses, payment methods, recovery codes,
            passkeys, and saved items. Past order history is retained — without your
            personal data — to comply with tax and consumer-protection law.
          </p>
        </div>

        {eligibility.isLoading && <p className="text-sm text-slate-500">Loading…</p>}

        {blocked && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-medium">You have unfinished business with us:</p>
            <ul className="mt-1 list-disc pl-5">
              {data!.blockingOrders > 0 && (
                <li>
                  {data!.blockingOrders} active{' '}
                  {data!.blockingOrders === 1 ? 'order' : 'orders'} not yet completed
                </li>
              )}
              {data!.openReturns > 0 && (
                <li>
                  {data!.openReturns} open{' '}
                  {data!.openReturns === 1 ? 'return' : 'returns'} in progress
                </li>
              )}
            </ul>
            <p className="mt-2">
              Wait for these to settle, then come back. We'll keep this option here for
              you.
            </p>
          </div>
        )}

        {!blocked && stage === 'idle' && data && (
          <Button
            variant="ghost"
            className="border-error-200 text-error-700 hover:bg-error-50"
            onClick={() => request.mutate()}
            disabled={request.isLoading}
          >
            {request.isLoading ? 'Sending code…' : 'Send confirmation code'}
          </Button>
        )}

        {stage === 'awaiting-code' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              confirm.mutate({ code });
            }}
            className="space-y-3 rounded-lg border border-error-200 bg-error-50 p-4"
          >
            <p className="text-sm text-error-900">
              We sent a 6-digit confirmation code to your email. Enter it below to
              permanently delete your account. <strong>This cannot be undone.</strong>
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="delete-code">Confirmation code</Label>
              <Input
                id="delete-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="text-center text-2xl tracking-widest"
                required
              />
            </div>
            {error && <p className="text-sm text-error-600">{error}</p>}
            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={confirm.isLoading || code.length !== 6}
                className="bg-error-600 hover:bg-error-700"
              >
                {confirm.isLoading ? 'Deleting…' : 'Delete my account'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setStage('idle');
                  setCode('');
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
