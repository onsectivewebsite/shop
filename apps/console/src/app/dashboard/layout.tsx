import { redirect } from 'next/navigation';
import { ConsoleSidebar } from '@/components/sidebar';
import { getConsoleSession } from '@/server/auth';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getConsoleSession();
  if (!session) redirect('/login');

  return (
    <div className="flex min-h-screen">
      <ConsoleSidebar user={{ email: session.user.email, fullName: session.user.fullName }} />
      <div className="flex-1 bg-slate-50">{children}</div>
    </div>
  );
}
