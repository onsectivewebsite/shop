# Architecture Decision Records (ADRs)

> An ADR captures **one decision, the alternatives we considered, and why we chose what we chose**. Future-you (and future hires) will revisit these. They are append-only — supersede with a new ADR rather than editing.

Format: each ADR has Status, Context, Decision, Consequences, Alternatives.

---

## ADR-001 — Modular Monolith over Microservices for v1

**Status:** Accepted  ·  2026-04-26

### Context
- 5-engineer team, greenfield, 6-month MVP target.
- Marketplace has clearly bounded domains: catalog, orders, payments, shipping. Microservices look natural on paper.
- Microservices add operational cost (k8s, service mesh, distributed tracing, eventual-consistency bugs) that doesn't pay off at low scale.

### Decision
Single Next.js + tRPC application deployed as one service on AWS ECS Fargate. Internal modular boundaries (`packages/catalog`, `packages/orders`, etc.) enforce separation. Shared Postgres database with logical schemas per module.

### Consequences
- Faster development; atomic transactions across modules.
- One deploy unit, one observability stack.
- Risk: module boundaries erode — mitigate via dependency-cruiser config in CI rejecting cross-module imports outside declared interfaces.
- Migration path: when one module needs independent scaling (likely shipping or search first), extract by replacing the in-process import with an HTTP/gRPC client. Module-internal APIs are already typed, so the move is mechanical.

### Alternatives considered
- **Microservices day 1** — rejected; overhead too high.
- **Single Express monolith** — rejected; tRPC + Next.js gives end-to-end types and SSR for free.
- **Serverless functions** — rejected; cold starts hurt PDP, function-per-route fragments state, hard to control runtime budget.

---

## ADR-002 — Stripe Connect Express for global payments

**Status:** Accepted  ·  2026-04-26

### Context
- Onsective is worldwide; v1 anchors are US + India.
- Marketplace requires split payments to multiple sellers from a single buyer charge.
- Sellers need KYC compliance for each country.

### Decision
**Stripe Connect Express** as the single payment + payout rail. Buyer is charged in their local presentment currency; seller receives in their settlement currency. We use the **Separate Charges and Transfers** pattern (not destination charges) to support multi-seller carts.

### Consequences
- Single integration covers 46 payout countries, 140 charge countries.
- Stripe handles seller KYC ("Stripe Identity"), 1099-K filing in US, and GST/VAT calculation via Stripe Tax.
- Cost: ~2.9% + $0.30 (US), ~2% (India), plus ~0.5% Connect fee. Acceptable v1.
- Lock-in risk: payment data migration is painful. Accept it; 99% of marketplaces stay on their first gateway.
- Razorpay would be cheaper in India but adds a second gateway = ledger complexity. Defer until India volume justifies (>$1M GMV/mo from India).

### Alternatives considered
- **Razorpay Route + Stripe Connect (dual)** — rejected for v1; revisit when India volume warrants.
- **PayPal Marketplaces** — rejected; weaker DX, less coverage in India.
- **Hyperswitch / Adyen / Mangopay** — rejected; smaller ecosystem, slower onboarding.
- **Build payouts ourselves via direct bank rails** — rejected; KYC + sanctions screening cost > Stripe's fee.

---

## ADR-003 — Separate Charges and Transfers for multi-seller cart

**Status:** Accepted  ·  2026-04-26

### Context
A single buyer cart can contain items from multiple sellers. Stripe offers two patterns:

1. **Destination charges** — single PaymentIntent specifies one connected account as destination; platform fee deducted; rest goes to seller. Limit: one destination account per charge. Doesn't fit multi-seller.
2. **Separate charges and transfers** — charge buyer to platform account; later issue Transfer per seller from platform balance.

### Decision
**Separate charges and transfers.** Charge the buyer once to Onsective's platform account. After capture, run our own ledger calculation. Issue Stripe Transfer to each seller's connected account asynchronously (T+N after delivery + return window).

### Consequences
- Money sits on platform balance briefly (regulatory implications: in some jurisdictions this could be considered "stored value" — verify with counsel).
- Refunds and partial refunds are easier — we own the source of truth.
- We are responsible for the ledger; Stripe is bookkeeping the bank account, but our DB is the source of truth on who-owes-whom.
- Buyer sees one charge from Onsective on statement (better CX than multi-seller charges).
- Chargeback comes to platform; we handle reclaim from seller.

