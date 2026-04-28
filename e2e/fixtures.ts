/* eslint-disable no-console */
/**
 * Deterministic E2E test fixtures.
 *
 * Idempotent: every entity is upserted on a `*@onsective.test` email or a
 * stable slug, so running twice is a no-op. Safe to run repeatedly against
 * the dev DB.
 *
 * Test DB safety: refuses to run if DATABASE_URL doesn't smell like a test
 * database. Override with E2E_FIXTURES_FORCE=1 if you really mean it.
 */
import { prisma } from '@onsective/db';
import { hashPassword } from '@onsective/auth';

export const E2E_PASSWORD = 'correct-horse-battery-staple';

export const E2E_USERS = {
  buyer: 'buyer-e2e@onsective.test',
  seller: 'seller-e2e@onsective.test',
  pm: 'pm-e2e@onsective.test',
  pm2: 'pm2-e2e@onsective.test',
} as const;

export const E2E_PRODUCT_SLUGS = ['e2e-headphones', 'e2e-tee', 'e2e-coffee'] as const;

function assertTestDb(): void {
  if (process.env.E2E_FIXTURES_FORCE === '1') return;
  const url = process.env.DATABASE_URL ?? '';
  // Accept localhost / 127.0.0.1 / a docker hostname; refuse anything that
  // looks remotely production-shaped.
  const looksLocal = /(localhost|127\.0\.0\.1|onsective-pg)/i.test(url);
  if (!looksLocal) {
    throw new Error(
      `[fixtures] DATABASE_URL doesn't look local: ${url}. Set E2E_FIXTURES_FORCE=1 to bypass.`,
    );
  }
}

async function ensureUser(args: {
  email: string;
  fullName: string;
  roles: ('BUYER' | 'SELLER' | 'PLATFORM_MANAGER')[];
  countryCode?: string;
}) {
  return prisma.user.upsert({
    where: { email: args.email },
    update: {
      fullName: args.fullName,
      roles: { set: args.roles },
      status: 'ACTIVE',
    },
    create: {
      email: args.email,
      passwordHash: hashPassword(E2E_PASSWORD),
      fullName: args.fullName,
      roles: args.roles,
      countryCode: args.countryCode ?? 'US',
      locale: 'en-US',
      emailVerified: new Date(),
    },
  });
}

async function ensureSellerProducts(sellerId: string, categoryId: string) {
  const blueprints = [
    {
      slug: 'e2e-headphones',
      title: 'E2E Wireless Headphones',
      brand: 'TestCo',
      description:
        'Deterministic test product seeded by e2e fixtures. 30-hour battery, ANC, USB-C.',
      bullets: ['30-hour battery', 'Active noise cancelling', 'USB-C fast charge'],
      images: ['https://placehold.co/800x800/png?text=Headphones'],
      sku: 'E2E-HP-001',
      priceAmount: 14999,
      mrpAmount: 19999,
      stockQty: 50,
    },
    {
      slug: 'e2e-tee',
      title: 'E2E Cotton T-Shirt',
      brand: 'TestCo',
      description: 'Deterministic test product seeded by e2e fixtures. 100% organic cotton.',
      bullets: ['Organic cotton', 'Machine washable', 'Pre-shrunk'],
      images: ['https://placehold.co/800x800/png?text=T-Shirt'],
      sku: 'E2E-TS-001',
      priceAmount: 1999,
      mrpAmount: 2499,
      stockQty: 100,
    },
    {
      slug: 'e2e-coffee',
      title: 'E2E Whole Bean Coffee',
      brand: 'TestCo',
      description: 'Deterministic test product seeded by e2e fixtures. Single-origin Ethiopia.',
      bullets: ['Single-origin', 'Roasted weekly', 'Whole bean 1 lb'],
      images: ['https://placehold.co/800x800/png?text=Coffee'],
      sku: 'E2E-CF-001',
      priceAmount: 2499,
      mrpAmount: null,
      stockQty: 30,
    },
  ];

  for (const bp of blueprints) {
    const product = await prisma.product.upsert({
      where: { slug: bp.slug },
      update: {
        title: bp.title,
        brand: bp.brand,
        description: bp.description,
        bullets: bp.bullets,
        images: bp.images,
        status: 'ACTIVE',
      },
      create: {
        sellerId,
        categoryId,
        title: bp.title,
        slug: bp.slug,
        brand: bp.brand,
        description: bp.description,
        bullets: bp.bullets,
        images: bp.images,
        countryCode: 'US',
        status: 'ACTIVE',
      },
    });

    await prisma.variant.upsert({
      where: { sku: bp.sku },
      update: {
        priceAmount: bp.priceAmount,
        mrpAmount: bp.mrpAmount,
        stockQty: bp.stockQty,
      },
      create: {
        productId: product.id,
        sku: bp.sku,
        title: 'Default',
        attributes: {},
        priceAmount: bp.priceAmount,
        mrpAmount: bp.mrpAmount,
        currency: 'USD',
        stockQty: bp.stockQty,
        weightGrams: 500,
        lengthMm: 200,
        widthMm: 200,
        heightMm: 100,
      },
    });
  }
}

