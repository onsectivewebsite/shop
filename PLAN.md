# Onsective — Multi-Seller Ecommerce Marketplace
## Master Plan (Phased, with Wire Diagrams)

> **Mission:** Build a multi-sided marketplace where sellers list, buyers buy, Onsective earns commission, and shipping is fully managed end-to-end.

---

## 0. Decisions To Lock Before Code

These are the questions that will shape every later decision. Answer these first.

| # | Question | Status | Decision |
|---|----------|--------|----------|
| 1 | Geography | ✅ | **Worldwide architecture; staged rollout** |
| 2 | Anchor markets for v1 launch | ✅ | **US + India** (largest English-speaking market + founder home base; covers Stripe + RBI compliance learning) |
| 3 | Categories v1 | ✅ | **General marketplace, broad categories** (fashion / electronics / home / books / beauty) — niche specialization deferred |
| 4 | Fulfillment model | ✅ | **Self-fulfilled only** in v1; Onsective-Fulfilled (FBA-style) is Phase 5 |
| 5 | Cross-border shipping | ✅ | **Domestic-only v1** (US sellers → US buyers, India sellers → India buyers). Cross-border deferred to Phase 4 |
| 6 | Apps | ✅ | **Web + PWA** v1; React Native apps in Phase 4 |
| 7 | Commission model | ✅ | **Category-tiered 8–15%** + payment-processing pass-through. No subscription fee for sellers in v1 (lowers acquisition friction) |
| 8 | Tech stack | ✅ | **Next.js 14 (App Router) + TypeScript + tRPC + Prisma + Postgres 16 + Redis + BullMQ** |
| 9 | Cloud | ✅ | **AWS** — `us-east-1` primary, `ap-south-1` read-replica for India latency. ECS Fargate + RDS + ElastiCache + S3 + CloudFront |
| 10 | Budget & timeline | ⚠️ | **Assumed**: 6-month MVP, 5-engineer team, ~$500K seed runway. Adjust if your reality differs |

> **Updated v1 recommendation (worldwide):** Architect global from day 1, **launch in 2 anchor markets** (suggest **US + India**, or **US + UK**), general categories, self-fulfilled only, **domestic-only shipping per seller** (defer cross-border to Phase 4), web + PWA, category-tiered 8–15% commission, **Stripe Connect (140+ countries)** + **EasyPost/Shippo (multi-carrier global)** + **Stripe Tax** for sales-tax/VAT/GST, Next.js + TS + Postgres on AWS multi-region (US-East primary, AP-South replica).

---

## 0.5 What "Worldwide" Actually Changes

Going global instead of India-first changes ~30% of the plan. Calling out the load-bearing changes so you see what you're signing up for:

### Payments
- **Stripe Connect** (Express accounts) instead of Razorpay Route. Covers 46+ countries for payouts, 140+ for charging.
- Multi-currency: store prices in seller's local currency, charge buyer in their currency, settle to seller in theirs. Stripe handles FX but takes a cut (~2%).
- Per-country KYC tiers (Stripe handles via "Stripe Identity" but you wire the UX).
- Card networks vary: India needs RBI-mandated tokenization, EU needs SCA/3DS2, US wants Apple Pay / Google Pay.

### Tax (the hardest part of worldwide)
- **US**: sales tax in 45+ states, each with its own rules + nexus thresholds. Use **Stripe Tax** or **TaxJar** or **Avalara**.
- **EU**: VAT, OSS scheme, IOSS for imports under €150, reverse charge for B2B.
- **UK**: separate from EU post-Brexit, own VAT.
- **India**: GST with HSN codes, e-invoicing for B2B above threshold.
- **Canada**: GST + provincial PST/HST.
- **Australia**: GST.
- **Marketplace facilitator laws** (US, EU, UK, AU): platform is liable for collecting & remitting tax on seller's behalf — *not optional*. Get a tax lawyer in each anchor market.

