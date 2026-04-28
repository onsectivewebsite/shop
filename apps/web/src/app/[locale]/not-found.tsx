import Link from 'next/link';
import { Button } from '@onsective/ui';

export default function NotFound() {
  return (
    <div className="container-page py-24 text-center">
      <p className="text-sm font-semibold text-brand-600">404</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">Page not found</h1>
      <p className="mt-4 text-slate-600">
        Sorry, we couldn&apos;t find the page you were looking for.
      </p>
      <div className="mt-8">
        <Button asChild>
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}
