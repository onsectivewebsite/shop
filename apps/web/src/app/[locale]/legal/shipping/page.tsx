import { LegalShell, LegalSection } from '@/components/legal/legal-shell';

export const metadata = { title: 'Shipping Policy' };

const SECTIONS = [
  { id: 'where', title: 'Where we ship' },
  { id: 'how-fast', title: 'How fast' },
  { id: 'cost', title: 'Shipping cost' },
  { id: 'tracking', title: 'Tracking' },
  { id: 'duties', title: 'Cross-border duties + taxes' },
  { id: 'lost', title: 'Lost or late parcels' },
  { id: 'contact', title: 'Contact' },
];

export default function ShippingPolicyPage() {
  return (
    <LegalShell title="Shipping Policy" lastUpdated="30 April 2026" sections={SECTIONS}>
      <LegalSection id="where" title="Where we ship">
        <p>
          Onsective is a worldwide marketplace; sellers list the countries they
          ship to on every product. The buybox blocks checkout for destinations a
          seller doesn't serve. Our launch markets are <strong>the United
          States, India, the United Kingdom, the EU, Canada, Australia, and Japan</strong>.
        </p>
      </LegalSection>

      <LegalSection id="how-fast" title="How fast">
        <p>
          Sellers commit to a dispatch SLA — typically 1-2 business days — which
          shows on each listing. Carrier transit times are layered on top:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li><strong>Domestic standard:</strong> 3-5 business days.</li>
          <li><strong>Domestic express:</strong> 1-2 business days where the seller offers it.</li>
          <li><strong>International standard:</strong> 7-14 business days, customs depending.</li>
          <li><strong>International express:</strong> 3-7 business days where offered.</li>
        </ul>
      </LegalSection>

      <LegalSection id="cost" title="Shipping cost">
        <p>
          Shipping is calculated at checkout based on weight, dimensions, the
          destination, and the speed you pick. The amount you see at checkout is
          what you pay — no surprise add-ons. Some sellers absorb the cost on
          orders above a threshold, which is shown on the listing.
        </p>
      </LegalSection>

      <LegalSection id="tracking" title="Tracking">
        <p>
          Every shipment gets a tracking number generated through EasyPost. Once
          the seller hands the parcel to the carrier you'll get an email with
          the link, and the same link is on{' '}
          <a className="font-medium text-slate-900 underline-offset-2 hover:underline" href="/account/orders">
            Account → Orders
          </a>{' '}
          and on{' '}
          <a className="font-medium text-slate-900 underline-offset-2 hover:underline" href="/track">
            /track
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection id="duties" title="Cross-border duties + taxes">
        <p>
          For international orders we calculate import duties and destination
          taxes at checkout where the law allows (Delivered Duty Paid). The total
          you see is the total you pay — the carrier won't ask for extra fees on
          delivery. A small set of countries don't yet support DDP collection;
          those listings carry a <em>Duties payable on delivery</em> note and the
          carrier will collect at the door.
        </p>
      </LegalSection>

      <LegalSection id="lost" title="Lost or late parcels">
        <p>
          If a parcel is more than 7 business days past the carrier's estimated
          delivery, open a support ticket from your order page. We'll file a
          carrier claim, and either resend or refund — your call. Lost parcels
          are covered by insurance up to the order total.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="Contact">
        <p>
          Shipping issue?{' '}
          <a className="font-medium text-slate-900 underline-offset-2 hover:underline" href="mailto:help@onsective.com">
            help@onsective.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalShell>
  );
}