### Shipping
- No single carrier covers the world. Use an aggregator: **EasyPost** or **Shippo** (global) gives you USPS/UPS/FedEx/DHL + 100+ regional carriers via one API.
- **Cross-border is its own beast**: customs declarations, HS codes, DDP (you collect duties at checkout) vs DDU (buyer pays courier on delivery — kills CX). Recommend deferring cross-border to Phase 4.
- Returns are 3–5× harder cross-border. Domestic-only v1 is the sane call.

### Compliance / Privacy
- **GDPR** (EU/UK) — data export, right to deletion, DPO, cookie consent, processor agreements
- **CCPA/CPRA** (California) — similar, US-flavored
- **DPDP Act** (India, 2024) — consent, data localization for "significant" processors
- **LGPD** (Brazil), **PIPEDA** (Canada), **POPIA** (South Africa) — basically GDPR clones
- One unified privacy framework that's GDPR-compliant covers ~80% of the rest.

### i18n / l10n
- Multi-language (start with EN; add ES, FR, DE, HI, AR as you expand). Use ICU MessageFormat (`react-intl` / `next-intl`).
- RTL layouts for Arabic/Hebrew (Tailwind `dir-rtl` plugin).
- Locale-aware dates, numbers, currency, addresses (address forms differ wildly — US vs UK vs India vs Japan).
- Right-to-left URL routing (`/en/`, `/hi/`, `/ar/`).

### Architecture changes
- **Multi-region database** from day 1? Probably no — start single-region (us-east-1 or eu-west-1) with read replicas. Real multi-master only when latency hurts.
- **CDN with regional edges** is non-negotiable (CloudFront / Cloudflare).
- **Data residency** — India's DPDP and Russia/China laws may require local storage. Architect so user data *can* be partitioned by region without rewriting.
- **Currency-aware pricing**: every monetary amount is `(amount_minor, currency_iso)` — never a bare number. No exceptions, ever.

### Cold-start strategy (the one that kills global v1s)
- Don't try to acquire sellers in 50 countries simultaneously. **Pick 2 anchors. Get 100 sellers + real GMV in each. Then expand.**
- Network effects are local: an Indian buyer wants Indian sellers shipping in 3 days, not a US seller shipping in 3 weeks.

---

## 1. High-Level System Architecture

```
                              ┌──────────────────────────────────────┐
                              │            CDN / EDGE (CloudFront)   │
                              └───────────────────┬──────────────────┘
                                                  │
        ┌─────────────────────────────────────────┼───────────────────────────────────┐
        │                                         │                                   │
        ▼                                         ▼                                   ▼
┌───────────────┐                       ┌───────────────┐                   ┌───────────────┐
│  Buyer Web /  │                       │  Seller       │                   │  Admin /      │
│  PWA / Mobile │                       │  Dashboard    │                   │  Ops Console  │
└───────┬───────┘                       └───────┬───────┘                   └───────┬───────┘
        │                                       │                                   │
        └─────────────────────┬─────────────────┴─────────────────┬─────────────────┘
                              │                                   │
                              ▼                                   ▼
                      ┌───────────────────────────────────────────────────┐
                      │      API GATEWAY (REST + GraphQL, JWT auth)       │
                      └─┬──────┬───────┬────────┬─────────┬───────┬──────┘
                        │      │       │        │         │       │
                        ▼      ▼       ▼        ▼         ▼       ▼
                    ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐  ┌──────┐ ┌──────┐
                    │User │ │Cata-│ │Cart │ │Order│  │Pay-  │ │Ship- │
                    │Svc  │ │log  │ │/Chk │ │Svc  │  │ments │ │ping  │
                    └──┬──┘ └──┬──┘ └──┬──┘ └──┬──┘  └──┬───┘ └──┬───┘
                       │       │       │       │        │        │
                       ▼       ▼       ▼       ▼        ▼        ▼
                    ┌────────────────────────────────────────────────┐
                    │   POSTGRES (primary) · REDIS · S3 · OpenSearch │
                    └────────────────────────────────────────────────┘
                                          │
                                          ▼
                    ┌────────────────────────────────────────────────┐
                    │   EVENT BUS (SQS / Kafka)                      │
                    │   ↓ async workers                              │
                    │   • Payout settlement   • Email/SMS/Push       │
                    │   • Search indexer      • Webhook receiver     │
                    │   • Invoice generator   • Carrier poller       │
                    └────────────────────────────────────────────────┘
                                          │
                                          ▼
            ┌─────────────────┬───────────────────┬────────────────────┐
            │   PAYMENTS      │   SHIPPING        │   COMMS            │
            │  (Razorpay      │   (Shiprocket /   │   (SES / Twilio /  │
            │   Route /       │    Delhivery /    │    FCM)            │
            │   Stripe Connect│    Shippo /       │                    │
            │   for split)    │    EasyPost)      │                    │
            └─────────────────┴───────────────────┴────────────────────┘
```

