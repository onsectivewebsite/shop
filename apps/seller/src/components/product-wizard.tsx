'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';

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
  const [step, setStep] = useState<Step>(1);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  const uploadedImageUrls = images
    .filter((i): i is Extract<ImageItem, { status: 'done' }> => i.status === 'done')
    .map((i) => i.publicUrl);
  const hasInflightUpload = images.some((i) => i.status === 'uploading');

  async function submit() {
    setError(null);
    if (uploadedImageUrls.length === 0) {
      setError('Add at least one product image.');
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch('/api/seller/products', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: basics.title,
          slug: slugify(basics.title),
          categoryId: basics.categoryId,
          brand: basics.brand || undefined,
          description: basics.description,
          bullets: bullets.filter(Boolean),
          images: uploadedImageUrls,
          countryCode: basics.countryCode,
          variants: [{ ...variant, attributes: {} }],
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? 'Could not create product.');
        return;
      }
      window.location.href = '/dashboard/products';
    } catch {
      setError('Network error.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Steps current={step} />

      {step === 1 && (
        <Card title="Basics">
          <Field label="Product title">
            <input
              required
              value={basics.title}
              onChange={(e) => setBasics({ ...basics, title: e.target.value })}
              className="h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
              placeholder="What is it?"
            />
          </Field>
          <Field label="Category">
            <select
              value={basics.categoryId}
              onChange={(e) => setBasics({ ...basics, categoryId: e.target.value })}
              className="h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Brand (optional)">
            <input
              value={basics.brand}
              onChange={(e) => setBasics({ ...basics, brand: e.target.value })}
              className="h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
            />
          </Field>
          <Field label="Description (≥ 20 characters)">
            <textarea
              value={basics.description}
              onChange={(e) => setBasics({ ...basics, description: e.target.value })}
              rows={5}
              className="w-full rounded-md border border-stone-300 bg-white p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
            />
          </Field>
          <Field label="Selling country">
            <select
              value={basics.countryCode}
              onChange={(e) => setBasics({ ...basics, countryCode: e.target.value })}
              className="h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
            >
              <option value="US">United States</option>
              <option value="IN">India</option>
              <option value="GB">United Kingdom</option>
              <option value="CA">Canada</option>
              <option value="AU">Australia</option>
              <option value="DE">Germany</option>
              <option value="FR">France</option>
              <option value="JP">Japan</option>
              <option value="SG">Singapore</option>
            </select>
          </Field>
        </Card>
      )}

      {step === 2 && (
        <Card title="Bullet points">
          <p className="text-sm text-stone-500">3-5 specific selling points work best.</p>
          {bullets.map((b, i) => (
            <input
              key={i}
              value={b}
              onChange={(e) => {
                const next = [...bullets];
                next[i] = e.target.value;
                setBullets(next);
              }}
              placeholder={`Selling point ${i + 1}`}
              className="h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
            />
          ))}
          <button
            type="button"
            onClick={() => setBullets([...bullets, ''])}
            className="rounded-full border border-stone-300 px-4 py-2 text-xs font-semibold text-stone-700 hover:border-stone-500"
          >
            + Add bullet
          </button>
        </Card>
      )}

      {step === 3 && <ImagesStep images={images} setImages={setImages} />}

      {step === 4 && (
        <Card title="Pricing & inventory">
          <Field label="SKU">
            <input
              required
              value={variant.sku}
              onChange={(e) => setVariant({ ...variant, sku: e.target.value })}
              className="h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price (in minor units, e.g. cents)">
              <input
                type="number"
                value={variant.priceAmount}
                onChange={(e) => setVariant({ ...variant, priceAmount: Number(e.target.value) })}
                className="h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
              />
            </Field>
            <Field label="Currency">
              <select
                value={variant.currency}
                onChange={(e) => setVariant({ ...variant, currency: e.target.value })}
                className="h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
              >
                <option>USD</option>
                <option>INR</option>
                <option>GBP</option>
                <option>EUR</option>
              </select>
            </Field>
          </div>
          <Field label="Stock quantity">
            <input
              type="number"
              value={variant.stockQty}
              onChange={(e) => setVariant({ ...variant, stockQty: Number(e.target.value) })}
              className="h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
            />
          </Field>
          <div className="grid grid-cols-4 gap-3">
            <Field label="Weight (g)">
              <input
                type="number"
                value={variant.weightGrams}
                onChange={(e) => setVariant({ ...variant, weightGrams: Number(e.target.value) })}
                className="h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
              />
            </Field>
            <Field label="L (mm)">
              <input
                type="number"
                value={variant.lengthMm}
                onChange={(e) => setVariant({ ...variant, lengthMm: Number(e.target.value) })}
                className="h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
              />
            </Field>
            <Field label="W (mm)">
              <input
                type="number"
                value={variant.widthMm}
                onChange={(e) => setVariant({ ...variant, widthMm: Number(e.target.value) })}
                className="h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
              />
            </Field>
            <Field label="H (mm)">
              <input
                type="number"
                value={variant.heightMm}
                onChange={(e) => setVariant({ ...variant, heightMm: Number(e.target.value) })}
                className="h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
              />
            </Field>
          </div>
        </Card>
      )}

      {step === 5 && (
        <Card title="Review">
          <p className="text-sm">
            <strong>{basics.title || '—'}</strong>
            {basics.brand && <> · {basics.brand}</>}
          </p>
          <p className="text-sm text-stone-600">{basics.description || '—'}</p>
          <p className="text-sm">
            {(variant.priceAmount / 100).toFixed(2)} {variant.currency} · stock {variant.stockQty}
          </p>
          {uploadedImageUrls.length > 0 && (
            <p className="text-xs text-stone-500">
              {uploadedImageUrls.length} {uploadedImageUrls.length === 1 ? 'image' : 'images'} attached
            </p>
          )}
          {error && <p className="text-sm text-error-600">{error}</p>}
          <p className="text-xs text-stone-500">
            On submit, listing goes to admin review before going live.
          </p>
        </Card>
      )}

      <div className="flex justify-between">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => (s - 1) as Step)}
            className="rounded-full px-4 py-2 text-sm text-stone-600 hover:text-stone-900"
          >
            ← Back
          </button>
        ) : (
          <span />
        )}
        {step < 5 ? (
          <button
            type="button"
            onClick={() => setStep((s) => (s + 1) as Step)}
            className="h-11 rounded-full bg-stone-900 px-6 text-sm font-semibold text-white transition-colors hover:bg-stone-800"
          >
            Continue →
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={submitting || hasInflightUpload}
            className="h-11 rounded-full bg-emerald-700 px-6 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 disabled:opacity-60"
          >
            {submitting
              ? 'Submitting…'
              : hasInflightUpload
                ? 'Waiting for uploads…'
                : 'Submit for approval'}
          </button>
        )}
      </div>
    </div>
  );
}

