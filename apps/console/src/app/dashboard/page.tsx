import { Card, CardContent } from '@onsective/ui';
import { prisma } from '@onsective/db';

async function getStats() {
  const [pendingSellers, pendingProducts, openDisputes, openTickets, openReturns, last24h] = await Promise.all([
    prisma.seller.count({ where: { status: { in: ['PENDING_KYC', 'KYC_SUBMITTED'] } } }),
    prisma.product.count({ where: { status: 'PENDING_REVIEW' } }),
    Promise.resolve(0), // disputes table populated Phase 2
    prisma.supportTicket.count({ where: { status: 'OPEN' } }).catch(() => 0),
    prisma.return.count({ where: { status: { in: ['REQUESTED', 'APPROVED', 'RECEIVED'] } } }).catch(() => 0),
    prisma.auditLog.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }).catch(() => 0),
  ]);
  return { pendingSellers, pendingProducts, openDisputes, openTickets, openReturns, last24h };
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
        <QueueCard label="Open returns" value={stats.openReturns} href="/dashboard/returns" />
        <QueueCard label="Open tickets" value={stats.openTickets} href="/dashboard/tickets" />
      </div>

      <h2 className="mt-12 text-sm font-semibold text-slate-700">Quick links</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <Pill href="/dashboard/users">Users</Pill>
        <Pill href="/dashboard/sellers">Sellers</Pill>
        <Pill href="/dashboard/orders">Orders</Pill>
        <Pill href="/dashboard/orgs">Organizations</Pill>
        <Pill href="/dashboard/ads">Ads moderation</Pill>
        <Pill href="/dashboard/approvals">4-eyes approvals</Pill>
        <Pill href="/dashboard/webhooks">Webhooks</Pill>
        <Pill href="/dashboard/health">System health</Pill>
        <Pill href="/dashboard/audit">Audit log ({stats.last24h.toLocaleString()} last 24h)</Pill>
      </div>
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

function Pill({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-500 hover:text-slate-900"
    >
      {children}
    </a>
  );
}
