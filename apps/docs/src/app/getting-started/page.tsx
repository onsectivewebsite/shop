export const metadata = { title: 'Quickstart' };

export default function QuickstartPage() {
  return (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-500">
        Getting started
      </p>
      <h1>Quickstart</h1>
      <p>From zero to your first order in five minutes.</p>

      <h2 id="signup">1. Create an account</h2>
      <p>
        Visit{' '}
        <a href="https://itsnottechy.cloud/signup">itsnottechy.cloud/signup</a>,
        enter your email and a password (10+ characters), and verify the email
        we send. You'll be signed in immediately after the verification code
        is accepted.
      </p>
      <p>
        Want a passwordless sign-in instead? Use the{' '}
        <em>Get a sign-in code by email</em> link on the login page. We'll
        send a one-time code; entering it signs you in without a password on
        record.
      </p>

      <h2 id="browse">2. Browse the marketplace</h2>
      <p>
        Start at the homepage, drill into a category, or search for a brand.
        Every product page shows the seller's rating, free shipping signals,
        verified-purchase reviews, and a buy box that respects your shipping
        country.
      </p>

      <h2 id="checkout">3. Place an order</h2>
      <ol>
        <li>Add an item to cart from the buy box.</li>
        <li>Open the cart, hit <strong>Checkout</strong>.</li>
        <li>Pick a shipping address (or add one) and a payment method.</li>
        <li>
          Stripe collects the card. The order is captured the moment the
          payment intent succeeds — sellers see it in their dashboard
          immediately.
        </li>
      </ol>

      <h2 id="track">4. Follow the order</h2>
      <p>
        Open <a href="https://itsnottechy.cloud/account/orders">Account → Orders</a>{' '}
        for shipment tracking, return requests, and re-order shortcuts. The{' '}
        <a href="https://itsnottechy.cloud/track">/track</a> page lets anyone
        with an order number + email check status without signing in.
      </p>

      <h2 id="security">Account safety</h2>
      <p>
        Two-factor sign-in (email OTP, optionally SMS) is on by default for
        every password login. Generate{' '}
        <a href="https://itsnottechy.cloud/account/security">recovery codes</a>{' '}
        the first day — they're the lifeboat if you lose access to your
        email.
      </p>
    </>
  );
}
