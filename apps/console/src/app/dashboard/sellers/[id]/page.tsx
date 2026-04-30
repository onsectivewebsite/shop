import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@onsective/db';
import { Card, CardContent, Badge, Button } from '@onsective/ui';
import {
  approveSellerAction,
  rejectSellerAction,
  reviewKycDocumentAction,
  updateCommissionAction,
  forceDisconnectStripeAction,
  reactivateFromSuspendedAction,
  suspendSellerAction,
} from './actions';

export const metadata = { title: 'Seller · Console' };

export default async function SellerDetail({ params }: { params: { id: string } }) {
  const seller = await prisma.seller.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { id: true, email: true, fullName: true, countryCode: true } },
      kycDocuments: { orderBy: { createdAt: 'desc' } },
      addresses: { take: 5 },
      _count: { select: { products: true, orderItems: true } },
    },
  });
  if (!seller) notFound();

  const pending = seller.status === 'PENDING_KYC' || seller.status === 'KYC_SUBMITTED';

  return (
    <div className="p-8">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">Seller</p>
          <h1 className="text-2xl font-bold text-slate-900">{seller.legalName}</h1>
          <p className="text-sm text-slate-500">
            {seller.displayName} ·{' '}
            <Link
              href={`/dashboard/users/${seller.user.id}`}
              className="text-brand-600 hover:underline"
            >
              {seller.user.email}
            </Link>
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge
              variant={
                seller.status === 'APPROVED'
                  ? 'success'
                  : seller.status === 'REJECTED' || seller.status === 'SUSPENDED'
                    ? 'error'
                    : 'warning'
              }
            >
              {seller.status}
            </Badge>
            <Badge variant="outline">{seller.countryCode}</Badge>
            {seller.taxId && <Badge variant="outline">Tax ID: {seller.taxId}</Badge>}
          </div>
        </div>

        {pending && (
          <div className="flex flex-col gap-2">
            <form action={approveSellerAction.bind(null, seller.id)}>
              <Button type="submit" variant="cta" size="sm">
                Approve seller
              </Button>
            </form>
            <details className="rounded-md border border-slate-200 bg-white p-3 text-sm">
              <summary className="cursor-pointer font-medium text-error-700">
                Reject…
              </summary>
              <form action={rejectSellerAction.bind(null, seller.id)} className="mt-2 space-y-2">
                <textarea
                  name="reason"
                  required
                  rows={3}
                  maxLength={500}
                  placeholder="Reason (visible to seller)…"
                  className="w-full rounded-md border border-slate-300 p-2 text-xs"
                />
                <Button type="submit" variant="destructive" size="sm">
                  Confirm reject
                </Button>
              </form>
            </details>
          </div>
        )}
      </header>

      <div className="mt-8 grid gap-4 sm:grid-cols-4">
        <Stat label="Products" value={seller._count.products} />
        <Stat label="Orders" value={seller._count.orderItems} />
        <Stat label="Rating" value={seller.ratingAvg.toFixed(2)} />
        <Stat label="Commission" value={`${seller.defaultCommissionPct.toFixed(2)}%`} />
      </div>

      {/* Manage — visible once seller is APPROVED or SUSPENDED */}
      {(seller.status === 'APPROVED' || seller.status === 'SUSPENDED') && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold">Manage seller</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {/* Commission */}
            <Card>
              <CardContent className="space-y-3 p-5">
                <p className="text-sm font-semibold">Commission rate</p>
                <p className="text-xs text-slate-500">
                  Default cut on every sale. Category-tier overrides apply on top.
                </p>
                <form
                  action={updateCommissionAction.bind(null, seller.id)}
                  className="flex items-center gap-2"
                >
                  <input
                    name="commissionPct"
                    type="number"
                    step="0.1"
                    min="0"
                    max="30"
                    required
                    defaultValue={seller.defaultCommissionPct.toFixed(2)}
                    className="h-9 w-24 rounded-md border border-slate-300 bg-white px-2 text-sm font-mono"
                  />
                  <span className="text-sm">%</span>
                  <Button type="submit" size="sm">
                    Update
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Stripe */}
            <Card>
              <CardContent className="space-y-3 p-5">
                <p className="text-sm font-semibold">Stripe Connect</p>
                {seller.stripeAccountId ? (
                  <>
                    <p className="text-xs text-slate-500">
                      Account <code className="font-mono text-[11px]">{seller.stripeAccountId}</code>
                      {seller.stripePayoutsEnabled
                        ? ' · payouts enabled'
                        : ' · payouts disabled'}
                    </p>
                    <details className="rounded-md border border-error-200 bg-error-50 p-3 text-sm">
                      <summary className="cursor-pointer font-medium text-error-700">
                        Force disconnect…
                      </summary>
                      <form
                        action={forceDisconnectStripeAction.bind(null, seller.id)}
                        className="mt-2 space-y-2"
                      >
                        <textarea
                          name="reason"
                          required
                          rows={2}
                          maxLength={500}
                          placeholder="Reason (compliance, fraud, KYC reset, …)"
                          className="w-full rounded-md border border-slate-300 p-2 text-xs"
                        />
                        <Button type="submit" variant="destructive" size="sm">
                          Confirm disconnect
                        </Button>
                      </form>
                    </details>
                  </>
                ) : (
                  <p className="text-xs text-slate-500">No Stripe account on file.</p>
                )}
              </CardContent>
            </Card>

            {/* Status */}
            <Card>
              <CardContent className="space-y-3 p-5">
                <p className="text-sm font-semibold">Account status</p>
                {seller.status === 'APPROVED' ? (
                  <>
                    <p className="text-xs text-slate-500">
                      Active — listings live, orders flowing, payouts on schedule.
                    </p>
                    <details className="rounded-md border border-error-200 bg-error-50 p-3 text-sm">
                      <summary className="cursor-pointer font-medium text-error-700">
                        Suspend…
                      </summary>
                      <form
                        action={suspendSellerAction.bind(null, seller.id)}
                        className="mt-2 space-y-2"
                      >
                        <textarea
                          name="reason"
                          required
                          rows={2}
                          maxLength={500}
                          placeholder="Reason (visible to seller)"
                          className="w-full rounded-md border border-slate-300 p-2 text-xs"
                        />
                        <Button type="submit" variant="destructive" size="sm">
                          Suspend account
                        </Button>
                      </form>
                    </details>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-slate-500">
                      Suspended{seller.suspendedReason ? ` · ${seller.suspendedReason}` : ''}.
                      Listings are hidden from buyers; payouts are paused.
                    </p>
                    <form
                      action={reactivateFromSuspendedAction.bind(null, seller.id)}
                      className="space-y-2"
                    >
                      <textarea
                        name="note"
                        required
                        rows={2}
                        maxLength={500}
                        placeholder="Reactivation note (audit only)"
                        className="w-full rounded-md border border-slate-300 p-2 text-xs"
                      />
                      <Button type="submit" variant="cta" size="sm">
                        Reactivate
                      </Button>
                    </form>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      <h2 className="mt-12 text-xl font-semibold">KYC documents</h2>
      {seller.kycDocuments.length === 0 ? (
        <Card className="mt-4">
          <CardContent className="p-8 text-center text-sm text-slate-500">
            No KYC documents submitted.
          </CardContent>
        </Card>
      ) : (
        <ul className="mt-4 space-y-3">
          {seller.kycDocuments.map((doc) => (
            <li key={doc.id}>
              <Card>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">{doc.type}</p>
                      <p className="font-mono text-xs text-slate-500">{doc.fileKey}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        Submitted {doc.createdAt.toUTCString()}
                      </p>
                      {doc.notes && (
                        <p className="mt-1 text-xs text-slate-600">Notes: {doc.notes}</p>
                      )}
                      {doc.reviewedAt && (
                        <p className="mt-1 text-xs text-slate-500">
                          Reviewed {doc.reviewedAt.toLocaleDateString()} by{' '}
                          {doc.reviewedBy ?? 'unknown'}
                        </p>
                      )}
                      <a
                        href={`/api/kyc/read?documentId=${doc.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-500 hover:text-slate-900"
                      >
                        Open document →
                      </a>
                    </div>
                    <Badge
                      variant={
                        doc.status === 'APPROVED'
                          ? 'success'
                          : doc.status === 'REJECTED'
                            ? 'error'
                            : 'warning'
                      }
                    >
                      {doc.status}
                    </Badge>
                  </div>
                  {doc.status === 'PENDING' && (
                    <form
                      action={reviewKycDocumentAction.bind(null, seller.id, doc.id, 'APPROVED')}
                      className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3"
                    >
                      <input
                        type="text"
                        name="notes"
                        placeholder="Notes (optional)"
                        maxLength={500}
                        className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs"
                      />
                      <Button type="submit" variant="cta" size="sm">
                        Approve doc
                      </Button>
                      <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        formAction={reviewKycDocumentAction.bind(
                          null,
                          seller.id,
                          doc.id,
                          'REJECTED',
                        )}
                      >
                        Reject doc
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="p-6">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