### Alternatives considered
- **One PaymentIntent per seller in cart** — rejected; multiple charges on buyer statement is bad UX, multiple SCA challenges, partial-success failure modes are awful.
- **Destination charges with on_behalf_of for one seller, then transfers for the rest** — rejected; too clever, hard to reason about, especially for refunds.

---

## ADR-004 — Money as integer minor units + ISO currency code

**Status:** Accepted  ·  2026-04-26

### Context
Floating-point money is the most expensive bug class in commerce. `0.1 + 0.2 ≠ 0.3` in IEEE 754. Even decimal types are subtle (rounding modes, locale differences). Going worldwide makes this worse: JPY has no minor units, BHD has 3, KWD has 3.

### Decision
- Store every monetary amount as **`(amount: int, currency: ISO 4217 string)`**.
- `amount` is in **smallest currency unit** ("minor units"): cents for USD, paise for INR, no division for JPY (which has no minor unit).
- Database column type: `INTEGER` (not numeric, not decimal).
- A shared `Money` value-object enforces operations: never add cross-currency without explicit conversion via stored FX rate.
- Display formatting is a render-time concern only; raw value never shown.

### Consequences
- Zero precision loss across all arithmetic.
- Tax + commission calculations done in integer math, deterministic across language/runtime.
- FX rates stored at point-of-event, not re-fetched (avoids non-determinism).
- More verbose code (`Money.from(1999, 'USD')` vs `19.99`) — accepted.

### Alternatives considered
- **Float / Number** — rejected; precision loss.
- **Postgres NUMERIC(20, 4)** — rejected; subtle conversion bugs at JS boundary.
- **String-based decimal lib (BigNumber.js)** — rejected; slower, requires careful serialization, JSON round-trips break.

---

## ADR-005 — Postgres FTS for v1 search; OpenSearch in Phase 4

**Status:** Accepted  ·  2026-04-26

### Context
v1 launches with thousands of products, not millions. Search is critical but premature investment in a search cluster adds ops burden.

### Decision
- v1: **Postgres tsvector + GIN index** with custom dictionary, weighted columns (title > brand > description). Trigram extension for typo tolerance.
- Phase 4: migrate to **OpenSearch** when (any of):
  - Product count > 200K
  - Search query latency p95 > 250ms
  - Need: synonyms, learning-to-rank, multi-language stemming, faceted aggregations Postgres can't keep up with

### Consequences
- One database to manage in v1.
- Search quality is "good enough" for early scale.
- Migration plan: write to both Postgres and OpenSearch during transition; cutover when query parity is verified.
- Risk: founder/PM has high search-quality expectations and pushes for OpenSearch early. Counter with metrics: ship Postgres FTS, measure CTR + bounce, only migrate when data justifies.

### Alternatives considered
- **OpenSearch / Elasticsearch from day 1** — rejected; ops overhead, cost, complexity.
- **Algolia** — rejected; cost scales fast at marketplace scale; vendor lock-in; but a reasonable choice for a smaller team. Reconsider if engineering bandwidth is constrained.
- **Typesense / Meilisearch** — viable; smaller community; reconsider in Phase 4 vs OpenSearch.

---

## ADR-006 — Single primary region + read replica; not multi-master

**Status:** Accepted  ·  2026-04-26

### Context
Worldwide product, anchor markets US + India. Latency between US-East and Mumbai is ~210ms. India users on a US-East primary will feel slow.

### Decision
- **Primary**: AWS RDS Postgres in `us-east-1` (single writer).
- **Read replica**: `ap-south-1` (Mumbai) for India read traffic.
- Application reads route based on user country: India users hit Mumbai replica; US users hit US-East primary directly.
- All writes go to US-East primary (replication lag ~50-200ms, acceptable for write-then-read patterns with read-after-write consistency on primary for the originating session).
- CDN (CloudFront) handles static assets globally.
- Object storage (S3) replicated to `ap-south-1` for hot product images.

