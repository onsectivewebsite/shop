import Link from 'next/link';
import { Badge, Button, Card, CardContent } from '@onsective/ui';
import { prisma } from '@onsective/db';

export const metadata = { title: 'Sellers · Console' };

export default async function ConsoleSellers() {
  const pending = await prisma.seller.findMany({
    where: { status: { in: ['PENDING_KYC', 'KYC_SUBMITTED'] } },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { email: true, fullName: true } } },
    take: 100,
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Sellers — Pending KYC ({pending.length})</h1>

      {pending.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="p-12 text-center text-sm text-slate-500">
            No pending KYC reviews. ✅
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Legal name</th>
                <th className="px-4 py-3">Country</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pending.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 tabular-nums">
                    {s.createdAt.toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{s.legalName}</p>
                    <p className="text-xs text-slate-500">{s.user.email}</p>
                  </td>
                  <td className="px-4 py-3">{s.countryCode}</td>
                  <td className="px-4 py-3">
                    <Badge variant="warning">{s.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/dashboard/sellers/${s.id}`}>Review →</Link>
                    </Button>
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
