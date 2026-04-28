import Link from 'next/link';
import { Button } from '@onsective/ui';

export default function ConsoleHome() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-brand-700">Onsective Console</h1>
          <p className="mt-2 text-sm text-slate-600">Internal operations.</p>
        </div>

        <div className="rounded-md border border-cta-100 bg-cta-50 p-4 text-sm text-cta-900">
          <p className="font-semibold">⚠ Auth not yet wired in console</p>
          <p className="mt-1">
            The PM/admin auth flow will live here. Sign-in goes through the main app
            cookie for now (Phase 1, ticket CONSOLE-008 — IP allowlist + 2FA).
          </p>
        </div>

        <Button asChild className="mt-6 w-full">
          <Link href="/dashboard">Open dashboard (dev)</Link>
        </Button>
      </div>
    </div>
  );
}
