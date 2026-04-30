# Onsective — Roadmap & System Plan

**Version:** 1.0
**Date:** 2026-04-30
**Status:** Phased plan from current deployment to production-ready launch
**Owner:** Onsective engineering

---

## Table of Contents

1. Executive Summary
2. System Architecture
3. Current-State Audit
4. Core User Workflows
5. Phased Roadmap
6. Risk Register
7. Appendices

---

# 1. Executive Summary

Onsective is a multi-sided ecommerce marketplace. Sellers list products; buyers purchase; the platform takes a category-tiered 8 — 15% commission on every sale.

**Three deployed surfaces:**

| Surface | Domain | Audience | Tech |
|---|---|---|---|
| Buyer marketplace | itsnottechy.cloud | Shoppers | Next.js (apps/web), port 3000 |
| Seller portal | seller.itsnottechy.cloud | Sellers | Next.js (apps/seller), port 3002 |
| Admin console | console.itsnottechy.cloud | Platform staff | Next.js (apps/console), port 3001 |

All three share one Postgres 16 database, one Redis instance (BullMQ + rate limiting), and one PM2 supervisor. Email is sent via Hostinger SMTP. Payments are processed via Stripe Connect Express — Onsective is the merchant of record; sellers are paid weekly via Stripe Transfers.

**Where we are:** auth (signup, email verify, 2FA, lockout, password reset, passkeys), the core schema (User, Seller, Product, Order, Payment, LedgerEntry, Payout), the buyer checkout flow, the seller application flow, and the admin console for users / sellers / orders / returns / tickets / approvals are all shipped and live.

**Where we're going:** a production-ready marketplace that takes real money, ships real packages, and has zero dead links or stub pages. This document defines the path in eleven phases.

**Phase summary:**

| # | Phase | Effort | Blocking? |
|---|---|---|---|
| 0 | Stabilization | 0.5 day | Yes (today) |
| 1 | Seller portal parity | 1 day | Yes |
| 2 | Console gap-filling | 1 day | Yes |
| 3 | Buyer-site completion | 1.5 days | No |
| 4 | Catalog seeding + images | 1 day | No |
| 5 | Production money infra | 2-3 days | Yes (pre-launch) |
| 6 | Trust & safety v1 | 2 days | Yes (pre-launch) |
| 7 | Reviews + Q&A | 3 days | No |
| 8 | Performance + scale | 1 week | No |
| 9 | Launch readiness | 1 week | Yes (pre-launch) |
| 10 | Growth surface | Ongoing | No |

---

# 2. System Architecture

## 2.1 Process & port topology

```
                          ┌───────────────────────────────────────┐
                          │           Internet (HTTPS 443)         │
                          └───────────────┬───────────────────────┘
                                          │
                          ┌───────────────▼───────────────────────┐
                          │     CloudPanel · Nginx (reverse        │
                          │     proxy + Let's Encrypt SSL)         │
                          └───────────────┬───────────────────────┘
                                          │
        ┌─────────────────────┬───────────┴──────────────┬──────────────────────┐
        │                     │                          │                      │
        ▼                     ▼                          ▼                      │
  itsnottechy.cloud   seller.itsnottechy.cloud   console.itsnottechy.cloud      │
        │                     │                          │                      │
        ▼                     ▼                          ▼                      │
  apps/web (3000)     apps/seller (3002)        apps/console (3001)             │
                                                                                │
                                                                                ▼
                                                           PM2 (single supervisor)
                                                          ┌────────────────────────┐
                                                          │ web                    │
                                                          │ seller                 │
                                                          │ console                │
                                                          │ worker-payouts         │
                                                          │ worker-images          │
                                                          │ worker-search-index    │
                                                          └────────────────────────┘
                                                                                │
                                                                                ▼
                                                              ┌─────────────────────────┐
                                                              │ Postgres 16  (port 5432)│
                                                              │ Redis        (port 6379)│
                                                              └─────────────────────────┘
```

## 2.2 Data flow — buyer order