### Consequences
- India read latency drops from ~250ms to ~30ms.
- Writes from India still pay cross-region cost (~210ms). For checkout, this matters; we accept it because checkout is rare per session.
- Operational complexity: one writer = simple. Ledger is single-region, single-source-of-truth.
- Failover: us-east-1 outage requires manual promotion of Mumbai replica. Document RTO/RPO; quarterly drill.

### Alternatives considered
- **Active-active multi-master** (Aurora Global, CockroachDB, Spanner) — rejected; complex, expensive, conflict resolution adds bugs. Revisit in Phase 5 if writes-from-India latency hurts conversion.
- **EU primary instead of US** — rejected; US is bigger anchor market.
- **Single region, accept India latency** — rejected; PDP load time directly hits conversion.

---

## ADR-007 — Carrier abstraction via adapter pattern; aggregator-of-aggregators

**Status:** Accepted  ·  2026-04-26

### Context
Worldwide shipping requires dozens of carriers. Direct integration with each is months of work and high maintenance. Aggregators (EasyPost, Shippo, Shiprocket) wrap many carriers behind one API but each aggregator has gaps (EasyPost weak in India; Shiprocket only India).

### Decision
Define a single internal **`CarrierAdapter` interface**. Implement adapters for:
- **EasyPost** (US, Canada, EU, parts of Asia)
- **Shiprocket** (India)
- **Self-fulfilled** (no-op; seller enters AWB manually)

Add **Shippo** or **Delhivery direct** as backups in Phase 3 — same interface, no app code changes.

The orchestrator (`ShippingService`) is region-aware: it routes to the preferred adapter for the seller's country, with fallbacks if rates are unavailable.

### Consequences
- App code never references a specific carrier. Switching carriers = config change.
- Same code path for all rate-shop, label-buy, tracking ingestion.
- One unified `ShipmentStatus` enum; each adapter normalizes its carrier-specific codes.
- Adding a new carrier is a 1–2 week task: implement the interface + tests; register in country routing.
- Risk: aggregators charge a margin on top of carrier rates. At >$50K/mo with one carrier, direct integration may pay off — track it; revisit in Phase 5.

### Alternatives considered
- **Direct integration with each carrier** — rejected; too much work for v1.
- **Use only one aggregator globally** — rejected; no aggregator covers India + US + EU well.
- **Build our own aggregator** — rejected; not the business.

---

## ADR-008 — Locale routing + ICU MessageFormat for i18n

**Status:** Accepted  ·  2026-04-26

### Context
Worldwide. Anchor markets need en-US, en-IN, hi-IN at minimum. Future: ar (RTL), zh, es, fr, de.

### Decision
- URL-based locale prefix: `/en/`, `/hi/`, `/ar/`. Default redirect based on `Accept-Language` + IP geo.
- **`next-intl`** (Next.js App Router-native) for runtime, **ICU MessageFormat** for the message catalog.
- Translations live in `apps/web/messages/{locale}.json`.
- All user-facing strings extracted; no hard-coded copy in components.
- Locale-aware number, date, currency, address formatting via `Intl.*`.
- RTL handled via Tailwind `dir-rtl` plugin; design tokens are direction-agnostic where possible (use `start/end` instead of `left/right`).

### Consequences
- Cost of i18n is paid up-front in component code (no later retrofit).
- Translations in v1: en-US, en-IN, hi-IN. Add ar/es/fr/de as those markets activate.
- Risk: machine-translated strings hurt conversion. Use professional translation for high-value pages (PDP, checkout, transactional emails); machine fine for help articles.

### Alternatives considered
- **Subdomain per locale** (`en.onsective.com`) — rejected; SEO and cookie scope harder.
- **react-intl** — viable but `next-intl` integrates better with App Router.
- **No i18n; English-only** — rejected; not viable for India anchor (Hindi expected).

---

## ADR-009 — tRPC for internal API, REST only for webhooks + public partner API

**Status:** Accepted  ·  2026-04-26

### Context
Single full-stack team, TypeScript end-to-end, Next.js app. Need: end-to-end type safety, DX, fast iteration. External: Stripe + carriers send REST webhooks.

### Decision
- **Internal API: tRPC** (with zod for input validation). All web app + admin app calls.
- **REST**: only for inbound webhooks (Stripe, EasyPost, Shippo, Shiprocket) and Phase 5 public Partner API (for ERP integrations like Unicommerce, Browntape).
- **GraphQL**: not used. Considered but not justified.

