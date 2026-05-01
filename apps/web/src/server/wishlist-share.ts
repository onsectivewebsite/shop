import { randomBytes } from 'node:crypto';
import { prisma } from './db';

// Same alphabet as referral codes — Crockford-base32 minus visually
// confusable characters. 10 chars × ~5 bits = ~50 bits of entropy; collisions
// at any user count we care about are vanishing, but the upsert below still
// retries on the very rare P2002.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomSlug(): string {
  const buf = randomBytes(10);
  let out = '';
  for (let i = 0; i < 10; i += 1) {
    out += ALPHABET.charAt(buf[i]! % ALPHABET.length);
  }
  return out;
}

export async function getOrCreateWishlistShare(userId: string): Promise<{
  slug: string;
  isPublic: boolean;
  viewCount: number;
  displayName: string | null;
}> {
  const existing = await prisma.wishlistShare.findUnique({ where: { userId } });
  if (existing) {
    return {
      slug: existing.slug,
      isPublic: existing.isPublic,
      viewCount: existing.viewCount,
      displayName: existing.displayName,
    };
  }

  let attempts = 0;
  while (attempts < 5) {
    const slug = randomSlug();
    try {
      const created = await prisma.wishlistShare.create({
        data: { userId, slug, isPublic: true },
      });
      return {
        slug: created.slug,
        isPublic: created.isPublic,
        viewCount: created.viewCount,
        displayName: created.displayName,
      };
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2002') {
        attempts += 1;
        continue;
      }
      throw err;
    }
  }
  throw new Error('Could not mint a unique wishlist slug after 5 attempts.');
}

export async function setWishlistShareVisibility(
  userId: string,
  isPublic: boolean,
): Promise<void> {
  // Lazy-mint then flip. Calling toggle on a never-shared wishlist creates
  // the row in whatever state the caller asked for, which keeps the UI
  // simple (the toggle works the same way the first time as the tenth).
  await getOrCreateWishlistShare(userId);
  await prisma.wishlistShare.update({
    where: { userId },
    data: { isPublic },
  });
}

export async function setWishlistShareDisplayName(
  userId: string,
  displayName: string | null,
): Promise<void> {
  await getOrCreateWishlistShare(userId);
  await prisma.wishlistShare.update({
    where: { userId },
    data: { displayName: displayName?.trim() || null },
  });
}

/**
 * Look up a public wishlist by slug. Returns null when the slug doesn't
 * resolve OR the owner has flipped it private — the public page renders
 * the same 404 in either case so visitors can't probe for "did this user
 * exist?".
 *
 * Bumps `viewCount` on hit. Skips writes for the owner's own preview
 * (caller passes `viewerUserId` when known) so an author's own page-views
 * don't inflate the counter.
 */
export async function lookupPublicWishlist(args: {
  slug: string;
  viewerUserId: string | null;
}): Promise<{
  ownerName: string;
  ownerId: string;
  viewCount: number;
} | null> {
  const share = await prisma.wishlistShare.findUnique({
    where: { slug: args.slug },
    include: { user: { select: { fullName: true } } },
  });
  if (!share || !share.isPublic) return null;

  const ownerName =
    share.displayName ||
    share.user.fullName?.split(' ')[0] ||
    'an Onsective shopper';

  if (args.viewerUserId !== share.userId) {
    // Best-effort increment — failure here doesn't break the page render.
    await prisma.wishlistShare
      .update({
        where: { id: share.id },
        data: { viewCount: { increment: 1 } },
      })
      .catch(() => {});
  }

  return {
    ownerId: share.userId,
    ownerName,
    viewCount: share.viewCount + (args.viewerUserId !== share.userId ? 1 : 0),
  };
}
