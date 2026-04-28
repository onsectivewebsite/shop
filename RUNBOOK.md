# Runbook — Onsective

Canonical responses for the alerts and incidents most likely to happen first.

## Severity levels

- **SEV-1** Customer payments broken, console down for everyone, data loss risk
- **SEV-2** A worker stuck, search down with FTS fallback active, region-specific outage
- **SEV-3** A cron didn't run, a single seller's payout stuck, search relevance regression

## How to declare

Hop into `#incidents`. Write `SEV-N: <one-line>` and tag the on-call PM. Update with progress every 15 min until resolution.

---

## Payouts worker stuck

**Symptom**: BullMQ dashboard shows the `payouts` queue depth > 0 for > 10 min, or `payout` rows stuck in `IN_TRANSIT` past the carrier's normal landing window.

**Diagnose**
1. Worker process up? Check the deployment.
2. Redis reachable from the worker? `redis-cli -u $REDIS_URL ping` from a sidecar.
3. Stripe API healthy? `https://status.stripe.com`
4. Inspect the failed job: `BullMQ` UI shows the error stack.

**Resolve**
- Worker crash: restart. The `attempts: 3` retry policy will replay any in-flight jobs. Idempotency keys on `stripe.transfers.create` prevent double-pay.
- Stripe outage: pause the cron (`pnpm cron:payouts` re-run with the queue removed) until they recover. Funds aren't lost — `SELLER_PAYABLE` ledger entries accumulate and the next sweep picks them up.
- Permanent failure on a single Payout (FAILED with reason): inspect the seller's Stripe Connect account. Common cause: `stripePayoutsEnabled` flipped off mid-sweep. Re-onboard the seller; their failed Payout row is left for an ops adjustment.

---

## Stripe dispute received

**Symptom**: `#alerts` posts a `charge.dispute.created` event, or finance sees a chargeback line in Stripe.

**Auto-effects (already wired)**
- AuditLog row written
- Phase 2: seller payout for the disputed item is frozen (TODO — not yet wired)

**Manual flow**
1. Open the order in console: `/dashboard/orders/<id>`
2. Pull the dispute reason code from Stripe dashboard
3. Compile evidence per Stripe's requested categories
4. Upload via Stripe dashboard (deadline ~7-21 days depending on reason)
5. Once resolved, mark the Refund row appropriately if won/lost

---

## Subscription churn (Prime)

**Symptom**: `customer.subscription.deleted` events spike, or weekly retention dashboard drops > 20%.

**Diagnose**
- Was a price change pushed recently? Check the Stripe price IDs vs `STRIPE_PRICE_PRIME_*` env
- Did `invoice.payment_failed` events spike? That's involuntary churn — different fix path
- Run a query against `PrimeMembership` filtered by `cancelledAt` in the last 7 days, joined with `User.createdAt` to see whether new vs old members are leaving

**Resolve**
- Voluntary churn: not an incident, but file a JIRA for the retention squad
- Involuntary churn: payment retry settings in Stripe's billing automations panel. Smart Retries handles most; otherwise issue a Customer Portal email

---

## OpenSearch down

**Symptom**: Search 500s, Sentry shows `OPENSEARCH_URL` connection refused

**Resolve**
1. The `catalog.search` proc auto-falls back to Postgres FTS — search keeps working with degraded relevance
2. Bring OpenSearch back up
3. After it's up: `pnpm --filter @onsective/web reindex:search` to re-pop any docs that mutated during the outage

---

## High-value refund (4-eyes flow)

**Symptom**: A PM tries to refund > $500 (50000 minor units USD).

**Auto-effects**
- An `ApprovalRequest` row is created instead of the refund being applied
- `/dashboard/approvals` shows it pending; a *different* PM must approve

**Manual flow**
- The requesting PM cannot approve their own request — guarded in `approveAction`
- The approving PM clicks Approve; the executed refund happens atomically with the approval row update
- If the refund itself fails (Stripe error), the audit row records it and the approval is marked `EXECUTED` but the refund remains TODO — manual cleanup

---

## Console IP allowlist locked you out

**Symptom**: legitimate PM gets `403 — IP not allowed` on the console.

**Resolve**
1. Add the user's egress IP to `CONSOLE_IP_ALLOWLIST` env
2. Restart the console deployment to pick up the env change
3. Don't disable the allowlist as a "temporary" fix — the audit trail will flag any login from the new IP anyway

---

## Image variants worker backed up

**Symptom**: Sellers complain images on PDP look pixelated, or BullMQ shows depth > 100 on `image-variants`.

**Diagnose**
- sharp's native deps need `node-gyp-build-optional-packages` — confirm the worker container has them
- S3 throttling? AWS rarely 503s but check CloudWatch

**Resolve**
- Worker scaling: increase `concurrency` in `worker-images.ts` (default 4) or add replicas
- Originals are still served as the primary image; variants are progressive-enhancement, so a backlog only affects bandwidth not correctness

---

## Rate limiter starts blocking real users

**Symptom**: Auth endpoints returning 429 for legitimate users (`#alerts` Sentry rate)

**Diagnose**
- Is it actually a bot wave? Inspect `x-forwarded-for` distribution — if 80% from one ASN, that's a bot
- `rate-limit.ts` fails *open* on Redis errors, so a 429 means Redis is up and the cap is being hit

**Resolve**
- Real bot wave: tighten upstream at WAF/CloudFront, not at app
- Genuine traffic spike: bump caps in `trpc.ts` (`authRateLimit`, etc) and ship a hotfix
- Redis full: rate limit keys have 60s/3600s TTLs so a flush is safe — but understand what flushed before doing so

---

## Useful one-liners

```bash
# How many active seller payouts are stuck IN_TRANSIT > 24h?
psql $DATABASE_URL -c "select count(*) from \"Payout\" where status = 'IN_TRANSIT' and \"updatedAt\" < now() - interval '24 hours';"

# Manually mark a single payout PAID after confirming with bank receipt
psql $DATABASE_URL -c "update \"Payout\" set status = 'PAID', \"paidAt\" = now() where id = 'PAYOUT_ID';"

# How many SEARCH_RESULTS ad campaigns are EXHAUSTED but should have reset?
psql $DATABASE_URL -c "select count(*) from \"AdCampaign\" where status = 'EXHAUSTED' and \"spentTodayResetAt\" < date_trunc('day', now() at time zone 'utc');"

# Replay the 100 most recent failed webhook events
psql $DATABASE_URL -c "select \"externalId\", \"eventType\", error from \"WebhookEvent\" where error is not null order by \"createdAt\" desc limit 100;"
```
