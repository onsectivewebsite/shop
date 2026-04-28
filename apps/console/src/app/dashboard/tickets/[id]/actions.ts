'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@onsective/db';
import { getConsoleSession } from '@/server/auth';
import { audit } from '@/lib/audit';

export async function sendTicketReplyAction(
  ticketId: string,
  formData: FormData,
): Promise<void> {
  const session = await getConsoleSession();
  if (!session) throw new Error('Not authorized');

  const body = (formData.get('body') ?? '').toString().trim();
  const isInternal = formData.get('isInternal') === 'on';

  if (!body) return;
  if (body.length > 10_000) throw new Error('Message too long.');

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, status: true, firstResponseAt: true },
  });
  if (!ticket) throw new Error('Ticket not found');

  await prisma.$transaction([
    prisma.supportMessage.create({
      data: {
        ticketId,
        authorType: 'PLATFORM_MANAGER',
        authorId: session.user.id,
        body,
        isInternal,
      },
    }),
    prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        // Public reply moves the ticket to PENDING_CUSTOMER; internal note doesn't move state.
        status: isInternal ? ticket.status : 'PENDING_CUSTOMER',
        firstResponseAt:
          !isInternal && !ticket.firstResponseAt ? new Date() : ticket.firstResponseAt,
        updatedAt: new Date(),
      },
    }),
  ]);

  await audit({
    actorId: session.user.id,
    action: isInternal ? 'ticket.note' : 'ticket.reply',
    targetType: 'ticket',
    targetId: ticketId,
    metadata: { length: body.length },
  });

  revalidatePath(`/dashboard/tickets/${ticketId}`);
}
