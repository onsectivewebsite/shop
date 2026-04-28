import Link from 'next/link';
import { prisma } from '@onsective/db';
import { Card, CardContent, Badge } from '@onsective/ui';

export const metadata = { title: 'Tickets · Console' };

export default async function ConsoleTickets() {
  const tickets = await prisma.supportTicket
    .findMany({
      where: { status: { in: ['OPEN', 'PENDING_CUSTOMER', 'PENDING_INTERNAL'] } },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: 100,
    })
    .catch(() => []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-900">Tickets</h1>

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
                <th className="px-4 py-3">Ticket</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.map((t) => (
                <tr key={t.id}>
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
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(t.updatedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/dashboard/tickets/${t.id}`} className="text-brand-600 hover:underline">
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
