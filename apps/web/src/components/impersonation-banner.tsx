import { getSession } from '@/server/auth';
import { prisma } from '@/server/db';

export async function ImpersonationBanner() {
  const session = await getSession();
  if (!session?.impersonation) return null;

  const pm = await prisma.user.findUnique({
    where: { id: session.impersonation.pmId },
    select: { email: true, fullName: true },
  });

  return (
    <div className="bg-cta-600 text-center text-xs font-medium text-white">
      <div className="container-page py-2">
        ⚠ Read-only impersonation as <strong>{session.user.email}</strong> by{' '}
        {pm?.fullName ?? pm?.email ?? 'a Platform Manager'}. All mutations are blocked.
      </div>
    </div>
  );
}
