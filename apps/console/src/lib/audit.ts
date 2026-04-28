import { prisma, Prisma } from '@onsective/db';

export async function audit(args: {
  actorId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      actorType: 'user',
      actorId: args.actorId,
      action: args.action,
      targetType: args.targetType,
      targetId: args.targetId,
      metadata: args.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}
