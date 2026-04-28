'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Label, Card, CardContent } from '@onsective/ui';
import { trpc } from '@/lib/trpc';

export function AddressForm() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: addresses, isLoading } = trpc.me.addresses.list.useQuery();

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    recipient: '',
    phone: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
    countryCode: 'US',
  });
  const [selected, setSelected] = useState<string | null>(null);

  const create = trpc.me.addresses.create.useMutation({
    onSuccess: (a) => {
      utils.me.addresses.list.invalidate();
      setAdding(false);
      setSelected(a.id);
    },
  });

  if (isLoading) return <p className="text-slate-500">Loading addresses…</p>;

  return (
    <div className="space-y-4">
      {addresses && addresses.length > 0 && (
        <ul className="space-y-3">
          {addresses.map((a) => (
            <li key={a.id}>
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 ${
                  selected === a.id
                    ? 'border-brand-600 ring-2 ring-brand-500/20'
                    : 'border-slate-200'
                }`}
              >
                <input
                  type="radio"
                  name="addr"
                  value={a.id}
                  checked={selected === a.id}
                  onChange={() => setSelected(a.id)}
                  className="mt-1"
                />
                <div className="text-sm">
                  <p className="font-medium">{a.recipient}</p>
                  <p className="text-slate-600">
                    {a.line1}
                    {a.line2 && `, ${a.line2}`}
                  </p>
                  <p className="text-slate-600">
                    {a.city}, {a.state} {a.postalCode}, {a.countryCode}
                  </p>
                  <p className="text-slate-500">{a.phone}</p>
                </div>
              </label>
            </li>
          ))}
        </ul>
      )}

      {!adding ? (
        <Button variant="outline" onClick={() => setAdding(true)}>
          + Add new address
        </Button>
      ) : (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(
                [
                  ['recipient', 'Full name'],
                  ['phone', 'Phone'],
                  ['line1', 'Address line 1'],
                  ['line2', 'Address line 2 (optional)'],
                  ['city', 'City'],
                  ['state', 'State / Province'],
                  ['postalCode', 'Postal code'],
                ] as const
              ).map(([k, label]) => (
                <div key={k} className={k === 'line1' || k === 'line2' ? 'sm:col-span-2' : ''}>
                  <Label htmlFor={k}>{label}</Label>
                  <Input
                    id={k}
                    value={form[k]}
                    onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                  />
                </div>
              ))}
              <div>
                <Label htmlFor="countryCode">Country</Label>
                <select
                  id="countryCode"
                  value={form.countryCode}
                  onChange={(e) => setForm({ ...form, countryCode: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                >
                  <option value="US">United States</option>
                  <option value="IN">India</option>
                  <option value="GB">United Kingdom</option>
                  <option value="CA">Canada</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={() => create.mutate({ ...form, type: 'SHIPPING', isDefault: true })}>
                Save address
              </Button>
              <Button variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Button
        variant="cta"
        size="lg"
        disabled={!selected}
        onClick={() => {
          if (selected) {
            sessionStorage.setItem('checkout.shippingAddressId', selected);
            router.push('/checkout/shipping');
          }
        }}
      >
        Continue to shipping →
      </Button>
    </div>
  );
}