```
   ┌──────┐    1. POST /checkout/placeOrder      ┌────────────────────┐
   │Buyer │──────────────────────────────────────▶│  apps/web (tRPC)   │
   └──────┘                                       └─────────┬──────────┘
       ▲                                                     │
       │ 6. order placed (UI redirect)                       │ 2. INSERT Order, OrderItem
       │                                                     │    (commission frozen here)
       │                                                     ▼
       │                                          ┌────────────────────┐
       │                                          │ Postgres           │
       │                                          └─────────┬──────────┘
       │                                                     │
       │  5. session continues                              │ 3. Stripe.paymentIntents
       │                                                     │       .create({on_behalf_of})
       │                                                     ▼
       │                                          ┌────────────────────┐
       │                                          │ Stripe API         │
       │                                          └─────────┬──────────┘
       │                                                     │
       │ 4. payment_intent.succeeded webhook (signed)       │
       │ ─────────────────────────────────────────────────── │
       │                                                     ▼
       │                                          ┌────────────────────┐
       │                                          │ webhook handler    │
       │                                          │ - dedup via        │
       │                                          │   WebhookEvent     │
       │                                          │ - post LedgerEntry │
       │                                          │   (DR/CR balanced) │
       │                                          │ - decrement stock  │
       │                                          └────────────────────┘
```

## 2.3 Money flow — seller payout

```
                           commission                   shipping
                           (8-15%)                      (carrier cost)
                              │                              │
   buyer                      ▼                              ▼
     │   $100   ┌──────────┬──────┬───────────┬──────┬─────────┐
     │ ────────▶│ Onsective│ -8 % │ -shipping │ -fees│ = seller│  $87 (example)
     │   pay    │ collects │ comm │ ($5)      │ ($3) │ payable │
     ▼          └──────────┴──────┴───────────┴──────┴─────────┘
   Stripe                                                    │
                                                             │ held 7 days
                                                             │ (return window)
                                                             ▼
                                              ┌──────────────────────────┐
                                              │ payouts worker (hourly)  │
                                              │  - groupBy seller        │
                                              │  - skip suspended        │
                                              │  - skip if Stripe        │
                                              │    payouts disabled      │
                                              │  - call                  │
                                              │    stripe.transfers      │
                                              │      .create()           │
                                              └─────────────┬────────────┘
                                                            │
                                                            ▼
                                              ┌──────────────────────────┐
                                              │ seller's Stripe Connect  │
                                              │   account                │
                                              └─────────────┬────────────┘
                                                            │
                                                            ▼
                                              ┌──────────────────────────┐
                                              │ seller's bank (~2-3 days)│
                                              └──────────────────────────┘
```

## 2.4 Auth flow — buyer signup with 2FA

```
   ┌──────┐         /signup form         ┌────────────┐
   │Buyer │ ───────────────────────────▶ │ apps/web    │
   └──────┘                              └──────┬──────┘
                                                 │ 1. INSERT User
                                                 │    (passwordHash, emailVerified=null)
                                                 │ 2. INSERT Otp (purpose=verify)
                                                 │ 3. SMTP send 6-digit code
                                                 ▼
                                          ┌────────────┐
                                          │ Hostinger  │
                                          │ SMTP       │
                                          └──────┬─────┘
                                                 │
                                                 ▼
                                          ┌────────────┐
                                          │  inbox     │
                                          └──────┬─────┘
                                                 │
   /verify-email form ◀──────────────────────────┘
   user enters code
                                                 │
                                                 ▼
                                          ┌────────────┐
                                          │ apps/web    │
                                          └──────┬──────┘
                                                 │ 4. UPDATE User SET emailVerified=NOW()
                                                 │ 5. INSERT Session (httpOnly cookie)
                                                 │
   Subsequent login:
   /login (email + password)
                                                 │
                                                 │ 6. password match → INSERT Otp (purpose=login_2fa)
                                                 │ 7. SMTP send 2FA code
                                                 ▼
   /verify-2fa form
   user enters code
                                                 │ 8. UPDATE User SET lastLogin/IP/UA
                                                 │ 9. INSERT Session
                                                 │ 10. detect new device → SMTP alert email
                                                 ▼
                                            buyer signed in
```

---

# 3. Current-State Audit

Status legend: ✓ shipped · ◐ stub or partial · ✗ missing · ⚠ broken

## 3.1 Buyer marketplace (itsnottechy.cloud)

