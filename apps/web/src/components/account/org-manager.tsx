'use client';

import { useState } from 'react';
import { Button, Card, CardContent, Input, Label } from '@onsective/ui';
import { trpc } from '@/lib/trpc';

export function OrgManager() {
  const utils = trpc.useUtils();
  const list = trpc.organizations.my.useQuery();
  const create = trpc.organizations.create.useMutation({
    onSuccess: () => {
      utils.organizations.my.invalidate();
      setLegalName('');
      setTaxId('');
    },
    onError: (e) => setError(e.message),
  });

  const [legalName, setLegalName] = useState('');
  const [country, setCountry] = useState('US');
  const [taxId, setTaxId] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">Create an organization</h2>
          <p className="text-sm text-slate-500">
            Buy on behalf of your team or company. Owners can invite members and add tax-exempt
            certificates.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="org-name">Legal name</Label>
              <Input
                id="org-name"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="Acme Corp"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-country">Country</Label>
              <select
                id="org-country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="US">United States</option>
                <option value="IN">India</option>
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="org-tax">Tax ID (optional)</Label>
              <Input
                id="org-tax"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                placeholder="EIN / GSTIN / VAT"
              />
            </div>
          </div>
          <Button
            variant="cta"
            onClick={() => {
              setError(null);
              create.mutate({ legalName, countryCode: country, taxId: taxId || undefined });
            }}
            disabled={create.isLoading || legalName.trim().length < 2}
          >
            {create.isLoading ? 'Creating…' : 'Create organization'}
          </Button>
          {error && <p className="text-sm text-error-600">{error}</p>}
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-semibold text-slate-900">Your organizations</h2>
        {list.isLoading && <p className="mt-2 text-sm text-slate-500">Loading…</p>}
        {list.data && list.data.length === 0 && (
          <p className="mt-2 text-sm text-slate-500">You&apos;re not in any organization yet.</p>
        )}
        {list.data && list.data.length > 0 && (
          <ul className="mt-3 divide-y rounded-lg border border-slate-200 bg-white">
            {list.data.map((m) => (
              <li key={m.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-slate-900">{m.organization.legalName}</p>
                  <p className="text-xs text-slate-500">
                    {m.role} · {m.organization.countryCode} ·{' '}
                    {m.organization.paymentTerms === 'NET_30' ? 'Net-30' : 'Charge on order'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
