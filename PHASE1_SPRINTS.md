# Phase 1 Sprint Breakdown — MVP Marketplace
## 8 weeks · 2-week sprints · 5 engineers (2 BE, 1 FE, 1 FS, 1 DevOps/lead)

> **Definition of done for Phase 1:** A real buyer in the US or India can find a product, pay for it via Stripe, get a delivery, and the seller gets a (manually-triggered) payout. No mocks. No "we'll fix that later" on money.

---

## Sprint 0 — Foundation (Week 1–2) · runs in parallel with Sprint 1

**Goal:** repo, infra, auth scaffolding so feature work can start cleanly.

| Owner | Ticket |
|---|---|
| DevOps | INFRA-001 — Provision AWS: VPC, RDS Postgres 16, ElastiCache Redis, S3, CloudFront |
| DevOps | INFRA-002 — Terraform repo with staging + prod environments |
| DevOps | INFRA-003 — GitHub Actions CI: lint, type, test, build, deploy on merge |
| DevOps | INFRA-004 — Sentry + Datadog (or Grafana Cloud) wired to staging |
| Lead | REPO-001 — Monorepo skeleton (pnpm + turbo); folder structure per `PLAN.md` Appendix A |
| Lead | REPO-002 — Next.js 14 app, Tailwind, shadcn/ui, next-intl |
| BE-1 | DB-001 — Prisma schema from `schema.prisma`; migration system; seed script |
| BE-1 | DB-002 — Postgres RLS policies for multi-tenant tables (seller-scoped) |
| BE-2 | AUTH-001 — Email/password signup + login; argon2 password hash |
| BE-2 | AUTH-002 — Email OTP via SES; phone OTP via Twilio |
| BE-2 | AUTH-003 — Session model, JWT or signed cookies, CSRF |
| FE-1 | UI-001 — Design system: tokens, base components (Button, Input, Card, Modal, Toast) |
| FS-1 | LEGAL-001 — i18n bootstrap: en-US, en-IN, hi-IN; locale routing |

**Sprint 0 exit:** `pnpm dev` boots a logged-in homepage in 2 locales on staging.

---

## Sprint 1 — Catalog & PDP (Week 3–4)

**Goal:** sellers can list a product, buyers can view it.

### Backend
- CAT-001 — Category tree CRUD + seed (10 top-level, 50 children)
- CAT-002 — Product create/update/list APIs (tRPC)
- CAT-003 — Variant CRUD with multi-currency price
- CAT-004 — Image upload: signed S3 URLs, max 8 images per product, server-side resize via Lambda
- CAT-005 — Product status state machine (DRAFT → PENDING_REVIEW → ACTIVE)
- CAT-006 — Postgres FTS index on product title + description + brand + keywords
- CAT-007 — Search API: query, filter (category, price range), sort (price, newness, sales)

### Frontend (buyer)
- BUY-001 — Home page: hero + category tiles + "trending" rail
- BUY-002 — Category listing page with filters
- BUY-003 — Search results page
- BUY-004 — Product detail page: image carousel, variant picker, price, stock badge, "Add to cart"
- BUY-005 — Reviews placeholder (real reviews in Phase 4 — show count + avg only)

### Frontend (seller)
- SEL-001 — Seller dashboard shell (sidebar, header, layout)
- SEL-002 — Product list (table, filters, status pills)
- SEL-003 — Product create wizard: basic info → variants → images → pricing → review
- SEL-004 — Product edit (single page)
- SEL-005 — Inventory quick-edit table

### QA / Ops
- QA-001 — Manual test plan for catalog flows
- ADMIN-001 — Internal admin: review pending products, approve/reject

**Sprint 1 exit:** seller adds a product through UI → admin approves → buyer sees it on home + can search for it.

---

## Sprint 2 — Cart, Checkout, Payment (Week 5–6)

**Goal:** money moves. End-to-end Stripe charge.

