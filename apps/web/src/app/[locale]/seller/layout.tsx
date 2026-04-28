import { redirect } from 'next/navigation';
import { getSession } from '@/server/auth';
import { SellerSidebar } from '@/components/seller/sidebar';

export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="flex">
      <SellerSidebar />
      <div className="flex-1">{children}</div>
    </div>
  );
}
