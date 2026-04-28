import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Globe, Instagram, Twitter, Github } from 'lucide-react';

export function Footer() {
  const t = useTranslations('footer');

  return (
    <footer className="mt-32 bg-slate-950 text-slate-300">
      <div className="container-page py-20">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-4">
            <Link
              href="/"
              className="flex items-baseline gap-1 text-2xl font-semibold tracking-tight text-white"
            >
              <span>Onsective</span>
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-slate-400">
              A curated worldwide marketplace. Trusted sellers, fast delivery, and the
              best of the world — all in one place.
            </p>
            <div className="mt-8 flex items-center gap-2">
              <SocialLink href="https://instagram.com" label="Instagram">
                <Instagram size={16} />
              </SocialLink>
              <SocialLink href="https://twitter.com" label="Twitter">
                <Twitter size={16} />
              </SocialLink>
              <SocialLink href="https://github.com" label="GitHub">
                <Github size={16} />
              </SocialLink>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-4 md:col-span-8">
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
              <FooterLink href="/sell">{t('becomeSeller')}</FooterLink>
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

        <div className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-8 text-sm text-slate-500 md:flex-row md:items-center">
          <p>{t('copyright')}</p>
          <div className="flex items-center gap-5">
            <button className="inline-flex items-center gap-2 transition-colors hover:text-white">
              <Globe size={14} /> English
            </button>
            <span className="text-slate-600">·</span>
            <button className="transition-colors hover:text-white">USD $</button>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-white">
        {title}
      </h3>
      <ul className="mt-5 space-y-3 text-sm text-slate-400">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="transition-colors hover:text-white"
      >
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
      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
    >
      {children}
    </a>
  );
}
