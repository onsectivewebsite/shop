import { LegalShell, LegalSection } from '@/components/legal/legal-shell';

export const metadata = { title: 'Return Policy' };

const SECTIONS = [
  { id: 'window', title: 'Return window' },
  { id: 'eligibility', title: 'What you can return' },
  { id: 'condition', title: 'Condition of returned items' },
  { id: 'how', title: 'How to start a return' },
  { id: 'shipping', title: 'Return shipping' },
  { id: 'refunds', title: 'Refunds' },
  { id: 'replacements', title: 'Replacements' },
  { id: 'rejected', title: 'When a return is rejected' },
  { id: 'contact', title: 'Contact' },
];

export default function ReturnsPolicyPage() {
  return (
    <LegalShell title="Return Policy" lastUpdated="30 April 2026" sections={SECTIONS}>
      <LegalSection id="window" title="Return window">
        <p>
          You can request a return within <strong>30 days</strong> of delivery. The
          window starts the day the carrier marks the parcel delivered. Some
          categories — perishable goods, intimate apparel, downloadable software —
          have a shorter window or aren't returnable; the seller's listing notes any
          deviation from the marketplace default.
        </p>
      </LegalSection>

      <LegalSection id="eligibility" title="What you can return">
        <ul className="list-disc space-y-1 pl-6">
          <li>Items that arrived damaged.</li>
          <li>Items that don't match the listing (wrong colour, size, model).</li>
          <li>Items you no longer want — within the 30-day window.</li>
          <li>Items defective in normal use, even past the 30-day window if covered by manufacturer warranty (we'll route you to the seller).</li>
        </ul>
        <p>
          Items not eligible: hygiene products opened, personalised goods,
          digital licences once the activation key has been revealed, and gift
          cards.
        </p>
      </LegalSection>

      <LegalSection id="condition" title="Condition of returned items">
        <p>
          Items must come back in the condition we sent them: unused, in original
          packaging where it exists, with all included accessories. We'll deduct or
          refuse a refund if items arrive missing parts, with damage that wasn't on
          the package when it left the seller, or with signs of use beyond what's
          needed to inspect them.
        </p>
      </LegalSection>

      <LegalSection id="how" title="How to start a return">
        <ol className="list-decimal space-y-1 pl-6">
          <li>
            Open{' '}
            <a className="font-medium text-slate-900 underline-offset-2 hover:underline" href="/account/orders">
              Account → Orders
            </a>{' '}
            and pick the order.
          </li>
          <li>Click <em>Return</em> next to the item, choose a reason, and (optionally) attach a photo.</li>
          <li>You'll receive an RMA number plus return-shipping instructions.</li>
          <li>Drop the parcel at the carrier within 7 days of issuance.</li>
        </ol>
      </LegalSection>

      <LegalSection id="shipping" title="Return shipping">
        <p>
          When the return is our fault — wrong item, damaged on arrival, defect —
          Onsective covers shipping both ways via a prepaid label. When you change
          your mind, the cost of the return label is deducted from the refund.
        </p>
      </LegalSection>

      <LegalSection id="refunds" title="Refunds">
        <p>
          Refunds land back on the original payment method within 5 business days of
          the seller marking the parcel <em>received</em>. Banks typically post the
          credit within 1-3 days after that. We'll email you the moment Stripe
          settles the refund.
        </p>
      </LegalSection>

      <LegalSection id="replacements" title="Replacements">
        <p>
          For damaged or wrong items you can request a replacement instead of a
          refund. The seller dispatches a fresh unit at no charge once the original
          has been received.
        </p>
      </LegalSection>

      <LegalSection id="rejected" title="When a return is rejected">
        <p>
          We reject returns when the parcel arrives outside the policy (missing
          items, signs of misuse, past the window). You'll see the reason on the
          return's status page; if you disagree, reply through the same page and a
          support agent will review within 2 business days.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="Contact">
        <p>
          Stuck on a return?{' '}
          <a className="font-medium text-slate-900 underline-offset-2 hover:underline" href="mailto:help@onsective.com">
            help@onsective.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalShell>
  );
}
