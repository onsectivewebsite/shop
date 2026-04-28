import { notFound } from 'next/navigation';
import { prisma } from '@onsective/db';
import { Card, CardContent, Badge, Button } from '@onsective/ui';
import {
  sendPasswordResetAction,
  suspendUserAction,
  reactivateUserAction,
  unlockUserAction,
  updateUserRolesAction,
} from './actions';
import { DeleteUserButton } from './delete-user-button';
import { getConsoleSession } from '@/server/auth';
import { startImpersonationAction, endImpersonationAction } from './impersonate';

export const metadata = { title: 'User · Console' };

export default async function UserDetail({ params }: { params: { id: string } }) {
  const consoleSession = await getConsoleSession();
  const user = await prisma.user.findUnique({
    where: { id: params.id },
    include: {
      addresses: { take: 5, orderBy: { isDefault: 'desc' } },
      orders: { take: 10, orderBy: { createdAt: 'desc' } },
      _count: { select: { orders: true, sessions: true } },
    },
  });
  if (!user) notFound();

  const activeImpersonation = consoleSession
    ? await prisma.impersonationSession.findFirst({
        where: { pmId: consoleSession.user.id, targetUserId: user.id, endedAt: null },
        orderBy: { startedAt: 'desc' },
      })
    : null;

  const buyerAppUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const magicLink =
    activeImpersonation && !activeImpersonation.tokenConsumedAt
      ? `${buyerAppUrl}/en/impersonate/${activeImpersonation.id}`
      : null;

  return (
    <div className="p-8">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{user.fullName ?? user.email}</h1>
          <p className="text-sm text-slate-500">{user.email}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {user.roles.map((r) => (
              <Badge key={r}>{r}</Badge>
            ))}
            <Badge variant={user.status === 'ACTIVE' ? 'success' : 'error'}>{user.status}</Badge>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <form action={sendPasswordResetAction.bind(null, user.id)}>
            <Button variant="outline" size="sm" type="submit">
              Send password reset
            </Button>
          </form>
          {user.lockedUntil && user.lockedUntil > new Date() && (
            <form action={unlockUserAction.bind(null, user.id)}>
              <Button variant="outline" size="sm" type="submit">
                Unlock now
              </Button>
            </form>
          )}
          {user.status === 'ACTIVE' ? (
            <form action={suspendUserAction.bind(null, user.id, 'console action')}>
              <Button variant="destructive" size="sm" type="submit">
                Suspend account
              </Button>
            </form>
          ) : (
            <form action={reactivateUserAction.bind(null, user.id)}>
              <Button variant="outline" size="sm" type="submit">
                Reactivate
              </Button>
            </form>
          )}
          <DeleteUserButton userId={user.id} />
        </div>
      </header>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">Roles</h3>
        <p className="mt-1 text-xs text-slate-500">
          Comma-separated. Allowed: BUYER, SELLER, SUPPORT_AGENT, PLATFORM_MANAGER,
          CATALOG_MODERATOR, FINANCE_OPS, ADMIN, OWNER.
        </p>
        <form
          action={async (fd) => {
            'use server';
            await updateUserRolesAction(user.id, String(fd.get('roles') ?? ''));
          }}
          className="mt-3 flex gap-2"
        >
          <input
            name="roles"
            defaultValue={user.roles.join(', ')}
            className="h-10 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm font-mono"
          />
          <Button type="submit" size="sm">
            Save roles
          </Button>
        </form>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Country" value={user.countryCode} />
        <Stat label="Total orders" value={user._count.orders} />
        <Stat label="Active sessions" value={user._count.sessions} />
      </div>

      <Card className="mt-8 border-cta-200 bg-cta-50">
        <CardContent className="space-y-3 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-cta-900">
                View as user
              </h2>
              <p className="text-xs text-cta-800">
                Read-only impersonation. Every action is audited; the user cannot tell.
              </p>
            </div>
            {activeImpersonation && (
              <Badge variant="warning">
                Session active since {activeImpersonation.startedAt.toLocaleTimeString()}
              </Badge>
            )}
          </div>

          {activeImpersonation ? (
            <div className="space-y-3">
              <p className="text-xs text-cta-900">
                Reason: <span className="italic">{activeImpersonation.reason}</span>
                {activeImpersonation.ticketContextId &&
                  ` · ticket ${activeImpersonation.ticketContextId}`}
              </p>
              {magicLink && (
                <div className="rounded-md border border-cta-300 bg-white p-3">
                  <p className="text-xs font-semibold text-cta-900">Magic link (single-use):</p>
                  <code className="mt-1 block break-all text-xs text-slate-700">{magicLink}</code>
                  <p className="mt-1 text-xs text-slate-500">
                    Open this in a private browser window. The link self-consumes on first visit.
                  </p>
                </div>
              )}
              {activeImpersonation.tokenConsumedAt && (
                <p className="text-xs text-cta-800">
                  Magic link consumed at {activeImpersonation.tokenConsumedAt.toLocaleString()} —
                  PM is now browsing as the user.
                </p>
              )}
              <form
                action={endImpersonationAction.bind(null, user.id, activeImpersonation.id)}
              >
                <Button type="submit" variant="outline" size="sm">
                  End session
                </Button>
              </form>
            </div>
          ) : (
            <form
              action={startImpersonationAction.bind(null, user.id)}
              className="space-y-2"
            >
              <textarea
                name="reason"
                required
                rows={2}
                maxLength={500}
                placeholder="Why are you doing this? (e.g. customer complaint about cart bug)"
                className="w-full rounded-md border border-slate-300 p-2 text-xs"
              />
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  name="ticketContextId"
                  placeholder="Ticket ID (optional)"
                  className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs"
                />
                <Button type="submit" variant="cta" size="sm">
                  Start view-as session
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <h2 className="mt-12 text-xl font-semibold">Recent orders</h2>
      {user.orders.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No orders yet.</p>
      ) : (
        <ul className="mt-4 divide-y rounded-lg border border-slate-200 bg-white">
          {user.orders.map((o) => (
            <li key={o.id} className="flex items-center justify-between p-4 text-sm">
              <span className="font-mono">{o.orderNumber}</span>
              <Badge>{o.status}</Badge>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-12 text-xl font-semibold">Addresses</h2>
      {user.addresses.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No addresses on file.</p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {user.addresses.map((a) => (
            <Card key={a.id}>
              <CardContent className="space-y-1 p-4 text-sm">
                <p className="font-medium">{a.recipient}</p>
                <p className="text-slate-600">
                  {a.line1}
                  {a.line2 ? `, ${a.line2}` : ''}
                </p>
                <p className="text-slate-600">
                  {a.city}, {a.state} {a.postalCode}
                </p>
              </CardContent>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="p-6">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
