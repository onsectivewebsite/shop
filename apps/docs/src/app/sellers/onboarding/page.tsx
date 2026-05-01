export const metadata = { title: 'Seller onboarding' };

export default function SellerOnboardingPage() {
  return (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-500">
        Sellers
      </p>
      <h1>Open a storefront</h1>
      <p>
        Six steps from application to your first payout. Onsective ops review
        each new seller manually — expect approval inside one business day for
        most regions.
      </p>

      <h2 id="apply">1. Apply</h2>
      <p>
        Start at <a href="https://seller.itsnottechy.cloud/apply">seller.itsnottechy.cloud/apply</a>.
        You'll need:
      </p>
      <ul>
        <li>A legal business name and tax ID (EIN, GSTIN, VAT — depending on your country).</li>
        <li>A working email address (used for order alerts and payout notifications).</li>
        <li>
          A storefront name and short description — this is what buyers see on
          every product page you list.
        </li>
      </ul>

      <h2 id="kyc">2. KYC documents</h2>
      <p>
        Once your application is in, the seller dashboard shows a checklist
        for KYC — typically a government-issued ID, proof of business
        registration, and a bank-account statement. Documents upload directly
        to a private S3 bucket; only KYC reviewers can see them, and access
        is audit-logged.
      </p>

      <h2 id="connect">3. Stripe Connect</h2>
      <p>
        After approval, connect a Stripe Express account from the dashboard's{' '}
        <em>Stripe payouts</em> tile. Stripe handles bank verification + ID;
        Onsective never sees full account numbers.
      </p>

      <h2 id="list">4. List your first product</h2>
      <p>
        The 5-step listing wizard covers basics, variants + pricing, images,
        shipping options, and a final review. Listings go live after a quick
        catalogue moderation pass — usually under an hour during business
        hours.
      </p>

      <h2 id="ship">5. Fulfil orders</h2>
      <p>
        New orders show up on the <code>/dashboard/orders</code> queue. Click{' '}
        <em>Ship</em>, pick a carrier, and Onsective generates the label via
        EasyPost. The buyer is notified the moment the carrier scans the
        parcel.
      </p>

      <h2 id="payout">6. Get paid</h2>
      <p>
        Earnings accrue per order item the moment payment is captured.
        Payouts settle to your Stripe Express account on <strong>T+7</strong>{' '}
        — once the return window closes for an item, its share moves from
        Pending to Available and lands on the next sweep.
      </p>
      <p>
        The <code>/dashboard/payouts</code> ledger shows everything: per-order
        contribution, in-flight transfers, and a complete settlement history.
      </p>
    </>
  );
}
