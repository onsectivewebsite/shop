import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router, protectedProcedure, userMutationRateLimit } from '../trpc';
import { prisma } from '../db';

/**
 * Buyer-side support tickets. The console-side ticket queue + reply flow
 * already exists (apps/console/src/app/dashboard/tickets); this router
 * gives buyers the surface to *create* and *follow up on* tickets, lighting
 * up the SupportTicket + SupportMessage scaffolding.
 *
 * Channel is hardcoded to WEB_FORM. SLA target is computed from the
 * declared priority — same minutes everywhere, no per-tier customer plans
 * yet, so the matrix lives in one place here.
 */

const SUBJECT_MAX = 200;
const BODY_MAX = 10_000;

const SLA_HOURS_BY_PRIORITY: Record<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT', number> = {
  URGENT: 1,
  HIGH: 4,
  NORMAL: 24,
  LOW: 72,
};

async function nextTicketNumber(): Promise<string> {
  // Year-prefixed sequential, mirrors Order.orderNumber. count() is cheap
  // enough at launch volume; switch to a sequence-backed generator if it
  // ever becomes a hot spot.
  const year = new Date().getFullYear();
  const seq = (await prisma.supportTicket.count()) + 1;
  return `ONS-T-${year}-${String(seq).padStart(6, '0')}`;
}

export const supportRouter = router({
  /** Buyer's tickets, newest first. */
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await prisma.supportTicket.findMany({
      where: { customerId: ctx.user.id },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        status: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
        firstResponseAt: true,
      },
    });
    return rows;
  }),

  /**
   * Thread view. Strips internal notes — those are PM-only and the buyer
   * shouldn't see them even by accident.
   */
  get: protectedProcedure
    .input(z.object({ ticketId: z.string() }))
    .query(async ({ ctx, input }) => {
      const ticket = await prisma.supportTicket.findFirst({
        where: { id: input.ticketId, customerId: ctx.user.id },
        select: {
          id: true,
          ticketNumber: true,
          subject: true,
          status: true,
          priority: true,
          createdAt: true,
          updatedAt: true,
          relatedOrderId: true,
          messages: {
            where: { isInternal: false },
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              authorType: true,
              body: true,
              createdAt: true,
            },
          },
        },
      });
      if (!ticket) throw new TRPCError({ code: 'NOT_FOUND' });
      return ticket;
    }),

  create: protectedProcedure
    .use(userMutationRateLimit)
    .input(
      z.object({
        subject: z.string().trim().min(3).max(SUBJECT_MAX),
        body: z.string().trim().min(10).max(BODY_MAX),
        priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
        relatedOrderNumber: z.string().trim().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the related order belongs to this buyer if supplied — never
      // trust a client-side identifier, even when scoped to current user.
      let relatedOrderId: string | null = null;
      if (input.relatedOrderNumber && input.relatedOrderNumber.length > 0) {
        const order = await prisma.order.findFirst({
          where: { orderNumber: input.relatedOrderNumber, buyerId: ctx.user.id },
          select: { id: true },
        });
        if (!order) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Order number not found in your history.',
          });
        }
        relatedOrderId = order.id;
      }

      const ticketNumber = await nextTicketNumber();
      const slaHours = SLA_HOURS_BY_PRIORITY[input.priority];
      const slaDueAt = new Date(Date.now() + slaHours * 60 * 60 * 1000);

      const created = await prisma.$transaction(async (tx) => {
        const ticket = await tx.supportTicket.create({
          data: {
            ticketNumber,
            channel: 'WEB_FORM',
            subject: input.subject,
            status: 'OPEN',
            priority: input.priority,
            customerId: ctx.user.id,
            customerEmail: ctx.user.email,
            relatedOrderId,
            slaDueAt,
            language: ctx.user.locale?.split('-')[0] ?? 'en',
          },
          select: { id: true, ticketNumber: true },
        });
        await tx.supportMessage.create({
          data: {
            ticketId: ticket.id,
            authorType: 'CUSTOMER',
            authorId: ctx.user.id,
            body: input.body,
          },
        });
        return ticket;
      });
      return created;
    }),

  reply: protectedProcedure
    .use(userMutationRateLimit)
    .input(
      z.object({
        ticketId: z.string(),
        body: z.string().trim().min(1).max(BODY_MAX),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ticket = await prisma.supportTicket.findFirst({
        where: { id: input.ticketId, customerId: ctx.user.id },
        select: { id: true, status: true },
      });
      if (!ticket) throw new TRPCError({ code: 'NOT_FOUND' });
      // Don't allow new buyer messages on RESOLVED/CLOSED — they should
      // open a new ticket. REOPENED is fine; PENDING_CUSTOMER flips back
      // to OPEN as soon as the buyer responds.
      if (ticket.status === 'CLOSED') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This ticket is closed. Open a new one.',
        });
      }

      const wasResolved = ticket.status === 'RESOLVED';
      await prisma.$transaction([
        prisma.supportMessage.create({
          data: {
            ticketId: ticket.id,
            authorType: 'CUSTOMER',
            authorId: ctx.user.id,
            body: input.body,
          },
        }),
        prisma.supportTicket.update({
          where: { id: ticket.id },
          data: {
            status: wasResolved ? 'REOPENED' : 'OPEN',
            // Bump reopenCount only when the buyer actually re-engages
            // after we marked it resolved.
            reopenCount: wasResolved ? { increment: 1 } : undefined,
            updatedAt: new Date(),
          },
        }),
      ]);
      return { ok: true };
    }),
});
