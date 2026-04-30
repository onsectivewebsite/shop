import Link from 'next/link';
import { type ReactNode } from 'react';

export type LegalSection = {
  id: string;
  title: string;
};

/**
 * Shared chrome for the /legal/* pages. Renders a max-w-3xl prose-style
 * column with a sticky table of contents on the right at md+ breakpoints.
 *
 * The page passes its own headings as `sections` so the TOC stays in sync
 * with whatever the body actually renders. Heading anchors must use the
 * matching `id` attribute on the page so #anchor scrolls work.
 */
export function LegalShell({
  title,
  lastUpdated,
  sections,
  children,
}: {
  title: string;
  lastUpdated: string;
  sections: LegalSection[];
  children: ReactNode;
}) {
  return (
    <div className="container-page py-12 md:py-20">
      <div className="mx-auto grid max-w-5xl gap-12 md:grid-cols-[minmax(0,1fr)_220px]">
        <article className="max-w-3xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-slate-500">
            Legal
          </p>
          <h1 className="mt-4 font-display text-4xl font-normal tracking-tight text-slate-950 md:text-5xl">
            {title}
          </h1>
          <p className="mt-4 text-sm text-slate-500">Last updated {lastUpdated}</p>

          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <strong>Draft.</strong> This page is published for transparency while
            we finalize legal review. Where this text conflicts with applicable law
            or our actual practice, the law and our practice control. Questions:{' '}
            <a
              href="mailto:legal@onsective.com"
              className="font-medium underline-offset-2 hover:underline"
            >
              legal@onsective.com
            </a>
            .
          </div>

          <div className="legal-prose mt-10 space-y-8">{children}</div>
        </article>

        <aside className="hidden md:block">
          <nav
            aria-label="On this page"
            className="sticky top-24 space-y-3 border-l border-slate-200 pl-4 text-sm"
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-500">
              On this page
            </p>
            <ul className="space-y-2">
              {sections.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`#${s.id}`}
                    className="text-slate-600 transition-colors hover:text-slate-950"
                  >
                    {s.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      </div>
    </div>
  );
}

/** Convenience wrappers so individual pages stay declarative. */
export function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 space-y-3">
      <h2 className="font-display text-2xl font-normal tracking-tight text-slate-950">
        {title}
      </h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-slate-700">
        {children}
      </div>
    </section>
  );
}