| Area | Status | Notes |
|---|---|---|
| Signup / login / 2FA | ✓ | Working end-to-end |
| Password reset | ✓ | Working end-to-end |
| Email lockout (5 fails) | ✓ | Working |
| Passkeys (WebAuthn) | ✓ | Working; null/null challenge fix applied |
| Account hub / settings | ✓ | `/account` index plus subpages |
| Header + footer | ✓ | Color-blocked bento marketplace style |
| Product detail page | ✓ | Live with variants and gallery |
| Category pages | ✓ | Server-rendered, paginated |
| Cart | ✓ | Live tRPC backed |
| 3-step checkout | ✓ | Address → shipping → pay (Stripe Elements) |
| Search (Postgres FTS) | ✓ | Falls back to ILIKE on small datasets |
| Sponsored ad slate | ✓ | On `/search`, second-price clearing |
| Order history | ✓ | `/account/orders` list + detail |
| Returns request flow | ✓ | Per-item from order detail |
| Wishlist link | ⚠ | Header link; `/account/wishlist` returns 404 |
| Categories index | ⚠ | `/categories` link in header; page does not exist |
| Today's Deals | ⚠ | `/deals` link in header; page does not exist |
| Best Sellers | ⚠ | `/best-sellers` linked; page does not exist |
| Trending | ⚠ | `/trending` linked from home; page does not exist |
| Order tracking | ✗ | `/track` linked from footer; page does not exist |
| Address book CRUD | ✗ | Schema exists, no UI |
| Hindi translations | ◐ | Some keys missing |
| Mobile menu | ◐ | Desktop nav only — no hamburger sheet |

## 3.2 Seller portal (seller.itsnottechy.cloud)

| Area | Status | Notes |
|---|---|---|
| Landing page | ✓ | Marketing page when logged out |
| Signup / apply form | ✓ | Form persists Seller row, status PENDING_KYC |
| Login | ✓ | Cookie-based, lockout enforced |
| Status dashboard | ✓ | 4-step onboarding checklist |
| Edit storefront profile | ✗ | No UI exists |
| KYC document upload | ✗ | Apply form collects nothing; admin expects KYC docs |
| Stripe Connect onboarding | ⚠ | Button only on legacy `/[locale]/seller/*` (cross-domain) |
| Product list | ⚠ | Cross-domain link to itsnottechy.cloud — cookie not shared |
| Product create wizard (5-step) | ⚠ | Same — only on legacy app |
| Orders queue | ⚠ | Same |
| Payouts ledger | ⚠ | Same |
| Analytics dashboard | ⚠ | Same |
| tRPC client | ✗ | Currently uses raw fetch + REST routes |

## 3.3 Admin console (console.itsnottechy.cloud)

| Area | Status | Notes |
|---|---|---|
| Login | ✓ | Email + password; PRIVILEGED_ROLES gate |
| IP allowlist | ✓ | Empty allowlist = open (dev) |
| Users list / detail | ✓ | Search, role editor, suspend, reactivate, delete |
| Create user | ✓ | Sends welcome email with set-password code |
| Sellers approval queue | ✓ | List + detail + approve/reject |
| KYC document review UI | ✗ | KycDocument schema exists; no UI |
| Orders queue / detail | ✓ | Cancel + refund (4-eyes if > $500) |
| Returns queue | ◐ | List + detail page exist; 4 state-machine action buttons missing on detail |
| Tickets workspace | ✓ | Reply, internal note, status transitions |
| Organizations (B2B) | ✓ | Approve, set credit limit, suspend |
| Approvals (4-eyes) | ✓ | Self-approval blocked |
| Ad moderation | ✓ | Approve drafts → ACTIVE |
| Audit log search UI | ✗ | AuditLog table exists; no page |
| Webhook event inspector | ✗ | WebhookEvent table exists; no page |
| System health page | ✗ | No `/dashboard/health` |
| Impersonation | ✓ | Magic-link, single-use, audited, read-only |
| SLA breach indicators | ✗ | Tickets have no breached/healthy badge |

## 3.4 Cross-cutting infrastructure

| Area | Status | Notes |
|---|---|---|
| Postgres backups | ✗ | No automated `pg_dump` |
| Monitoring / Sentry | ◐ | Sentry SDK wired, DSN not set in production |
| Health check endpoint | ✗ | No `/api/health` |
| OpenSearch | ✗ | Code wired; cluster not provisioned |
| EasyPost live carrier rates | ✗ | Test API key; checkout uses hardcoded $5 shipping |
| Stripe live mode | ✗ | Test keys; placeholders in `.env` |
| S3 + CloudFront for images | ✗ | Bucket not provisioned |
| Image variants worker | ◐ | Code exists; never runs because no uploads happen |
| SES / SPF / DKIM / DMARC | ⚠ | Hostinger SMTP works; DNS records not set — emails risk spam folder |
| Status page | ✗ | None |