function Steps({ current }: { current: Step }) {
  const labels = ['Basics', 'Bullets', 'Images', 'Pricing', 'Review'];
  return (
    <ol className="flex flex-wrap items-center gap-3 text-sm">
      {labels.map((l, i) => {
        const num = (i + 1) as Step;
        const done = current > num;
        const active = current === num;
        return (
          <li key={l} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                active
                  ? 'bg-stone-900 text-white'
                  : done
                    ? 'bg-emerald-700 text-white'
                    : 'bg-stone-200 text-stone-500'
              }`}
            >
              {done ? <CheckCircle2 size={12} strokeWidth={2.5} /> : num}
            </span>
            <span className={active ? 'font-semibold text-stone-950' : 'text-stone-500'}>{l}</span>
            {i < labels.length - 1 && <span className="mx-1 h-px w-6 bg-stone-200" />}
          </li>
        );
      })}
    </ol>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
      <h2 className="font-display text-xl font-medium tracking-tight text-stone-950">{title}</h2>
      <div className="mt-5 space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-stone-700">{label}</span>
      <span className="mt-1 block">{children}</span>
    </label>
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
      const signRes = await fetch('/api/seller/uploads/sign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contentType: file.type, sizeBytes: file.size }),
      });
      const signed = await signRes.json();
      if (!signRes.ok) throw new Error(signed.error ?? 'Could not sign upload.');

      const putRes = await fetch(signed.url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error(`S3 upload failed (${putRes.status}).`);

      // Fire-and-forget the resize confirmation.
      fetch('/api/seller/uploads/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: signed.key, contentType: file.type }),
      }).catch(() => {});

      setImages((prev) =>
        prev.map((i) =>
          i.id === id ? { id, status: 'done', preview, publicUrl: signed.publicUrl } : i,
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
    Array.from(files)
      .slice(0, room)
      .forEach((f) => void uploadOne(f));
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
    <Card title="Images">
      <p className="text-sm text-stone-500">
        Up to {MAX_IMAGES}. JPEG, PNG, WebP or AVIF. 5 MB max each. The first image is the cover.
      </p>

      {images.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((img) => (
            <li
              key={img.id}
              className="group relative aspect-square overflow-hidden rounded-2xl border border-stone-200 bg-stone-100"
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
                aria-label="Remove"
                className="absolute right-1.5 top-1.5 rounded-full bg-white/90 p-1 text-stone-700 shadow opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X size={12} strokeWidth={2} />
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
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={images.length >= MAX_IMAGES}
          className="rounded-full border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-900 hover:border-stone-500 disabled:opacity-50"
        >
          {images.length === 0 ? 'Choose images' : '+ Add more'}
        </button>
      </div>
    </Card>
  );
}
