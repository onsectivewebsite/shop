import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container-page py-16">
      <div className="mx-auto max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="text-2xl font-bold text-brand-700">
            Onsective
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
