import type { UserRole } from '@onsective/db';

// Privilege ladder, lowest to highest. Anything to the left of you, you can grant.
const LADDER: UserRole[] = [
  'BUYER',
  'SELLER',
  'SUPPORT_AGENT',
  'CATALOG_MODERATOR',
  'FINANCE_OPS',
  'PLATFORM_MANAGER',
  'ADMIN',
  'OWNER',
];

function rank(role: UserRole): number {
  const i = LADDER.indexOf(role);
  return i === -1 ? -1 : i;
}

export function maxRank(roles: UserRole[]): number {
  return roles.reduce((m, r) => Math.max(m, rank(r)), -1);
}

/**
 * Filters the requested roles down to roles the actor is allowed to grant.
 * Rule: an actor can grant any role at or below their highest-rank role.
 * OWNER can grant OWNER. ADMIN can grant ADMIN and below. PLATFORM_MANAGER
 * can grant PLATFORM_MANAGER and below. Etc.
 */
export function filterGrantableRoles(
  actorRoles: UserRole[],
  requestedRoles: UserRole[],
): UserRole[] {
  const ceiling = maxRank(actorRoles);
  return requestedRoles.filter((r) => rank(r) <= ceiling);
}

/**
 * True if the actor can target this user at all (delete, role-edit, etc).
 * Rule: you can never act on a user whose privilege exceeds yours. This
 * blocks an ADMIN from deleting an OWNER.
 */
export function canTargetUser(actorRoles: UserRole[], targetRoles: UserRole[]): boolean {
  return maxRank(actorRoles) >= maxRank(targetRoles);
}
