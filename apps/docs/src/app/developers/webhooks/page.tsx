export const metadata = { title: 'Webhooks' };

export default function WebhooksPage() {
  return (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-500">
        Developers
      </p>
      <h1>Webhooks</h1>
      <p>
        Onsective consumes webhooks from Stripe (payments + Connect transfers
        + subscriptions), EasyPost (shipment events), and Twilio (SMS
        delivery status). External partners can subscribe to Onsective
        webhooks once a partner program lands — not yet exposed.
      </p>

      <h2 id="stripe">Stripe</h2>
      <p>
        Endpoint: <code>/api/webhooks/stripe</code> on the buyer app. Events
        we handle:
      </p>
      <ul>
        <li><code>payment_intent.succeeded</code> — captures payment, flips order to <code>PAID</code>, books ledger entries, awards referral on first order.</li>
        <li><code>payment_intent.payment_failed</code> — stamps the failure on the payment row.</li>
        <li><code>charge.dispute.created</code> — opens a dispute case for ops review.</li>
        <li><code>transfer.{`{created,updated,reversed}`}</code> — tracks payout-settlement state.</li>
        <li><code>payout.paid</code> — confirms a Stripe Express payout actually landed.</li>
        <li><code>customer.subscription.{`{created,updated,deleted}`}</code> — Onsective Prime lifecycle.</li>
        <li><code>invoice.payment_failed</code> — flips Prime to <code>PAYMENT_FAILED</code> on a renewal failure.</li>
      </ul>

      <h2 id="idempotency">Idempotency</h2>
      <p>
        Every handler is idempotent: a re-played event with the same
        <code>WebhookEvent.externalId</code> exits early. Side-effects either
        run inside an explicit transaction or use predicate-narrowed
        <code>updateMany</code> calls that are no-ops on a replay.
      </p>

      <h2 id="signature">Signature verification</h2>
      <p>
        Stripe signatures are checked against{' '}
        <code>STRIPE_WEBHOOK_SECRET</code> using their official SDK helper.
        Requests with a missing or invalid signature are rejected with
        a 400 before any handler runs.
      </p>

      <h2 id="retries">Retries</h2>
      <p>
        Failed handlers return 5xx so Stripe will retry per its standard
        backoff schedule. We rely on idempotency rather than de-duplication
        windows — handlers can be invoked any number of times safely.
      </p>
    </>
  );
}