---

# 4. Core User Workflows

## 4.1 Buyer journey (target end-state)

```
   Discover ─▶ Browse ─▶ Compare ─▶ Cart ─▶ Sign in ─▶ Address ─▶ Ship ─▶ Pay ─▶ Track ─▶ Receive ─▶ Review
      │           │         │         │        │           │          │       │         │           │            │
      │           │         │         │        │           │          │       │         │           │            │
   /home       /category   PDP       /cart   /login     /checkout /shipping /pay   /account/  delivery        review
                                                       /address                              orders/[n]    notification
```

**Critical-path coverage:** ✓ except review notification email (Phase 7), tracking page (Phase 3).

## 4.2 Seller journey (target end-state)

```
   Discover ─▶ Apply ─▶ KYC ─▶ Stripe ─▶ List ─▶ Sell ─▶ Ship ─▶ Get paid ─▶ Analyze
      │           │         │       │         │         │       │         │             │
      │           │         │       │         │         │       │         │             │
   seller.    /signup   /dashboard /dashboard /products /orders /orders/  /payouts   /analytics
   itsnot.   →/apply    /kyc      /connect   /new      queue   [n]/ship             ranges
   techy.cloud
```

**Critical-path coverage:** ◐ — Phase 1 closes the gaps (storefront edit, KYC upload, on-domain Stripe + product wizard + orders + payouts + analytics).

## 4.3 Admin journey (target end-state)

```
   Login ─▶ Triage ─▶ Approve ─▶ Moderate ─▶ Resolve ─▶ Audit
      │         │           │            │              │           │
      │         │           │            │              │           │
   /login   /dashboard   /sellers    /dashboard   /tickets/[n] /audit
                         /[id]      /ads          /returns/[n]
                         (KYC)      /products
                                   /approvals
```

**Critical-path coverage:** ✓ for users, sellers, orders, tickets, approvals; ✗ for KYC review (Phase 2), audit search (Phase 2), webhook inspection (Phase 2), system health (Phase 2).

## 4.4 Money flow (lifecycle)

```
T=0     Buyer pays   ──▶ Onsective Stripe balance
T=0     payment_intent.succeeded ──▶ LedgerEntry posted (commission frozen at OrderItem)
T+0     OrderItem.status = PAID
T+1d    Seller ships ──▶ Shipment.status = IN_TRANSIT
T+5d    EasyPost webhook ──▶ Shipment.status = DELIVERED
T+7d    Return window closes ──▶ Payouts worker eligible
T+8d    Hourly cron runs ──▶ stripe.transfers.create() to seller
T+10d   Stripe ACH lands  ──▶ payout.paid webhook ──▶ Payout.status = PAID
```

**Disputes:** if `charge.dispute.created` fires before T+8d, the seller payable is held. After T+8d, the dispute is debited from the seller's next payout (this part needs hardening in Phase 5).

---

# 5. Phased Roadmap

Each phase is sized to ship in one deploy. Phases are designed so a partial completion still leaves the system in a working state.

## Phase 0 — Stabilization (today, ~30 minutes)

**Goal:** kill all current 404s, dead links, and routing bugs so the system feels coherent end-to-end.

**Scope:**
- Fix CloudPanel reverse-proxy URLs for all three sites
- Bootstrap admin user via SQL (`admin@onsective.com` → OWNER)
- Add SPF, DKIM, and DMARC TXT records in Hostinger DNS for `onsective.com`
- Confirm all 6 PM2 processes online + restart-on-boot via `pm2 startup`
- Smoke-test signup, 2FA, login, password reset on each surface

**Out of scope:** anything that requires code changes.

**Dependencies:** none.

**Deliverables:**
1. CloudPanel reverse-proxy URLs map cleanly: web→3000, console→3001, seller→3002
2. DNS records published and verified via `dig` / mxtoolbox
3. PM2 systemd unit installed; survives reboot
4. Admin user can log in to console

**Success criteria:** every documented URL returns 200 or 307; emails to Gmail land in inbox, not spam.

## Phase 1 — Seller portal feature parity (1 deploy, ~6 hours)

**Goal:** `seller.itsnottechy.cloud` is fully self-contained. Zero cross-domain links. The legacy `/[locale]/seller/*` routes on the buyer app are deleted.

