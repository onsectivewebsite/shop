import { Hourglass } from 'lucide-react';

export function RateLimited({ retryAfter }: { retryAfter: number }) {
  return (
    <div className="container-page py-16">
      <div className="mx-auto max-w-md rounded-3xl border border-stone-200 bg-white p-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-stone-700">
          <Hourglass size={20} strokeWidth={1.75} />
        </div>
        <h1 className="mt-5 font-display text-2xl font-medium text-stone-950">
          Slow down a moment
        </h1>
        <p className="mt-2 text-sm text-stone-600">
          You&rsquo;re browsing fast enough that we&rsquo;d like to give the database a breather.
          Try again in about {retryAfter} second{retryAfter === 1 ? '' : 's'}.
        </p>
      </div>
    </div>
  );
}