**Core principle:** Build it as a **modular monolith** in v1 (single deploy, separate modules). Extract into services only when scaling pain forces it. Modules above are *logical* — same codebase.

---

## 2. Domain Model (ER-Style Wire Diagram)

```
┌─────────────┐ 1     * ┌─────────────┐ *     1 ┌─────────────┐
│   USER      │─────────│  ADDRESS    │─────────│   COUNTRY   │
│ id          │         │ id          │         │ iso2, name  │
│ email       │         │ user_id     │         └─────────────┘
│ phone       │         │ line1/2     │
│ role(buyer/ │         │ city/state  │
│  seller/    │         │ pin/zip     │
│  admin)     │         │ default?    │
└──────┬──────┘         └─────────────┘
       │ 1
       │
       │ 0..1
       ▼
┌─────────────┐ 1   * ┌──────────────┐ 1     * ┌──────────────┐
│   SELLER    │───────│   PRODUCT    │─────────│   VARIANT    │
│ id          │       │ id           │         │ id (SKU)     │
│ legal_name  │       │ title, slug  │         │ product_id   │
│ gstin/tax_id│       │ description  │         │ price        │
│ kyc_status  │       │ category_id  │         │ mrp          │
│ payout_acct │       │ brand        │         │ stock_qty    │
│ rating_avg  │       │ images[]     │         │ attrs(jsonb) │
└─────────────┘       │ status       │         │ weight,dims  │
                      └──────┬───────┘         └──────┬───────┘
                             │ *                      │ *
                             │                        │
                             ▼ 1                      ▼ *
                      ┌──────────────┐         ┌──────────────┐
                      │  CATEGORY    │         │ INVENTORY_LOG│
                      │ tree (parent)│         │ delta, reason│
                      └──────────────┘         └──────────────┘

┌─────────────┐ *   1 ┌──────────────┐ 1   * ┌──────────────┐
│    CART     │───────│    USER      │       │   ORDER      │
│ id          │       │ (buyer)      │       │ id           │
│ items[]     │       └──────────────┘       │ buyer_id     │
└─────────────┘                              │ status       │
                                             │ total_amount │
                                             │ tax, ship_fee│
                                             │ commission   │
                                             │ placed_at    │
                                             └──────┬───────┘
                                                    │ 1
                                                    ▼ *
                                             ┌──────────────┐ *  1 ┌──────────────┐
                                             │  ORDER_ITEM  │──────│   VARIANT    │
                                             │ id           │      └──────────────┘
                                             │ order_id     │
                                             │ variant_id   │
                                             │ seller_id    │  ◄── critical: every line owns a seller
                                             │ qty, price   │
                                             │ commission_pct│
                                             │ shipment_id  │
                                             └──────┬───────┘
                                                    │
                                                    ▼ 1
                                             ┌──────────────┐ 1  * ┌──────────────┐
                                             │  SHIPMENT    │──────│ TRACKING_EVT │
                                             │ id, awb      │      │ status, ts   │
                                             │ carrier      │      │ location     │
                                             │ status       │      └──────────────┘
                                             │ from/to_addr │
                                             │ label_url    │
                                             └──────────────┘

┌─────────────┐ 1  1 ┌──────────────┐ 1  * ┌──────────────┐
│   ORDER     │──────│   PAYMENT    │──────│   PAYOUT     │  ← seller ledger
│             │      │ gateway_ref  │      │ seller_id    │
│             │      │ amount       │      │ amount       │
│             │      │ status       │      │ status       │
│             │      │ split_done?  │      │ settled_at   │
└─────────────┘      └──────────────┘      └──────────────┘

┌─────────────┐ 1  * ┌──────────────┐
│   PRODUCT   │──────│   REVIEW     │
└─────────────┘      │ rating, body │
                     │ verified?    │
                     └──────────────┘
```

