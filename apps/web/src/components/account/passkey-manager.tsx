'use client';

import { useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { Button, Card, CardContent, Input, Label } from '@onsective/ui';
import { trpc } from '@/lib/trpc';

export function PasskeyManager() {
  const list = trpc.auth.passkeys.list.useQuery();
  const utils = trpc.useUtils();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const requestReg = trpc.auth.passkeys.requestRegistration.useMutation();
  const verifyReg = trpc.auth.passkeys.verifyRegistration.useMutation({
    onSuccess: () => {
      setName('');
      utils.auth.passkeys.list.invalidate();
    },
  });
  const remove = trpc.auth.passkeys.remove.useMutation({
    onSuccess: () => utils.auth.passkeys.list.invalidate(),
  });

  async function add() {
    setError(null);
    setBusy(true);
    try {
      const options = await requestReg.mutateAsync();
      const response = await startRegistration({ optionsJSON: options });
      await verifyReg.mutateAsync({ response, name: name.trim() || undefined });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not register passkey.';
      setError(msg.startsWith('NotAllowedError') ? 'Cancelled or not allowed.' : msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Add a passkey</h2>
            <p className="text-sm text-slate-500">
              Sign in with Touch ID, Windows Hello, or a hardware key. Phishing-resistant by
              design.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pk-name">Name (optional)</Label>
            <Input
              id="pk-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="iPhone 16 Pro"
              maxLength={80}
            />
          </div>
          <Button variant="cta" onClick={add} disabled={busy}>
            {busy ? 'Waiting for authenticator…' : 'Add passkey'}
          </Button>
          {error && <p className="text-sm text-error-600">{error}</p>}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Your passkeys</h2>
        {list.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
        {list.data && list.data.length === 0 && (
          <p className="text-sm text-slate-500">No passkeys registered yet.</p>
        )}
        {list.data && list.data.length > 0 && (
          <ul className="divide-y rounded-lg border border-slate-200 bg-white">
            {list.data.map((p) => (
              <li key={p.id} className="flex items-center justify-between p-4">
                <div className="text-sm">
                  <p className="font-medium text-slate-900">{p.name ?? 'Unnamed passkey'}</p>
                  <p className="text-slate-500">
                    {p.deviceType === 'multiDevice' ? 'Synced (multi-device)' : 'Single device'}
                    {p.backedUp ? ' · Backed up' : ''}
                    {' · '}
                    Added {p.createdAt.toLocaleDateString()}
                    {p.lastUsedAt && ` · Last used ${p.lastUsedAt.toLocaleDateString()}`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove.mutate({ id: p.id })}
                  disabled={remove.isLoading}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
