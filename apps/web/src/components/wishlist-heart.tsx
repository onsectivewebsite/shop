'use client';

import { useState } from 'react';
import { Heart } from 'lucide-react';

export function WishlistHeart({
  productId,
  initialSaved = false,
  size = 'md',
}: {
  productId: string;
  initialSaved?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setError(null);
    setBusy(true);
    try {
      const r = await fetch('/api/wishlist/toggle', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? 'Could not save.');
        return;
      }
      setSaved(Boolean(data.saved));
    } catch {
      setError('Network error.');
    } finally {
      setBusy(false);
    }
  }

  const dims =
    size === 'lg' ? 'h-12 w-12' : size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  const icon = size === 'lg' ? 18 : size === 'sm' ? 14 : 16;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
      title={error ?? (saved ? 'Saved · click to remove' : 'Save to wishlist')}
      className={`flex ${dims} items-center justify-center rounded-full border transition-colors disabled:opacity-60 ${
        saved
          ? 'border-rose-300 bg-rose-50 text-rose-600 hover:border-rose-400'
          : 'border-stone-300 bg-white text-stone-700 hover:border-stone-500'
      }`}
    >
      <Heart
        size={icon}
        strokeWidth={1.75}
        fill={saved ? 'currentColor' : 'none'}
      />
    </button>
  );
}