### Consequences
- Front-end gets autocompleted, type-safe API calls — huge DX win.
- Refactors propagate type errors instantly.
- Mobile app (Phase 4): React Native consumes tRPC fine. If we ship a non-TS native app later, switch to REST or generate OpenAPI from tRPC.
- Webhooks remain REST because senders are external.
- Partner API in Phase 5 is REST + OpenAPI for SDKs.

### Alternatives considered
- **REST + OpenAPI everywhere** — rejected; loses end-to-end types; more boilerplate.
- **GraphQL (Apollo)** — rejected; overkill for our scale; n+1 risk; tooling tax. Revisit if open-graph public API requested.
- **gRPC** — rejected; not browser-friendly without wrappers; type story is good but tRPC is just easier in TS.

---

## ADR-010 — Session cookies (signed) over JWT for browser auth

**Status:** Accepted  ·  2026-04-26

### Context
Auth across web (browser) and future mobile (React Native). Need: revocable sessions, CSRF protection, simple ops.

### Decision
- **Browser**: opaque session ID in HTTP-only, Secure, SameSite=Lax cookie. Backend has `Session` table (in `schema.prisma`). Sessions revocable instantly. CSRF via double-submit token.
- **Mobile (Phase 4)**: short-lived JWT access token + long-lived refresh token (server-side rotation, refresh-token reuse detection).
- **Connect-account / OAuth**: standard authorization code flow.

### Consequences
- Browser sessions are simple and revocable (kicking a logged-in attacker is one DB delete).
- No bearer-token leakage from XSS via JS-readable storage (cookies are HttpOnly).
- Slight DB load per request (session lookup) — cached in Redis with 60s TTL.
- Mobile gets token-based for offline-friendliness later.
- Refresh-token rotation = standard but requires care.

### Alternatives considered
- **JWT for browsers** — rejected; revocation is hard; if stored in localStorage it's XSS-vulnerable; if stored in cookies, you've reinvented sessions with worse tradeoffs.
- **Auth0 / Clerk / Cognito** — viable; cost grows fast at scale; reduces ops burden in v1. Reconsider if team is bandwidth-constrained.

---

## ADR-011 — BullMQ on Redis for jobs; defer Kafka

**Status:** Accepted  ·  2026-04-26

### Context
Need async jobs: payout calculation, webhook processing, label generation, email sends, search indexing, tracking polling. Many jobs need delays + retries.

### Decision
- **BullMQ** (Node-native, Redis-backed) for all async work in v1.
- Job classes per domain (`payouts`, `webhooks`, `notifications`, `shipping`).
- Idempotent handlers; deduplication via Redis SET on job key.
- Visualization via Bull Board admin route (admin-only).

### Consequences
- Same Redis we use for cache also runs queues — fine at our scale; split if either workload starves the other.
- BullMQ supports delayed jobs natively (perfect for "release payout T+7").
- Migration to Kafka / Kinesis is straightforward later — re-emit job-creation events to a stream; workers can subscribe to either.
- Risk: Redis is ephemeral by default; we configure AOF persistence + daily snapshot to preserve queue state.

### Alternatives considered
- **AWS SQS + Lambda** — viable; adds AWS-specific lock-in, cold starts, lambda timeouts limit long jobs.
- **Kafka** — rejected v1; ops overhead unjustified at our scale.
- **Temporal** — viable for complex workflows (e.g. multi-step shipping flows). Reconsider in Phase 5 if we have many long-running orchestrations.

---

## ADR-012 — Postgres Row-Level Security for multi-tenant data

**Status:** Accepted  ·  2026-04-26

### Context
Sellers must never see each other's orders, inventory, or financials. App-layer guards alone are fragile (one missed `where sellerId = ` in a query is a data leak).

### Decision
Use **Postgres RLS** on every multi-tenant table (`Product`, `OrderItem`, `Shipment`, `Payout`, `LedgerEntry`, etc.). Application sets `SET LOCAL app.current_seller_id = '<id>'` per transaction; RLS policies use that.

App-layer guards still in place (Prisma middleware) — defense in depth.

