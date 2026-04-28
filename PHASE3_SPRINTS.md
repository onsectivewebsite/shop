# Phase 3 Sprint Breakdown — Shipping Management
## 8 weeks · 4 sprints · 5 engineers + 1 ops/logistics hire

> **Definition of done for Phase 3:** 95%+ of orders ship without ops intervention. Buyer sees a live tracking page. Seller clicks one button to print a label. Onsective runs rate-shopping across 2+ carriers per region. RTO / lost / damaged shipments have automated handling. Weight reconciliation reclaims overcharges from carriers. COD orders flow buyer → courier → platform → seller correctly.

This is the chunkiest phase. Shipping is where most marketplaces bleed money. Spend the time.

---

## Carrier Adapter Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                   ShippingService (orchestrator)                 │
│                                                                  │
│   rateShop()  ─────────►  for each registered adapter:           │
│                              adapter.getRates(parcel) → []       │
│                              normalize → unified rate objects    │
│                              filter (SLA, COD, services)         │
│                              sort by cost                        │
│                                                                  │
│   createShipment(rate)  ──►  adapter.createShipment(rate, parcel)│
│                              returns {awb, label_url, carrier}   │
│                                                                  │
│   schedulePickup()       ──►  adapter.schedulePickup(awb, time)  │
│                                                                  │
│   cancelShipment(awb)    ──►  adapter.cancel(awb)                │
│                                                                  │
│   ingestWebhook(payload) ──►  adapter.parse(payload) →           │
│                              TrackingEvent[]                     │
│                                                                  │
│   pollTracking(awb)      ──►  adapter.track(awb) → status        │
└────────────────────┬─────────────────────────────────────────────┘
                     │
        implements   ▼   adapter interface
   ┌─────────────────────────────────────────┐
   │  CarrierAdapter (interface)             │
   │  ─ name(): string                       │
   │  ─ supportedCountries(): string[]       │
   │  ─ supportedServices(): Service[]       │
   │  ─ getRates(parcel): Rate[]             │
   │  ─ createShipment(rate, parcel): {...}  │
   │  ─ schedulePickup(awb, time): void      │
   │  ─ cancel(awb): void                    │
   │  ─ track(awb): TrackingEvent[]          │
   │  ─ parseWebhook(body): TrackingEvent[]  │
   │  ─ verifyWebhookSig(body, sig): boolean │
   └─────────────────────────────────────────┘
                     ▲
                     │ implementations
   ┌─────────────────┼─────────────────────────────────────────┐
   │                 │                                         │
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐
│EasyPost  │  │Shippo    │  │Shiprocket│  │Delhivery │  │Self-fulfilled│
│(US, CA,  │  │(global   │  │(India    │  │(India    │  │(seller hands │
│ EU,      │  │ aggreg.) │  │ aggreg.) │  │ direct)  │  │ to courier   │
│ global)  │  │          │  │          │  │          │  │ themselves)  │
└──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────────┘
```

**Why an aggregator-of-aggregators?** EasyPost gives you US/EU; Shiprocket gives you India. Each aggregator already wraps 50+ carriers. We don't integrate USPS or Bluedart directly — we let our aggregators do that. We unify their interfaces.

---

## Order → Shipment lifecycle (state machine)

```
            order.paid
                │
                ▼
         ┌──────────────┐
         │   PENDING    │ ←─ Shipment row created, no carrier yet
         └──────┬───────┘
                │ rate-shop + carrier selected
                ▼
         ┌──────────────┐
         │LABEL_CREATED │ ←─ AWB issued, label PDF generated
         └──────┬───────┘
                │ pickup scheduled
                ▼
         ┌──────────────┐
         │  PICKED_UP   │ ←─ courier scanned at seller
         └──────┬───────┘
                │
                ▼
         ┌──────────────┐         exception?         ┌──────────────┐
         │ IN_TRANSIT   │─────────────────────────►  │  EXCEPTION   │
         └──────┬───────┘                            └──────┬───────┘
                │                                           │
                ▼                                           ▼
         ┌──────────────┐                            ┌──────────────┐
         │OUT_FOR_DELIV │                            │ Manual ops   │
         └──────┬───────┘                            │ resolution   │
                │                                    └──────────────┘
        ┌───────┴───────┐
        │               │
        ▼               ▼
 ┌─────────────┐  ┌──────────────┐
 │  DELIVERED  │  │ RTO_INITIATED│ ← buyer not available, rejected, etc.
 └──────┬──────┘  └──────┬───────┘
        │                │
        ▼                ▼
 (T+7 → completed)  ┌──────────────┐
                    │RTO_DELIVERED │ ← back to seller
                    └──────────────┘
