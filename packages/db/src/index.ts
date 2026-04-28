import { PrismaClient } from '@prisma/client';

// Singleton Prisma client. In dev with Next.js HMR, prevent connection storms by
// stashing the instance on globalThis. In prod each process owns one.

declare global {
  // eslint-disable-next-line no-var
  var __onsectivePrisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__onsectivePrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__onsectivePrisma = prisma;
}

export * from '@prisma/client';
