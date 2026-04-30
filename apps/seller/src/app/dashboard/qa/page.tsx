import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSellerSession } from '@/server/auth';
import { prisma } from '@/server/db';
import { SellerShell } from '@/components/seller-shell';
import { QAList, type SellerQuestionRow } from '@/components/qa-list';

export const metadata = { title: 'Q&A' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

type Filter = 'all' | 'unanswered' | 'answered';

export default async function QAPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const session = await getSellerSession();
  if (!session) redirect('/login');

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!seller) redirect('/apply');

  const filter: Filter =
    searchParams.filter === 'answered'
      ? 'answered'
      : searchParams.filter === 'unanswered'
        ? 'unanswered'
        : 'all';

  const answerClause =
    filter === 'unanswered'
      ? { answer: null }
      : filter === 'answered'
        ? { answer: { not: null } }
        : {};

  const [unansweredCount, items] = await Promise.all([
    prisma.productQuestion.count({
      where: { product: { sellerId: seller.id }, answer: null },
    }),
    prisma.productQuestion.findMany({
      where: { product: { sellerId: seller.id }, ...answerClause },
      orderBy: [{ answer: { sort: 'asc', nulls: 'first' } }, { createdAt: 'desc' }],
      take: PAGE_SIZE,
      select: {
        id: true,
        question: true,
        answer: true,
        answeredAt: true,
        createdAt: true,
        askerId: true,
        product: { select: { title: true, slug: true } },
      },
    }),
  ]);

  const askerIds = Array.from(new Set(items.map((q) => q.askerId)));
  const askers = await prisma.user.findMany({
    where: { id: { in: askerIds } },
    select: { id: true, fullName: true },
  });
  const nameById = new Map(askers.map((u) => [u.id, redactName(u.fullName)]));

  const rows: SellerQuestionRow[] = items.map((q) => ({
    id: q.id,
    question: q.question,
    answer: q.answer,
    answeredAt: q.answeredAt,
    createdAt: q.createdAt,
    productTitle: q.product.title,
    productSlug: q.product.slug,
    askerName: nameById.get(q.askerId) ?? 'Onsective shopper',
  }));

  return (
    <SellerShell email={session.user.email} name={session.user.fullName ?? undefined}>
      <div className="container-page py-10 md:py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-stone-500">
              Buyer questions
            </p>
            <h1 className="mt-3 font-display text-4xl font-medium leading-tight tracking-tight text-stone-950">
              Q&amp;A
            </h1>
            <p className="mt-2 text-sm text-stone-600">
              Answers are public and shown on the product page.
              {unansweredCount > 0 && (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                  {unansweredCount} awaiting answer
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="mt-8 flex gap-2">
          <FilterPill href="/dashboard/qa" label="All" active={filter === 'all'} />
          <FilterPill
            href="/dashboard/qa?filter=unanswered"
            label={`Unanswered${unansweredCount ? ` · ${unansweredCount}` : ''}`}
            active={filter === 'unanswered'}
          />
          <FilterPill
            href="/dashboard/qa?filter=answered"
            label="Answered"
            active={filter === 'answered'}
          />
        </div>

        <div className="mt-6">
          <QAList questions={rows} />
        </div>
      </div>
    </SellerShell>
  );
}

function FilterPill({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={
        active
          ? 'rounded-full bg-stone-900 px-4 py-1.5 text-xs font-medium text-white'
          : 'rounded-full border border-stone-300 px-4 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100'
      }
    >
      {label}
    </Link>
  );
}

function redactName(name: string | null): string {
  if (!name) return 'Onsective shopper';
  const parts = name.trim().split(/\s+/);
  const first = parts[0] ?? '';
  const lastInitial = parts.length > 1 ? `${parts[parts.length - 1]!.charAt(0)}.` : '';
  return `${first} ${lastInitial}`.trim() || 'Onsective shopper';
}