**Scope:**
1. Move into `apps/seller/dashboard`:
   - `/products` (list + 5-step wizard)
   - `/orders` (list + per-order detail)
   - `/payouts` (ledger view)
   - `/analytics` (charts + range picker)
   - `/onboarding/return` and `/onboarding/refresh` (Stripe Connect callback URLs)
2. Add `/dashboard/storefront` — edit form for legalName, displayName, description, country, tax id, logo
3. Add `/dashboard/kyc` — upload form for KycDocument with five doc types
4. Add `/dashboard/connect` — Stripe Connect Express button
5. Build a tRPC client + provider for `apps/seller`
6. Delete `apps/web/src/app/[locale]/seller` and `apps/web/src/app/[locale]/sell`
7. Update Stripe Connect return / refresh URL constants to seller subdomain

**Out of scope:** any work in Phase 2+.

**Dependencies:** Phase 0.

**Deliverables:**
1. New seller signs up, fills profile, uploads KYC, gets approved, connects Stripe, lists a product, sees an order — all without leaving `seller.itsnottechy.cloud`
2. Buyer site has zero links to `/seller/*`
3. tRPC subset (`auth`, `seller`, `me`) wired to seller app

**Success criteria:** end-to-end seller flow works on the seller subdomain alone.

## Phase 2 — Console gap-filling (1 deploy, ~5 hours)

**Goal:** admins can run the platform from the console without ever needing SQL.

**Scope:**
1. KYC review UI on `/dashboard/sellers/[id]` — list KycDocument rows, per-doc approve/reject buttons, bulk approve seller
2. Returns workflow buttons on `/dashboard/returns/[id]` — wire 4 server actions (approve, reject, mark-received, mark-refunded) that already exist
3. Audit log search at `/dashboard/audit` — search by actor, action, date range, target id; pagination
4. Webhook event inspector at `/dashboard/webhooks` — viewer, retry-failed, mark-resolved
5. System health at `/dashboard/health` — Postgres latency, Redis ping, BullMQ queue depths, worker last-heartbeat
6. Seller management actions — change commission %, force-disconnect Stripe, reactivate from suspended
7. Ticket SLA breach indicators

**Dependencies:** Phase 0.

**Deliverables:** all six pages above, all buttons wired and audited.

**Success criteria:** PM can run the platform for one week without SSH-ing in.

## Phase 3 — Buyer site completion (1 deploy, ~6 hours)

**Goal:** every link on the buyer site goes somewhere real. Mobile menu works.

**Scope:**
1. Build missing pages:
   - `/categories` — full grid
   - `/deals` — products with `mrpAmount > priceAmount`, sorted by % off
   - `/best-sellers` — order by `_count.orderItems`
   - `/trending` — last-24h order-frequency leaderboard
   - `/track/[orderNumber]` — guest-accessible (email-protected)
   - `/account/addresses` — CRUD on the existing `Address` model
   - `/account/wishlist` — Wishlist model + item add/remove
2. New `Wishlist` schema + tRPC endpoints
3. Search filters — price range, category, brand, seller rating
4. Mobile menu (hamburger sheet)
5. Hindi translations completed
6. Empty-state polish

**Dependencies:** Phase 0.

**Deliverables:** seven new pages, one new schema, complete translation file.

**Success criteria:** open the site on a phone, click every nav item, never hit 404.

## Phase 4 — Catalog seeding + image pipeline (1 deploy, ~4 hours)

**Goal:** marketplace doesn't look dead. Real-feel browsing experience pre-launch.

**Scope:**
1. Provision real S3 bucket (`onsective-products`) + CloudFront distribution + OAC
2. Wire image variants worker to actually run (sharp pipeline coded; needs to enqueue on real upload)
3. Seed script with 4 demo seller accounts and 80 products distributed across 8 categories with Unsplash images
4. Realistic prices, descriptions, ratings (50-2000 reviews), variant data
5. Mark all demo data with `isDemo: true` flag — wipeable before launch
6. Demo sellers excluded from real Stripe transfers

**Dependencies:** AWS account; S3 credentials.

**Deliverables:** S3 + CloudFront live, seed script committed, 80 demo products visible.

**Success criteria:** load `itsnottechy.cloud/category/electronics` and see 10+ realistic products with images, ratings, prices.

## Phase 5 — Production money infrastructure (2-3 days, blocked on external services)

**Goal:** ready to take real money from real buyers.

