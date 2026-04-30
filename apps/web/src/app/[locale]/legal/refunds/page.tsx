import { LegalShell, LegalSection } from '@/components/legal/legal-shell';

export const metadata = { title: 'Refund Policy' };

const SECTIONS = [
  { id: 'when', title: 'When you get a refund' },
  { id: 'how-much', title: 'How much you get back' },
  { id: 'timing', title: 'Timing' },
  { id: 'method', title: 'Method of refund' },
  { id: 'partial', title: 'Partial refunds' },
  { id: 'cancellations', title: 'Cancellations' },
  { id: 'contact', title: 'Contact' },
];

export default function RefundsPolicyPage() {
  return (
    <LegalShell title="Refund Policy" lastUpdated="30 April 2026" sections={SECTIONS}>
      <LegalSection id="when" title="When you get a refund">
        <ul className="list-disc space-y-1 pl-6">
          <li>You returned the item within the policy and the seller marked it received.</li>
          <li>The order was cancelled before it shipped.</li>
          <li>The parcel was lost in transit and we couldn't recover it.</li>
          <li>You filed a chargeback Onsective ruled in your favour after review.</li>
        </ul>
        <p>
          See the{' '}
          <a className="font-medium text-slate-900 underline-offset-2 hover:underline" href="/legal/returns">
            return policy
          </a>{' '}
          for what's eligible and how to start a return.
        </p>
      </LegalSection>

      <LegalSection id="how-much" title="How much you get back">
        <p>
          For damaged, defective, or wrong-item returns: the full price of the
          item plus the original outbound shipping. For changed-mind returns: the
          full price minus the cost of the return label.
        </p>
        <p>
          Sellers may charge a <em>restocking fee</em> on changed-mind returns of
          high-value items; this is disclosed on the listing before purchase and
          is capped by Onsective at <strong>15%</strong> of the item price.
        </p>
      </LegalSection>

      <LegalSection id="timing" title="Timing">
        <p>
          We initiate the refund the moment the seller marks the parcel{' '}
          <em>received</em>. Stripe processes the refund within 5 business days —
          you'll see the credit on your statement 1-3 banking days after that,
          depending on your card network.
        </p>
      </LegalSection>

      <LegalSection id="method" title="Method of refund">
        <p>
          Refunds always go to the original payment method. Card payments come
          back to that card. UPI and bank-rail payments come back to the same
          account. We don't issue refunds in cash or on a different card.
        </p>
        <p>
          If the original method is no longer valid (a card was closed, the bank
          changed your IBAN), Stripe redirects the refund through your bank's
          standard reroute path. Contact us if it doesn't land within 14 business
          days.
        </p>
      </LegalSection>

      <LegalSection id="partial" title="Partial refunds">
        <p>
          Multi-item orders refund the per-item line plus the share of shipping
          and tax attributable to the returned items. The remaining items stay
          on the order and we'll send an updated invoice.
        </p>
      </LegalSection>

      <LegalSection id="cancellations" title="Cancellations">
        <p>
          You can cancel an order before it ships from{' '}
          <a className="font-medium text-slate-900 underline-offset-2 hover:underline" href="/account/orders">
            Account → Orders
          </a>
          . Cancellation refunds the full order, including shipping. Once the
          parcel is in the carrier's hands, the cancellation flow rolls into a
          return.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="Contact">
        <p>
          Refund stuck?{' '}
          <a className="font-medium text-slate-900 underline-offset-2 hover:underline" href="mailto:help@onsective.com">
            help@onsective.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalShell>
  );
}