**Key invariants:**
- Every `order_item` records the seller and the commission % *at the time of sale* (immutable for accounting).
- `shipment` is per-seller per-order — one order can have multiple shipments.
- `payout` is its own ledger; never derive money from joins at runtime.

---

## 3. Phased Roadmap

### Phase 0 — Foundation (Weeks 1–2)
**Goal:** Get the rails laid before any feature code.

- Repo + monorepo or single app decision
- CI/CD (GitHub Actions → staging + prod)
- Postgres, Redis, S3 buckets provisioned
- Auth scaffolding (email/password + OTP via SMS)
- Logging (CloudWatch / Datadog), error tracking (Sentry)
- Feature flag system (LaunchDarkly or homegrown)
- Design system / component library (shadcn/ui or MUI)
- Legal: T&Cs, privacy policy, seller agreement drafts

**Exit criteria:** A "hello world" deploy goes from PR → staging → prod with one click.

---

### Phase 1 — MVP Marketplace (Weeks 3–10)
**Goal:** A buyer can find a product, buy it, and a seller gets paid. Bare minimum.

#### 1.1 Buyer side
- Sign up / login (email + OTP)
- Home page (hand-curated featured + categories)
- Category browse + search (Postgres full-text v1, OpenSearch later)
- Product detail page (PDP)
- Cart + checkout (single payment, multi-seller cart)
- Order history + order detail
- Cancel order (pre-shipment only)

#### 1.2 Seller side
- Seller signup → KYC upload (PAN/GSTIN/bank)
- Admin approves seller (manual in Phase 1)
- Seller dashboard:
  - Product CRUD (single product, single variant, then multi-variant)
  - Inventory + price update
  - Order list (only their items)
  - "Mark as shipped" with manual AWB entry (real carrier in Phase 3)
- Payout statement (read-only)

#### 1.3 Admin
- User management
- Seller approval queue
- Manual order interventions (refund, cancel)
- Commission rate config per category

#### 1.4 Payments (manual split first)
- Single Razorpay/Stripe charge to platform account
- Payout calculation runs nightly: sale − commission − tax − refund = seller payout
- Manual bank transfer initially (T+7 settlement)

**Exit criteria:** 10 friendly sellers + 50 friendly buyers transacting real money.

---

### Phase 2 — Commission Engine + Automated Payouts (Weeks 11–14)

**Wire diagram — money flow:**
```
Buyer pays ₹1000
        │
        ▼
┌──────────────────┐
│ Payment Gateway  │  (Razorpay / Stripe Connect)
│ ─ holds funds    │
└────────┬─────────┘
         │ webhook: payment.captured
         ▼
┌──────────────────────────────────────────────┐
│        ONSECTIVE LEDGER (atomic txn)         │
│                                              │
│  Order #123  total ₹1000                     │
│  ├─ Seller A item ₹600                       │
│  │   ├─ commission 10%   = ₹60   → platform │
│  │   ├─ payment fee 2%   = ₹12   → gateway  │
│  │   ├─ GST on commission       → govt      │
│  │   └─ net payable      = ₹528  → seller A │
│  └─ Seller B item ₹400 (similar split)       │
└──────────────────┬───────────────────────────┘
                   │
        On delivery + return-window expiry (T+7):
                   │
                   ▼
        ┌──────────────────────┐
        │ Trigger payout API   │ → Razorpay Route / Stripe transfer
        └──────────────────────┘
                   │
                   ▼
                Seller bank account
```

**What gets built:**
- Commission rules engine (category × seller-tier × promo overrides)
- Ledger service (double-entry, immutable)
- Auto-payout via Razorpay Route or Stripe Connect Express
- Seller invoice generation (GST/tax-compliant PDF)
- Refund flow with reverse ledger entries
- Buyer-side: tax invoice download

