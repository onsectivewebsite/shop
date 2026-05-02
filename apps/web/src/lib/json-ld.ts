/**
 * Schema.org JSON-LD builders. Keep these as plain objects rather than
 * stringified blobs so the call site can spread per-page overrides; the
 * `<script type="application/ld+json">` tag stringifies once at render.
 *
 * Rich-results validator checks the marketplace cares about for v1:
 *   - Product (rating + offer + brand → star ratings + price snippet)
 *   - BreadcrumbList (per-page; not yet wired — straightforward add later)
 *   - Organization (home page only)
 */

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://itsnottechy.cloud';

export type ProductLdInput = {
  title: string;
  slug: string;
  description: string;
  brand: string | null;
  imageUrls: string[];
  ratingAvg: number;
  ratingCount: number;
  variants: Array<{ priceAmount: number; currency: string; available: boolean; sku: string }>;
  sellerName: string;
};

export function productJsonLd(p: ProductLdInput): Record<string, unknown> {
  const cheapest = p.variants
    .filter((v) => v.available)
    .sort((a, b) => a.priceAmount - b.priceAmount)[0];
  // Fall back to the absolute cheapest if everything is OOS — Google still
  // wants an Offer block; availability flips to OutOfStock.
  const reference = cheapest ?? p.variants.sort((a, b) => a.priceAmount - b.priceAmount)[0];

  const productUrl = `${BASE}/en/product/${p.slug}`;

  const node: Record<string, unknown> = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: p.title,
    description: p.description.slice(0, 5000),
    url: productUrl,
    image: p.imageUrls.slice(0, 8),
    sku: reference?.sku,
    brand: p.brand ? { '@type': 'Brand', name: p.brand } : undefined,
    offers: reference
      ? {
          '@type': 'Offer',
          price: (reference.priceAmount / 100).toFixed(2),
          priceCurrency: reference.currency,
          availability: reference.available
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
          url: productUrl,
          seller: { '@type': 'Organization', name: p.sellerName },
        }
      : undefined,
  };

  // Only emit aggregateRating when there's at least one review — Google's
  // validator throws "no value provided" warnings on zero-rating products.
  if (p.ratingCount > 0) {
    node.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: p.ratingAvg.toFixed(2),
      reviewCount: p.ratingCount,
    };
  }
  return node;
}

export function organizationJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org/',
    '@type': 'Organization',
    name: 'Onsective',
    url: BASE,
    logo: `${BASE}/icon.svg`,
    sameAs: [],
  };
}

export function websiteJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org/',
    '@type': 'WebSite',
    name: 'Onsective',
    url: BASE,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${BASE}/en/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * Stringify with safe HTML escaping — `</script>` inside a JSON-LD blob
 * could close the script tag. Replacing the slash with the unicode escape
 * is the standard fix.
 */
export function jsonLdScriptContent(node: Record<string, unknown>): string {
  return JSON.stringify(node).replace(/<\/script>/gi, '<\\/script>');
}
