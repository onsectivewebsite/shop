/**
 * Initial DB seed: top-level categories.
 * Run with `pnpm db:seed`.
 *
 * Keep this idempotent — `upsert` on slug.
 */
import { prisma } from '../src';

const TOP_CATEGORIES = [
  { slug: 'electronics', name: 'Electronics', sortOrder: 1 },
  { slug: 'fashion', name: 'Fashion', sortOrder: 2 },
  { slug: 'home', name: 'Home & Kitchen', sortOrder: 3 },
  { slug: 'beauty', name: 'Beauty & Personal Care', sortOrder: 4 },
  { slug: 'books', name: 'Books', sortOrder: 5 },
  { slug: 'toys', name: 'Toys & Games', sortOrder: 6 },
  { slug: 'grocery', name: 'Grocery', sortOrder: 7 },
  { slug: 'sports', name: 'Sports & Outdoors', sortOrder: 8 },
];

async function main() {
  for (const c of TOP_CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, sortOrder: c.sortOrder },
      create: { slug: c.slug, name: c.name, sortOrder: c.sortOrder },
    });
    // eslint-disable-next-line no-console
    console.log(`✔ category: ${c.slug}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
