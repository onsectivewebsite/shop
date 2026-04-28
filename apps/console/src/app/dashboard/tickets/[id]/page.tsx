import { notFound } from 'next/navigation';
import { prisma } from '@onsective/db';
import { Card, CardContent, Badge, Button } from '@onsective/ui';
import { sendTicketReplyAction } from './actions';

export default async function TicketWorkspace({ params }: { params: { id: string } }) {
  const ticket = await prisma.supportTicket
    .findUnique({
      where: { id: params.id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    })
    .catch(() => null);
  if (!ticket) notFound();

  const replyAction = sendTicketReplyAction.bind(null, ticket.id);

  return (
    <div className="grid grid-cols-[1fr_360px]">
      <div className="p-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-sm text-slate-500">{ticket.ticketNumber}</p>
            <h1 className="text-xl font-bold">{ticket.subject}</h1>
          </div>
          <div className="flex gap-2">
            <Badge>{ticket.priority}</Badge>
            <Badge>{ticket.status}</Badge>
          </div>
        </div>

        <Card className="mt-6">
          <CardContent className="space-y-4 p-6">
            {ticket.messages.length === 0 ? (
              <p className="text-sm text-slate-500">No messages yet.</p>
            ) : (
              ticket.messages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-lg p-3 text-sm ${
                    m.isInternal
                      ? 'bg-cta-50 text-cta-900'
                      : m.authorType === 'CUSTOMER'
                        ? 'bg-slate-50'
                        : 'bg-brand-50 text-brand-900'
                  }`}
                >
                  <p className="text-xs font-semibold opacity-75">
                    {m.authorType}
                    {m.isInternal && ' · internal note'}
                    {' · '}
                    {m.createdAt.toLocaleString()}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardContent className="p-4">
            <form action={replyAction} className="space-y-2">
              <textarea
                name="body"
                placeholder="Compose reply…"
                rows={4}
                required
                maxLength={10000}
                className="w-full resize-none rounded-md border border-slate-300 p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    name="isInternal"
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  Internal note (not sent to customer)
                </label>
                <Button type="submit" variant="cta" size="sm">
                  Send
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <aside className="border-l border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase text-slate-500">Context</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-slate-500">Channel</dt>
            <dd>{ticket.channel}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Customer</dt>
            <dd>{ticket.customerEmail ?? ticket.customerId ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Related order</dt>
            <dd className="font-mono">{ticket.relatedOrderId ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">SLA due</dt>
            <dd>{ticket.slaDueAt ? new Date(ticket.slaDueAt).toLocaleString() : '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">First response</dt>
            <dd>
              {ticket.firstResponseAt ? new Date(ticket.firstResponseAt).toLocaleString() : '—'}
            </dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}