### Consequences
- Seller data isolation enforced by the database itself; bug in app code can't bypass it.
- Slight query overhead (RLS evaluation per row) — measured, acceptable.
- Migration: apply RLS gradually. Tables added in v1 get policies from day 1; backfill any later additions.
- Admin queries bypass RLS via `BYPASSRLS` role used only by admin/ops paths.

### Alternatives considered
- **App-layer-only** — rejected; one bug = data leak.
- **Schema per tenant** — rejected; doesn't scale to 10K+ sellers.
- **Database per tenant** — rejected; way overkill.

---

## ADR-013 — Domestic-only shipping in v1; cross-border deferred to Phase 4

**Status:** Accepted  ·  2026-04-26

### Context
Worldwide architecture, but cross-border shipping is its own multi-month problem: customs declarations, HS codes, DDP/DDU, duties calculation, returns, prohibited items, restricted destinations.

### Decision
- v1: hard-block sellers from listing in markets they don't operate in. US sellers ship to US buyers only; India sellers to India only.
- Schema and address model already supports cross-border; UI and rules block it.
- Phase 4 will add: HS code on every product, customs declaration generation, DDP at checkout (collect duties), restricted-item filters per destination, IOSS for EU.

### Consequences
- v1 shippable in 8 weeks instead of 16+.
- Buyers in India can only buy from Indian sellers. Smaller selection, accepted trade-off.
- Architecture flag: `crossBorderEnabled = false` in v1; flipping it in Phase 4 unlocks the work.

### Alternatives considered
- **Cross-border from day 1** — rejected; too risky, drags out launch.
- **Cross-border in some markets only** — rejected; complicates rules.

---

## ADR-014 — TypeScript strict + zod runtime validation everywhere

**Status:** Accepted  ·  2026-04-26

### Context
Prevent runtime errors caused by untrusted data (form input, webhook bodies, third-party API responses).

### Decision
- `tsconfig`: `strict: true`, `noUncheckedIndexedAccess: true`.
- All tRPC inputs use **zod**; schemas exported and reused for forms (via `react-hook-form` + `@hookform/resolvers/zod`).
- All webhook payloads parsed through zod before any business logic.
- Database results trusted (Prisma types are sound); env vars parsed via zod once at boot.

### Consequences
- Slightly more boilerplate (zod schema mirrors Prisma model in some places); generators (zod-prisma-types) eliminate the duplication.
- Runtime safety on every external boundary.
- Forms get free validation + types.

### Alternatives considered
- **Runtime checks only at API boundaries** — rejected; webhooks and forms are still external boundaries.
- **io-ts / yup** — viable; zod has best DX in this ecosystem.

---

## ADR-015 — Soft delete via `deletedAt` for audit-relevant entities only

**Status:** Accepted  ·  2026-04-26

### Context
Some data must be retained for legal/audit (orders, payments, ledger). Some is fine to hard-delete (cart items, sessions).

### Decision
- Soft delete (`deletedAt: timestamp`) on: `User`, `Seller`, `Product`, `Order`, `OrderItem`, `Shipment`, `Payment`, `Refund`, `LedgerEntry` (LedgerEntry never deleted, only marked obsolete via reversal entries).
- Hard delete on: `Cart`, `CartItem`, `Session`, `Otp`, `WebhookEvent` (after retention window).
- Prisma middleware filters `deletedAt IS NULL` automatically on common reads; admin queries can opt out.
- GDPR/DPDP "right to deletion": user request triggers a 30-day soft-delete + scheduled hard-delete of PII (replace name/email/phone with hashes; preserve order rows for accounting).

### Consequences
- Compliance with both audit and privacy rules.
- Risk of stale `deletedAt` filtering being forgotten — Prisma middleware enforces.
- Some queries get more complex (e.g. seller's "active" product count vs total).

### Alternatives considered
- **Hard delete everywhere** — rejected; loses audit trail; breaks foreign keys.
- **Soft delete everywhere** — rejected; cart and session bloat is real.

---

## ADR template (use for future decisions)

```markdown
## ADR-NNN — Title

**Status:** Proposed | Accepted | Superseded by ADR-XXX  ·  YYYY-MM-DD

### Context
What problem are we solving? What constraints?

### Decision
What did we choose, in one paragraph?

### Consequences
What changes? Trade-offs. Migration path.

### Alternatives considered
What did we look at and reject, and why?
```
