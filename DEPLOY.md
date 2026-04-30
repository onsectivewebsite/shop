# Deploy guide

End-to-end deploy walkthrough for Onsective. Assumes AWS but the recipe maps cleanly to GCP/Render/Fly with name swaps.

## 0. Prerequisites

- Node ≥ 20.10, pnpm ≥ 9
- AWS account with us-east-1 (and ap-south-1 for the IN read-replica when you turn India on)
- Stripe live account with Connect enabled
- Domain pointing to wherever you host (apex: `itsnottechy.cloud`, console: `console.itsnottechy.cloud`)
- A Postgres 16 instance, a Redis instance, and (when flipping search) OpenSearch

## 1. Environment variables

Production secrets live in **AWS Secrets Manager**. Never commit `.env`. The full env surface is in `.env.example` — all of these need real values in prod except where noted:

| Var | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | RDS Postgres 16 connection string |
| `REDIS_URL` | yes | ElastiCache Redis cluster — BullMQ + rate limit + queues all use it |
| `SESSION_SECRET` | yes | ≥ 32 bytes, rotate every 6 months |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | yes | Live keys; webhook secret is per-endpoint in the Stripe dashboard |
| `STRIPE_PRICE_PRIME_MONTHLY`, `STRIPE_PRICE_PRIME_ANNUAL` | when Prime ships | Stripe Price IDs |
| `AWS_REGION`, `S3_BUCKET_PRODUCTS`, `S3_BUCKET_KYC`, `S3_PUBLIC_URL_BASE` | yes | CDN base = your CloudFront distribution |
| `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME`, `WEBAUTHN_ORIGIN` | yes | RP_ID = eTLD+1 (`itsnottechy.cloud`), origin includes scheme (`https://itsnottechy.cloud`) |
| `EASYPOST_API_KEY`, `EASYPOST_WEBHOOK_SECRET` | when shipping ships | |
| `OPENSEARCH_URL`, `OPENSEARCH_USERNAME`, `OPENSEARCH_PASSWORD`, `OPENSEARCH_INDEX` | optional | Empty → falls back to Postgres FTS |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | recommended | Empty → no-op |
| `CONSOLE_IP_ALLOWLIST` | recommended | Comma-separated IPs/CIDRs allowed to hit console |
| `EMAIL_FROM`, `EMAIL_REPLY_TO` | yes | Verified SES senders |
| `TWILIO_*`, `MSG91_*` | when SMS is wired | |

## 2. Database

```bash
# First time
pnpm install
pnpm db:generate
pnpm --filter @onsective/db deploy   # applies all migrations in /prisma/migrations

# Seed the eight top-level categories
pnpm db:seed
```

Migrations are checked in under `packages/db/prisma/migrations/`. Latest at time of writing:
- `20260427083905_init`
- `20260427120000_passkeys_impersonation_fts`
- `20260427180000_phase4_5_scaffolds`

## 3. The web app

`apps/web` is a Next.js 14 server. Build + run:

```bash
pnpm --filter @onsective/web build
pnpm --filter @onsective/web start
```

Port 3000. Behind a load balancer that terminates TLS and forwards `x-forwarded-for` and `x-request-id`.

## 4. The console

`apps/console` runs on port 3001. Same build/start pattern. Lock it behind the corp VPN by setting `CONSOLE_IP_ALLOWLIST` to your office CIDRs — the middleware enforces it.

## 5. Workers (separate processes)

These are **not** part of the web server. Run them as their own k8s Deployments / ECS services / Fly machines.

| Process | Command | What it does |
|---|---|---|
| Payouts worker | `pnpm --filter @onsective/web worker:payouts` | Long-running, listens on the `payouts` queue |
| Images worker | `pnpm --filter @onsective/web worker:images` | Resizes uploaded product images via sharp |
| Search-index worker | `pnpm --filter @onsective/web worker:search-index` | Pushes product changes into OpenSearch |
| Payouts cron | `pnpm --filter @onsective/web cron:payouts` | Run **once at boot** to register the hourly repeatable |
| Ads daily reset | `pnpm --filter @onsective/web cron:ads-reset` | Schedule **hourly** (cron job, EventBridge, k8s CronJob) |
| Full search reindex | `pnpm --filter @onsective/web reindex:search` | One-shot — run after schema changes or on first OpenSearch turn-up |

Each is meant to scale horizontally — BullMQ handles concurrency.

## 6. S3 bucket setup

Two buckets: `S3_BUCKET_PRODUCTS` (public-read) and `S3_BUCKET_KYC` (private).

