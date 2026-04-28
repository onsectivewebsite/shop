'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Label, Card, CardContent } from '@onsective/ui';
import { trpc } from '@/lib/trpc';

type Step = 1 | 2 | 3 | 4 | 5;

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;
type AcceptedImageType = (typeof ACCEPTED_IMAGE_TYPES)[number];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 8;

type ImageItem =
  | { id: string; status: 'uploading'; preview: string }
  | { id: string; status: 'done'; preview: string; publicUrl: string }
  | { id: string; status: 'error'; preview: string; error: string };

function isAcceptedType(t: string): t is AcceptedImageType {
  return (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(t);
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);

export function ProductWizard({ categories }: { categories: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [error, setError] = useState<string | null>(null);

  const [basics, setBasics] = useState({
    title: '',
    categoryId: categories[0]?.id ?? '',
    brand: '',
    description: '',
    countryCode: 'US',
  });
  const [bullets, setBullets] = useState<string[]>(['']);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [variant, setVariant] = useState({
    sku: '',
    title: '',
    priceAmount: 0,
    currency: 'USD',
    stockQty: 0,
    weightGrams: 100,
    lengthMm: 100,
    widthMm: 100,
    heightMm: 50,
  });

  const create = trpc.seller.products.create.useMutation({
    onSuccess: () => router.push('/seller/products'),
    onError: (e) => setError(e.message),
  });

  const uploadedImageUrls = images
    .filter((i): i is Extract<ImageItem, { status: 'done' }> => i.status === 'done')
    .map((i) => i.publicUrl);
  const hasInflightUpload = images.some((i) => i.status === 'uploading');

  function submit() {
    setError(null);
    if (uploadedImageUrls.length === 0) {
      setError('Add at least one product image.');
      return;
    }
    create.mutate({
      title: basics.title,
      slug: slugify(basics.title),
      categoryId: basics.categoryId,
      brand: basics.brand || undefined,
      description: basics.description,
      bullets: bullets.filter(Boolean),
      images: uploadedImageUrls,
      countryCode: basics.countryCode,
      variants: [{ ...variant, attributes: {} }],
    });
  }

  return (
    <div className="space-y-6">
      <Steps current={step} />

      {step === 1 && (
        <Card>
          <CardContent className="space-y-4 p-6">
            <h2 className="text-lg font-semibold">Basic info</h2>
            <Field label="Title">
              <Input value={basics.title} onChange={(e) => setBasics({ ...basics, title: e.target.value })} />
            </Field>
            <Field label="Category">
              <select
                value={basics.categoryId}
                onChange={(e) => setBasics({ ...basics, categoryId: e.target.value })}
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Brand (optional)">
              <Input value={basics.brand} onChange={(e) => setBasics({ ...basics, brand: e.target.value })} />
            </Field>
            <Field label="Description (≥ 20 chars)">
              <textarea
                value={basics.description}
                onChange={(e) => setBasics({ ...basics, description: e.target.value })}
                rows={5}
                className="w-full rounded-md border border-slate-300 bg-white p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              />
            </Field>
            <Field label="Selling country">
              <select
                value={basics.countryCode}
                onChange={(e) => setBasics({ ...basics, countryCode: e.target.value })}
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="US">United States</option>
                <option value="IN">India</option>
              </select>
            </Field>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardContent className="space-y-4 p-6">
            <h2 className="text-lg font-semibold">Bullet points</h2>
            {bullets.map((b, i) => (
              <Input
                key={i}
                value={b}
                onChange={(e) => {
                  const next = [...bullets];
                  next[i] = e.target.value;
                  setBullets(next);
                }}
                placeholder={`Selling point ${i + 1}`}
              />
            ))}
            <Button variant="outline" onClick={() => setBullets([...bullets, ''])}>
              + Add bullet
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 3 && <ImagesStep images={images} setImages={setImages} />}

      {step === 4 && (
        <Card>
          <CardContent className="space-y-4 p-6">
            <h2 className="text-lg font-semibold">Pricing & inventory</h2>
            <Field label="SKU">
              <Input value={variant.sku} onChange={(e) => setVariant({ ...variant, sku: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Price (in minor units, e.g. cents)">
                <Input
                  type="number"
                  value={variant.priceAmount}
                  onChange={(e) => setVariant({ ...variant, priceAmount: Number(e.target.value) })}
                />
              </Field>
              <Field label="Currency">
                <select
                  value={variant.currency}
                  onChange={(e) => setVariant({ ...variant, currency: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                >
                  <option>USD</option>
                  <option>INR</option>
                  <option>GBP</option>
                </select>
              </Field>
            </div>
            <Field label="Stock qty">
              <Input
                type="number"
                value={variant.stockQty}
                onChange={(e) => setVariant({ ...variant, stockQty: Number(e.target.value) })}
              />
            </Field>
            <div className="grid grid-cols-4 gap-3">
              <Field label="Weight (g)">
                <Input
                  type="number"
                  value={variant.weightGrams}
                  onChange={(e) => setVariant({ ...variant, weightGrams: Number(e.target.value) })}
                />
              </Field>
              <Field label="L (mm)">
                <Input
                  type="number"
                  value={variant.lengthMm}
                  onChange={(e) => setVariant({ ...variant, lengthMm: Number(e.target.value) })}
                />
              </Field>
              <Field label="W (mm)">
                <Input
                  type="number"
                  value={variant.widthMm}
                  onChange={(e) => setVariant({ ...variant, widthMm: Number(e.target.value) })}
                />
              </Field>
              <Field label="H (mm)">
                <Input
                  type="number"
                  value={variant.heightMm}
                  onChange={(e) => setVariant({ ...variant, heightMm: Number(e.target.value) })}
                />
              </Field>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 5 && (
        <Card>
          <CardContent className="space-y-3 p-6">
            <h2 className="text-lg font-semibold">Review</h2>
            <p className="text-sm">
              <strong>{basics.title}</strong> · {basics.brand || 'no brand'}
            </p>
            <p className="text-sm text-slate-600">{basics.description}</p>
            <p className="text-sm">
              {variant.priceAmount / 100} {variant.currency} · stock {variant.stockQty}
            </p>
            {error && <p className="text-sm text-error-600">{error}</p>}
            <p className="text-xs text-slate-500">
              On submit, listing goes to admin review before going live.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        {step > 1 ? (
          <Button variant="ghost" onClick={() => setStep((s) => (s - 1) as Step)}>
            ← Back
          </Button>
        ) : (
          <span />
        )}
        {step < 5 ? (
          <Button onClick={() => setStep((s) => (s + 1) as Step)}>Continue →</Button>
        ) : (
          <Button variant="cta" onClick={submit} disabled={create.isLoading || hasInflightUpload}>
            {create.isLoading
              ? 'Submitting…'
              : hasInflightUpload
                ? 'Waiting for uploads…'
                : 'Submit for approval'}
          </Button>
        )}
      </div>
    </div>
  );
}

function Steps({ current }: { current: Step }) {
  const labels = ['Basics', 'Bullets', 'Images', 'Pricing', 'Review'];
  return (
    <ol className="flex items-center gap-2 text-sm">
      {labels.map((l, i) => {
        const num = (i + 1) as Step;
        const done = current > num;
        const active = current === num;
        return (
          <li key={l} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                active
                  ? 'bg-brand-600 text-white'
                  : done
                    ? 'bg-success-500 text-white'
                    : 'bg-slate-200 text-slate-500'
              }`}
            >
              {done ? '✓' : num}
            </span>
            <span className={active ? 'font-semibold' : 'text-slate-500'}>{l}</span>
            {i < labels.length - 1 && <span className="mx-1 h-px w-6 bg-slate-200" />}
          </li>
        );
      })}
    </ol>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ImagesStep({
  images,
  setImages,
}: {
  images: ImageItem[];
  setImages: React.Dispatch<React.SetStateAction<ImageItem[]>>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const requestUrl = trpc.seller.uploads.requestImageUploadUrl.useMutation();
  const confirmUpload = trpc.seller.uploads.confirmImageUpload.useMutation();

  // Revoke object URLs to avoid leaks. The preview URL stays live until the row is removed.
  useEffect(() => {
    return () => {
      images.forEach((i) => URL.revokeObjectURL(i.preview));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function uploadOne(file: File) {
    if (!isAcceptedType(file.type)) {
      const id = crypto.randomUUID();
      const preview = URL.createObjectURL(file);
      setImages((prev) => [
        ...prev,
        { id, status: 'error', preview, error: 'Use JPEG, PNG, WebP or AVIF.' },
      ]);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      const id = crypto.randomUUID();
      const preview = URL.createObjectURL(file);
      setImages((prev) => [...prev, { id, status: 'error', preview, error: 'Max 5 MB.' }]);
      return;
    }

    const id = crypto.randomUUID();
    const preview = URL.createObjectURL(file);
    setImages((prev) => [...prev, { id, status: 'uploading', preview }]);

    try {
      const signed = await requestUrl.mutateAsync({
        contentType: file.type,
        sizeBytes: file.size,
      });
      const res = await fetch(signed.url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!res.ok) throw new Error(`S3 upload failed (${res.status}).`);
      // Fire-and-forget the resize job — wizard doesn't block on variant
      // generation. Variants render lazily on first PDP render.
      confirmUpload
        .mutateAsync({ key: signed.key, contentType: file.type as AcceptedImageType })
        .catch(() => {});
      setImages((prev) =>
        prev.map((i) =>
          i.id === id
            ? { id, status: 'done', preview, publicUrl: signed.publicUrl }
            : i,
        ),
      );
    } catch (err) {
      setImages((prev) =>
        prev.map((i) =>
          i.id === id
            ? { id, status: 'error', preview, error: err instanceof Error ? err.message : 'Upload failed.' }
            : i,
        ),
      );
    }
  }

  function onSelectFiles(files: FileList | null) {
    if (!files) return;
    const room = MAX_IMAGES - images.length;
    if (room <= 0) return;
    Array.from(files).slice(0, room).forEach((f) => void uploadOne(f));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function remove(id: string) {
    setImages((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((i) => i.id !== id);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <h2 className="text-lg font-semibold">Images</h2>
        <p className="text-sm text-slate-500">
          Up to {MAX_IMAGES}. JPEG, PNG, WebP or AVIF. 5 MB max each.
        </p>

        {images.length > 0 && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {images.map((img) => (
              <li
                key={img.id}
                className="group relative aspect-square overflow-hidden rounded-md border border-slate-200 bg-slate-50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.preview} alt="" className="h-full w-full object-cover" />
                {img.status === 'uploading' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-medium text-white">
                    Uploading…
                  </div>
                )}
                {img.status === 'error' && (
                  <div className="absolute inset-x-0 bottom-0 bg-error-600/90 px-2 py-1 text-xs text-white">
                    {img.error}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => remove(img.id)}
                  className="absolute right-1 top-1 rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-slate-700 opacity-0 shadow group-hover:opacity-100"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(',')}
            multiple
            className="hidden"
            onChange={(e) => onSelectFiles(e.target.files)}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={images.length >= MAX_IMAGES}
          >
            {images.length === 0 ? 'Choose images' : '+ Add more'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
