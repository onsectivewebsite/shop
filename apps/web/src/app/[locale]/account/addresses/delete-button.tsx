'use client';

import { Trash2 } from 'lucide-react';
import { deleteAddressAction } from './actions';

export function DeleteAddressButton({ addressId }: { addressId: string }) {
  return (
    <form
      action={deleteAddressAction.bind(null, addressId)}
      onSubmit={(e) => {
        if (!confirm('Delete this address from your address book?')) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-rose-300 bg-white px-3 text-xs font-semibold text-rose-700 hover:border-rose-500"
      >
        <Trash2 size={11} strokeWidth={2} /> Delete
      </button>
    </form>
  );
}
