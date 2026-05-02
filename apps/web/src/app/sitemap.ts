import type { MetadataRoute } from 'next';
import { prisma } from '@/server/db';

/**
 * Marketplace sitemap. Capped at Google's 50k-URL hard limit per sitemap;
 * past that, we'd split via `generateSitemaps()` into chunked files. For
 * the catalog at launch scale (≤ a few thousand active SKUs), one file is
 * plenty.
 *
 * Locale: only the `/en` prefix is sitemapped — Hindi UI strings exist but
 * legal/marketing copy is English-only at launch, so we don't want Google
 * surfacing partial-Hindi pages as canonical.
 */

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://itsnottechy.cloud';
const LOCALE = 'en';
const MAX_URLS = 50_000;

export const revalidate = 3600; // regenerate hourly

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${BASE}/${LOCALE}`, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${BASE}/${LOCALE}/categories`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/${LOCALE}/best-sellers`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE}/${LOCALE}/deals`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE}/${LOCALE}/trending`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE}/${LOCALE}/legal/privacy`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE}/${LOCALE}/legal/terms`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE}/${LOCALE}/legal/returns`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE}/${LOCALE}/legal/shipping`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
  ];

  const remaining = MAX_URLS - staticEntries.length;

  // Active products + their lastModified, ordered by recency so trims
  // happen at the long tail rather than the most-relevant URLs.
  const products = await prisma.product.findMany({
    where: { status: 'ACTIVE' },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
    take: Math.min(remaining, 30_000),
  });

  // Live categories — small set, no real cap concern.
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    select: { slug: true, updatedAt: true },
    take: 1000,
  });

  // Approved (or KYC-submitted, since storefronts surface for both) sellers.
  const sellers = await prisma.seller.findMany({
    where: { status: { in: ['APPROVED', 'KYC_SUBMITTED'] } },
    select: { slug: true, updatedAt: true },
    take: 10_000,
  });

  return [
    ...staticEntries,
    ...categories.map((c) => ({
      url: `${BASE}/${LOCALE}/category/${c.slug}`,
      lastModified: c.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...sellers.map((s) => ({
      url: `${BASE}/${LOCALE}/seller/${s.slug}`,
      lastModified: s.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
    ...products.map((p) => ({
      url: `${BASE}/${LOCALE}/product/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];
}