```

---

## Sprint 6 — Carrier Integration + Rate Shopping (Week 13–14)

### Backend
- **SHIP-010** — `CarrierAdapter` TypeScript interface in `packages/shipping/`
- **SHIP-011** — EasyPost adapter:
  - Implement: getRates, createShipment, label fetch, schedulePickup, cancel, track, parseWebhook
  - HMAC webhook verification
  - Sandbox + prod credentials per environment
- **SHIP-012** — Shiprocket adapter:
  - Same interface
  - OAuth token refresh
  - India-specific: COD flag, RTO-aware rates
- **SHIP-013** — Self-fulfilled adapter (no-op for sellers who handle their own logistics; just records AWB they enter)
- **SHIP-014** — Adapter registry: country → preferred adapters list with fallback order
- **SHIP-015** — Rate-shop API: `POST /shipping/rates` returns ranked options
- **SHIP-016** — Rate caching: same `(from_pin, to_pin, weight, dims, COD)` cached 60min in Redis
- **SHIP-017** — Address validation per country (USPS API for US, India Post API for IN — fall back to regex if APIs down)

### Pickup origins
- **SHIP-018** — Seller multi-warehouse: PICKUP-type addresses, default + alternates
- **SHIP-019** — Auto-select pickup origin based on stock allocation (Phase 5 inventory split; v1 = default address)

### Frontend (seller)
- **SEL-020** — Seller pickup-address management UI
- **SEL-021** — Carrier preference UI (allow seller to blacklist a carrier from past bad experience)
- **SEL-022** — Shipping settings: package types/sizes presets

### Admin
- **ADMIN-010** — Carrier health dashboard: per-carrier success rate, avg cost, avg delivery time
- **ADMIN-011** — Rate-shop simulator (input parcel, see ranked options across all carriers)

### Tests
- **TEST-010** — Mock-server suite for each adapter (record fixtures from sandbox, replay)
- **TEST-011** — Property test: rate-shop should never return an option for an unsupported country

**Sprint 6 exit:** rate-shop returns ≥ 2 options for every domestic order in US and India; mock test suite covers all adapters.

---

## Sprint 7 — Label Generation, Pickup, In-Transit (Week 15–16)

### Backend
- **SHIP-020** — Shipment creation endpoint: `POST /orders/:id/shipments`
  - Validates order is PAID and seller is verified
  - Calls rate-shop, picks default carrier (admin-configurable: cheapest meeting SLA, or seller-preferred)
  - Calls adapter.createShipment
  - Stores AWB, label, manifest URLs
  - Emits `shipment.created`
- **SHIP-021** — Label PDF storage: download from carrier, re-store in S3 (carriers expire URLs)
- **SHIP-022** — Bulk label generation: seller selects 10 orders → ZIP of labels + manifest CSV
- **SHIP-023** — Pickup scheduling:
  - Single pickup window per day per pickup-address
  - Adapter.schedulePickup with all AWBs in that window
  - Pickup confirmation # stored
- **SHIP-024** — Pickup cancellation cascade (cancels all linked shipments)

### Frontend (seller)
- **SEL-023** — "Ready to ship" queue: paid orders not yet shipped
- **SEL-024** — Per-order "Generate label" button → modal with rate-shop options → confirm
- **SEL-025** — Bulk-ship UI: select multiple orders, generate combined manifest, download labels ZIP
- **SEL-026** — Pickup scheduler: pick date/time slot, see countdown
- **SEL-027** — Print queue: "X labels ready to print"

### Frontend (buyer)
- **BUY-020** — Order detail: status timeline expands when shipment exists; shows AWB, carrier name, link out
- **BUY-021** — Email + SMS notification: "Your order has shipped" with AWB

### Tracking ingestion
- **SHIP-030** — Webhook receiver endpoint per carrier (`POST /webhooks/easypost`, `POST /webhooks/shiprocket`)
- **SHIP-031** — Signature verification per adapter
- **SHIP-032** — Idempotent event ingestion (dedupe by carrier_event_id)
- **SHIP-033** — Status normalization: each carrier's codes → unified `ShipmentStatus` enum
- **SHIP-034** — Polling fallback: cron every 30 min for shipments not webhook-active in last 6h
- **SHIP-035** — TrackingEvent timeline materializer

**Sprint 7 exit:** Seller in US and India both ship a real package, label scans on courier app, buyer sees status update in real time.

---

## Sprint 8 — Buyer Tracking, Delivery, Exceptions (Week 17–18)

### Buyer tracking page

```
URL: /track/{order-id}  (and shareable /track/{public-tracking-token})

