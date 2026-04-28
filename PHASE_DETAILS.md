# Onsective — Per-Phase Detailed Spec
## Features · UI/UX · Color & Layout · Security · Trust & Safety · Customer Support · Admin · Integrations

> **How to use this doc:** for each phase, this is the consolidated checklist. Cross-references to other docs:
> - `DESIGN_SYSTEM.md` — colors, typography, components
> - `SECURITY.md` — full threat model + per-phase security delta
> - `CUSTOMER_SUPPORT.md` — channels, RMA, automation
> - `PLATFORM_MANAGER.md` — PM role + console
> - `PHASE{N}_SPRINTS.md` — sprint-level ticket breakdown
> - `schema.prisma` — DB shape
> - `API_SURFACE.md` — tRPC contract
> - `WIREFRAMES.md` — every screen
> - `ADRs.md` — why each big decision

---

## Phase 0 — Foundation (Weeks 1–2)
**Goal:** the rails. Nothing customer-facing.

### Scope
- AWS infra (VPC, RDS, ElastiCache, S3, CloudFront, ECS, ALB)
- Terraform IaC, staging + prod separated
- GitHub Actions CI: lint / type / test / build / deploy
- Sentry, Datadog (or Grafana Cloud) wired
- Auth scaffolding (email/password + OTP)
- Repo structure (monorepo, pnpm + turbo, Next.js + tRPC + Prisma)
- Design system tokens + Storybook

### UI / UX deliverables
- Storybook live with empty primitives
- Locale routing structure (en-US, en-IN, hi-IN ready)
- Theme provider (light + dark scaffolded; light wired)
- Hello-world home page that proves the SSR + auth + i18n pipeline works

### Color / layout focus
- Tokens land: `brand`, `cta`, `slate`, semantic, signal palettes (DESIGN_SYSTEM §2)
- Typography stack live (Inter + Noto fallbacks, scale, line-heights)
- Container widths + breakpoints from DESIGN_SYSTEM §5
- Light mode only

### Security additions (this phase)
- TLS / HSTS prep (HSTS preload after stability)
- Cloudflare in front + AWS WAF rules (OWASP CRS)
- IAM SSO + MFA on AWS console
- Secrets in AWS Secrets Manager
- gitleaks pre-commit + trufflehog in CI
- SAST (GitHub Advanced Security or SonarCloud)
- Dependabot + Snyk
- Incident response playbook stub

### Trust & Safety
- N/A this phase

### Customer support
- N/A this phase (no customers yet)

### Admin / Platform Mgmt
- Console app skeleton (`console.onsective.com`)
- Auth via shared session, role guards in middleware
- IP allowlist on console (Cloudflare Access)
- Audit log writer + viewer (rudimentary)

### Integrations live
- AWS, GitHub, Sentry, Datadog (or Grafana), Cloudflare

### Exit criteria
- "Hello world" deploy goes PR → staging → prod with one click
- Storybook deploys on every UI PR
- Audit log records the deployment

---

## Phase 1 — MVP Marketplace (Weeks 3–10)
**Goal:** real money moves. A buyer in US or India finds a product, pays, gets it delivered.

### Features

**Catalog**
- Categories tree (10 top-level, 50 child); admin CRUD
- Products + Variants CRUD (seller surface)
- Image upload + auto-resize to 200/400/800/1200 (WebP + AVIF + JPG fallback)
- Search via Postgres FTS (title, brand, keywords); category filter, price-range, sort
- Product status state machine (DRAFT → PENDING_REVIEW → ACTIVE / REJECTED → ARCHIVED)
- Inventory tracking, low-stock indicator

**Buyer flow**
- Sign up (email + OTP, or password)
- Home / category / search / PDP / reviews placeholder
- Cart (multi-seller, guest + logged in, merge on login)
- 3-step checkout (address → shipping → payment + review)
- Stripe payment (PaymentIntent, Elements, SCA-ready)
- Order confirmation + order history + order detail
- Cancel pre-shipment

