import { LegalShell, LegalSection } from '@/components/legal/legal-shell';

export const metadata = { title: 'Privacy Policy' };

const SECTIONS = [
  { id: 'who', title: 'Who we are' },
  { id: 'data', title: 'Data we collect' },
  { id: 'use', title: 'How we use it' },
  { id: 'share', title: 'Who we share with' },
  { id: 'retention', title: 'How long we keep it' },
  { id: 'rights', title: 'Your rights' },
  { id: 'security', title: 'Security' },
  { id: 'children', title: 'Children' },
  { id: 'changes', title: 'Changes to this policy' },
  { id: 'contact', title: 'Contact' },
];

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" lastUpdated="30 April 2026" sections={SECTIONS}>
      <LegalSection id="who" title="Who we are">
        <p>
          Onsective operates a worldwide marketplace connecting buyers with
          independent sellers. The data controller for the personal data described
          here is Onsective, contactable at{' '}
          <a className="font-medium text-slate-900 underline-offset-2 hover:underline" href="mailto:legal@onsective.com">
            legal@onsective.com
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection id="data" title="Data we collect">
        <p>We collect only the data we need to operate the marketplace:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong>Account.</strong> Email, full name, password hash, country, locale,
            preferred language, and the roles you hold (buyer, seller, etc).
          </li>
          <li>
            <strong>Authentication.</strong> One-time codes (hashed, short-lived),
            recovery codes (hashed only), passkey public keys + device hints, the IP
            and user-agent of your last sign-in for new-device detection.
          </li>
          <li>
            <strong>Phone.</strong> Optional. Only collected if you enable SMS
            two-factor sign-in.
          </li>
          <li>
            <strong>Addresses.</strong> Names, phone numbers, and postal addresses you
            save for shipping and billing.
          </li>
          <li>
            <strong>Orders, returns, reviews.</strong> What you bought, when, from
            whom, and how it ended. Delivery status, tracking metadata, refunds.
          </li>
          <li>
            <strong>Payments.</strong> We do not store full card numbers. Stripe
            processes payment data on our behalf and returns a token + last-four +
            brand we keep for receipts and refund routing.
          </li>
          <li>
            <strong>Browsing context.</strong> Pages visited, search queries, items
            added to cart or wishlist. We use this to render the site and to detect
            abuse.
          </li>
          <li>
            <strong>Cookies.</strong> Essential cookies for sign-in and cart. Optional
            cookies only when you accept them. See the{' '}
            <a className="font-medium text-slate-900 underline-offset-2 hover:underline" href="/legal/cookies">
              cookie policy
            </a>
            .
          </li>
          <li>
            <strong>Audit and abuse signals.</strong> IP, user-agent, request id, and
            failed-login counters. Used for fraud, account-takeover defence, and
            customer-support triage.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="use" title="How we use it">
        <ul className="list-disc space-y-1 pl-6">
          <li>To run the marketplace: process orders, take payment, ship, handle returns and refunds.</li>
          <li>To keep accounts safe: rate-limit, lock-out abusive sign-ins, surface new-device alerts.</li>
          <li>To meet legal duties: tax reporting, sanctions screening, sub-poena response.</li>
          <li>To improve the site: aggregate, de-identified analytics; product search ranking; bug detection.</li>
          <li>To talk to you: order updates, security alerts, and (only if you opt in) marketing messages.</li>
        </ul>
        <p>
          We do not sell personal data. We do not use your data to train third-party
          machine-learning models.
        </p>
      </LegalSection>

      <LegalSection id="share" title="Who we share with">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong>Sellers.</strong> When you place an order, the relevant seller
            sees your name, ship-to address, the items you ordered, and any return or
            replacement requests. They do not see your email, phone number, payment
            details, or other orders.
          </li>
          <li>
            <strong>Stripe</strong> (payments) and <strong>Stripe Connect</strong>{' '}
            (seller payouts).
          </li>
          <li>
            <strong>EasyPost</strong> for shipping label generation and tracking.
          </li>
          <li>
            <strong>Twilio</strong> for SMS sign-in codes if you enable that
            channel.
          </li>
          <li>
            <strong>Hostinger / SMTP provider</strong> for transactional email.
          </li>
          <li>
            <strong>AWS S3</strong> for product images, KYC documents, and your data
            exports — all in private buckets with server-side encryption.
          </li>
          <li>Law-enforcement bodies, when required by valid legal process.</li>
        </ul>
      </LegalSection>

      <LegalSection id="retention" title="How long we keep it">
        <p>
          Live account data is retained for as long as your account is active. When
          you delete your account we scrub your profile, addresses, payment metadata,
          recovery codes, passkeys, and saved items. Order, return, refund, and tax
          records are retained for the period required by applicable tax and consumer-
          protection law (typically 7 years in the United States and India), but no
          longer carry your name or other identifying personal data.
        </p>
      </LegalSection>

      <LegalSection id="rights" title="Your rights">
        <p>
          Depending on where you live, you have rights under laws like the GDPR, the
          UK GDPR, the CCPA, and India's DPDP Act. Onsective honours all of the
          following for every user:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong>Access + portability.</strong> Request a JSON copy of your data
            from{' '}
            <a className="font-medium text-slate-900 underline-offset-2 hover:underline" href="/account/security">
              Account → Security
            </a>
            .
          </li>
          <li>
            <strong>Correction.</strong> Edit your profile, addresses, and contact
            info from your account.
          </li>
          <li>
            <strong>Deletion.</strong> Delete your account from{' '}
            <a className="font-medium text-slate-900 underline-offset-2 hover:underline" href="/account/security">
              Account → Security
            </a>
            . Tax-mandated order records are retained without your name attached.
          </li>
          <li>
            <strong>Objection + restriction.</strong> Email{' '}
            <a className="font-medium text-slate-900 underline-offset-2 hover:underline" href="mailto:legal@onsective.com">
              legal@onsective.com
            </a>{' '}
            and we'll act within 30 days.
          </li>
          <li>
            <strong>Complaint.</strong> If we get it wrong, you can complain to your
            local data protection authority. We'd appreciate the chance to fix it
            first.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="security" title="Security">
        <p>
          Passwords are hashed with Argon2id. Recovery codes are SHA-256 hashed. KYC
          documents and data exports are stored in private S3 buckets with server-side
          encryption (AES-256). The site is HTTPS-only. Stripe handles card data on
          PCI-compliant infrastructure — we never see the full PAN.
        </p>
      </LegalSection>

      <LegalSection id="children" title="Children">
        <p>
          Onsective is not directed at children under 13 (under 16 in the EEA).
          Accounts must be held by adults; if you believe a minor has registered,
          email{' '}
          <a className="font-medium text-slate-900 underline-offset-2 hover:underline" href="mailto:legal@onsective.com">
            legal@onsective.com
          </a>{' '}
          and we'll close it.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="Changes to this policy">
        <p>
          We'll update the &ldquo;Last updated&rdquo; date and, for material changes,
          email registered users at least 14 days before the new policy takes effect.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="Contact">
        <p>
          Email{' '}
          <a className="font-medium text-slate-900 underline-offset-2 hover:underline" href="mailto:legal@onsective.com">
            legal@onsective.com
          </a>{' '}
          for any privacy-related question or request.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
