export const metadata = { title: 'API overview' };

export default function ApiOverviewPage() {
  return (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-500">
        Developers
      </p>
      <h1>API overview</h1>
      <p>
        Onsective exposes two surfaces — a REST seller API on
        <code>seller.itsnottechy.cloud</code> and an internal tRPC router used
        by the buyer marketplace. Public partner integrations live on the
        REST surface; the tRPC layer is end-to-end-typed and considered
        internal.
      </p>

      <h2 id="auth">Authentication</h2>
      <p>
        All requests authenticate with a session cookie issued by the host
        you're calling — there's no cross-subdomain session surface. Sign in
        via the standard email/password or passwordless flow, then call
        endpoints from the same origin. The session is httpOnly + Secure +
        SameSite=lax.
      </p>

      <h2 id="rest">REST (seller)</h2>
      <p>Seller-facing routes the dashboard uses internally:</p>
      <ul>
        <li><code>POST /api/seller/orders/[id]/ship</code> — mark an item shipped, return a label URL.</li>
        <li><code>POST /api/seller/uploads/confirm</code> — confirm an S3 presigned upload completed; queues image-variant generation.</li>
        <li><code>POST /api/seller/reviews/[id]/reply</code> — public reply on a buyer review.</li>
        <li><code>POST /api/seller/questions/[id]/answer</code> — public answer to a buyer Q&amp;A question.</li>
        <li><code>POST /api/seller/ads</code> + <code>PATCH /api/seller/ads/[id]/status</code> — sponsored campaign authoring.</li>
      </ul>

      <h2 id="trpc">tRPC (buyer)</h2>
      <p>
        Imported as a typed client in any internal Onsective code. Top-level
        routers (see <code>apps/web/src/server/routers/_app.ts</code>):
      </p>
      <ul>
        <li><code>auth</code> — signup, sign-in, 2FA, recovery codes, account deletion.</li>
        <li><code>me</code> — profile, addresses, notification preferences.</li>
        <li><code>catalog</code>, <code>cart</code>, <code>checkout</code> — buy flow.</li>
        <li><code>order</code> — historical orders, returns.</li>
        <li><code>reviews</code>, <code>qa</code> — UGC.</li>
        <li><code>prime</code>, <code>referrals</code> — membership + referral programs.</li>
        <li><code>organizations</code>, <code>organizations.invoices</code> — B2B accounts.</li>
        <li><code>ads</code> — impression + click tracking endpoints (public).</li>
      </ul>

      <h2 id="rate-limits">Rate limits</h2>
      <p>
        Auth-mutating tRPC procedures are rate-limited per IP via Redis
        token-bucket. Public catalog SSR pages share a 60/min/IP bucket. Add
        rate-limited middleware to any procedure that mutates user state
        with <code>.use(authRateLimit)</code> or <code>.use(userMutationRateLimit)</code>.
      </p>

      <h2 id="errors">Errors</h2>
      <p>
        REST routes return JSON <code>{`{ error: string }`}</code> with a 4xx
        status. tRPC raises <code>TRPCError</code>; the client surfaces
        <code>error.message</code>. Inputs are validated with zod at every
        boundary — you'll see <code>BAD_REQUEST</code> on a schema miss.
      </p>
    </>
  );
}
