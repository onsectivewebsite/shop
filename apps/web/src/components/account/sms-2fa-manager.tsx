'use client';

import { useState } from 'react';
import { Button, Card, CardContent, Input, Label } from '@onsective/ui';
import { trpc } from '@/lib/trpc';

type Stage = 'idle' | 'awaiting-code';

export function Sms2FAManager() {
  const status = trpc.auth.smsOtp.status.useQuery();
  const utils = trpc.useUtils();
  const [stage, setStage] = useState<Stage>('idle');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const request = trpc.auth.smsOtp.requestEnrollment.useMutation({
    onSuccess: () => {
      setStage('awaiting-code');
      setError(null);
    },
    onError: (e) => setError(e.message),
  });
  const confirm = trpc.auth.smsOtp.confirmEnrollment.useMutation({
    onSuccess: () => {
      setStage('idle');
      setPhone('');
      setCode('');
      utils.auth.smsOtp.status.invalidate();
    },
    onError: (e) => setError(e.message),
  });
  const disable = trpc.auth.smsOtp.disable.useMutation({
    onSuccess: () => utils.auth.smsOtp.status.invalidate(),
  });

  const data = status.data;
  const enrolled = data?.enabled && data.verified;

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">SMS sign-in code</h2>
          <p className="mt-2 text-sm text-slate-600">
            Receive your sign-in code by text in addition to email. Standard carrier
            rates apply.
          </p>
        </div>

        {status.isLoading && <p className="text-sm text-slate-500">Loading…</p>}

        {!status.isLoading && enrolled && (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              Enabled · texts go to{' '}
              <span className="font-mono font-medium text-slate-900">{data.phone}</span>
            </p>
            <Button
              variant="ghost"
              onClick={() => disable.mutate()}
              disabled={disable.isLoading}
            >
              {disable.isLoading ? 'Disabling…' : 'Disable SMS code'}
            </Button>
          </div>
        )}

        {!status.isLoading && !enrolled && stage === 'idle' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              request.mutate({ phone });
            }}
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <Label htmlFor="sms-phone">Phone (E.164)</Label>
              <Input
                id="sms-phone"
                type="tel"
                inputMode="tel"
                placeholder="+14155552671"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
              <p className="text-xs text-slate-500">
                Include country code, no spaces or dashes.
              </p>
            </div>
            {error && <p className="text-sm text-error-600">{error}</p>}
            <Button type="submit" disabled={request.isLoading}>
              {request.isLoading ? 'Sending…' : 'Send verification text'}
            </Button>
          </form>
        )}

        {stage === 'awaiting-code' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              confirm.mutate({ phone, code });
            }}
            className="space-y-3"
          >
            <p className="text-sm text-slate-600">
              We sent a 6-digit code to{' '}
              <span className="font-mono font-medium text-slate-900">{phone}</span>.
              Enter it below to enable SMS.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="sms-code">Verification code</Label>
              <Input
                id="sms-code"
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
              <Button type="submit" disabled={confirm.isLoading || code.length !== 6}>
                {confirm.isLoading ? 'Verifying…' : 'Confirm SMS'}
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
