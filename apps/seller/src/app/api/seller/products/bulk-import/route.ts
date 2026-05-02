import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@onsective/db';
import { prisma } from '@/server/db';
import { getSellerSession } from '@/server/auth';
import { parseCsv } from '@/server/csv';

/**
 * Synchronous bulk product import. Sized to land inside a normal request
 * timeout: max 200 rows per call. Sellers with bigger catalogs split files.
 *
 * Each row = one product with one default variant. Multi-variant products
 * (size/color/etc) need the wizard — CSV-defining variants gets ugly fast
 * and the wizard's UX is better for that case anyway.
 *
 * New products land as DRAFT so the seller can review before publishing.
 * Existing products (matched by Product.slug, scoped to this seller) are
 * updated in place; another seller's slug collides → row error.
 *
 * Per-row $transaction so one bad row doesn't poison 199 good ones; errors
 * collected with row numbers and returned for the seller to fix and re-upload.
 */

const MAX_ROWS = 200;
const MAX_BYTES = 1024 * 1024; // 1MB
const MAX_IMAGES = 8;

const HEADER = [
  'slug',
  'title',
  'brand',
  'description',
  'category_slug',
  'image_urls',
  'price_minor',
  'currency',
  'stock_qty',
  'weight_grams',
  'length_mm',
  'width_mm',
  'height_mm',
  'mrp_minor',
  'sku',
  'hs_code',
  'origin_country_code',
] as const;
type Header = (typeof HEADER)[number];

const requiredColumns: Header[] = [
  'slug',
  'title',
  'description',
  'category_slug',
  'price_minor',
  'currency',
  'stock_qty',
  'weight_grams',
  'length_mm',
  'width_mm',
  'height_mm',
];

const rowSchema = z.object({
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/, 'slug must be lowercase letters, digits, and hyphens'),
  title: z.string().trim().min(2).max(200),
  brand: z.string().trim().max(120).optional(),
  description: z.string().trim().min(10).max(8000),
  category_slug: z.string().trim().min(1),
  image_urls: z.string().trim().optional(),
  price_minor: z.coerce.number().int().min(0),
  currency: z.string().trim().length(3).toUpperCase(),
  stock_qty: z.coerce.number().int().min(0),
  weight_grams: z.coerce.number().int().min(1),
  length_mm: z.coerce.number().int().min(1),
  width_mm: z.coerce.number().int().min(1),
  height_mm: z.coerce.number().int().min(1),
  mrp_minor: z.coerce.number().int().min(0).optional(),
  sku: z.string().trim().max(80).optional(),
  hs_code: z.string().trim().max(16).optional(),
  origin_country_code: z.string().trim().length(2).toUpperCase().optional(),
});

const bodySchema = z.object({ csv: z.string().min(1) });

type ImportError = { row: number; column?: string; message: string };
type ImportResult = {
  totalRows: number;
  created: number;
  updated: number;
  errors: ImportError[];
};

