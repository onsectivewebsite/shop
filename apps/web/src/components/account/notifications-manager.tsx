'use client';

import { Card, CardContent } from '@onsective/ui';
import { trpc } from '@/lib/trpc';

export function NotificationsManager() {
  const q = trpc.me.notifications.get.useQuery();
  const utils = trpc.useUtils();
  const set = trpc.me.notifications.setEmailMarketing.useMutation({
    onMutate: async ({ optIn }) => {
      // Optimistic update — toggling feels instant. Roll back on error.
      await utils.me.notifications.get.cancel();
      const prev = utils.me.notifications.get.getData();
      utils.me.notifications.get.setData(undefined, { emailMarketingOptIn: optIn });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) utils.me.notifications.get.setData(undefined, ctx.prev);
    },
    onSettled: () => utils.me.notifications.get.invalidate(),
  });

  if (q.isLoading) return <p className="text-sm text-slate-500">Loading…</p>;

  const optIn = q.data?.emailMarketingOptIn ?? false;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Marketing emails</h2>
              <p className="mt-1 text-sm text-slate-600">
                Deals, new arrivals, occasional product updates. Sent at most a
                few times a month.
              </p>
            </div>
            <Toggle
              checked={optIn}
              onChange={(v) => set.mutate({ optIn: v })}
              ariaLabel="Marketing emails"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-6 text-sm text-slate-600">
          <h2 className="text-base font-semibold text-slate-900">
            Always sent
          </h2>
          <p>
            Order updates, shipment notifications, returns, refunds, security
            alerts, and account-related messages always go through. Those are
            transactional emails — required for the platform to function — and
            ignore the marketing toggle.
          </p>
          <p>
            Want to leave entirely?{' '}
            <a
              className="font-medium text-slate-900 underline-offset-2 hover:underline"
              href="/account/security"
            >
              Delete your account
            </a>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-emerald-600' : 'bg-slate-300'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
