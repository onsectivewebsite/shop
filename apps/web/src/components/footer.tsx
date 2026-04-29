import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Globe, Instagram, Twitter } from 'lucide-react';

export function Footer() {
  const t = useTranslations('footer');

  return (
    <footer className="border-t border-stone-200 bg-stone-50">
      <div className="container-page py-20">
        {/* Big wordmark */}
        <Link
          href="/"
          className="font-display text-7xl font-medium tracking-tighter text-stone-900 sm:text-8xl md:text-[160px] md:leading-[0.9]"
        >
          on<span className="italic text-emerald-700">sective</span>
          <span className="text-stone-400">.</span>
        </Link>

        <div className="mt-16 grid gap-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <p className="max-w-md text-sm leading-relaxed text-stone-600">
              A small, deliberate marketplace of objects, garments, and rituals
              from independent makers around the world.
            </p>
            <div className="mt-8 flex items-center gap-2">
              <SocialLink href="https://instagram.com" label="Instagram">
                <Instagram size={14} strokeWidth={1.5} />
              </SocialLink>
              <SocialLink href="https://twitter.com" label="Twitter">
                <Twitter size={14} strokeWidth={1.5} />
              </SocialLink>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-4 md:col-span-7">
            <FooterColumn title="Company">
              <FooterLink href="/about">{t('about')}</FooterLink>
              <FooterLink href="/careers">{t('careers')}</FooterLink>
              <FooterLink href="/press">{t('press')}</FooterLink>
            </FooterColumn>
            <FooterColumn title="Help">
              <FooterLink href="/help">{t('help')}</FooterLink>
              <FooterLink href="/track">{t('trackOrder')}</FooterLink>
              <FooterLink href="/returns">{t('returns')}</FooterLink>
              <FooterLink href="/contact">{t('contact')}</FooterLink>
            </FooterColumn>
            <FooterColumn title="Sell">
              <FooterLink href="https://seller.itsnottechy.cloud">{t('becomeSeller')}</FooterLink>
              <FooterLink href="/sell/policies">{t('sellerPolicies')}</FooterLink>
              <FooterLink href="/sell/pricing">{t('pricing')}</FooterLink>
            </FooterColumn>
            <FooterColumn title="Legal">
              <FooterLink href="/legal/privacy">{t('privacy')}</FooterLink>
              <FooterLink href="/legal/terms">{t('terms')}</FooterLink>
              <FooterLink href="/legal/cookies">{t('cookies')}</FooterLink>
            </FooterColumn>
          </div>
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-stone-200 pt-8 text-xs text-stone-500 md:flex-row md:items-center">
          <p>{t('copyright')} · Lisbon · Tokyo · Mumbai</p>
          <div className="flex items-center gap-5">
            <button className="inline-flex items-center gap-2 transition-colors hover:text-stone-900">
              <Globe size={12} /> English
            </button>
            <span className="text-stone-300">·</span>
            <button className="transition-colors hover:text-stone-900">USD $</button>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-900">
        {title}
      </h3>
      <ul className="mt-5 space-y-3 text-sm text-stone-600">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="transition-colors hover:text-stone-900">
        {children}
      </Link>
    </li>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      aria-label={label}
      target="_blank"
      rel="noreferrer noopener"
      className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-300 bg-white text-stone-700 transition-colors hover:border-stone-900 hover:bg-stone-900 hover:text-white"
    >
      {children}
    </a>
  );
}