┌─────────────────────────────────────────────────────────────────────┐
│  Order #ONS-2026-00123                          [ Need help? ]      │
│  ─────────────────────────────────────────────────────────────────  │
│  Estimated delivery: Mon, 4 May 2026                                │
│                                                                     │
│  ●━━━━━━━●━━━━━━━●━━━━━━━○────────────○                             │
│  Placed   Packed  Shipped  Out for      Delivered                   │
│  26 Apr   27 Apr  28 Apr   delivery                                 │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  ●  Mon 28 Apr 14:32 — Mumbai sorting hub                     │  │
│  │  ●  Mon 28 Apr 09:10 — Picked up from seller (Pune)           │  │
│  │  ●  Sun 27 Apr 18:00 — Label created                          │  │
│  │  ●  Sat 26 Apr 22:15 — Order placed                           │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  AWB: 1Z999AA10123456784   ·   Carrier: Delhivery                   │
│  [ View on Delhivery ]    [ Get SMS updates ]                       │
│                                                                     │
│  Items in this shipment (1 of 2 shipments for this order):          │
│    • Cotton T-Shirt, Blue, M  ×1                                    │
│    • Phone case  ×2                                                 │
│                                                                     │
│  Shipping to:                                                       │
│    Rishabh Kumar, 12 MG Road, Bangalore 560001                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Backend
- **TRACK-001** — Public tracking page (no auth needed; access via signed token in email)
- **TRACK-002** — `GET /orders/:id/tracking` returns timeline + shipment(s)
- **TRACK-003** — Server-side rendered tracking page (SSR for share-ability + SEO)
- **TRACK-004** — Map view (optional; Mapbox + carrier lat/lng if available — only for premium carriers)

### Delivery confirmation
- **SHIP-040** — Auto-status update on `delivered` webhook → mark order DELIVERED, start return-window timer (T+7)
- **SHIP-041** — POD (proof of delivery) image storage (signed image, signature image)
- **SHIP-042** — Auto-trigger on completion (T+7): payout-eligible state, order COMPLETED
- **SHIP-043** — Delivery confirmation email/SMS to buyer with rating prompt (links to review flow — Phase 4)

### Exceptions
- **SHIP-050** — Exception detection: stuck > N days in same status, repeat-delivery-attempts, address-not-found, damaged-on-arrival
- **SHIP-051** — Auto-create ops ticket when exception detected
- **SHIP-052** — Exception resolution UI for ops: contact buyer, contact carrier, reship, refund
- **SHIP-053** — Lost shipment: after 21 days of no movement → auto-claim from carrier insurance, refund buyer, no payout to seller

### RTO (return to origin)
- **RTO-001** — RTO state in shipment status enum (already in schema)
- **RTO-002** — Auto-detect RTO from carrier webhook
- **RTO-003** — Notify seller; create RTO shipment back to seller's pickup address
- **RTO-004** — Refund buyer fully on RTO_DELIVERED
- **RTO-005** — RTO charge to seller policy: passes RTO shipping cost back to seller (configurable; default = yes for prepaid, yes for COD)
- **RTO-006** — Inventory restock on RTO_DELIVERED (only if seller marks "received in good condition")

**Sprint 8 exit:** Buyer can hit `/track/...` and see a live timeline; lost-package edge case end-to-end tested; RTO flow validates against real carrier sandbox.

---

## Sprint 9 — COD, Weight Reco, Returns RMA, Insurance (Week 19–20)

### COD (Cash on Delivery) — India-critical, US-rare
- **COD-001** — COD flag on order at checkout; only available where carrier supports
- **COD-002** — COD limits per buyer (₹5000 default, raise after first successful COD)
- **COD-003** — COD verification call/SMS before shipment (auto via Twilio)
- **COD-004** — Carrier collects cash → remits to Onsective bank weekly (Shiprocket COD remittance API)
- **COD-005** — COD reconciliation: COD remittance reports ingested daily, matched to shipments
- **COD-006** — COD-collected event triggers ledger entries (BUYER_RECEIVABLE filled)
- **COD-007** — COD payout to seller delayed until COD remittance received (can be T+14 in India)
- **COD-008** — Failed-COD handling: buyer refuses → RTO; carrier still charges shipping both ways

### Weight reconciliation
- **WEIGHT-001** — Carriers measure parcels and may charge based on actual vs declared weight
- **WEIGHT-002** — Ingest weight-discrepancy reports from carrier (weekly CSV from EasyPost; API from Shiprocket)
- **WEIGHT-003** — Auto-charge seller difference if their declared < actual
- **WEIGHT-004** — Dispute UI: seller can challenge with packed-photo evidence
- **WEIGHT-005** — Ledger entry: WEIGHT_ADJUSTMENT (DR seller payable / CR carrier cost)