**Exit criteria:** Zero manual bank transfers; all settlements automated.

---

### Phase 3 — Shipping Management (Weeks 15–22)

This is the chunkiest phase. Shipping is where most marketplaces bleed.

**Wire diagram — order → delivery lifecycle:**

```
PLACED ──► PAID ──► SELLER_NOTIFIED ──► PACKED ──► PICKUP_SCHEDULED
                                                        │
                                                        ▼
                                                   IN_TRANSIT
                                                        │
                                                        ├──► OUT_FOR_DELIVERY
                                                        │           │
                                                        │           ▼
                                                        │       DELIVERED ──► COMPLETE (after T+7 return window)
                                                        │
                                                        ├──► RTO_INITIATED ──► RTO_DELIVERED  (return to seller)
                                                        │
                                                        └──► EXCEPTION (lost / damaged / address issue)
                                                                    │
                                                                    ▼
                                                              CLAIMS QUEUE
```

**Shipping subsystem wire diagram:**

```
┌────────────────────┐
│ Seller marks Ready │
└─────────┬──────────┘
          │
          ▼
┌────────────────────────────────────────────────┐
│  RATE-SHOPPING SERVICE                         │
│  Inputs: weight, dims, from-pin, to-pin, COD?  │
│  Calls: Shiprocket / Delhivery / Bluedart APIs │
│  Output: list of (carrier, service, ETA, cost) │
└─────────┬──────────────────────────────────────┘
          │ pick cheapest meeting SLA
          ▼
┌────────────────────────────────────────────────┐
│  CREATE SHIPMENT                               │
│  ├─ Generate AWB                               │
│  ├─ Generate label (PDF, 4×6)                  │
│  ├─ Generate manifest                          │
│  └─ Schedule pickup                            │
└─────────┬──────────────────────────────────────┘
          │
          ▼
┌────────────────────────────────────────────────┐
│  TRACKING POLLER (every 30 min)                │
│  + Carrier WEBHOOKS (push)                     │
│  Normalize → unified tracking events           │
│  Update SHIPMENT.status                        │
│  Emit event: shipment.delivered, .exception... │
└─────────┬──────────────────────────────────────┘
          │
          ▼
┌────────────────────────────────────────────────┐
│  DOWNSTREAM REACTORS                           │
│  • Buyer email/SMS on each milestone           │
│  • Buyer portal live timeline                  │
│  • Trigger payout-eligibility on delivered     │
│  • Open dispute on exception                   │
└────────────────────────────────────────────────┘
```

**What gets built:**
- Carrier abstraction layer (`CarrierAdapter` interface; Shiprocket adapter v1, Delhivery adapter v2)
- Rate-shopping API
- Shipment + label generation
- AWB / waybill management
- Pickup scheduling
- Tracking ingestion (webhooks + polling fallback)
- Buyer-facing tracking page (with map if API supports lat/lng)
- RTO (return-to-origin) handling
- Weight discrepancy reconciliation (carrier charges by their measured weight)
- COD reconciliation (cash collected by courier → remitted to platform → split to seller)
- Multi-warehouse + zonal pickup (seller has 2+ pickup addresses)

**Buyer tracking page wire:**

```
┌──────────────────────────────────────────────────────────┐
│  Order #ONS-2026-00123                                   │
│  ─────────────────────────────────────────────────────── │
│  Estimated delivery: Mon, 4 May 2026                     │
│                                                          │
│  ●━━━━━━━●━━━━━━━●━━━━━━━○─────────○                    │
│  Placed   Packed  Shipped  Out for   Delivered           │
│  26 Apr   27 Apr  28 Apr   delivery                      │
│                                                          │
│  Latest: "Package arrived at Mumbai sorting hub"         │
│  AWB: 1Z999AA10123456784  ·  Delhivery                   │
│                                                          │
│  [ View full timeline ]   [ Need help? ]                 │
└──────────────────────────────────────────────────────────┘
```