**Seller flow**
- Seller signup → KYC (PAN/EIN/bank) → admin approval
- Stripe Connect Express onboarding
- Seller dashboard: products, orders, inventory, payouts
- Mark as shipped (manual AWB entry — real carriers in Phase 3)
- Inventory + price quick-edit

**Admin (PM console)**
- Dashboard with action queues
- Seller approval workflow + KYC review screen
- Product moderation queue
- Order intervention console (search, view, manual cancel/refund < $500)
- User search + read-only "view as"
- Send password reset email
- Commission rule editor (basic)

**Payments / financial**
- Stripe charges to platform account
- Per-order ledger entries (BUYER_RECEIVABLE, PLATFORM_LIABILITY, PLATFORM_REVENUE, GATEWAY_FEES, SELLER_PAYABLE)
- Stripe Tax for sales-tax/GST
- Buyer invoice PDF download

### UI / UX deliverables
- Header (sticky, condensing on scroll), footer (4-column desktop, accordion mobile)
- Bottom nav on mobile
- All buyer screens 1–12 from WIREFRAMES.md
- Seller screens 25–34, 39 from WIREFRAMES.md
- Admin screens 43–46 from WIREFRAMES.md
- Skeleton loaders on every list/grid
- Empty states for: cart, orders, products, search no-results, filtered no-results
- Error states with retry CTAs
- Toasts (success/error/warn/info)
- Lighthouse Accessibility ≥ 95 on PDP and home

### Color / layout focus
- Buyer surface: brand-600 primary, cta-500 amber on Buy/Add-to-Cart
- Seller dashboard: lighter slate background, brand sidebar
- Admin console: distinct accent (deeper indigo) so PMs feel they're "in admin land"
- Status pills follow signal palette (DESIGN_SYSTEM §2.5)
- Light mode only this phase
- Mobile-responsive every screen

### Security additions
- All Phase 0 carries forward
- Rate limits (auth, search, checkout) per SECURITY.md §4.1
- CSRF double-submit token
- zod input validation everywhere
- Postgres RLS on Product, OrderItem, Shipment
- argon2id passwords, OTP throttling
- Stripe Elements (PCI SAQ-A scope)
- Webhook signature verification (Stripe)
- Audit log on every PM action
- Pre-launch external pentest (5-day scope: auth + checkout + admin)
- Privacy policy + T&Cs + cookie banner (lawyer-reviewed for US + India)
- GDPR/DPDP data export endpoint
- Account deletion endpoint (30d soft-delete)

### Trust & Safety
- Sanctions screening (Stripe Connect handles for sellers; we add buyers)
- Manual product moderation queue
- Brand-protection placeholder (admin can take down on report)
- Manual order-intervention (admin force-cancel/refund)

### Customer support
- Web form on every page → ticket creation
- Email-to-ticket (`help@onsective.com`)
- PM console inbox + ticket workspace
- Internal notes
- Manual assignment
- Email outbound (templated for: order placed, shipped, delivered, refund initiated)
- Order-context auto-attached to ticket

### Admin / Platform Mgmt features (this phase)
- See PM section above + PLATFORM_MANAGER.md §5 (Phase 1)
- Permission tiers active: refund < $500 PM-direct
- 4-eyes scaffolded but unused

### Integrations live
- Stripe (charges, Connect Express, Tax, Refunds)
- AWS SES (email)
- Twilio + MSG91 (SMS / OTP)
- Cloudflare (CDN, WAF, Access)
- Postgres FTS (no external search)

### Exit criteria
- Real $1 transaction in production from founder card
- 10 sellers + 50 invited buyers in each anchor market transacting
- Lighthouse a11y ≥ 95
- All audit log entries reconcile
- Pentest: zero critical/high open

---

## Phase 2 — Commission Engine + Automated Payouts (Weeks 11–14)
**Goal:** zero manual bank transfers. Ledger reconciles to the cent. Refunds reverse cleanly.

### Features

**Commission rule engine**
- CommissionRule table with category × seller × country × value matchers, priority-ordered
- Rule editor admin UI with drag-priority + dry-run preview
- Cached compiled rules in Redis; bust on change
- Commission frozen at order_item creation (immutable thereafter)

