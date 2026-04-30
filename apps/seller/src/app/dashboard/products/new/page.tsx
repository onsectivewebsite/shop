import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getSellerSession } from '@/server/auth';
import { prisma } from '@/server/db';
import { SellerShell } from '@/components/seller-shell';
import { ProductWizard } from '@/components/product-wizard';

export const metadata = { title: 'List a new product' };

export default async function NewProductPage() {
  const session = await getSellerSession();
  if (!session) redirect('/login');
  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } });
  if (!seller) redirect('/apply');

  if (seller.status !== 'APPROVED') {
    return (
      <SellerShell email={session.user.email} name={session.user.fullName ?? undefined}>
        <div className="container-page py-16 md:py-24">
          <div className="mx-auto max-w-2xl rounded-3xl border border-stone-200 bg-white p-10 text-center">
            <h1 className="font-display text-3xl font-medium tracking-tight text-stone-950">
              Listing locks until KYC approval
            </h1>
            <p className="mt-3 text-sm text-stone-600">
              Once Onsective ops verify your business, you can list products from this page.
              Current status: <strong>{seller.status}</strong>.
            </p>
            <Link
              href="/dashboard"
              className="mt-8 inline-flex h-11 items-center rounded-full bg-stone-900 px-6 text-sm font-semibold text-white transition-colors hover:bg-stone-800"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </SellerShell>
    );
  }

  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true, parentId: true },
  });

  // Show top-level + their direct children, flat.
  const flat = categories.map((c) => ({ id: c.id, name: c.name }));

  return (
    <SellerShell email={session.user.email} name={session.user.fullName ?? undefined}>
      <div className="container-page py-10 md:py-14">
        <Link
          href="/dashboard/products"
          className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900"
        >
          <ArrowLeft size={14} /> Back to products
        </Link>

        <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-stone-950 md:text-5xl">
          List a new product
        </h1>
        <p className="mt-3 max-w-xl text-sm text-stone-600">
          5 steps. We review the listing within 1 business day before it goes live to buyers.
        </p>

        <div className="mt-10">
          <ProductWizard categories={flat} />
        </div>
      </div>
    </SellerShell>
  );
}
