import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router, protectedProcedure, userMutationRateLimit } from '../trpc';
import { prisma } from '../db';

/**
 * B2B organizations — Phase 5.
 *
 * Surface here:
 *   - my: list orgs the caller belongs to
 *   - create: create org + first member (caller becomes OWNER)
 *   - invite: OWNER/ADMIN invites by email; users with that email auto-join
 *     when they next sign in (acceptedAt = first sign-in after invite)
 *   - removeMember: OWNER/ADMIN removes; OWNER cannot remove themselves
 *     unless another OWNER exists
 *   - updateMemberRole: OWNER only
 *   - currentExemption: returns the active TaxExemption for an org+country
 *
 * Tax-exempt + net-30 rendering at checkout is wired in checkout.summary
 * (separate change). Ops-side approval of tax certs lives in the console.
 */

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

async function requireMembership(args: {
  userId: string;
  organizationId: string;
  minRole?: 'OWNER' | 'ADMIN' | 'BUYER';
}) {
  const member = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: args.organizationId,
        userId: args.userId,
      },
    },
  });
  if (!member) throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a member.' });
  const rank = { BUYER: 1, ADMIN: 2, OWNER: 3 } as const;
  if (rank[member.role] < rank[args.minRole ?? 'BUYER']) {
    throw new TRPCError({ code: 'FORBIDDEN', message: `Requires ${args.minRole} role.` });
  }
  return member;
}

export const organizationsRouter = router({
  my: protectedProcedure.query(async ({ ctx }) => {
    return prisma.organizationMember.findMany({
      where: { userId: ctx.user.id, acceptedAt: { not: null } },
      include: {
        organization: {
          select: {
            id: true,
            legalName: true,
            slug: true,
            countryCode: true,
            paymentTerms: true,
          },
        },
      },
    });
  }),

  create: protectedProcedure
    .use(userMutationRateLimit)
    .input(
      z.object({
        legalName: z.string().min(2).max(120),
        countryCode: z.string().length(2).toUpperCase(),
        taxId: z.string().max(80).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const baseSlug = slugify(input.legalName);
      // Idempotency on slug — append numeric suffix until unique.
      let slug = baseSlug;
      let attempt = 0;
      while (await prisma.organization.findUnique({ where: { slug } })) {
        attempt++;
        slug = `${baseSlug}-${attempt}`;
        if (attempt > 50) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Could not derive a unique slug.' });
        }
      }

      return prisma.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: {
            legalName: input.legalName,
            slug,
            countryCode: input.countryCode,
            taxId: input.taxId,
          },
        });
        await tx.organizationMember.create({
          data: {
            organizationId: org.id,
            userId: ctx.user.id,
            role: 'OWNER',
            acceptedAt: new Date(),
          },
        });
        return org;
      });
    }),

  members: protectedProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireMembership({ userId: ctx.user.id, organizationId: input.organizationId });
      return prisma.organizationMember.findMany({
        where: { organizationId: input.organizationId },
        orderBy: { invitedAt: 'asc' },
        include: {
          user: { select: { email: true, fullName: true } },
        },
      });
    }),

  invite: protectedProcedure
    .use(userMutationRateLimit)
    .input(
      z.object({
        organizationId: z.string(),
        email: z.string().email().toLowerCase().trim(),
        role: z.enum(['ADMIN', 'BUYER']),
        monthlyCapMinor: z.number().int().min(0).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireMembership({
        userId: ctx.user.id,
        organizationId: input.organizationId,
        minRole: 'ADMIN',
      });

      // If the user already exists, link directly. Otherwise we still create
      // a pending row keyed on a synthetic userId so the invite shows up in
      // /my once they sign up — handled by a sign-in hook (TODO).
      const user = await prisma.user.findUnique({ where: { email: input.email } });
      if (!user) {
        throw new TRPCError({
          code: 'NOT_IMPLEMENTED',
          message:
            'Inviting a user who does not yet have an account is queued for the next slice. Ask them to sign up first.',
        });
      }

      const existing = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: input.organizationId,
            userId: user.id,
          },
        },
      });
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Already a member.' });
      }

      return prisma.organizationMember.create({
        data: {
          organizationId: input.organizationId,
          userId: user.id,
          role: input.role,
          monthlyCapMinor: input.monthlyCapMinor,
          // Auto-accept since the user already exists; in a real flow we'd
          // gate on an email-confirm step.
          acceptedAt: new Date(),
        },
      });
    }),

  removeMember: protectedProcedure
    .use(userMutationRateLimit)
    .input(
      z.object({
        organizationId: z.string(),
        memberId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const acting = await requireMembership({
        userId: ctx.user.id,
        organizationId: input.organizationId,
        minRole: 'ADMIN',
      });

      const target = await prisma.organizationMember.findUnique({
        where: { id: input.memberId },
      });
      if (!target || target.organizationId !== input.organizationId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found.' });
      }

      // Prevent removing the last OWNER.
      if (target.role === 'OWNER') {
        const owners = await prisma.organizationMember.count({
          where: { organizationId: input.organizationId, role: 'OWNER' },
        });
        if (owners <= 1) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Cannot remove the last OWNER. Promote another member first.',
          });
        }
      }
      // ADMINs cannot remove OWNERs.
      if (target.role === 'OWNER' && acting.role !== 'OWNER') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only OWNERs can remove other OWNERs.' });
      }

      await prisma.organizationMember.delete({ where: { id: target.id } });
      return { ok: true };
    }),

  updateMemberRole: protectedProcedure
    .use(userMutationRateLimit)
    .input(
      z.object({
        organizationId: z.string(),
        memberId: z.string(),
        role: z.enum(['OWNER', 'ADMIN', 'BUYER']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireMembership({
        userId: ctx.user.id,
        organizationId: input.organizationId,
        minRole: 'OWNER',
      });
      return prisma.organizationMember.update({
        where: { id: input.memberId },
        data: { role: input.role },
      });
    }),

  /**
   * Returns the active tax exemption for the org+jurisdiction that covers
   * `now`. Used by checkout to decide whether to skip tax calc.
   */
  currentExemption: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        jurisdiction: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireMembership({
        userId: ctx.user.id,
        organizationId: input.organizationId,
      });
      const now = new Date();
      return prisma.taxExemption.findFirst({
        where: {
          organizationId: input.organizationId,
          status: 'APPROVED',
          jurisdiction: input.jurisdiction ?? null,
          validFrom: { lte: now },
          OR: [{ validUntil: null }, { validUntil: { gt: now } }],
        },
      });
    }),
});