**Ledger v2**
- Posting templates per event (`order.paid`, `order.refunded`, `payout.created`, `chargeback.opened`)
- Atomic recording with DR == CR validation
- Trial balance dashboard (admin)
- Daily reconciliation job vs Stripe Balance API
- Drift alarm

**Automated payouts**
- Per-seller payout policy: frequency, minimum threshold, on-hold flags
- Hourly worker creates Payout when eligible
- Stripe Transfer with idempotency
- Webhook handlers: transfer.created/paid/failed/reversed
- Failed-payout retry (3x exp backoff, then human review)
- Payout statement PDF

**Refunds**
- Buyer-initiated refund-request flow
- Seller approve/reject
- Admin override
- Partial refunds (line-item, qty)
- Reverse ledger entries
- Inventory restock on accept

**Disputes**
- Stripe webhook freeze on charge.dispute.created
- Evidence collection UI (seller uploads)
- Submit evidence to Stripe
- Resolution handlers (won/lost/charged-back fee)

**Tax & invoicing**
- Buyer invoice with line tax breakdown (CGST/SGST/IGST in India)
- Seller invoice (Onsective → seller for commission charged)
- Per-fiscal-year, gap-free invoice numbering per legal entity
- TDS deduction (India) + 1099-K prep (US)

### UI / UX deliverables
- Seller payouts page upgrade (available / pending / on-hold; per-currency tabs)
- Seller earnings analytics (daily line chart, top products, monthly summary)
- Tax docs download center
- Buyer refund request UI on order detail
- Refund status tracking page
- Admin trial-balance dashboard (WIREFRAMES.md §50)
- Admin commission rule editor (WIREFRAMES.md §49)
- Approval modal (4-eyes flow, see PLATFORM_MANAGER.md §8.3)

### Color / layout focus
- Tabular numbers everywhere money displays (`font-feature-settings: 'tnum'`)
- Money component canonicalized — single source of price formatting
- Financial dashboards: data-density layout (more content per viewport, denser type than buyer surface)
- Charts: brand-600 lines, slate-200 grid, cta-500 highlights
- Status pills for payout states (PENDING / IN_TRANSIT / PAID / FAILED) in signal colors

### Security additions
- 4-eyes approval flow live (refunds $500–$5K)
- Anomaly detection on refund/payout patterns (basic rules)
- Stripe Radar enabled
- 3DS for high-risk regions
- Per-PM throttles (daily refund cap)
- Stripe Connect KYC enforced (no payouts pre-KYC)

### Trust & Safety
- Per-buyer refund-rate flag (returns abuse signal)
- Per-seller refund-rate flag (quality signal)
- Chargeback freeze on seller payouts when dispute open
- Manual ledger adjust requires 2-person approval (admin only)

### Customer support
- Refund queue inside ticket workspace
- Approval workflow integrated with tickets
- SLA timers visible
- Reason taxonomy enforced for refunds

### Admin / Platform Mgmt features
- Refund authority tiers (PM < $500 auto, $500–$5K 4-eyes, > $5K admin)
- Hold/release seller payouts
- Failed payout retry button
- Stripe dispute evidence collection
- Commission rule dry-run

### Integrations live
- Stripe Tax, Stripe Radar, Stripe Connect Express, Stripe Refunds
- Stripe 1099-K (US tax form filing)
- Email + SMS templates expanded

### Exit criteria
- Real seller in each anchor receives an automated payout
- A real refund flows through; ledger reverses; trial balance reconciles to zero
- Chargeback dry-run end-to-end works
- Auditor (external) signs off on ledger code

---

## Phase 3 — Shipping Management (Weeks 15–22)
**Goal:** 95% of orders ship without ops touching them. Buyers see live tracking. Sellers click one button to print labels.

### Features

**Carrier abstraction**
- `CarrierAdapter` interface
- EasyPost adapter (US/EU/APAC)
- Shiprocket adapter (India)
- Self-fulfilled adapter (manual AWB)
- Country-routed orchestration with fallback

