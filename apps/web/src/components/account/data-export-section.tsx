'use client';

import { useEffect } from 'react';
import { Button, Card, CardContent } from '@onsective/ui';
import { trpc } from '@/lib/trpc';

export function DataExportSection() {
  const status = trpc.auth.dataExport.status.useQuery(undefined, {
    refetchInterval: (data) =>
      data?.status === 'QUEUED' || data?.status === 'RUNNING' ? 5_000 : false,
  });
  const utils = trpc.useUtils();
  const request = trpc.auth.dataExport.request.useMutation({
    onSuccess: () => utils.auth.dataExport.status.invalidate(),
  });

  // Stop polling once a terminal state lands.
  useEffect(() => {
    if (status.data && (status.data.status === 'READY' || status.data.status === 'FAILED')) {
      void status.refetch();
    }
  }, [status.data?.status]);

  const job = status.data;
  const inFlight = job?.status === 'QUEUED' || job?.status === 'RUNNING';
  const ready = job?.status === 'READY';
  const failed = job?.status === 'FAILED';

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Download your data</h2>
          <p className="mt-2 text-sm text-slate-600">
            Get a JSON file with everything we hold against your account: profile,
            addresses, orders, returns, reviews, wishlist. We email you a download link
            that expires in 24 hours.
          </p>
        </div>

        {status.isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : null}

        {inFlight && (
          <p className="text-sm text-slate-700">
            Preparing your export… we'll email{' '}
            <span className="font-medium">{job.emailedTo}</span> once it's ready. This
            usually takes under a minute.
          </p>
        )}

        {ready && job && (
          <p className="text-sm text-slate-700">
            Last export delivered to{' '}
            <span className="font-medium">{job.emailedTo}</span> on{' '}
            {job.completedAt ? new Date(job.completedAt).toLocaleString() : '—'}
            {job.bytes ? ` · ${Math.round(job.bytes / 1024)} KB` : ''}
            {job.expiresAt ? ` · link expires ${new Date(job.expiresAt).toLocaleString()}` : ''}
          </p>
        )}

        {failed && (
          <p className="text-sm text-error-600">
            The previous export failed. Try again — we'll retry behind the scenes.
          </p>
        )}

        <Button
          onClick={() => request.mutate()}
          disabled={request.isLoading || inFlight}
        >
          {request.isLoading
            ? 'Requesting…'
            : inFlight
              ? 'Preparing your export…'
              : ready
                ? 'Request a fresh export'
                : 'Request my data'}
        </Button>

        {request.error && (
          <p className="text-sm text-error-600">{request.error.message}</p>
        )}
      </CardContent>
    </Card>
  );
}
