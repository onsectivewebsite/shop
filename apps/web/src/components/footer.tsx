import Link from 'next/link';
import { useTranslations } from 'next-intl';

export function Footer() {
  const t = useTranslations('footer');

  return (
    <footer className="mt-24 border-t border-slate-200 bg-slate-50">
      <div className="container-page py-12">
        <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
          <FooterColumn title="About">
            <FooterLink href="/about">{t('about')}</FooterLink>
            <FooterLink href="/careers">{t('careers')}</FooterLink>
            <FooterLink href="/press">{t('press')}</FooterLink>
          </FooterColumn>

          <FooterColumn title="Customer service">
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

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-6 text-sm text-slate-500 md:flex-row">
          <p>{t('copyright')}</p>
          <div className="flex items-center gap-4">
            <span>🌐 English</span>
            <span>USD</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <ul className="mt-4 space-y-2 text-sm text-slate-600">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="hover:text-brand-700">
        {children}
      </Link>
    </li>
  );
}
