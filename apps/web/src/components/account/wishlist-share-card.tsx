'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, Button, Input, Label } from '@onsective/ui';
import { Copy, Eye, EyeOff } from 'lucide-react';
import { trpc } from '@/lib/trpc';

export function WishlistShareCard({ baseUrl }: { baseUrl: string }) {
  const q = trpc.me.wishlistShare.get.useQuery();
  const utils = trpc.useUtils();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [draftName, setDraftName] = useState<string | null>(null);

  const setVisibility = trpc.me.wishlistShare.setVisibility.useMutation({
    onSettled: () => utils.me.wishlistShare.get.invalidate(),
  });

  const setName = trpc.me.wishlistShare.setDisplayName.useMutation({
    onSettled: () => utils.me.wishlistShare.get.invalidate(),
  });

  if (q.isLoading || !q.data) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  const { slug, isPublic, viewCount, displayName } = q.data;
  const shareUrl = `${baseUrl}/wishlist/${slug}`;

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Share your wishlist</h2>
            <p className="mt-1 text-sm text-slate-600">
              A view-only public link friends and family can open without an
              Onsective account.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isPublic}
            aria-label="Wishlist public"
            onClick={() => setVisibility.mutate({ isPublic: !isPublic })}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
              isPublic ? 'bg-emerald-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                isPublic ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {isPublic ? (
          <>
            <div className="rounded-xl border border-slate-200 bg-stone-50 p-4">
              <p className="text-xs text-slate-500">Public link</p>
              <p className="mt-1 break-all font-mono text-sm text-slate-700">{shareUrl}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={copyLink}
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                >
                  <Copy size={12} strokeWidth={2} />
                  {copied ? 'Copied' : 'Copy link'}
                </button>
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Eye size={12} strokeWidth={2} />
                  Preview
                </a>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ws-name">Display name (optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="ws-name"
                  value={draftName ?? displayName ?? ''}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="Defaults to your first name"
                  maxLength={60}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending || draftName === null || draftName === (displayName ?? '')}
                  onClick={() => {
                    const name = draftName?.trim() ?? '';
                    startTransition(() => {
                      setName.mutate({ displayName: name === '' ? null : name });
                      setDraftName(null);
                    });
                  }}
                >
                  Save
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                Visible to anyone who opens the link — no last name shown either way.
              </p>
            </div>

            {viewCount > 0 && (
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <Eye size={12} strokeWidth={2} />
                {viewCount.toLocaleString()} views all-time
              </p>
            )}
          </>
        ) : (
          <p className="flex items-center gap-2 rounded-xl border border-slate-200 bg-stone-50 p-4 text-sm text-slate-600">
            <EyeOff size={14} strokeWidth={2} />
            Your wishlist isn't currently shareable. Toggle on to mint a link.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
