import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Package,
  KeyRound,
  Building2,
  Heart,
  ShieldCheck,
  Star,
  Receipt,
  Sparkles,
  Gift,
  Bell,
  CreditCard,
  Repeat,
  MessageCircle,
  ArrowUpRight,
  type LucideIcon,
} from 'lucide-react';
import { getSession } from '@/server/auth/session';

export const metadata = { title: 'Account' };

export default async function AccountPage({ params }: { params: { locale: string } }) {
  const session = await getSession();
  if (!session) {
    redirect(`/${params.locale}/login`);
  }
  const user = session.user;

  return (
    <div className="container-page py-20 md:py-28">
      <div className="mx-auto max-w-3xl">
        <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-slate-500">
          Your account
        </p>
        <h1 className="mt-6 font-display text-5xl font-normal tracking-tight text-slate-950 md:text-6xl">
          Hello, {user.fullName?.split(' ')[0] ?? user.email.split('@')[0]}.
        </h1>
        <p className="mt-6 max-w-md text-sm text-slate-600">
          Signed in as <span className="font-medium text-slate-900">{user.email}</span>.
        </p>

        <div className="mt-16 grid gap-px bg-slate-200 sm:grid-cols-2">
          <AccountTile href="/account/orders" icon={Package} title="Orders" sub="Track shipments and view history" />
          <AccountTile href="/account/buy-again" icon={Repeat} title="Buy again" sub="Re-order anything you've bought before" />
          <AccountTile href="/account/messages" icon={MessageCircle} title="Messages" sub="Conversations with your sellers" />
          <AccountTile href="/account/passkeys" icon={KeyRound} title="Passkeys" sub="Faster sign-in with your device" />
          <AccountTile href="/account/security" icon={ShieldCheck} title="Security" sub="Recovery codes and account safety" />
          <AccountTile href="/account/reviews" icon={Star} title="Reviews" sub="Reviews you've left across the marketplace" />
          <AccountTile href="/account/organization" icon={Building2} title="Organization" sub="B2B accounts and team members" />
          <AccountTile href="/account/organization/invoices" icon={Receipt} title="Invoices" sub="NET-30 statements for your organisation" />
          <AccountTile href="/account/wishlist" icon={Heart} title="Wishlist" sub="Saved items you'll want again" />
          <AccountTile href="/account/prime" icon={Sparkles} title="Prime" sub="Membership perks and renewal" />
          <AccountTile href="/account/referrals" icon={Gift} title="Referrals" sub="Share Onsective and earn credit" />
          <AccountTile href="/account/notifications" icon={Bell} title="Notifications" sub="Email preferences and unsubscribes" />
          <AccountTile href="/account/payment-methods" icon={CreditCard} title="Payment methods" sub="Saved cards for faster checkout" />
        </div>
      </div>
    </div>
  );
}

function AccountTile({
  href,
  icon: Icon,
  title,
  sub,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start justify-between gap-6 bg-white p-8 transition-colors hover:bg-stone-50"
    >
      <div>
        <Icon size={22} strokeWidth={1.5} className="text-slate-400" />
        <p className="mt-6 font-display text-2xl font-normal tracking-tight text-slate-950">
          {title}
        </p>
        <p className="mt-2 text-sm text-slate-500">{sub}</p>
      </div>
      <ArrowUpRight
        size={18}
        strokeWidth={1.5}
        className="text-slate-300 transition-all group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-slate-900"
      />
    </Link>
  );
}
