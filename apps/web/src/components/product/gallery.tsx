'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

export function ProductGallery({ images, title }: { images: string[]; title: string }) {
  const [active, setActive] = useState(0);
  const safe = images.length > 0 ? images : [];

  if (safe.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-400">
        No image
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-white">
        <Image
          // The hero image is above the fold on every PDP — priority skips
          // lazy loading and gives the browser a head start on decoding.
          priority
          fill
          // PDP gallery is at most ~50% of viewport on desktop, full on mobile.
          sizes="(min-width: 768px) 50vw, 100vw"
          src={safe[active]!}
          alt={`${title} (image ${active + 1} of ${safe.length})`}
          className="object-contain"
        />
      </div>
      {safe.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto" aria-label="Product images">
          {safe.map((src, i) => (
            <li key={src + i}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-current={i === active}
                className={cn(
                  'relative h-16 w-16 overflow-hidden rounded-md border-2 bg-white',
                  i === active ? 'border-brand-600' : 'border-slate-200 hover:border-slate-400',
                )}
              >
                <Image
                  src={src}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
