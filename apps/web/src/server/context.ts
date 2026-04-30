import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import { getSession } from './auth';
import { newRequestId, tagRequest } from './observability';

export async function createTRPCContext(opts: FetchCreateContextFnOptions) {
  const session = await getSession();
  // Honour an upstream request id (load balancer, edge proxy) when present;
  // otherwise mint our own. Either way it propagates through ctx and back
  // out on the response so the caller can correlate logs.
  const incoming = opts.req.headers.get('x-request-id');
  const requestId = incoming && incoming.length <= 64 ? incoming : newRequestId();
  await tagRequest(requestId, session?.user?.id ?? null);
  return {
    req: opts.req,
    user: session?.user ?? null,
    sessionId: session?.sessionId ?? null,
    impersonation: session?.impersonation ?? null,
    ipAddress: opts.req.headers.get('x-forwarded-for') ?? null,
    userAgent: opts.req.headers.get('user-agent') ?? null,
    requestId,
  };
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;
