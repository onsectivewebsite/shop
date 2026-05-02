import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getSellerSession } from '@/server/auth';
import { prisma } from '@/server/db';
import { SellerShell } from '@/components/seller-shell';
import { BulkImportForm } from './bulk-import-form';

export const metadata = { title: 'Bulk import' };

export default async function ImportPage() {
  const session = await getSellerSession();
  if (!session) redirect('/login');
  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    select: { status: true },
  });
  if (!seller) redirect('/apply');

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
          Bulk import
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-stone-600">
          Paste or upload a CSV to create up to 200 products in one go. New
          products land as <span className="font-medium text-stone-900">Draft</span> so
          you can review them before publishing. Existing products (matched by
          slug) are updated in place.
        </p>

        {seller.status !== 'APPROVED' && (
          <div className="mt-6 max-w-3xl rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Bulk import unlocks once your KYC is approved.
          </div>
        )}

        <div className="mt-10 max-w-3xl rounded-3xl border border-stone-200 bg-white p-8 sm:p-10">
          <h2 className="font-display text-xl font-medium tracking-tight text-stone-950">
            CSV format
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            First row is the header. Required columns:{' '}
            <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs">
              slug, title, description, category_slug, price_minor, currency,
              stock_qty, weight_grams, length_mm, width_mm, height_mm
            </code>
            . Optional:{' '}
            <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs">
              brand, image_urls (pipe-separated, up to 8), mrp_minor, sku,
              hs_code, origin_country_code
            </code>
            .
          </p>
          <p className="mt-2 text-xs text-stone-500">
            Multi-variant products (size, color, etc) need the wizard — bulk
            import creates a single default variant per product.
          </p>

          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-medium text-stone-700">
              Example
            </summary>
            <pre className="mt-2 overflow-x-auto rounded-md bg-stone-950 p-3 font-mono text-xs text-stone-100">
{`slug,title,description,category_slug,price_minor,currency,stock_qty,weight_grams,length_mm,width_mm,height_mm,brand,image_urls
aurora-mug,Aurora ceramic mug,"Hand-thrown stoneware. 12oz capacity.",home-kitchen,2400,USD,40,420,110,90,90,Kintsugi,https://example.com/aurora.jpg|https://example.com/aurora-2.jpg
fern-throw,Fern throw blanket,"Linen-cotton blend, 50x60in.",home-kitchen,7800,USD,15,1200,1500,1300,40,Fern & Fable,https://example.com/fern.jpg`}
            </pre>
          </details>

          <hr className="my-8 border-stone-200" />

          {seller.status === 'APPROVED' ? (
            <BulkImportForm />
          ) : (
            <p className="text-sm text-stone-500">
              Importer disabled until KYC is approved.
            </p>
          )}
        </div>
      </div>
    </SellerShell>
  );
}
