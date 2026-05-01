import Link from 'next/link';

export default function HomePage() {
  return (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-500">
        Welcome
      </p>
      <h1>Onsective documentation</h1>
      <p className="text-lg text-slate-600">
        Everything you need to buy, sell, or build on a worldwide marketplace.
      </p>

      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        <Card
          href="/getting-started"
          eyebrow="New here?"
          title="Quickstart"
          body="Sign up, browse the marketplace, and place your first order in under five minutes."
        />
        <Card
          href="/sellers/onboarding"
          eyebrow="For sellers"
          title="Open a storefront"
          body="From application to first payout: KYC, Stripe Connect, listings, fulfilment."
        />
        <Card
          href="/buyers/orders"
          eyebrow="For buyers"
          title="Orders, returns, refunds"
          body="What happens after checkout — tracking, returns, refunds, escalations."
        />
        <Card
          href="/developers/api"
          eyebrow="For developers"
          title="API overview"
          body="The shape of the REST + tRPC surface, auth, rate limits, webhooks."
        />
      </div>

      <h2 id="philosophy">How Onsective is built</h2>
      <p>
        Onsective runs as a small monorepo of three Next.js apps — buyer
        marketplace at <code>itsnottechy.cloud</code>, seller portal at{' '}
        <code>seller.itsnottechy.cloud</code>, and an internal operations
        console at <code>console.itsnottechy.cloud</code>. Shared schema lives
        in a Prisma package; shared auth lives in another. Every subdomain
        owns its own session cookie by design — there's no cross-subdomain
        sign-in surface to abuse.
      </p>
      <p>
        Money is always stored as integer minor units and an ISO currency
        code. Commissions are frozen at order-item creation, ledger entries
        balance (sum of debits = sum of credits), and every console action is
        audit-logged. Inputs cross trust boundaries through zod schemas —
        every webhook handler, every tRPC procedure.
      </p>

      <h2 id="status">Where things stand</h2>
      <p>
        Phases 0-10 of the roadmap are shipped end-to-end. The marketplace
        runs on Postgres + Redis + S3, with Stripe for payments + Connect
        payouts, Twilio for SMS 2FA, and EasyPost for shipping. Sentry,
        rate-limiting, suspicious-login detection, GDPR data export, account
        deletion, security headers (CSP / HSTS), and a Lighthouse-gated CI
        pipeline are all in place.
      </p>
    </>
  );
}

function Card({
  href,
  eyebrow,
  title,
  body,
}: {
  href: string;
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.04)]"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {eyebrow}
      </p>
      <p className="mt-3 font-display text-xl font-medium tracking-tight text-slate-950">
        {title}
      </p>
      <p className="mt-2 text-sm text-slate-600">{body}</p>
      <p className="mt-3 text-sm font-medium text-slate-900 group-hover:underline">
        Read →
      </p>
    </Link>
  );
}
