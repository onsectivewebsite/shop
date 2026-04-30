import { Save } from 'lucide-react';

const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'IN', name: 'India' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'JP', name: 'Japan' },
  { code: 'SG', name: 'Singapore' },
];

type AddressDefaults = {
  type?: 'SHIPPING' | 'BILLING';
  label?: string | null;
  recipient?: string;
  phone?: string;
  line1?: string;
  line2?: string | null;
  city?: string;
  state?: string;
  postalCode?: string;
  countryCode?: string;
  isDefault?: boolean;
};

export function AddressForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  defaults?: AddressDefaults;
  submitLabel: string;
}) {
  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Recipient name">
          <input
            name="recipient"
            required
            defaultValue={defaults?.recipient ?? ''}
            className="mt-1 h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
          />
        </Field>
        <Field label="Phone">
          <input
            name="phone"
            required
            defaultValue={defaults?.phone ?? ''}
            placeholder="+1 555 0100"
            className="mt-1 h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type">
          <select
            name="type"
            defaultValue={defaults?.type ?? 'SHIPPING'}
            className="mt-1 h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
          >
            <option value="SHIPPING">Shipping</option>
            <option value="BILLING">Billing</option>
          </select>
        </Field>
        <Field label="Label (optional)">
          <input
            name="label"
            defaultValue={defaults?.label ?? ''}
            placeholder="Home, Office, …"
            className="mt-1 h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
          />
        </Field>
      </div>

      <Field label="Address line 1">
        <input
          name="line1"
          required
          defaultValue={defaults?.line1 ?? ''}
          className="mt-1 h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
        />
      </Field>
      <Field label="Address line 2 (optional)">
        <input
          name="line2"
          defaultValue={defaults?.line2 ?? ''}
          className="mt-1 h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="City">
          <input
            name="city"
            required
            defaultValue={defaults?.city ?? ''}
            className="mt-1 h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
          />
        </Field>
        <Field label="State / region">
          <input
            name="state"
            required
            defaultValue={defaults?.state ?? ''}
            className="mt-1 h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
          />
        </Field>
        <Field label="Postal code">
          <input
            name="postalCode"
            required
            defaultValue={defaults?.postalCode ?? ''}
            className="mt-1 h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
          />
        </Field>
      </div>

      <Field label="Country">
        <select
          name="countryCode"
          required
          defaultValue={defaults?.countryCode ?? 'US'}
          className="mt-1 h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <label className="flex items-center gap-2 text-sm text-stone-700">
        <input
          type="checkbox"
          name="isDefault"
          defaultChecked={defaults?.isDefault ?? false}
          className="rounded border-stone-300"
        />
        Set as default for its type
      </label>

      <button
        type="submit"
        className="inline-flex h-11 items-center gap-2 rounded-full bg-stone-900 px-6 text-sm font-semibold text-white transition-colors hover:bg-stone-800"
      >
        <Save size={14} strokeWidth={2} />
        {submitLabel}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-stone-700">{label}</span>
      {children}
    </label>
  );
}