**Rate shopping**
- `POST /shipping/rates` returns ranked options (cost / SLA / COD-eligible)
- Redis cache (60 min) by parcel + lane

**Label / pickup**
- Shipment creation with auto-AWB + label PDF stored in S3
- Bulk label generation (ZIP + manifest CSV)
- Pickup scheduling per pickup-address per day

**Tracking**
- Webhook receiver per carrier (signature-verified)
- Polling fallback every 30 min for non-webhooked active shipments
- Status normalization (carrier code → unified ShipmentStatus)
- Buyer-facing tracking page (public, signed-token URL)
- Tracking timeline with location + ETA
- SMS / email milestones

**Exception handling**
- Stuck-shipment dashboard (no movement > N days)
- Auto ops-ticket creation
- Lost-shipment workflow (insurance claim → refund)
- RTO flow (auto-detect, notify, recover)
- Damaged / wrong-item flows feed RMA

**COD (India)**
- COD flag at checkout, eligible items only
- COD verification call/SMS
- Carrier remittance reconciliation (Shiprocket COD remittance)
- Delayed seller payout for COD (T+14 typical)

**Weight reconciliation**
- Carrier weight-discrepancy reports ingested weekly
- Auto-charge seller delta if declared < actual
- Dispute UI (seller upload packed photos)
- Ledger entry: WEIGHT_ADJUSTMENT

**Returns RMA**
- Buyer return wizard (reason → photos → label)
- Seller approve / reject / inspect
- Reverse shipment via carrier
- Restocking fee (configurable, capped 15%)
- Replacement orders

**Insurance**
- Auto-attach above $100 / ₹5000
- Claim filing on lost/damaged
- Recovery → ledger

### UI / UX deliverables
- Buyer tracking page (WIREFRAMES.md §13) with live timeline
- Buyer return wizard (WIREFRAMES.md §14)
- Seller "Ready to ship" queue (WIREFRAMES.md §34)
- Seller ship-now flow (WIREFRAMES.md §36) — 3 steps
- Seller bulk-ship + manifest download
- Seller pickup scheduler
- Seller returns inbox + inspection UI
- Admin carrier health dashboard
- Admin weight discrepancy review queue
- Admin insurance claims queue

### Color / layout focus
- Tracking timeline uses brand-600 for active, slate-300 for upcoming, success-500 for delivered
- Status pills for shipment states (PENDING / LABEL_CREATED / PICKED_UP / IN_TRANSIT / OUT_FOR_DELIVERY / DELIVERED / EXCEPTION / RTO)
- Map view (Mapbox) where carrier supplies lat/lng — Phase 3 stretch goal
- Carrier badges (small logos) for each shipment

### Security additions
- Webhook signature verification per carrier
- COD remittance reconciliation (anti-skim)
- Address validation pre-shipment (USPS / India Post / regex fallback)
- Insurance claim workflow with audit
- Stuck-shipment ops queue (proactive, not reactive)
- Carrier API credentials per environment, rotated yearly

### Trust & Safety
- COD limits per buyer (₹5K default, raise after 1st success)
- Address-not-found auto-RTO flow with 3-attempt buyer outreach
- POD photo storage; review for "delivered, not received" disputes
- Seller multi-warehouse to prevent address spoofing

### Customer support
- Shipping exception ticket types (lost, stuck, RTO, weight)
- RMA full flow inside support workspace
- Stuck-shipment auto-tickets
- Carrier-side ticket creation tooling (PM clicks "Open carrier ticket" with pre-filled context)

### Admin / Platform Mgmt features
- Re-deliver / re-ship at platform expense (PM 4-eyes)
- Override declared weight (4-eyes)
- File insurance claim on behalf of seller
- Carrier exception assignment to ops queue
- Stuck-shipment dashboard
- POD photo viewer

### Integrations live
- EasyPost (US/EU/APAC)
- Shiprocket (India)
- Optional: Shippo (backup global aggregator)
- Mapbox (tracking map)
- USPS + India Post (address validation)

