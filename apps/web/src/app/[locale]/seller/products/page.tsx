import { redirect } from 'next/navigation';
import { Button, Badge, Card, CardContent } from '@onsective/ui';
import Link from 'next/link';
import { getSession } from '@/server/auth';
import { prisma } from '@/server/db';

export const metadata = { title: 'Products' };

export default async function SellerProducts() {
  const session = await getSession();
  if (!session) redirect('/login');

  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } });
  if (!seller) redirect('/seller');

  const products = await prisma.product.findMany({
    where: { sellerId: seller.id },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    include: { variants: { take: 1 } },
  });

  return (
    <div className="p-6 md:p-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Products ({products.length})</h1>
        <Button asChild>
          <Link href="/seller/products/new">+ Add product</Link>
        </Button>
      </div>

      {products.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="p-12 text-center">
            <p className="text-slate-600">You haven&apos;t added any products yet.</p>
            <Button asChild className="mt-4">
              <Link href="/seller/products/new">Add your first product</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 tabular-nums">Stock</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-medium">{p.title}</td>
                  <td className="px-4 py-3">
                    <Badge variant={p.status === 'ACTIVE' ? 'success' : 'default'}>
                      {p.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{p.variants[0]?.stockQty ?? 0}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/seller/products/${p.id}`} className="text-brand-600 hover:underline">
                      Edit →
                    </Link>
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