### Returns RMA flow
- **RMA-001** — Buyer initiates return on order detail (within return window, configurable per category)
- **RMA-002** — Reasons taxonomy: defective / not as described / changed mind / damaged in transit
- **RMA-003** — Seller approves/rejects (auto-approve if "defective" + photos uploaded)
- **RMA-004** — Reverse shipment created: from buyer → seller (carrier picks up)
- **RMA-005** — On received: seller inspects, marks "accept" → refund triggered, or "reject" → manual review
- **RMA-006** — Restocking fee policy (configurable per seller, capped at 15%)
- **RMA-007** — Buyer-paid vs seller-paid return shipping: seller-paid for "defective" / "not as described"; buyer-paid for "changed mind"

### Insurance
- **INS-001** — Auto-attach declared-value insurance for shipments above $100 / ₹5000
- **INS-002** — Carrier insurance API (most aggregators wrap this)
- **INS-003** — Claim filing on lost/damaged → recover funds, refund proportionally
- **INS-004** — Seller-opt-in extra coverage (paid by seller)

### Frontend
- **BUY-030** — "Return this item" CTA on delivered orders
- **BUY-031** — Return wizard: reason → photos → ship label generated → drop-off instructions
- **BUY-032** — Return tracking sub-page
- **SEL-030** — Returns inbox: pending / received / inspected / refunded
- **SEL-031** — Inspection UI: confirm condition, accept/reject, photos
- **SEL-032** — COD orders dashboard tab with remittance status

### Admin
- **ADMIN-020** — COD remittance reconciliation dashboard
- **ADMIN-021** — Weight discrepancy review queue (auto-approve under threshold; manual above)
- **ADMIN-022** — Insurance claims queue
- **ADMIN-023** — Carrier SLA report: per-carrier on-time delivery, exception rate

### Hardening
- **PERF-010** — Tracking page: aggressive cache (60s public CDN); SSR with stale-while-revalidate
- **PERF-011** — Webhook ingestion target: < 200ms p99; queue heavy work async
- **AUDIT-010** — Quarterly carrier-cost audit: rate-shop tier vs actual invoiced

**Sprint 9 exit:** Phase 3 complete — full shipping management live, COD working in India, RMA validated, weight reconciliation reclaiming overcharges.

---

## Cross-cutting concerns

### Observability
- One dashboard per shipping flow: orders→labels→pickup→delivered, conversion funnel
- Per-carrier alert: success rate < 95%, exception rate > 5%, avg label-gen latency > 2s
- Per-region alert: rate-shop coverage drops below 2 carriers

### Cost controls
- Daily report: shipping cost as % of GMV per category (target < 8%)
- Carrier negotiation: at $100K/mo volume per carrier, renegotiate rates

### Documentation
- Internal runbook per failure mode (label-gen down, pickup missed, mass-delay across a carrier)
- Public API documentation for sellers using shipping endpoints (Phase 5 partner integrations)

---

## Phase 3 risks

| # | Risk | Mitigation |
|---|------|------------|
| 1 | Carrier API outage stalls all shipments | Multiple carriers per region; fallback adapter; queue + retry |
| 2 | Webhook deliverability (carriers drop events) | Polling fallback every 30 min; reconciliation cron daily |
| 3 | Address-validation false negatives block legit orders | Soft-warn UI; never auto-reject; ops can override |
| 4 | Carrier overcharges weight without our detection | Weight reco automated weekly; spot-check 1% of shipments physically |
| 5 | COD fraud (refuse-on-delivery) → RTO costs | COD limits, address verification, COD-only-for-known-buyers above value threshold |
| 6 | Return abuse (wear-and-return) | Photo-required returns, seller inspection power, restock fee, blocklist after pattern |
| 7 | Lost in transit insurance gaps | Auto-insure above threshold; declare-value defaults to item price |
| 8 | Cross-border slip (someone marks INTL by mistake) | UI guard: country mismatch → confirm modal; v1 hard-blocks intl |
| 9 | Stuck-shipment buildup (looks shipped, never moves) | Dashboard alert; auto-escalate at 5d no-update for SLA carriers |
| 10 | Manifest data wrong → customs hold (Phase 4 cross-border) | Per-line HS code field on product; validation before shipment create |

---

## Phase 3 KPIs

- Time from order paid → label created (target < 4h business hours)
- Time from label → picked up (target < 24h)
- On-time delivery rate (target > 92%)
- RTO rate (target < 8%, action item if higher)
- Lost-shipment rate (target < 0.2%)
- Weight-discrepancy auto-recovered $ (track $ saved)
- Buyer tracking-page visit rate (proxy for delivery anxiety; target > 60% per order)
- Carrier cost / GMV (target < 8%)
- Auto-resolution rate of exceptions (target > 70% — 30% require ops)