### Exit criteria
- Buyer in each anchor sees live tracking timeline updating
- Lost-package edge case end-to-end tested with claim recovery
- RTO flow validated against carrier sandbox
- COD reconciliation in India: 100% of remittances reconciled
- Weight reco saves $X (track and report)

---

## Phase 4 — Trust, Discovery, Growth (Weeks 23–30)
**Goal:** marketplace trust loops kick in. Discovery beyond search. Mobile reach. Cross-cutting polish.

### Features

**Reviews & ratings**
- Verified-purchase only (tied to OrderItem.id)
- Photo upload up to 5
- Seller reply
- Rating filter on PDP
- Helpful votes
- Review moderation queue
- Velocity caps + ML fake-review detection

**Search v2**
- OpenSearch cluster
- Synonyms, stemming, multi-language
- Faceted aggregations
- Learning-to-rank (basic, click data)
- "Did you mean" + "no results — try this"

**Recommendations**
- "Frequently bought together"
- "Customers also viewed"
- "Recently viewed by you"
- Collaborative filtering (basic v1)

**Wishlist & save-for-later**
- Save from PDP, search, cart
- Move to cart from wishlist
- Notify on price drop / back-in-stock

**Coupons / promo engine**
- Code-based (% / flat / BOGO / first-order / first-N-orders)
- Eligibility rules (category, seller, min cart, country)
- Seller-funded vs platform-funded
- Stacking rules (one per cart by default)

**Referrals**
- Give X get Y mechanic
- Tracked in ledger as PROMO_LIABILITY
- Anti-abuse: device + payment-method dedupe

**Multi-language inbox + UI**
- Phase 1 covered en-US, en-IN, hi-IN
- Phase 4 adds: ar (RTL), es-LA, fr-CA, de-EU as anchors expand
- Auto-detect locale; user override

**Mobile apps (React Native + Expo)**
- iOS + Android
- Buyer app first; seller app Phase 4 stretch
- Push notifications via FCM/APNS
- Native checkout (Apple Pay, Google Pay, UPI Intent)

**Customer support upgrade**
- In-app realtime chat (WebSocket)
- AI chatbot with handoff
- Phone IVR / callback
- WhatsApp Business (India)
- Auto-resolve safe categories
- Smart routing + skill matrix
- Macros library
- Help center / knowledge base public
- CSAT + NPS surveys

**Trust & Safety**
- Device fingerprinting (FingerprintJS)
- Velocity rules across many signals
- Behavioral fraud scoring
- Counterfeit detection (image + text classifier)
- Prohibited items image classifier
- Bug bounty soft launch

### UI / UX deliverables
- **Dark mode launches** (palette per DESIGN_SYSTEM §2.6, components reviewed)
- Reviews showcase on PDP (filter, sort, helpful votes)
- Recommendations carousels (home, PDP, cart, post-purchase)
- Wishlist screen
- Coupon code field on cart + checkout
- AI chat widget (in-app)
- Help center site
- Mobile app screens — match buyer web parity (12 screens)
- Illustrations set for empty/error states
- Push notification UX (in-app preferences)

### Color / layout focus
- **Dark mode** rolled out across all surfaces; tested in CI for both themes
- Illustration set in brand colors; consistent visual language across empty states
- Marketing pages refresh (more polished hero, gradient accents)
- Mobile app design (native patterns + brand consistency)
- RTL layouts validated for Arabic
- Devanagari line-height tweak applied for hi-IN

### Security additions
- **Passkeys (WebAuthn)** for buyers + sellers (alt to password + as MFA)
- Social login (Google + Apple) with account-linking guards
- Device fingerprinting for fraud detection
- Fake-review ML (text + behavior)
- Counterfeit detection ML (image + text)
- Dark-web exposed-creds monitoring (HIBP)
- Bug bounty soft launch (HackerOne or Bugcrowd, private invite)
- ISO 27001 prep work begun