async function ensurePaidOrder(buyerId: string, sellerId: string) {
  const variant = await prisma.variant.findUnique({ where: { sku: 'E2E-HP-001' } });
  if (!variant) return null;

  // Need a shipping address — create a dummy one for the buyer.
  const address = await prisma.address.upsert({
    where: { id: 'e2e-buyer-shipping' },
    update: {},
    create: {
      id: 'e2e-buyer-shipping',
      userId: buyerId,
      type: 'SHIPPING',
      label: 'Home',
      recipient: 'E2E Buyer',
      phone: '+15555550100',
      line1: '1 Test Street',
      city: 'Testville',
      state: 'CA',
      postalCode: '94016',
      countryCode: 'US',
      isDefault: true,
    },
  });

  const orderNumber = 'ONS-E2E-PAID-001';
  return prisma.order.upsert({
    where: { orderNumber },
    update: {},
    create: {
      orderNumber,
      buyerId,
      status: 'PAID',
      currency: 'USD',
      countryCode: 'US',
      subtotalAmount: variant.priceAmount,
      shippingAmount: 500,
      taxAmount: 0,
      totalAmount: variant.priceAmount + 500,
      shippingAddressId: address.id,
      placedAt: new Date(),
      items: {
        create: {
          variantId: variant.id,
          sellerId,
          qty: 1,
          unitPrice: variant.priceAmount,
          lineSubtotal: variant.priceAmount,
          taxAmount: 0,
          shippingAmount: 500,
          commissionPct: 10,
          commissionAmount: Math.round(variant.priceAmount * 0.1),
          sellerNetAmount: variant.priceAmount - Math.round(variant.priceAmount * 0.1),
          productTitle: 'E2E Wireless Headphones',
          sku: 'E2E-HP-001',
          status: 'PAID',
        },
      },
    },
  });
}

export async function seedE2eFixtures(): Promise<void> {
  assertTestDb();

  const [buyer, sellerUser, , ] = await Promise.all([
    ensureUser({ email: E2E_USERS.buyer, fullName: 'E2E Buyer', roles: ['BUYER'] }),
    ensureUser({
      email: E2E_USERS.seller,
      fullName: 'E2E Seller',
      roles: ['BUYER', 'SELLER'],
    }),
    ensureUser({
      email: E2E_USERS.pm,
      fullName: 'E2E PM',
      roles: ['BUYER', 'PLATFORM_MANAGER'],
    }),
    ensureUser({
      email: E2E_USERS.pm2,
      fullName: 'E2E PM 2',
      roles: ['BUYER', 'PLATFORM_MANAGER'],
    }),
  ]);

  const seller = await prisma.seller.upsert({
    where: { userId: sellerUser.id },
    update: { status: 'APPROVED' },
    create: {
      userId: sellerUser.id,
      legalName: 'E2E Seller LLC',
      displayName: 'E2E Seller',
      slug: 'e2e-seller',
      countryCode: 'US',
      status: 'APPROVED',
      approvedAt: new Date(),
      stripePayoutsEnabled: true,
      stripeAccountId: 'acct_e2e_test',
    },
  });

  const electronics = await prisma.category.findUnique({ where: { slug: 'electronics' } });
  if (!electronics) {
    throw new Error('Run `pnpm db:seed` first to create the top-level category fixtures.');
  }

  await ensureSellerProducts(seller.id, electronics.id);
  await ensurePaidOrder(buyer.id, seller.id);

  console.log('[fixtures] e2e fixtures ready');
  console.log('  buyer:  ', E2E_USERS.buyer);
  console.log('  seller: ', E2E_USERS.seller);
  console.log('  pm:     ', E2E_USERS.pm);
  console.log('  pm2:    ', E2E_USERS.pm2);
  console.log('  password:', E2E_PASSWORD);
}

if (require.main === module) {
  seedE2eFixtures()
    .then(() => prisma.$disconnect())
    .catch(async (err) => {
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