**Scope:**
1. Stripe live mode — switch all `STRIPE_*_KEY` env vars from test to live; Stripe Connect Express live; Stripe Tax enabled; webhook endpoint registered with all events from DEPLOY.md §7
2. EasyPost real account — pay for an account, set live API key + webhook secret, register webhook
3. Email — choose between AWS SES (better deliverability) or stay on Hostinger with full SPF / DKIM / DMARC
4. TLS auto-renewal — confirm Let's Encrypt certbot cron is running
5. Postgres backups — `pg_dump` to S3 daily via cron + restore drill
6. Monitoring — Sentry DSN set in production env, UptimeRobot pinging the app
7. `/api/health` endpoint — returns 200 if Postgres, Redis, and queue workers are healthy
8. Rate limit hardening — apply `publicReadRateLimit` to all catalog reads
9. Live-key dispute handling — verify `charge.dispute.created` flow against real Stripe sandbox

**Dependencies:** Phase 0-4 complete; legal entity (Onsective LLC or similar) registered; bank account for Stripe payouts.

**Deliverables:** real $50 order placed by real buyer, shipped, delivered, paid out — fully hands-off.

**Success criteria:** ten test orders processed end-to-end; books balance; Stripe reconciliation report matches LedgerEntry totals.

## Phase 6 — Trust & safety v1 (1-2 days)

**Goal:** can survive a determined troll and pass a basic security audit.

**Scope:**
1. 2FA recovery codes — 10 single-use codes shown after enabling 2FA
2. SMS OTP via Twilio — for users without email access
3. GDPR data export at `/account/privacy` — JSON dump emailed
4. Account deletion flow — proper hard-delete with PII purge after 30-day grace
5. Cookie consent banner for EU visitors (geolocate by countryCode)
6. Privacy policy + Terms of Service pages — boilerplate templates, real legal review before launch
7. Suspicious-login lockdown — 3 different IPs failing on same email in 1h = 24h lock
8. Reverse-proxy security headers — CSP, HSTS, frame-ancestors

**Dependencies:** Twilio account, real legal review.

**Deliverables:** all eight items shipped + signed legal docs.

**Success criteria:** external security review finds no P0; OWASP Top 10 checklist clean.

## Phase 7 — Reviews, Q&A, ratings (2-3 days)

**Goal:** social proof on every product detail page.

**Scope:**
1. Buyer can leave a review after order DELIVERED
2. Seller can respond to reviews
3. PDP shows aggregate rating, distribution chart, recent reviews
4. Verified-purchase badge
5. Q&A section on PDP — buyer asks, seller answers
6. Console moderation queue for review reports
7. Search results show rating star + count

**Dependencies:** Phase 4 (real catalog).

**Deliverables:** Review and Question / Answer schemas + UI; review-prompt email template.

**Success criteria:** buyer who placed three orders sees three review-prompt emails after delivery and can leave reviews.

## Phase 8 — Performance + scale prep (1 week)

**Goal:** site stays fast as catalog grows from 80 to 80,000 products.

**Scope:**
1. OpenSearch turn-up — provision cluster, run `pnpm reindex:search`, switch from Postgres FTS
2. CDN — Cloudflare in front of `itsnottechy.cloud`
3. DB indexes audit — `EXPLAIN ANALYZE` 10 slowest queries
4. N+1 detection — Prisma `$on('query')` logging, fix worst offenders
5. Image lazy loading + AVIF — `next/image` everywhere
6. Bundle-size audit — `@next/bundle-analyzer`
7. Lighthouse CI — gate on PRs

**Dependencies:** Phases 4-7.

**Deliverables:** Lighthouse Performance > 90 on home + PDP; p99 server response < 300ms.

**Success criteria:** k6 load test passes 100 RPS sustained.

## Phase 9 — Launch readiness (1 week)

**Goal:** ready for first 100 real customers.

**Scope:**
1. Load test — k6 with 100 concurrent users, find breaking point
2. Status page at `status.onsective.com` (UptimeRobot or BetterStack)
3. On-call rotation + PagerDuty integration with Sentry
4. Real customer support — `help@onsective.com` → Tickets workspace
5. Documentation site at `docs.onsective.com`
6. Refund / return / shipping policy pages
7. First 10 sellers manually onboarded (white-glove)
8. Beta-launch announcement — Product Hunt, ads, social

**Dependencies:** Phases 5-8.

