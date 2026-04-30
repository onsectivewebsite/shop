import { LegalShell, LegalSection } from '@/components/legal/legal-shell';

export const metadata = { title: 'Terms of Service' };

const SECTIONS = [
  { id: 'agreement', title: 'Agreement' },
  { id: 'eligibility', title: 'Eligibility' },
  { id: 'account', title: 'Your account' },
  { id: 'role', title: 'Onsective is a marketplace' },
  { id: 'orders', title: 'Orders, returns, refunds' },
  { id: 'prohibited', title: 'Prohibited use' },
  { id: 'ip', title: 'Intellectual property' },
  { id: 'disclaimers', title: 'Disclaimers' },
  { id: 'liability', title: 'Limitation of liability' },
  { id: 'disputes', title: 'Disputes + governing law' },
  { id: 'changes', title: 'Changes' },
  { id: 'contact', title: 'Contact' },
];

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" lastUpdated="30 April 2026" sections={SECTIONS}>
      <LegalSection id="agreement" title="Agreement">
        <p>
          These Terms govern your use of Onsective. By creating an account or placing
          an order, you accept them. If you don't accept them, don't use the site.
        </p>
      </LegalSection>

      <LegalSection id="eligibility" title="Eligibility">
        <p>
          You must be at least 18 (or the age of majority where you live) and capable
          of entering into a binding contract. Don't use Onsective if you're on a
          sanctions list, or located in a country we can't lawfully serve.
        </p>
      </LegalSection>

      <LegalSection id="account" title="Your account">
        <p>
          Keep your password and recovery codes private. You're responsible for
          activity under your account. Tell us right away at{' '}
          <a className="font-medium text-slate-900 underline-offset-2 hover:underline" href="mailto:security@onsective.com">
            security@onsective.com
          </a>{' '}
          if something looks wrong.
        </p>
      </LegalSection>

      <LegalSection id="role" title="Onsective is a marketplace">
        <p>
          Onsective is a marketplace, not the merchant of record (except where local
          law deems us a marketplace facilitator for tax purposes). The contract of
          sale for any item is between you and the seller. We facilitate listings,
          payment, payout, shipping, returns, and dispute resolution; we don't take
          title to inventory.
        </p>
      </LegalSection>

      <LegalSection id="orders" title="Orders, returns, refunds">
        <p>
          When you place an order, you offer to buy the listed items at the listed
          price. The order is accepted when the seller confirms it, and a contract
          forms at that moment. Returns follow the seller's posted return policy plus
          our marketplace minimum — see{' '}
          <a className="font-medium text-slate-900 underline-offset-2 hover:underline" href="/legal/returns">
            Returns
          </a>{' '}
          for the floor.
        </p>
        <p>
          If we cancel an order for stock, fraud, or compliance reasons, we'll fully
          refund the original payment method.
        </p>
      </LegalSection>

      <LegalSection id="prohibited" title="Prohibited use">
        <ul className="list-disc space-y-1 pl-6">
          <li>Resale of items in violation of the seller's terms.</li>
          <li>Fraud, payment fraud, or chargebacks made in bad faith.</li>
          <li>Scraping, automated bulk querying, or interfering with the site.</li>
          <li>Posting unlawful, infringing, or misleading content (reviews, Q&amp;A).</li>
          <li>Circumventing any platform safety or fee mechanism.</li>
        </ul>
      </LegalSection>

      <LegalSection id="ip" title="Intellectual property">
        <p>
          Onsective and its logo are trademarks of Onsective. Product listings,
          images, and descriptions belong to the seller who posted them. Reviews and
          Q&amp;A you post grant us a non-exclusive licence to display them on the
          marketplace.
        </p>
      </LegalSection>

      <LegalSection id="disclaimers" title="Disclaimers">
        <p>
          The site is provided &ldquo;as is&rdquo;. To the maximum extent permitted by
          law, Onsective disclaims all implied warranties for the marketplace itself.
          Statutory consumer rights against the seller are not affected.
        </p>
      </LegalSection>

      <LegalSection id="liability" title="Limitation of liability">
        <p>
          Where the law allows it to be limited, our aggregate liability under these
          Terms is capped at the greater of (a) the amounts you paid to Onsective in
          the 12 months before the event giving rise to the claim and (b) USD 100.
          We are not liable for indirect, incidental, or consequential losses. Nothing
          here limits liability that cannot be limited by law (fraud, gross
          negligence, death, personal injury).
        </p>
      </LegalSection>

      <LegalSection id="disputes" title="Disputes + governing law">
        <p>
          We'll try to resolve disputes informally first — email{' '}
          <a className="font-medium text-slate-900 underline-offset-2 hover:underline" href="mailto:legal@onsective.com">
            legal@onsective.com
          </a>
          . Where binding law does not require otherwise, these Terms are governed by
          the laws of the State of Delaware, USA, with jurisdiction in the state and
          federal courts located in New Castle County. Buyers in the EU, UK, and
          India retain the right to bring claims in their home jurisdiction under
          mandatory consumer protection law.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="Changes">
        <p>
          We may update these Terms. Material changes will be communicated by email
          to registered users at least 14 days before they take effect. Continued use
          after the effective date means you accept the new Terms.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="Contact">
        <p>
          Email{' '}
          <a className="font-medium text-slate-900 underline-offset-2 hover:underline" href="mailto:legal@onsective.com">
            legal@onsective.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalShell>
  );
}
