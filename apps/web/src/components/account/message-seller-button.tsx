'use client';

import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';

/**
 * Per-order-item CTA. Calls startFromOrderItem (idempotent on orderItemId)
 * and routes to the resulting thread. Replays gracefully on a duplicate
 * click — the second mutation just gets the same conversation id back.
 */
export function MessageSellerButton({ orderItemId }: { orderItemId: string }) {
  const router = useRouter();
  const start = trpc.messages.startFromOrderItem.useMutation({
    onSuccess: ({ id }) => {
      router.push(`/account/messages/${id}`);
    },
  });

  return (
    <button
      type="button"
      onClick={() => start.mutate({ orderItemId })}
      disabled={start.isLoading}
      className="text-xs font-medium text-cta-700 underline-offset-2 hover:underline disabled:opacity-50"
    >
      {start.isLoading ? 'Opening…' : 'Message seller'}
    </button>
  );
}
