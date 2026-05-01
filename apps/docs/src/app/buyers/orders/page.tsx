export const metadata = { title: 'Orders + returns' };

export default function BuyerOrdersPage() {
  return (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-500">
        Buyers
      </p>
      <h1>Orders, returns, refunds</h1>
      <p>The shape of every order, from placement to settlement.</p>

      <h2 id="lifecycle">Order lifecycle</h2>
      <ol>
        <li><code>CREATED</code> — cart converted, awaiting payment.</li>
        <li><code>PAID</code> — Stripe captured the payment intent.</li>
        <li><code>CONFIRMED</code> — sellers notified.</li>
        <li><code>SHIPPED</code> — every item picked up by the carrier.</li>
        <li><code>DELIVERED</code> — every item marked delivered.</li>
        <li><code>COMPLETED</code> — return window closed, payouts release.</li>
      </ol>
      <p>
        Multi-seller orders move through{' '}
        <code>PARTIALLY_SHIPPED</code> /{' '}
        <code>PARTIALLY_DELIVERED</code> as each seller's items advance
        independently.
      </p>

      <h2 id="returns">Returns</h2>
      <p>
        See the full <a href="https://itsnottechy.cloud/legal/returns">return
        policy</a> for the legal framing. The short version:
      </p>
      <ul>
        <li>30-day window from delivery.</li>
        <li>Open from <a href="https://itsnottechy.cloud/account/orders">Account → Orders</a> next to the line item.</li>
        <li>If the return is our fault (damage, wrong item), we cover shipping both ways.</li>
        <li>Refunds settle within 5 business days of the seller marking the parcel received.</li>
      </ul>

      <h2 id="refunds">Refund flow</h2>
      <p>
        Money always returns to the original payment method via Stripe — we
        don't issue refunds in cash or on a different card. The{' '}
        <a href="https://itsnottechy.cloud/legal/refunds">refund policy</a>{' '}
        covers partial refunds, restocking caps (15% max), and what happens
        when your card is closed before the refund posts.
      </p>

      <h2 id="track">Tracking</h2>
      <p>
        Every shipment gets a tracking number generated through EasyPost. Use{' '}
        <a href="https://itsnottechy.cloud/track">/track</a> with your order
        number + email for guest tracking, or your account orders page for
        the full timeline.
      </p>
    </>
  );
}
