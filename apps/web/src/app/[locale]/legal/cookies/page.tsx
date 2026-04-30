import { LegalShell, LegalSection } from '@/components/legal/legal-shell';

export const metadata = { title: 'Cookie Policy' };

const SECTIONS = [
  { id: 'what', title: 'What cookies we use' },
  { id: 'choice', title: 'Your choice' },
  { id: 'change', title: 'Changing your mind' },
  { id: 'contact', title: 'Contact' },
];

export default function CookiesPage() {
  return (
    <LegalShell title="Cookie Policy" lastUpdated="30 April 2026" sections={SECTIONS}>
      <LegalSection id="what" title="What cookies we use">
        <p>
          A cookie is a small text file the site stores on your device. We split them
          into two categories:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong>Essential.</strong> Sign-in session, cart contents, locale
            preference, and the consent flag set by the banner. Without these the
            site can't function — you can't reject them.
          </li>
          <li>
            <strong>Optional.</strong> We currently set no optional cookies. If we
            ever add analytics or advertising cookies, we'll only set them after you
            click <em>Accept all</em> in the consent banner, and we'll list them
            here.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="choice" title="Your choice">
        <p>
          On your first visit we show a banner with two options:{' '}
          <em>Essential only</em> or <em>Accept all</em>. Either choice records a
          cookie called <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[13px]">cookie_consent</code>{' '}
          that lasts for one year. We won't show the banner again until that cookie
          expires or you clear it.
        </p>
      </LegalSection>

      <LegalSection id="change" title="Changing your mind">
        <p>
          To change your choice, clear the{' '}
          <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[13px]">cookie_consent</code>{' '}
          cookie in your browser. The banner will appear again on the next page load.
          Most browsers let you do this from <em>Settings → Privacy → Cookies</em>.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="Contact">
        <p>
          Questions about how we use cookies? Email{' '}
          <a className="font-medium text-slate-900 underline-offset-2 hover:underline" href="mailto:legal@onsective.com">
            legal@onsective.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalShell>
  );
}