### Trust & Safety
- T&S team (Trust & Safety specialist hired)
- Dispute resolution as own track (escalation tree codified)
- Counterfeit reactive takedown SLA: 48h
- Repeat-offender → seller suspension
- Device fingerprinting blocks shared-device account farms

### Customer support (Phase 4 expansion)
- See CUSTOMER_SUPPORT.md §12 (Phase 4)

### Admin / Platform Mgmt features
- See PLATFORM_MANAGER.md §5 (Phase 4)
- Macros / canned responses
- Multi-language inbox
- Auto-routing + skill-based assignment
- Fraud signals dashboard (consumer of T&S engine)
- Mobile companion app (PMs on call)

### Integrations live
- OpenSearch (search v2)
- FingerprintJS (fraud)
- FCM + APNS (push)
- WhatsApp Business API (Twilio or Gupshup)
- Twilio Voice (IVR)
- HIBP (cred monitoring)
- HackerOne / Bugcrowd (bug bounty)
- Mixpanel or PostHog (analytics, if not already)

### Exit criteria
- 30%+ of homepage clicks come from recommendations (not just search)
- Dark mode in production with no contrast regressions
- AI chatbot deflects 30%+ of incoming chat
- Mobile apps on both stores with > 100 reviews each
- T&S team handling fraud + dispute queues with SLA met
- Bug bounty program active with first valid report addressed

---

## Phase 5 — Scale & Moats (Month 8+)
**Goal:** the marketplace turns into a defensible platform. Higher take-rate categories, FBO, ads, lending, B2B.

### Features

**Onsective Fulfilled (FBO/FBA-style)**
- Warehouse network (3PLs initially: ShipBob, Stord, regional in India)
- Inbound flow: seller ships SKUs to warehouse → received → stored
- Outbound: orders pick-pack-ship from warehouse, faster SLA
- Inventory storage fee + per-unit fulfillment fee
- Subset of catalog gets "Onsective Fulfilled" badge

**Onsective Prime (subscription)**
- Free shipping on FBO items
- Same/next-day delivery in metros
- Member-only deals
- Annual + monthly tiers

**Onsective Ads (sponsored products)**
- Sponsored-search ads on results
- Sponsored-product on PDPs ("compare with")
- Auction-based pricing per keyword + category
- Budget pacing
- This is the highest-margin product Onsective will ever ship

**Cross-border**
- Customs declarations + HS codes per product
- DDP (collect duties at checkout)
- IOSS for EU, GST/VAT compliance per destination
- Restricted-item filters per destination
- Multi-currency settlement

**Seller financing / working capital**
- Loans backed by next-90-days GMV history
- 8–14% APR, 30–90 day terms
- Underwriting from internal data (orders, returns, ratings, payment history)

**B2B marketplace**
- Bulk pricing tiers
- GST invoicing for India / sales-tax for US
- Net-30 terms
- Quote-to-order flow

**Public partner API**
- OAuth 2.0 client credentials
- Scoped tokens (read:orders, write:shipments, etc.)
- ERP / OMS integrations (Unicommerce, Browntape, NetSuite)
- Rate-limited; tiered for partners

**Fraud / risk engine v2**
- ML scoring at order placement
- Velocity rules across many signals
- Account takeover detection
- Auto-step-up auth on suspicious sessions

### UI / UX deliverables
- "Onsective Fulfilled" badge throughout buyer surface
- "Prime" badge + dedicated landing page
- Sponsored-product ad slots integrated naturally on search + PDP (clearly labeled)
- Cross-border: customs info on PDP for cross-border eligible items, duties shown at checkout
- Seller financing: dashboard tile with eligibility + offer
- B2B: separate buyer surface (`b2b.onsective.com`) with bulk-pricing UX, quote-request flow
- Partner developer portal (docs, sandbox, API keys)

### Color / layout focus
- **Brand refresh** — refined palette, signature gradient introduced for Prime
- "Onsective Choice" gold badge (cta-500-derived)
- Prime purple (or violet variant) for member content
- Sponsored slots visually distinct (subtle border or background tint, "Sponsored" label per regulation)

