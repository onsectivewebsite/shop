import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { getSellerSession } from '@/server/auth';
import { enqueueSearchReindex } from '@/server/queue';

const SLUG_RE = /^[a-z0-9-]+$/i;

export async function POST(req: Request) {
  const session = await getSellerSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } });
  if (!seller) return NextResponse.json({ error: 'No seller account.' }, { status: 404 });
  if (seller.status !== 'APPROVED') {
    return NextResponse.json(
      { error: 'Listing unlocks after KYC approval.' },
      { status: 403 },
    );
  }

  let body: {
    title?: string;
    slug?: string;
    categoryId?: string;
    brand?: string;
    description?: string;
    bullets?: string[];
    images?: string[];
    countryCode?: string;
    attributes?: Record<string, string>;
    variants?: Array<{
      sku: string;
      title?: string;
      attributes?: Record<string, string>;
      priceAmount: number;
      mrpAmount?: number;
      currency: string;
      stockQty?: number;
      weightGrams: number;
      lengthMm: number;
      widthMm: number;
      heightMm: number;
    }>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }

  if (!body.title || body.title.length < 3 || body.title.length > 200) {
    return NextResponse.json({ error: 'Title must be 3-200 characters.' }, { status: 400 });
  }
  if (!body.slug || !SLUG_RE.test(body.slug)) {
    return NextResponse.json({ error: 'Bad slug.' }, { status: 400 });
  }
  if (!body.categoryId) {
    return NextResponse.json({ error: 'Category required.' }, { status: 400 });
  }
  if (!body.description || body.description.length < 20) {
    return NextResponse.json({ error: 'Description must be at least 20 characters.' }, { status: 400 });
  }
  if (!body.images || body.images.length === 0 || body.images.length > 8) {
    return NextResponse.json({ error: 'Provide 1-8 images.' }, { status: 400 });
  }
  if (!body.countryCode || body.countryCode.length !== 2) {
    return NextResponse.json({ error: 'Country must be ISO-2.' }, { status: 400 });
  }
  if (!body.variants || body.variants.length === 0) {
    return NextResponse.json({ error: 'At least one variant required.' }, { status: 400 });
  }

  // Slug uniqueness within seller
  const slugClash = await prisma.product.findFirst({
    where: { sellerId: seller.id, slug: body.slug },
    select: { id: true },
  });
  if (slugClash) {
    return NextResponse.json({ error: 'Slug already exists in your storefront.' }, { status: 409 });
  }

  try {
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          sellerId: seller.id,
          categoryId: body.categoryId!,
          title: body.title!,
          slug: body.slug!,
          brand: body.brand ?? null,
          description: body.description!,
          bullets: body.bullets ?? [],
          images: body.images!,
          countryCode: body.countryCode!.toUpperCase(),
          attributes: body.attributes ?? {},
          status: 'PENDING_REVIEW',
        },
      });
      for (const v of body.variants!) {
        await tx.variant.create({
          data: {
            productId: created.id,
            sku: v.sku,
            title: v.title ?? null,
            attributes: v.attributes ?? {},
            priceAmount: v.priceAmount,
            mrpAmount: v.mrpAmount ?? null,
            currency: v.currency,
            stockQty: v.stockQty ?? 0,
            weightGrams: v.weightGrams,
            lengthMm: v.lengthMm,
            widthMm: v.widthMm,
            heightMm: v.heightMm,
          },
        });
      }
      return created;
    });

    await enqueueSearchReindex(product.id);
    return NextResponse.json({ ok: true, productId: product.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Could not create product.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
