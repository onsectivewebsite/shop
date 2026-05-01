export const metadata = { title: 'Seller payouts' };

export default function PayoutsPage() {
  return (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-500">
        Sellers
      </p>
      <h1>Payouts</h1>
      <p>
        Onsective settles seller earnings via Stripe Connect Express. Money
        flows from the buyer's payment method through Stripe to Onsective,
        then through a Stripe Transfer to your connected account.
      </p>

      <h2 id="schedule">Schedule</h2>
      <ul>
        <li><strong>T+7 hold:</strong> earnings sit in <em>Pending</em> while the return window is open.</li>
        <li><strong>Sweep:</strong> a daily cron moves anything past T+7 into Available and queues a Transfer.</li>
        <li><strong>Stripe payout:</strong> Stripe pays you on your Express account's standard schedule (typically 2 business days after the Transfer).</li>
      </ul>

      <h2 id="commission">Commission</h2>
      <p>
        Commission is frozen at the moment an OrderItem is created in
        checkout — later changes to the platform commission rate don't apply
        retroactively. Your <code>/dashboard/payouts</code> page shows the
        net-of-commission number for every line.
      </p>

      <h2 id="returns">Returns and refunds</h2>
      <p>
        When a buyer return is approved and a refund flows out, the seller's
        share of the refund is debited from the next available payout. If
        Available isn't enough to cover it, Stripe debits the connected
        account directly.
      </p>

      <h2 id="multi-currency">Multi-currency</h2>
      <p>
        Earnings are tracked per currency — a USD order pays out USD; an INR
        order pays out INR. Your dashboard summary shows totals per currency.
        Stripe handles the FX if your bank account is denominated differently.
      </p>
    </>
  );
}
