import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-[calc(100vh-5rem)] overflow-hidden bg-gradient-to-b from-slate-50 to-white">
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-br from-amber-200/30 via-rose-200/20 to-indigo-200/20 blur-3xl"
        aria-hidden
      />
      <div className="container-page relative py-16 sm:py-24">
        <div className="mx-auto w-full max-w-[420px]">
          <div className="mb-10 text-center">
            <Link
              href="/"
              className="inline-flex items-baseline gap-1 text-2xl font-semibold tracking-tight text-slate-900"
            >
              <span>Onsective</span>
              <span className="h-1.5 w-1.5 rounded-full bg-cta-500" aria-hidden />
            </Link>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] sm:p-10">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