### Backend
- CART-001 — Cart model: get-or-create on add, merge guest cart on login
- CART-002 — Cart line item add/update/remove, qty validation against stock
- CART-003 — Multi-seller cart support — group items by seller in API response
- CHK-001 — Address CRUD; default address logic
- CHK-002 — Shipping fee calculator stub: flat per-seller fee in v1 (real rates in Phase 3)
- CHK-003 — Tax calculator integration: Stripe Tax API call at checkout
- CHK-004 — Order create: validates stock, reserves inventory, creates Order + OrderItems, returns clientSecret
- PAY-001 — Stripe PaymentIntent creation with `application_fee_amount` (commission) and `transfer_data[destination]` per seller — *wait, this only works for single-seller charges. For multi-seller cart use Separate Charges & Transfers pattern: one charge to platform, then Transfer per seller*
- PAY-002 — Stripe webhook handler: `payment_intent.succeeded` → mark Order PAID, emit event
- PAY-003 — Idempotency keys on all gateway calls
- PAY-004 — Webhook event dedup table (`WebhookEvent`)
- LEDGER-001 — Ledger entry creation on payment captured (debit BUYER_RECEIVABLE, credit PLATFORM_LIABILITY + PLATFORM_REVENUE + GATEWAY_FEES)

### Frontend (buyer)
- BUY-006 — Mini cart drawer + full cart page (group by seller)
- BUY-007 — Checkout: address picker, shipping method, payment (Stripe Elements), review, place order
- BUY-008 — Order confirmation page
- BUY-009 — Order history list + detail page (status timeline placeholder)

### QA / Ops
- QA-002 — Stripe test cards run-through: success, decline, SCA challenge, network error
- QA-003 — Multi-seller cart end-to-end test
- OPS-001 — Runbook: "what to do when a payment is captured but order didn't update"

**Sprint 2 exit:** real money transacted on staging with Stripe test mode; ledger balances. **Run a real $1 charge in prod with founder's card to validate.**

---

## Sprint 3 — Order Lifecycle, Shipping Stub, Payouts (Week 7–8)

**Goal:** sellers fulfill, buyers get tracked, sellers get paid.

### Backend
- ORD-001 — Order state machine module (state transitions, guards, event emission)
- ORD-002 — Buyer cancel order (only if status=PAID and no shipment)
- ORD-003 — Refund flow: full refund → Stripe Refund → reverse ledger entries → restore inventory
- SHIP-001 — Shipment model (already in schema); stub carrier adapter that just generates a fake AWB
- SHIP-002 — Seller "Mark as shipped" UI → creates Shipment, captures AWB + carrier name + tracking URL (manual entry in v1)
- SHIP-003 — Seller "Mark as delivered" stub (Phase 3 will replace with carrier webhooks)
- SHIP-004 — Auto-mark COMPLETED 7 days after delivered (cron job)
- PAY-005 — Payout calculation job (nightly cron): for each seller, sum LedgerEntries where account=SELLER_PAYABLE since last payout, group by currency
- PAY-006 — Payout creation via Stripe Transfer API; create Payout record + ledger entries
- PAY-007 — Stripe Connect onboarding: `account_links` flow → seller redirected to Stripe-hosted KYC

### Frontend
- BUY-010 — Order detail: real status timeline, cancel button, refund status
- BUY-011 — Tracking info display (AWB + link out to carrier — full tracking page in Phase 3)
- SEL-006 — Order list (incoming orders) with status filter
- SEL-007 — Order detail: items to ship, "Generate label" (Phase 3) / "Mark as shipped" (manual AWB)
- SEL-008 — Payouts page: history table, current balance per currency
- SEL-009 — Stripe Connect onboarding flow (button → redirect → return handler)

### Notifications
- NOTIF-001 — Email templates (React Email): order confirmation, shipped, delivered, refund initiated, payout sent
- NOTIF-002 — SMS via Twilio for: OTP, order shipped, delivered (anchor markets only)
- NOTIF-003 — Notification preferences table (opt-in/out per channel)

