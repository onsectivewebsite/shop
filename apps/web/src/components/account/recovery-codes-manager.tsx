'use client';

import { useState } from 'react';
import { Button, Card, CardContent } from '@onsective/ui';
import { trpc } from '@/lib/trpc';

export function RecoveryCodesManager() {
  const status = trpc.auth.recoveryCodes.status.useQuery();
  const utils = trpc.useUtils();
  const [generated, setGenerated] = useState<string[] | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);

  const regenerate = trpc.auth.recoveryCodes.regenerate.useMutation({
    onSuccess: ({ codes }) => {
      setGenerated(codes);
      setConfirming(false);
      utils.auth.recoveryCodes.status.invalidate();
    },
  });

  async function copyAll() {
    if (!generated) return;
    await navigator.clipboard.writeText(generated.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadTxt() {
    if (!generated) return;
    const body =
      `Onsective recovery codes — generated ${new Date().toISOString()}\n\n` +
      `Each code can be used once to sign in if you lose access to your email.\n` +
      `Keep them somewhere safe. Generating new codes invalidates all old ones.\n\n` +
      generated.join('\n') +
      '\n';
    const blob = new Blob([body], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'onsective-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  if (generated) {
    return (
      <Card>
        <CardContent className="space-y-5 p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Save these recovery codes now
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              This is the only time we'll show them. If you lose them, you'll need to
              regenerate, which invalidates this set. Each code works once.
            </p>
          </div>
          <ul className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-stone-50 p-4 font-mono text-sm sm:grid-cols-2">
            {generated.map((c) => (
              <li key={c} className="text-slate-900">
                {c}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3">
            <Button onClick={copyAll} variant="cta">
              {copied ? 'Copied' : 'Copy all'}
            </Button>
            <Button onClick={downloadTxt} variant="ghost">
              Download .txt
            </Button>
            <Button
              onClick={() => setGenerated(null)}
              variant="ghost"
              className="ml-auto"
            >
              I've saved them
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const data = status.data;
  const hasCodes = data && data.total > 0;
  const lowCount = data && data.unused > 0 && data.unused <= 3;

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Recovery codes</h2>
          <p className="mt-2 text-sm text-slate-600">
            One-time backup codes for signing in if you lose access to your email.
            Store them somewhere safe — a password manager is ideal.
          </p>
        </div>

        {status.isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : !hasCodes ? (
          <p className="text-sm text-slate-500">
            You don't have recovery codes yet.
          </p>
        ) : (
          <p className="text-sm text-slate-700">
            <span className="font-medium">
              {data.unused} of {data.total}
            </span>{' '}
            unused
            {data.generatedAt &&
              ` · generated ${new Date(data.generatedAt).toLocaleDateString()}`}
            {lowCount && (
              <span className="ml-2 rounded-sm bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-amber-900">
                Running low
              </span>
            )}
          </p>
        )}

        {!confirming && !hasCodes && (
          <Button onClick={() => regenerate.mutate()} disabled={regenerate.isLoading}>
            {regenerate.isLoading ? 'Generating…' : 'Generate recovery codes'}
          </Button>
        )}
        {!confirming && hasCodes && (
          <Button variant="ghost" onClick={() => setConfirming(true)}>
            Regenerate codes
          </Button>
        )}
        {confirming && (
          <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-900">
              Regenerating invalidates your existing {data?.total} codes immediately.
              You'll see the new ones once.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => regenerate.mutate()}
                disabled={regenerate.isLoading}
              >
                {regenerate.isLoading ? 'Generating…' : 'Yes, regenerate'}
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
        {regenerate.error && (
          <p className="text-sm text-error-600">{regenerate.error.message}</p>
        )}
      </CardContent>
    </Card>
  );
}
