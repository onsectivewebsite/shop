import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@onsective/db';
import { getConsoleSession } from '@/server/auth';
import {
  hideMessageAction,
  dismissMessageReportsAction,
  unhideMessageAction,
} from './actions';

export const metadata = { title: 'Flagged messages' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

type Tab = 'reported' | 'hidden';

export default async function MessageModerationPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const session = await getConsoleSession();
  if (!session) redirect('/login');

  const tab: Tab = searchParams.tab === 'hidden' ? 'hidden' : 'reported';

  const [reportedMessages, hiddenMessages, reportedCount] = await Promise.all([
    prisma.message.findMany({
      where: {
        isHidden: false,
        reports: { some: {} },
      },
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      select: {
        id: true,
        authorRole: true,
        body: true,
        createdAt: true,
        author: { select: { email: true, fullName: true } },
        conversation: {
          select: {
            id: true,
            buyer: { select: { email: true } },
            seller: { select: { displayName: true } },
            orderItem: {
              select: {
                productTitle: true,
                order: { select: { orderNumber: true } },
              },
            },
          },
        },
        reports: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            reason: true,
            reporterRole: true,
            note: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.message.findMany({
      where: { isHidden: true },
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      select: {
        id: true,
        authorRole: true,
        body: true,
        hiddenReason: true,
        createdAt: true,
        author: { select: { email: true, fullName: true } },
        conversation: {
          select: {
            id: true,
            buyer: { select: { email: true } },
            seller: { select: { displayName: true } },
            orderItem: {
              select: {
                productTitle: true,
                order: { select: { orderNumber: true } },
              },
            },
          },
        },
      },
    }),
    prisma.message.count({
      where: { isHidden: false, reports: { some: {} } },
    }),
  ]);

  return (
    <div className="p-6 lg:p-10">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Flagged messages</h1>
        <p className="mt-1 text-sm text-slate-600">
          Buyer- and seller-flagged messages from the messaging surface. Hide
          to redact the body buyer- and seller-side; the row is preserved for
          audit.
        </p>
      </header>

      <div className="mb-6 flex gap-2">
        <Tab
          href="/dashboard/messages"
          label={`Reported${reportedCount ? ` · ${reportedCount}` : ''}`}
          active={tab === 'reported'}
        />
        <Tab
          href="/dashboard/messages?tab=hidden"
          label="Hidden"
          active={tab === 'hidden'}
        />
      </div>

      {tab === 'reported' && (
        <div className="space-y-4">
          {reportedMessages.length === 0 ? (
            <p className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              No flagged messages awaiting review.
            </p>
          ) : (
            reportedMessages.map((m) => (
              <ReportedCard key={m.id} message={m} />
            ))
          )}
        </div>
      )}

      {tab === 'hidden' && (
        <div className="space-y-4">
          {hiddenMessages.length === 0 ? (
            <p className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              No hidden messages.
            </p>
          ) : (
            hiddenMessages.map((m) => <HiddenCard key={m.id} message={m} />)
          )}
        </div>
      )}
    </div>
  );
}

function Tab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={
        active
          ? 'rounded-full bg-slate-900 px-4 py-1.5 text-xs font-medium text-white'
          : 'rounded-full border border-slate-300 px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100'
      }
    >
      {label}
    </Link>
  );
}

type ReportedRow = {
  id: string;
  authorRole: 'BUYER' | 'SELLER';
  body: string;
  createdAt: Date;
  author: { email: string; fullName: string | null };
  conversation: {
    id: string;
    buyer: { email: string };
    seller: { displayName: string };
    orderItem: {
      productTitle: string;
      order: { orderNumber: string };
    };
  };
  reports: Array<{
    id: string;
    reason: string;
    reporterRole: 'BUYER' | 'SELLER';
    note: string | null;
    createdAt: Date;
  }>;
};

function ReportedCard({ message }: { message: ReportedRow }) {
  const histogram = new Map<string, number>();
  for (const r of message.reports) {
    histogram.set(r.reason, (histogram.get(r.reason) ?? 0) + 1);
  }
  const reasonsLabel = Array.from(histogram.entries())
    .map(([reason, count]) => `${reason}${count > 1 ? ` × ${count}` : ''}`)
    .join(' · ');

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-amber-900">
            {message.reports.length} flag{message.reports.length === 1 ? '' : 's'} · {reasonsLabel}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            From {message.author.fullName ?? message.author.email}{' '}
            <span className="font-medium text-slate-700">({message.authorRole})</span>{' '}
            · {message.createdAt.toLocaleString()}
          </p>
        </div>
      </div>

      <p className="mt-3 whitespace-pre-line rounded bg-white p-3 text-sm text-slate-800">
        {message.body}
      </p>

      <p className="mt-3 text-xs text-slate-500">
        Thread: {message.conversation.seller.displayName} ↔{' '}
        {message.conversation.buyer.email} · about{' '}
        {message.conversation.orderItem.productTitle}{' '}
        <span className="font-mono">
          · {message.conversation.orderItem.order.orderNumber}
        </span>
      </p>

      {message.reports.some((r) => r.note) && (
        <ul className="mt-3 space-y-1 text-xs text-slate-600">
          {message.reports
            .filter((r) => r.note)
            .map((r) => (
              <li key={r.id}>
                <span className="font-medium text-slate-700">
                  {r.reporterRole}:
                </span>{' '}
                {r.note}
              </li>
            ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <form action={hideMessageAction.bind(null, message.id)} className="flex items-center gap-2">
          <input
            type="text"
            name="reason"
            placeholder="Reason for hiding (visible to participants)"
            required
            maxLength={500}
            className="w-72 rounded-md border border-amber-300 px-3 py-1.5 text-xs"
          />
          <button
            type="submit"
            className="rounded-full bg-amber-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-800"
          >
            Hide
          </button>
        </form>
        <form action={dismissMessageReportsAction.bind(null, message.id)}>
          <button
            type="submit"
            className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Dismiss reports
          </button>
        </form>
      </div>
    </div>
  );
}

type HiddenRow = {
  id: string;
  authorRole: 'BUYER' | 'SELLER';
  body: string;
  hiddenReason: string | null;
  createdAt: Date;
  author: { email: string; fullName: string | null };
  conversation: {
    id: string;
    buyer: { email: string };
    seller: { displayName: string };
    orderItem: {
      productTitle: string;
      order: { orderNumber: string };
    };
  };
};

function HiddenCard({ message }: { message: HiddenRow }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">
        Hidden from {message.author.fullName ?? message.author.email}{' '}
        <span className="font-medium text-slate-700">({message.authorRole})</span>{' '}
        · {message.createdAt.toLocaleString()}
      </p>
      {message.hiddenReason && (
        <p className="mt-1 text-xs text-slate-600">
          Reason: {message.hiddenReason}
        </p>
      )}
      <p className="mt-3 whitespace-pre-line rounded bg-slate-50 p-3 text-sm text-slate-700">
        {message.body}
      </p>
      <p className="mt-3 text-xs text-slate-500">
        Thread: {message.conversation.seller.displayName} ↔{' '}
        {message.conversation.buyer.email} · about{' '}
        {message.conversation.orderItem.productTitle}{' '}
        <span className="font-mono">
          · {message.conversation.orderItem.order.orderNumber}
        </span>
      </p>
      <form
        action={unhideMessageAction.bind(null, message.id)}
        className="mt-3"
      >
        <button
          type="submit"
          className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          Unhide
        </button>
      </form>
    </div>
  );
}