**Deliverables:** first real order placed, shipped, delivered, paid out without manual intervention.

**Success criteria:** 100 sellers onboarded in week one without on-call paging more than once per day.

## Phase 10 — Growth surface (ongoing)

**Goal:** scale from 10 to 1000 sellers.

**Scope:** Onsective Prime subscription, sponsored ads UI + reporting, mobile apps (PWA + Capacitor), affiliate / referral program, marketing automation, B2B sales (NET_30 invoicing already schema'd).

**Dependencies:** Phase 9.

**Deliverables:** post-launch product roadmap.

**Success criteria:** retention curves stabilize; >40% of new sellers list a product within 7 days of approval.

---

# 6. Risk Register

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Email delivery (Gmail spam) | High | High | Phase 0 SPF/DKIM/DMARC; Phase 5 SES migration |
| R2 | Stripe account suspension | Low | Critical | Maintain compliance; have backup processor (Adyen) plan |
| R3 | Postgres data loss | Low | Critical | Phase 5 daily backups + restore drill |
| R4 | Seller fraud (stolen cards used to buy own products) | Medium | Medium | Stripe Radar; manual review on first 10 orders/seller |
| R5 | Buyer chargeback abuse | Medium | Medium | 7-day return-window hold; require photo evidence on returns |
| R6 | DDoS | Low | High | Phase 8 Cloudflare; rate limits already wired |
| R7 | Tax compliance (GST/VAT/sales) | Medium | High | Phase 5 Stripe Tax; consult tax counsel pre-launch |
| R8 | Image hosting costs balloon | Low | Medium | CloudFront + S3 lifecycle policy (Phase 8) |
| R9 | OpenSearch cluster outage | Medium | Medium | Postgres FTS fallback already coded |
| R10 | Founder bus factor | Always | Critical | Documentation; runbook; CI/CD |
| R11 | EU GDPR fine | Low | High | Phase 6 data export + deletion + cookie consent |
| R12 | Stripe payout reversal mid-flight | Low | High | Idempotency keys on every transfer (already wired) |

---

# 7. Appendices

## Appendix A — Environment variable reference

| Variable | Required | Purpose | Example |
|---|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection | `postgresql://onsective:****@127.0.0.1:5432/onsective` |
| `REDIS_URL` | Yes | BullMQ + rate limit | `redis://127.0.0.1:6379` |
| `SESSION_SECRET` | Yes | Cookie signing | 32-byte hex |
| `STRIPE_SECRET_KEY` | Yes | Stripe API | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Yes | Webhook signature | `whsec_...` |
| `STRIPE_PUBLISHABLE_KEY` | Yes | Stripe Elements client | `pk_live_...` |
| `WEBAUTHN_RP_ID` | Yes | Passkey domain | `itsnottechy.cloud` |
| `WEBAUTHN_ORIGIN` | Yes | Passkey origin | `https://itsnottechy.cloud` |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | Yes | Outbound email | `smtp.hostinger.com` |
| `EMAIL_FROM` | Yes | Sender address | `donotreply@onsective.com` |
| `S3_BUCKET_PRODUCTS` | Phase 4+ | Image storage | `onsective-products` |
| `EASYPOST_API_KEY` | Phase 5+ | Carrier rates | `EZAK...` |
| `OPENSEARCH_URL` | Phase 8+ | Search cluster | `https://search.onsective.com` |
| `SENTRY_DSN` | Phase 5+ | Error tracking | `https://...@sentry.io/...` |
| `CONSOLE_IP_ALLOWLIST` | Phase 6+ | Console access | `1.2.3.4,5.6.7.8` |

## Appendix B — Critical tRPC routers

| Router | Procedures | Purpose |
|---|---|---|
| auth | signup, login, verifyTwoFactor, requestPasswordReset, resetPassword, logout, passkeys.* | Account lifecycle |
| me | profile, addresses | Buyer self-service |
| catalog | categories.tree, products.byCategory, products.bySlug, search | Browse |
| cart | get, addItem, updateQty, removeItem | Cart state |
| checkout | summary, placeOrder | Checkout |
| order | byNumber, list | Buyer orders |
| seller | application.apply / status, dashboard.summary, products.*, orders.*, connect.*, uploads.*, analytics.* | Seller surface |
| admin | sellers.approve / reject, products.approve | Console actions |
| organizations | my, create, members, invite, removeMember, currentExemption | B2B |
| prime | status, startCheckout, cancel | Membership |
| ads | campaigns.*, buildSlate, trackImpression, trackClick | Sponsored ads |
| returns | list, request, cancel | Returns |

## Appendix C — Deployment runbook (current)

### One-time bootstrap

1. **As root:** `apt install postgresql-16 redis-server libvips-dev`; install Node 20, pnpm 9, pm2
2. **As root:** `sudo -u postgres psql -c "CREATE USER onsective WITH PASSWORD '...';"`; `CREATE DATABASE onsective OWNER onsective;`
3. **CloudPanel UI:** create three Reverse Proxy sites (web→3000, console→3001, seller→3002)
4. **DNS:** A records for apex, console, seller subdomains
5. **As site user:** `git clone`, write `.env`, symlink into each app + db package, `pnpm install`, `pnpm db:generate`, `pnpm db:deploy`, `pnpm db:seed`, `pnpm build`
6. **As site user:** `pm2 start ecosystem.config.js`, `pm2 save`
7. **As root:** `pm2 startup systemd -u <site-user> --hp /home/<site-user>`
8. **CloudPanel UI:** SSL/TLS → Let's Encrypt for each site
9. **SQL:** promote one user to OWNER

### Per-deploy

```
git pull origin main
set -a; source .env; set +a
pnpm install
pnpm db:generate
pnpm --filter @onsective/db run deploy
pnpm build
pm2 restart all --update-env
```

## Appendix D — Schema highlights

**User (with Phase 0+ security):** `id, email, emailVerified, passwordHash, fullName, locale, countryCode, roles[], status, twoFactorEmail, failedLoginAttempts, lockedUntil, lastLoginIp, lastLoginUserAgent, lastLoginAt, deletedAt, ...`

**Seller:** `id, userId, legalName, displayName, slug, description, countryCode, taxId, status (PENDING_KYC|KYC_SUBMITTED|APPROVED|SUSPENDED|REJECTED), stripeAccountId, stripePayoutsEnabled, defaultCommissionPct, allowedDestinationCountries[], approvedAt, approvedBy, ...`

**Product:** `id, sellerId, categoryId, slug, title, description, brand, status (DRAFT|PENDING_REVIEW|ACTIVE|REJECTED|ARCHIVED), images[], variants[], hsCode, originCountryCode, ...`

**Order:** `id, orderNumber, buyerId, status, totals (sub/tax/shipping/discount/grand), currency, organizationId?, b2bInvoiceId?, taxExempt, ...`

**OrderItem:** `id, orderId, sellerId, productId, variantId, qty, priceAmount, mrpAmount, commissionPctBps (frozen here), status (CREATED|PAID|CONFIRMED|SHIPPED|DELIVERED|RETURNED|REFUNDED|CANCELLED), ...`

**LedgerEntry:** `id, postedAt, accountType (MERCHANT_RECEIVABLE|PLATFORM_REVENUE|SELLER_PAYABLE|SELLER_PAID|GATEWAY_FEE|REFUND|...), debitMinor, creditMinor, currency, sellerId?, orderItemId?, refundId?, payoutId?, paymentId?, metadata` — every set must balance (sum DR = sum CR).

**Payout:** `id, sellerId, periodStart, periodEnd, amountMinor, currency, status (PENDING|IN_TRANSIT|PAID|FAILED), stripeTransferId, ledgerEntries[]`

**KycDocument:** `id, sellerId, type (GOVT_ID|TAX_CERTIFICATE|BANK_STATEMENT|BUSINESS_REGISTRATION|ADDRESS_PROOF), status (PENDING|APPROVED|REJECTED), fileKey, ...`

## Appendix E — Quick reference

**Surfaces and ports**

| Surface | Domain | Port | App |
|---|---|---|---|
| Buyer | itsnottechy.cloud | 3000 | apps/web |
| Console | console.itsnottechy.cloud | 3001 | apps/console |
| Seller | seller.itsnottechy.cloud | 3002 | apps/seller |

**PM2 processes (6 total)**

`web`, `console`, `seller`, `worker-payouts`, `worker-images`, `worker-search-index`

**Cron schedule**

| Job | Frequency | Command |
|---|---|---|
| Payouts sweep | Hourly UTC | enqueued via BullMQ repeatable |
| Ads daily reset | Hourly UTC | `pnpm cron:ads-reset` |
| Search reindex | Manual | `pnpm reindex:search` |

---

# End of document
