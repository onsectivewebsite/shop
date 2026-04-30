import Link from 'next/link';
import { prisma } from '@onsective/db';
import { Card, CardContent, Badge } from '@onsective/ui';
import { SlaDot } from '@/components/sla-indicator';

export const metadata = { title: 'Tickets · Console' };
export const dynamic = 'force-dynamic';

const HOUR = 60 * 60 * 1000;

export default async function ConsoleTickets() {
  const now = new Date();
  const tickets = await prisma.supportTicket
    .findMany({
      where: { status: { in: ['OPEN', 'PENDING_CUSTOMER', 'PENDING_INTERNAL'] } },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: 100,
    })
    .catch(() => []);

  const breached = tickets.filter(
    (t) => !t.firstResponseAt && now.getTime() - t.createdAt.getTime() > 24 * HOUR,
  ).length;
  const warning = tickets.filter(
    (t) =>
      !t.firstResponseAt &&
      now.getTime() - t.createdAt.getTime() > 8 * HOUR &&
      now.getTime() - t.createdAt.getTime() <= 24 * HOUR,
  ).length;

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tickets</h1>
          <p className="mt-1 text-sm text-slate-500">
            {tickets.length} open · response SLA target 24h.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {breached > 0 && <Badge variant="error">{breached} breached</Badge>}
          {warning > 0 && <Badge variant="warning">{warning} approaching</Badge>}
        </div>
      </div>

      {tickets.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="p-12 text-center text-sm text-slate-500">
            No open tickets.
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-2 py-3"></th>
                <th className="px-4 py-3">Ticket</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Open for</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.map((t) => {
                const ageHours = Math.floor((now.getTime() - t.createdAt.getTime()) / HOUR);
                return (
                  <tr key={t.id}>
                    <td className="pl-3 pr-1">
                      <SlaDot
                        createdAt={t.createdAt}
                        firstResponseAt={t.firstResponseAt}
                        slaDueAt={t.slaDueAt}
                        resolvedAt={t.resolvedAt}
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{t.ticketNumber}</td>
                    <td className="px-4 py-3">{t.subject}</td>
                    <td className="px-4 py-3">
                      <Badge variant={t.priority === 'URGENT' ? 'error' : 'default'}>
                        {t.priority}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge>{t.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 tabular-nums">
                      {ageHours}h{!t.firstResponseAt && ' · awaiting first reply'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/dashboard/tickets/${t.id}`}
                        className="text-brand-600 hover:underline"
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