Products bucket needs CORS to allow direct browser uploads:
```json
[{
  "AllowedOrigins": ["https://itsnottechy.cloud", "https://*.itsnottechy.cloud"],
  "AllowedMethods": ["PUT", "GET"],
  "AllowedHeaders": ["*"],
  "ExposeHeaders": ["ETag"],
  "MaxAgeSeconds": 3000
}]
```

In prod prefer **private bucket + CloudFront OAC** over public-read. Update the `S3_PUBLIC_URL_BASE` env to the CloudFront domain and remove the `ACL: 'public-read'` line in `apps/web/src/server/uploads.ts`.

### 6.1 CloudFront + OAC setup (Phase 4)

1. **Create distribution**
   - Origin domain: `<bucket>.s3.<region>.amazonaws.com`
   - Origin access: **Origin access control settings** → create new OAC, signing behavior **Sign requests**
   - Default cache behavior: **Redirect HTTP to HTTPS**, allow `GET, HEAD`
   - Cache policy: **CachingOptimized** (CDN respects `Cache-Control: public, max-age=31536000, immutable` already set by the variants worker)
   - Compress objects: **Yes**
2. **Attach OAC to bucket policy** — CloudFront prints a JSON snippet on the OAC step. Paste it into the bucket's Permissions → Bucket policy.
3. **Block public access** on the bucket once OAC is verified working (`aws s3api put-public-access-block …`).
4. **Custom domain (optional)** — point `images.itsnottechy.cloud` at the distribution, attach an ACM cert in `us-east-1`.
5. **Wire the env**:
   ```bash
   S3_PUBLIC_URL_BASE=https://images.itsnottechy.cloud
   # or, without custom domain:
   S3_PUBLIC_URL_BASE=https://d1234abcd.cloudfront.net
   ```
   `apps/seller/src/server/uploads.ts` reads this and rewrites all returned image URLs through the CDN.

### 6.2 Demo catalog seed (Phase 4)

```bash
pnpm db:seed         # categories (idempotent, safe to re-run)
pnpm db:seed:demo    # 4 demo sellers + ~55 products with Unsplash imagery
pnpm db:seed:demo --reset   # wipe demo data before launch
```

Demo sellers carry `isDemo: true`. The hourly payouts sweep skips them, so they can sit alongside real sellers indefinitely without triggering Stripe transfers. Image URLs point at `images.unsplash.com` directly, so this works before you stand up S3 — once the CDN is live, replace the URLs in `prisma/demo-seed.ts` (or upload the images to S3 and re-run the seed).

## 7. Stripe Connect

1. In the Stripe dashboard → Connect → Settings, enable Express accounts
2. Set the redirect URLs to `https://itsnottechy.cloud/en/seller/onboarding/{return,refresh}`
3. Add a webhook endpoint at `https://itsnottechy.cloud/api/webhooks/stripe` — copy the signing secret into `STRIPE_WEBHOOK_SECRET`
4. Subscribe to: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.dispute.created`, `transfer.created`, `transfer.updated`, `transfer.reversed`, `payout.paid`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`

## 8. EasyPost

Add a webhook at `https://itsnottechy.cloud/api/webhooks/easypost`. Signing key goes in `EASYPOST_WEBHOOK_SECRET`.

## 9. First deploy checklist

- [ ] All env vars set in Secrets Manager
- [ ] DB migrations applied (`pnpm --filter @onsective/db deploy`)
- [ ] Categories seeded (`pnpm db:seed`)
- [ ] Demo catalog seeded (`pnpm db:seed:demo`) — optional pre-launch
- [ ] Web app green at `/en` (renders the category strip)
- [ ] Console reachable at `:3001/login` (PM-role user can log in)
- [ ] Stripe webhook test event delivers a 200
- [ ] EasyPost test event delivers a 200
- [ ] Workers running (logs show "started, listening for jobs")
- [ ] Payouts cron registered (`pnpm cron:payouts` exited 0)
- [ ] Sentry receiving its first event from each runtime
- [ ] OpenSearch index created (if enabled) via `pnpm reindex:search`

## 10. Rollback

DB migrations are **not auto-reversible**. Roll back by:
1. Pinning the previous container image
2. Manually applying the inverse SQL for the offending migration (keep an `up.sql`/`down.sql` per migration in your runbook)
3. For Stripe-side state, replay webhook events from the dashboard rather than mutate by hand

The rule: if the DB shape changes, the deploy is a forward-only event. Plan migrations so the *previous* code keeps working against the *new* schema during the rollout window (add columns nullable, drop in a follow-up).
