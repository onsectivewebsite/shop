import { Card, CardContent } from '@onsective/ui';
import { prisma } from '@onsective/db';

async function getStats() {
  const [pendingSellers, pendingProducts, openDisputes, openTickets] = await Promise.all([
    prisma.seller.count({ where: { status: { in: ['PENDING_KYC', 'KYC_SUBMITTED'] } } }),
    prisma.product.count({ where: { status: 'PENDING_REVIEW' } }),
    Promise.resolve(0), // disputes table populated Phase 2
    prisma.supportTicket.count({ where: { status: 'OPEN' } }).catch(() => 0),
  ]);
  return { pendingSellers, pendingProducts, openDisputes, openTickets };
}

export default async function ConsoleDashboard() {
  const stats = await getStats();

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-900">Operations dashboard</h1>
      <p className="mt-1 text-sm text-slate-600">Action queues — work top to bottom.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QueueCard label="Pending KYC" value={stats.pendingSellers} href="/dashboard/sellers" />
        <QueueCard label="Products to review" value={stats.pendingProducts} href="/dashboard/products" />
        <QueueCard label="Open disputes" value={stats.openDisputes} href="/dashboard/disputes" />
        <QueueCard label="Open tickets" value={stats.openTickets} href="/dashboard" />
      </div>

      <Card className="mt-12">
        <CardContent className="p-6">
          <p className="text-sm font-semibold">⚙ What this console will do (full spec)</p>
          <ul className="mt-3 space-y-1 text-sm text-slate-600">
            <li>• Cmd-K palette for universal search + actions</li>
            <li>• Inbox + ticket workspace with internal notes</li>
            <li>• Order workspace (cancel pre-ship, refund &lt; $500 PM-direct)</li>
            <li>• User workspace (search, view, send password reset)</li>
            <li>• Seller KYC review screen</li>
            <li>• 4-eyes approval flow</li>
            <li>• Audit log on every action</li>
            <li>• 2FA enforcement + IP allowlist</li>
          </ul>
          <p className="mt-3 text-xs text-slate-500">See PLATFORM_MANAGER.md for the full spec.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function QueueCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <a
      href={href}
      className="block rounded-lg border border-slate-200 bg-white p-6 transition-shadow hover:shadow-md"
    >
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{value}</p>
    </a>
  );
}