export async function POST(req: Request) {
  const session = await getSellerSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    select: { id: true, status: true, countryCode: true },
  });
  if (!seller) return NextResponse.json({ error: 'No seller account.' }, { status: 404 });
  if (seller.status !== 'APPROVED') {
    return NextResponse.json(
      { error: 'Bulk import is available after KYC approval.' },
      { status: 403 },
    );
  }

  let payload: z.infer<typeof bodySchema>;
  try {
    payload = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }
  if (payload.csv.length > MAX_BYTES) {
    return NextResponse.json(
      { error: `CSV too large. Max ${MAX_BYTES / 1024} KB per upload.` },
      { status: 413 },
    );
  }

  const rows = parseCsv(payload.csv);
  if (rows.length === 0) {
    return NextResponse.json({ error: 'CSV is empty.' }, { status: 400 });
  }

  const headerRow = rows[0]!.map((c) => c.trim().toLowerCase());
  for (const col of requiredColumns) {
    if (!headerRow.includes(col)) {
      return NextResponse.json(
        { error: `Missing required column: ${col}` },
        { status: 400 },
      );
    }
  }

  const dataRows = rows.slice(1);
  if (dataRows.length === 0) {
    return NextResponse.json({ error: 'CSV has no data rows.' }, { status: 400 });
  }
  if (dataRows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `Too many rows. Max ${MAX_ROWS} per upload.` },
      { status: 413 },
    );
  }

  // Map column name → index once. Unknown columns are ignored (forwards-
  // compatible — sellers can add new columns we don't yet read).
  const colIndex = new Map<string, number>();
  headerRow.forEach((name, i) => colIndex.set(name, i));

  const result: ImportResult = {
    totalRows: dataRows.length,
    created: 0,
    updated: 0,
    errors: [],
  };

  // Pre-load all referenced categories so we don't re-query per row.
  const referencedCategorySlugs = new Set<string>();
  for (const row of dataRows) {
    const slug = row[colIndex.get('category_slug')!]?.trim().toLowerCase();
    if (slug) referencedCategorySlugs.add(slug);
  }
  const categories = await prisma.category.findMany({
    where: { slug: { in: Array.from(referencedCategorySlugs) }, isActive: true },
    select: { id: true, slug: true, commissionPct: true },
  });
  const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));

  for (let i = 0; i < dataRows.length; i++) {
    const rowNum = i + 2; // +1 for 0-indexed, +1 for header
    const raw = dataRows[i]!;

    const obj: Record<string, string | undefined> = {};
    for (const [colName, idx] of colIndex.entries()) {
      const v = raw[idx];
      if (v !== undefined && v !== '') obj[colName] = v;
    }

    const parsed = rowSchema.safeParse(obj);
    if (!parsed.success) {
      const issue = parsed.error.issues[0]!;
      result.errors.push({
        row: rowNum,
        column: issue.path.join('.'),
        message: issue.message,
      });
      continue;
    }
    const data = parsed.data;

    const category = categoryBySlug.get(data.category_slug.toLowerCase());
    if (!category) {
      result.errors.push({
        row: rowNum,
        column: 'category_slug',
        message: `Unknown or inactive category: ${data.category_slug}`,
      });
      continue;
    }

    const images =
      data.image_urls
        ?.split('|')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .slice(0, MAX_IMAGES) ?? [];

    try {
      await prisma.$transaction(async (tx) => {
        const existing = await tx.product.findUnique({
          where: { slug: data.slug },
          select: { id: true, sellerId: true },
        });
        if (existing && existing.sellerId !== seller.id) {
          throw new RowConflict(
            'slug',
            'A product with this slug exists under a different seller.',
          );
        }

        if (existing) {
          await tx.product.update({
            where: { id: existing.id },
            data: {
              title: data.title,
              brand: data.brand ?? null,
              description: data.description,
              categoryId: category.id,
              images,
              hsCode: data.hs_code ?? null,
              originCountryCode: data.origin_country_code ?? seller.countryCode,
            },
          });
          // Update the FIRST variant in place — multi-variant products
          // beyond v1's reach belong to the wizard. Find or create.
          const firstVariant = await tx.variant.findFirst({
            where: { productId: existing.id },
            orderBy: { createdAt: 'asc' },
          });
          if (firstVariant) {
            await tx.variant.update({
              where: { id: firstVariant.id },
              data: {
                priceAmount: data.price_minor,
                mrpAmount: data.mrp_minor ?? null,
                currency: data.currency,
                stockQty: data.stock_qty,
                weightGrams: data.weight_grams,
                lengthMm: data.length_mm,
                widthMm: data.width_mm,
                heightMm: data.height_mm,
              },
            });
          } else {
            await tx.variant.create({
              data: {
                productId: existing.id,
                sku: data.sku ?? `${data.slug}-default`,
                priceAmount: data.price_minor,
                mrpAmount: data.mrp_minor ?? null,
                currency: data.currency,
                stockQty: data.stock_qty,
                weightGrams: data.weight_grams,
                lengthMm: data.length_mm,
                widthMm: data.width_mm,
                heightMm: data.height_mm,
              },
            });
          }
          result.updated += 1;
        } else {
          const product = await tx.product.create({
            data: {
              sellerId: seller.id,
              categoryId: category.id,
              title: data.title,
              slug: data.slug,
              brand: data.brand ?? null,
              description: data.description,
              bullets: [],
              images,
              status: 'DRAFT', // never auto-publish — seller reviews
              countryCode: seller.countryCode,
              hsCode: data.hs_code ?? null,
              originCountryCode: data.origin_country_code ?? seller.countryCode,
              searchKeywords: [],
            },
          });
          await tx.variant.create({
            data: {
              productId: product.id,
              sku: data.sku ?? `${data.slug}-default`,
              priceAmount: data.price_minor,
              mrpAmount: data.mrp_minor ?? null,
              currency: data.currency,
              stockQty: data.stock_qty,
              weightGrams: data.weight_grams,
              lengthMm: data.length_mm,
              widthMm: data.width_mm,
              heightMm: data.height_mm,
            },
          });
          result.created += 1;
        }
      });
    } catch (err) {
      if (err instanceof RowConflict) {
        result.errors.push({ row: rowNum, column: err.column, message: err.message });
        continue;
      }
      // P2002 from Variant.sku unique — common when sku omitted on a
      // re-import and the slug-default key collides.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        result.errors.push({
          row: rowNum,
          message: `Conflict on ${(err.meta?.target as string[] | undefined)?.join(', ') ?? 'unique constraint'}`,
        });
        continue;
      }
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push({ row: rowNum, message: message.slice(0, 300) });
    }
  }

  return NextResponse.json(result);
}

class RowConflict extends Error {
  constructor(public column: string, message: string) {
    super(message);
  }
}
