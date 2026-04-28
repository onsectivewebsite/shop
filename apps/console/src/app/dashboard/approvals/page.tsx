import { prisma } from '@onsective/db';
import { Card, CardContent, Badge, Button } from '@onsective/ui';
import { getConsoleSession } from '@/server/auth';
import { approveAction, denyAction } from './actions';

export const metadata = { title: 'Approvals · Console' };

export default async function ApprovalsPage() {
  const session = await getConsoleSession();
  if (!session) return null;

  const pending = await prisma.approvalRequest.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    take: 50,
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-900">Approvals queue</h1>
      <p className="mt-1 text-sm text-slate-500">
        4-eyes principle: you cannot approve your own requests.
      </p>

      {pending.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="p-12 text-center text-sm text-slate-500">
            No pending approvals. ✅
          </CardContent>
        </Card>
      ) : (
        <ul className="mt-6 space-y-4">
          {pending.map((req) => {
            const isOwn = req.requesterId === session.user.id;
            const payload = req.payload as Record<string, unknown>;
            return (
              <Card key={req.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm">{req.action}</span>
                        <Badge variant="warning">PENDING</Badge>
                        {isOwn && <Badge variant="error">Your request</Badge>}
                      </div>
                      <p className="mt-2 text-sm text-slate-700">{req.reason}</p>
                      <pre className="mt-2 overflow-x-auto rounded-md bg-slate-50 p-3 text-xs">
                        {JSON.stringify(payload, null, 2)}
                      </pre>
                      <p className="mt-2 text-xs text-slate-500">
                        Requested {req.createdAt.toLocaleString()} · expires{' '}
                        {req.expiresAt.toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <form action={approveAction.bind(null, req.id)}>
                        <Button type="submit" size="sm" disabled={isOwn} className="w-32">
                          Approve
                        </Button>
                      </form>
                      <form action={denyAction.bind(null, req.id, 'console deny')}>
                        <Button type="submit" variant="outline" size="sm" disabled={isOwn} className="w-32">
                          Deny
                        </Button>
                      </form>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </ul>
      )}
    </div>
  );
}