**Exit criteria:** 95%+ orders auto-shipped, label-printed, tracked, and delivered without ops intervention.

---

### Phase 4 — Trust, Discovery & Growth (Weeks 23–30)

- **Reviews & ratings** (verified-purchase only, photo upload, seller reply)
- **Search upgrade** to OpenSearch (typo tolerance, synonyms, filters, sort)
- **Recommendations** (collaborative filtering v1, "frequently bought together")
- **Wishlist + Save for later**
- **Coupons / promo engine** (% off, flat off, BOGO, first-order, seller-funded vs platform-funded)
- **Referrals** (give X get Y)
- **Buyer support** — ticketing, return RMA flow, dispute resolution
- **Seller analytics** — sales, returns, conversion, search-impression share
- **Notification center** (email + SMS + push, unified)
- **Mobile apps** (React Native if you went that route, or native)

---

### Phase 5 — Scale & Moats (Month 8+)

- **Onsective Fulfilled** (FBA equivalent): warehouse network, inbound, storage, pick-pack-ship
- **Onsective Prime** (subscription, free shipping, faster SLA)
- **Onsective Ads** (sponsored products on search/PDP — *highest-margin product the platform can build*)
- **Multi-region** (multiple countries, currencies, languages)
- **Seller financing / working capital loans** (data moat: you see their cashflow)
- **B2B marketplace** (bulk pricing, GST invoicing, net-30)
- **API platform** for ERP integrations (Unicommerce, Browntape connectors)
- **Fraud / risk engine** (velocity rules, device fingerprinting, ML scoring)

---

## 4. Critical User Flows

### 4.1 Buyer Journey (happy path)

```
 Discover ──► PDP ──► Add to Cart ──► Checkout ──► Pay
    │                    │                            │
    │                    │                            ▼
    ▼                    ▼                       Order Placed
  Search                Reviews                       │
  Categories            Q&A                           ▼
  Recommendations       Variants                  Notifications
                        Stock check               (email + SMS)
                                                      │
                                                      ▼
                                                 Track shipment
                                                      │
                                                      ▼
                                                 Delivered
                                                      │
                                                      ▼
                                            Review · Return · Reorder
```

### 4.2 Seller Journey

```
Sign up ──► KYC ──► Approval ──► Onboarding tour
                                       │
                                       ▼
                           ┌─── Add products (CSV / manual / API)
                           │
                           ▼
                       Listings live
                           │
                           ▼
                       Order received  ◄── notification
                           │
                           ▼
                       Pack + click "Ready" ──► Label auto-prints
                           │
                           ▼
                       Pickup ──► In transit ──► Delivered
                           │
                           ▼
                       Settlement (T+7 after delivery)
                           │
                           ▼
                       Bank credit  +  Tax invoice generated
```

### 4.3 Order State Machine

```
                     ┌───────────────────────────────┐
                     │                               │
   created ─► paid ─► confirmed ─► packed ─► shipped ─► delivered ─► completed
              │           │           │          │         │
              │           │           │          │         └──► returned ─► refunded
              │           │           │          └──► RTO ─► refunded
              │           │           └──► cancelled (by seller) ─► refunded
              │           └──► cancelled (by buyer) ─► refunded
              └──► failed ─► cancelled
```

---

## 5. Tech Stack (recommended v1)

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 14 (App Router) + TS + Tailwind + shadcn | SSR for SEO, fast |
| Mobile | React Native (Expo) — Phase 4 | Code reuse |
| API | Next.js API routes → tRPC, OR NestJS for stricter boundaries | Pick one, don't mix |
| DB | Postgres 16 + pgvector | One DB to rule them v1 |
| Cache / queues | Redis + BullMQ | Boring, works |
| Search | Postgres FTS → OpenSearch in Phase 4 | Defer complexity |
| Storage | S3 + CloudFront | Standard |
| Payments | **Stripe Connect Express** (worldwide) | 140+ countries, native split-payouts, KYC handled |
| Tax | **Stripe Tax** (or TaxJar/Avalara if scale demands) | Sales tax, VAT, GST in one API |
| Shipping | **EasyPost** or **Shippo** (global aggregators) | One integration → 100+ carriers globally |
| FX / Multi-currency | Stripe presentment + settlement currency | Buyer pays in local; seller paid in local |
| Email | AWS SES + React Email templates | Cheap |
| SMS / WhatsApp | Twilio (global) — fallback to MSG91 in India for cost | OTP + transactional, global reach |
| i18n | next-intl + ICU MessageFormat | Locale routing, pluralization, RTL |
| Observability | Sentry + Datadog or Grafana Cloud | Day 1 |
| CI/CD | GitHub Actions | Default |
| Hosting | AWS (ECS Fargate or EC2 + RDS) | Vendor your team knows |
| IaC | Terraform | Reproducibility |