### Security additions
- ISO 27001 certification
- SOC 2 Type II audit complete
- Bug bounty live and public
- Continuous SAST/DAST
- Yearly red-team exercise
- Zero-trust network upgrade for internal services

### Trust & Safety
- Predictive escalation (ML flags likely-to-escalate tickets early)
- Customer health score (proactive outreach)
- Fraud engine ML model with continuous retraining
- T&S analytics: where fraud is concentrated, which products attract it

### Customer support
- See CUSTOMER_SUPPORT.md §12 (Phase 5)
- Voice (live agents, call center)
- Workforce management (shift / on-call)
- AI-assist for PMs (suggested replies, auto-categorize)
- Onsective University (training portal)

### Admin / Platform Mgmt features
- See PLATFORM_MANAGER.md §5 (Phase 5)
- Per-PM productivity dashboards
- Tiered escalation tree codified
- Workforce management
- Quality assurance program (5% sampling)

### Integrations live
- 3PL (ShipBob, Stord, regional India)
- Cross-border carriers (DHL eCommerce, FedEx International)
- Bank rails for direct seller financing (RBI-licensed NBFC partner in India; lending bank partner US)
- ERP / OMS partners (Unicommerce, Browntape, NetSuite)
- Ad serving infra (in-house auction engine)

### Exit criteria
- FBO live with first 50 sellers; 95% on-time delivery
- Prime member count target hit
- Ads revenue > 5% of GMV
- Cross-border live in 5 country pairs with tax-clean operation
- ISO 27001 + SOC 2 Type II certificates issued
- Public Partner API has 10+ integration partners

---

## Cross-phase summary table

| Concern | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 |
|---|---|---|---|---|---|
| **Auth** | email+pass+OTP | + Stripe Connect KYC | + carrier creds | + passkeys + social | + zero-trust |
| **UI surface** | buyer + seller + console | + financial dashboards | + tracking pages | + dark mode + mobile apps + reviews + recs | + B2B + partner portal |
| **Color theme** | light only | tabular money UI | shipment palette | dark mode + illustrations | brand refresh + Prime |
| **Mobile** | responsive web | same | same | native apps | same |
| **Localization** | en-US, en-IN, hi-IN | same | same | + ar, es, fr, de | + zh, ja, more |
| **Payments** | Stripe charges | + Connect payouts + Refunds + Disputes | + COD | + multi-currency settlement | + financing |
| **Shipping** | manual AWB | same | full carrier integration + RMA | tighter exception ML | cross-border + FBO |
| **Search** | Postgres FTS | same | same | OpenSearch + recs | personalization + ads |
| **Support** | tickets only | refund queue | RMA queue | chat + AI + WhatsApp + IVR | voice + AI assist |
| **Trust & Safety** | sanctions + manual moderation | refund anomaly | COD limits | device fingerprint + ML fraud + counterfeit | predictive + risk engine v2 |
| **Compliance** | privacy basics + cookies | tax automation | shipping insurance + customs prep | ISO 27001 prep | ISO 27001 + SOC 2 |
| **Team** | 5 eng + 1 PM | + 1 PM (US/IN coverage) | + 1 ops/logistics | + T&S specialist + 2 PMs + mobile dev | + warehouse ops + ads + financing teams |

---

## How to read this with the other docs

1. Start in **PLAN.md** for the bird's-eye.
2. Drill into **PHASE_DETAILS.md** (this file) for what each phase contains.
3. **PHASE{N}_SPRINTS.md** has the actual two-week sprint tickets.
4. **DESIGN_SYSTEM.md** is what every UI ticket implements against.
5. **SECURITY.md** is the running threat model + per-phase security delta.
6. **CUSTOMER_SUPPORT.md** is the full support system spec.
7. **PLATFORM_MANAGER.md** is the human ops layer.
8. **API_SURFACE.md** is the contract between frontend and backend.
9. **WIREFRAMES.md** is the screen list.
10. **schema.prisma** is the database shape.
11. **ADRs.md** is why the big choices were made.

If anything contradicts, fix it — single source of truth wins. PLAN.md is the boss.
