import { redirect } from 'next/navigation';
import { getSession } from '@/server/auth';
import { prisma } from '@/server/db';
import { ProductWizard } from '@/components/seller/product-wizard';

export const metadata = { title: 'New product' };

export default async function NewProductPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } });
  if (!seller) redirect('/seller');

  const categories = await prisma.category.findMany({
    where: { parentId: null, isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true },
  });

  return (
    <div className="p-6 md:p-10">
      <h1 className="text-2xl font-bold text-slate-900">New product</h1>
      <p className="mt-1 text-sm text-slate-500">5 steps. Save when done.</p>
      <div className="mt-8 max-w-3xl">
        <ProductWizard categories={categories} />
      </div>
    </div>
  );
}