---

## 6. Security & Compliance Checklist

- [ ] PCI-DSS SAQ-A — never touch card data; gateway tokenization only
- [ ] PII at rest encrypted (Postgres TDE / column-level for phone, address, tax IDs)
- [ ] Row-level security so seller A can never read seller B's orders
- [ ] Rate limiting on all public endpoints (per-IP + per-user)
- [ ] OWASP Top 10 review before launch
- [ ] **Tax compliance per anchor market** — US sales tax (Stripe Tax), EU VAT (OSS/IOSS), UK VAT, India GST e-invoicing — engage a tax lawyer/CA per market
- [ ] **Marketplace facilitator registration** in each US state where threshold is hit, EU OSS registration, UK VAT registration
- [ ] Seller agreement, T&Cs, privacy policy, refund policy, **per-jurisdiction localized versions** — lawyer-reviewed in each anchor market
- [ ] **GDPR/UK-GDPR**: data export endpoint, right-to-deletion, cookie consent banner (Cookiebot / OneTrust), DPO appointed if scale requires, ROPA documented
- [ ] **CCPA/CPRA**: "Do not sell my info" link, opt-out signal handling
- [ ] **DPDP Act (India)**: consent manager, breach notification within 72h
- [ ] **Data residency**: design so India/EU user data *can* be region-pinned later without rewrite
- [ ] **Sanctions screening** — block sellers/buyers from OFAC / UN sanctions lists (Stripe Connect does most of this for sellers; you handle buyers)
- [ ] Audit log on all admin actions (immutable, 7-year retention minimum, longer per jurisdiction)
- [ ] Backup: nightly full + WAL streaming, restore-tested quarterly, geographically replicated

---

## 7. KPIs to Instrument From Day 1

**Marketplace health**
- GMV, take rate, net revenue
- Active sellers, active buyers, repeat-buyer rate
- New seller activation rate (signup → first sale)

**Funnel**
- Search → PDP CTR
- PDP → ATC
- ATC → checkout → paid
- Checkout abandonment %

**Operations**
- Cancellation rate (seller-initiated vs buyer-initiated)
- RTO rate (target < 8%)
- On-time delivery %
- Time-to-ship (paid → handover-to-courier)
- Return rate by category

**Money**
- Average order value
- Commission realized vs invoiced
- Payout TAT (paid → seller bank)
- Refund rate, dispute rate

---

## 8. Risk Register (Top 10)

| # | Risk | Mitigation |
|---|------|------------|
| 1 | Catalog quality (sellers upload junk) | Required fields, image quality checks, category-specific schemas, manual review queue for first 50 listings per seller |
| 2 | Counterfeits / banned items | Brand-protection list, keyword blocklist, reactive takedown SLA |
| 3 | Fake reviews | Verified-purchase only, velocity limits, ML detection in Phase 4 |
| 4 | Payment fraud / chargebacks | Risk scoring, COD limits, address-mismatch flags |
| 5 | High RTO eats margins | COD limits, address verification, seller-paid RTO above threshold |
| 6 | Shipping carrier lock-in | Adapter pattern + rate-shop across ≥2 carriers from day 1 |
| 7 | Tax compliance | Engage CA/CPA early; auto-generate GST/sales-tax invoices |
| 8 | Cold-start (no buyers, no sellers) | Seed one side: onboard 50 hand-picked sellers + run paid acquisition for buyers in 1–2 cities only |
| 9 | Search relevance | Don't ship FTS as final; budget for OpenSearch + curated rankings |
| 10 | Data loss / outage | Daily restore drill, multi-AZ Postgres, blameless postmortems |

