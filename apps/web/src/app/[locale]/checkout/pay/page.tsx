import { PayForm } from '@/components/checkout/pay-form';

export const metadata = { title: 'Checkout — Pay' };

export default function CheckoutPayPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-slate-900">Review and pay</h1>
      <p className="mt-1 text-sm text-slate-600">
        Card data goes directly to Stripe; we never touch it.
      </p>
      <div className="mt-6">
        <PayForm />
      </div>
    </div>
  );
}
