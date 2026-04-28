import { AddressForm } from '@/components/checkout/address-form';

export const metadata = { title: 'Checkout — Address' };

export default function CheckoutAddressPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900">Where should we ship?</h1>
      <p className="mt-1 text-sm text-slate-600">Pick an address or add a new one.</p>
      <div className="mt-6">
        <AddressForm />
      </div>
    </div>
  );
}