---

## 9. Suggested Team Composition (lean v1)

- 1 Product / Founder
- 2 Full-stack engineers (one leans backend)
- 1 Frontend specialist
- 1 Designer (contract OK after first 3 months)
- 1 Ops / Customer Support (hire when first paid orders flow)
- 1 Category / Seller-acquisition lead (hire when ready to scale sellers)

Total: 5–6 for first 6 months. Scale when GMV warrants.

---

## 10. Immediate Next Steps (this week)

1. **Lock the remaining decisions in §0** (8 still open) — geography is set to worldwide; pick anchor markets next.
2. Pick a name + buy domain (.com mandatory for worldwide; also country TLDs of your anchors: .in, .co.uk, etc.).
3. **Register the company in your home jurisdiction first.** Worldwide ≠ multinational entity day 1. A US Delaware C-corp or India Pvt Ltd is enough to start; you'll add subsidiaries as anchors mature.
4. Open Stripe **Atlas** (if US incorporation) or local equivalent — gets you bank account + Stripe Connect access.
5. Start **Stripe Connect** application + **Stripe Tax** activation (1–3 weeks for full approval).
6. Apply for **EasyPost** or **Shippo** merchant account.
7. **Tax counsel**: engage a lawyer/CA in each anchor market for marketplace facilitator obligations. Do not skip this.
8. Create the GitHub org, set up repo, CI scaffolding.
9. Wireframe the buyer + seller flows in Figma — design **with i18n in mind from frame 1** (variable text length, RTL safe).
10. Draft seller agreement + buyer T&Cs — lawyer-reviewed *per anchor market*.

---

## Appendix A — Folder Structure (monorepo, Phase 1)

```
onsective/
├── apps/
│   ├── web/              # Next.js — buyer + seller dashboards
│   └── admin/            # internal ops console
├── packages/
│   ├── db/               # Prisma schema + migrations
│   ├── api/              # tRPC routers (or NestJS modules)
│   ├── ui/               # shared components
│   ├── shipping/         # carrier adapters
│   ├── payments/         # gateway adapters + ledger
│   ├── catalog/          # product/category/search
│   ├── orders/           # order state machine
│   ├── notifications/    # email/sms/push
│   └── shared/           # types, utils, validators (zod)
├── infra/                # terraform
├── ops/                  # runbooks, dashboards-as-code
└── docs/                 # ADRs, this plan, API docs
```

## Appendix B — Companion documents

| File | Owns |
|---|---|
| `PHASE_DETAILS.md` | per-phase: features, UI/UX, color, security, T&S, support, admin, integrations, exit criteria |
| `PHASE1_SPRINTS.md` … `PHASE3_SPRINTS.md` | sprint-level ticket breakdown |
| `DESIGN_SYSTEM.md` | colors, typography, spacing, components, motion, accessibility, dark mode |
| `SECURITY.md` | threat model + per-phase security rollout |
| `CUSTOMER_SUPPORT.md` | multi-channel intake, ticketing, RMA, automation, feedback |
| `PLATFORM_MANAGER.md` | operational role + console + permissions + 4-eyes |
| `API_SURFACE.md` | full tRPC routers, error taxonomy, pagination |
| `WIREFRAMES.md` | every screen (buyer, seller, admin) |
| `ADRs.md` | architecture decision records |
| `schema.prisma` | database |

## Appendix C — Open Questions for Founder

1. Geography? India / US / global?
2. What categories are you most credible in?
3. Self-fulfilled only, or are you open to running warehouses (FBA-style)?
4. What's the available capital runway? Determines aggressive vs conservative phasing.
5. Do you have a co-founder with engineering background, or hiring all of it?
6. Any existing seller relationships you can lean on for cold start?

> Answer these and I'll convert this plan into concrete sprint tickets, a database schema (Prisma), and an architecture decision record (ADR) per major choice.
