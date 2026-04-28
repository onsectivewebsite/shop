import { redirect } from 'next/navigation';
import { getSession } from '@/server/auth';
import { CheckoutStepper } from '@/components/checkout/stepper';

export default async function CheckoutLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="container-page py-8">
      <CheckoutStepper />
      {children}
    </div>
  );
}