### Admin
- ADMIN-002 — Seller approval workflow: KYC docs view + approve/reject
- ADMIN-003 — Order intervention console: search, view, manually cancel, manually refund
- ADMIN-004 — Commission rule editor (Category × Seller × Country)

### Compliance
- COMPLIANCE-001 — Cookie consent banner (en-US default; en-IN respects DPDP)
- COMPLIANCE-002 — Privacy policy + T&Cs pages (lawyer-reviewed text)
- COMPLIANCE-003 — Data export endpoint (`/api/me/export` → JSON of all user data)
- COMPLIANCE-004 — Account deletion endpoint (soft-delete + scheduled hard-delete after 30d)

### Final hardening
- SEC-001 — Rate limiting (per-IP and per-user) on auth, search, checkout
- SEC-002 — OWASP scan via OWASP ZAP in CI
- SEC-003 — Penetration test by external vendor (5 days, scope: auth + checkout + admin)
- PERF-001 — Lighthouse score ≥ 85 on PDP and home
- PERF-002 — p95 API latency < 300ms; p99 < 800ms
- LAUNCH-001 — Soft launch to 10 sellers, 50 invited buyers in each anchor market

**Sprint 3 exit:** A real buyer in the US AND a real buyer in India each complete an order; both sellers get a Stripe Connect payout. Onsective collects commission. Pop the champagne.

---

## What's intentionally NOT in Phase 1

These are common cuts that founders try to put back in. Resist:

- ❌ Real carrier integration (manual AWB only — Phase 3 covers EasyPost)
- ❌ Reviews & ratings (Phase 4)
- ❌ Wishlist, save-for-later, recently-viewed (Phase 4)
- ❌ Coupons & promo codes (Phase 4)
- ❌ Recommendations / "related products" (Phase 4)
- ❌ Mobile apps (Phase 4)
- ❌ Multi-language beyond en-US, en-IN, hi-IN (Phase 4 onward)
- ❌ Cross-border (Phase 4)
- ❌ Returns RMA flow (Phase 3 — refund-only in v1; buyer ships back at own cost if seller agrees)
- ❌ Seller analytics dashboards (Phase 4)
- ❌ A/B testing framework (Phase 5)
- ❌ Sponsored ads (Phase 5)
- ❌ Onsective Fulfilled (Phase 5)

---

## Risks specific to Phase 1

| # | Risk | Mitigation |
|---|------|------------|
| 1 | Stripe Connect approval delay (1–3 weeks per country) | Apply Sprint 0; have founder's personal account approved first |
| 2 | Stripe Tax misconfiguration → wrong tax collected → liability | Hire tax counsel before launch; sandbox-validate every state/region |
| 3 | Multi-seller cart payment edge cases (one transfer fails after charge captured) | Use Separate Charges & Transfers, retry transfers idempotently, don't block on transfer failure |
| 4 | Inventory race conditions (two buyers checkout same last unit) | Reserve on cart-add with TTL; reconfirm at payment-intent creation; release on abandonment |
| 5 | Webhook replay / out-of-order delivery | Event dedup by externalId; status state machine rejects illegal transitions |
| 6 | Refund-after-payout (seller already paid) | Negative balance allowed on Stripe Connect; reclaim from next payout |

---

## Daily / Weekly cadence

- Daily 15-min standup
- Mid-sprint check-in (Wed of week 1) — adjust scope
- End-of-sprint demo + retro (Fri of week 2)
- One **dogfood Friday** per sprint: whole team buys & sells real products on staging

---

## Tooling checklist

- [ ] Linear or Jira for tickets
- [ ] GitHub for code + reviews
- [ ] Vercel preview links per PR (or AWS Amplify)
- [ ] Stripe Workbench bookmarked
- [ ] Postman/Insomnia collections versioned in repo
- [ ] Storybook for FE components
- [ ] Slack channels: `#eng`, `#alerts`, `#dogfood`, `#shipped`
