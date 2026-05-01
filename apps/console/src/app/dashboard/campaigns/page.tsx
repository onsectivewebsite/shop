import { prisma } from '@onsective/db';
import { Badge, Card, CardContent } from '@onsective/ui';
import { sendNowAction, cancelCampaignAction } from './actions';
import { NewCampaignForm } from './new-campaign-form';

export const metadata = { title: 'Campaigns · Console' };
export const dynamic = 'force-dynamic';

const STATUS_VARIANT: Record<
  string,
  'default' | 'warning' | 'success' | 'error'
> = {
  DRAFT: 'default',
  SCHEDULED: 'warning',
  SENDING: 'warning',
  SENT: 'success',
  CANCELLED: 'default',
};

export default async function CampaignsPage() {
  const campaigns = await prisma.emailCampaign.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 100,
  });

  // Pull aggregate event counts in one round-trip rather than fanning out
  // per-campaign; keeps the page fast as the campaign archive grows.
  const ids = campaigns.map((c) => c.id);
  const events = ids.length
    ? await prisma.emailEvent.groupBy({
        by: ['campaignId', 'type'],
        where: { campaignId: { in: ids } },
        _count: { _all: true },
      })
    : [];
  const eventBy = new Map<string, Record<string, number>>();
  for (const e of events) {
    if (!e.campaignId) continue;
    const slot = eventBy.get(e.campaignId) ?? {};
    slot[e.type] = e._count._all;
    eventBy.set(e.campaignId, slot);
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Email campaigns</h1>
      <p className="mt-1 text-sm text-slate-600">
        Marketing emails. Transactional messages (orders, OTP, security) flow
        through a separate path and ignore opt-outs.
      </p>

      <div className="mt-8">
        <NewCampaignForm />
      </div>

      <h2 className="mt-12 text-sm font-semibold text-slate-700">All campaigns</h2>
      {campaigns.length === 0 ? (
        <Card className="mt-3">
          <CardContent className="p-12 text-center text-sm text-slate-500">
            No campaigns yet.
          </CardContent>
        </Card>
      ) : (
        <ul className="mt-3 space-y-3">
          {campaigns.map((c) => {
            const stats = eventBy.get(c.id) ?? {};
            const sent = stats.SENT ?? c.sentCount;
            const opens = stats.OPENED ?? 0;
            const clicks = stats.CLICKED ?? 0;
            const unsubs = stats.UNSUBSCRIBED ?? 0;
            return (
              <li key={c.id}>
                <Card>
                  <CardContent className="grid gap-4 p-5 sm:grid-cols-[1fr_auto]">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{c.name}</p>
                        <Badge variant={STATUS_VARIANT[c.status] ?? 'default'}>
                          {c.status}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-600">
                        Subject: {c.subject}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Template: <span className="font-mono">{c.templateKey}</span>
                        {c.scheduledFor && (
                          <>
                            {' · '}
                            scheduled {new Date(c.scheduledFor).toLocaleString()}
                          </>
                        )}
                        {c.sentAt && (
                          <> {' · '} sent {new Date(c.sentAt).toLocaleString()}</>
                        )}
                      </p>
                      {c.status === 'SENT' && (
                        <p className="mt-2 text-xs text-slate-700">
                          {sent.toLocaleString()} sent · {opens.toLocaleString()} opens · {clicks.toLocaleString()} clicks · {unsubs.toLocaleString()} unsubs
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {(c.status === 'DRAFT' || c.status === 'SCHEDULED') && (
                        <>
                          <form action={sendNowAction.bind(null, c.id)}>
                            <button
                              type="submit"
                              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                            >
                              Send now
                            </button>
                          </form>
                          <form action={cancelCampaignAction.bind(null, c.id)}>
                            <button
                              type="submit"
                              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                          </form>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
