import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSellerSession } from '@/server/auth';
import { prisma } from '@/server/db';
import { SignupForm } from './signup-form';
import { SellerShell } from '@/components/seller-shell';

export const metadata = { title: 'Apply to sell' };

export default async function SellerSignupPage() {
  const session = await getSellerSession();
  if (session) {
    const seller = await prisma.seller.findUnique({ where: { userId: session.user.id } });
    redirect(seller ? '/dashboard' : '/apply');
  }

  return (
    <SellerShell>
      <div className="container-page py-16 md:py-24">
        <div className="mx-auto w-full max-w-[480px] rounded-3xl border border-stone-200 bg-white p-8 sm:p-10">
          <h1 className="font-display text-3xl font-medium tracking-tight text-stone-950">
            Apply to sell on Onsective.
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            Create your account first. We&rsquo;ll ask about your business in the next step.
          </p>
          <div className="mt-8">
            <SignupForm />
          </div>
          <p className="mt-6 text-center text-sm text-stone-600">
            Already a seller?{' '}
            <Link href="/login" className="font-medium text-stone-900 underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </SellerShell>
  );
}
