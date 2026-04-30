'use client';

import { useRef, useState } from 'react';
import { Upload, Check, AlertCircle } from 'lucide-react';

const ACCEPTED = '.pdf,image/jpeg,image/png,image/webp';
const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_BYTES = 10 * 1024 * 1024;

type UploadState = 'idle' | 'uploading' | 'done' | 'error';

export function KycUploader({ docType, label }: { docType: string; label: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onPick(file: File) {
    setError(null);
    if (!ACCEPTED_MIME.includes(file.type)) {
      setError('Use JPEG, PNG, WebP, or PDF.');
      setState('error');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('File must be ≤ 10 MB.');
      setState('error');
      return;
    }

    setState('uploading');
    try {
      // 1. Get presigned PUT URL
      const signRes = await fetch('/api/seller/kyc/sign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          docType,
          contentType: file.type,
          sizeBytes: file.size,
        }),
      });
      const signed = await signRes.json();
      if (!signRes.ok) throw new Error(signed.error ?? 'Could not sign upload.');

      // 2. PUT to S3
      const putRes = await fetch(signed.url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error(`Upload failed (${putRes.status}).`);

      // 3. Confirm — creates KycDocument row
      const confirmRes = await fetch('/api/seller/kyc/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ docType, key: signed.key }),
      });
      const confirm = await confirmRes.json();
      if (!confirmRes.ok) throw new Error(confirm.error ?? 'Could not confirm.');

      setState('done');
      // Reload so the parent server component renders the new submission badge.
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
      setState('error');
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onPick(f);
          if (fileRef.current) fileRef.current.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={state === 'uploading'}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 text-xs font-semibold text-stone-700 transition-colors hover:border-stone-500 disabled:opacity-60"
      >
        {state === 'uploading' ? (
          'Uploading…'
        ) : state === 'done' ? (
          <>
            <Check size={11} strokeWidth={2.5} className="text-emerald-700" /> Uploaded
          </>
        ) : (
          <>
            <Upload size={11} strokeWidth={2.5} /> Upload {label}
          </>
        )}
      </button>
      {state === 'error' && error && (
        <p className="inline-flex items-center gap-1 text-[11px] text-error-600">
          <AlertCircle size={10} /> {error}
        </p>
      )}
    </div>
  );
}
