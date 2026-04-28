# Phase 2 Sprint Breakdown — Commission Engine + Automated Payouts
## 4 weeks · 2 sprints · 5 engineers

> **Definition of done for Phase 2:** Zero manual bank transfers. Every dollar/rupee that flows through Onsective is recorded in a double-entry ledger, settled automatically per Stripe Connect schedule, and reconcilable to the cent against Stripe's reports. Sellers can download tax-compliant invoices. Refunds reverse cleanly through the ledger.

---

## Why Phase 2 matters

Phase 1 used Stripe with a single charge → platform → manual transfer. That doesn't scale past ~50 sellers and creates accounting nightmares. Phase 2 replaces it with:

1. **A real commission rule engine** — category × seller-tier × promo overrides, evaluated at order time, frozen on order_item.
2. **Double-entry ledger** as source of truth — every money movement is two balanced rows; the bank statements must reconcile to ledger sum.
3. **Auto-settlement** — payouts trigger automatically T+N after delivery (configurable per seller/region).
4. **Tax invoices** — GST in India, sales-tax invoice in US, VAT-compliant later.
5. **Refunds + chargebacks** that reverse the ledger and reclaim from future payouts if needed.

---

## Money Flow Wire Diagram (canonical)

```
                                       ┌──────────────────────────────┐
                                       │  BUYER places order ₹1000    │
                                       └────────────────┬─────────────┘
                                                        │
                                                        ▼
                              ┌──────────────────────────────────────────────┐
                              │  Stripe PaymentIntent (Separate charges &    │
                              │  transfers pattern)                          │
                              │  ─ on_behalf_of: platform                    │
                              │  ─ transfer_data: NONE (we do transfers      │
                              │     ourselves, async, after capture)         │
                              └─────────────────┬────────────────────────────┘
                                                │ payment_intent.succeeded webhook
                                                ▼
              ┌──────────────────────────────────────────────────────────┐
              │           ATOMIC TRANSACTION (Postgres)                  │
              │                                                          │
              │  Order #ONS-2026-00123  total ₹1000                      │
              │                                                          │
              │  ── LEDGER ENTRIES (double-entry) ────────────────────── │
              │                                                          │
              │  DR  BUYER_RECEIVABLE    1000  (we received this)        │
              │  CR  PLATFORM_LIABILITY   862  (held for sellers)        │
              │  CR  PLATFORM_REVENUE      90  (commission)              │
              │  CR  TAX_PAYABLE           18  (GST on commission)       │
              │  CR  GATEWAY_FEES          30  (Stripe's cut)            │
              │                                                          │
              │  Per-seller breakdown:                                   │
              │    Seller A item ₹600 → SELLER_PAYABLE ₹512              │
              │    Seller B item ₹400 → SELLER_PAYABLE ₹350              │
              │                                                          │
              │  Update Order.status = PAID                              │
              │  Emit event: order.paid                                  │
              └─────────────────────────┬────────────────────────────────┘
                                        │
              ┌─────────────────────────┴────────────────────────────────┐
              │                                                          │
              ▼                                                          ▼
   ┌─────────────────────────┐                          ┌─────────────────────────┐
   │ Inventory decrement     │                          │ Notification dispatch   │
   │ (already reserved,      │                          │ (buyer + sellers)       │
   │  now committed)         │                          │                         │
   └─────────────────────────┘                          └─────────────────────────┘

                           ────────  T + 7 days after delivery  ────────

                                                ▼
              ┌──────────────────────────────────────────────────────────┐
              │  PAYOUT JOB (cron, hourly)                               │
              │                                                          │
              │  For each seller × currency:                             │
              │    eligible = SUM(SELLER_PAYABLE entries) WHERE          │
              │      order.delivered_at < NOW() - 7d                     │
              │      AND ledger_entry.payout_id IS NULL                  │
              │      AND order.status NOT IN (REFUNDED, DISPUTED)        │
              │                                                          │
              │  if eligible > min_payout_threshold:                     │
              │    create Payout                                         │
              │    Stripe Transfer to seller's connected account         │
              │    DR SELLER_PAYABLE  / CR SELLER_PAID                   │
              │    Mark ledger entries with payout_id                    │
              └─────────────────────────┬────────────────────────────────┘
                                        │ transfer.created webhook
                                        ▼
              ┌──────────────────────────────────────────────────────────┐
              │  Update Payout.status = IN_TRANSIT                       │
              │  Notify seller                                           │
              │  When transfer.paid → Payout.status = PAID               │
              └──────────────────────────────────────────────────────────┘
```

**Critical invariant:** at any moment in time, the sum of all ledger debits equals the sum of all ledger credits. If this ever breaks, halt all payouts and page the lead.

---

## Sprint 4 — Commission Engine + Ledger v2 (Week 9–10)

### Backend
- **COMM-001** — `CommissionRule` evaluation service:
  - Inputs: `{categoryId, sellerId, countryCode, orderSubtotal, currency}`
  - Returns: `{commissionPct, ruleId}` (highest-priority match wins)
  - Cache compiled rules in Redis; bust on rule change
  - Unit tests covering: no-rule fallback, multiple matches, effective-date windows, currency mismatch
- **COMM-002** — Rule editor admin UI: priority drag-drop, effective dates, dry-run preview ("if this rule existed yesterday, X orders would have changed")
- **COMM-003** — Migrate Phase 1 hardcoded `defaultCommissionPct` to rule engine; backfill historical orders are NOT touched (commissions are frozen)
- **LEDGER-002** — `LedgerService.record(entries[])` — atomic, validates DR == CR, rejects on imbalance
- **LEDGER-003** — Posting templates per event type:
  - `order.paid` → 5 entries (buyer rcv, platform liability, platform revenue, tax payable, gateway fees, seller payable per item)
  - `order.refunded` → reverse of above + REFUND_LIABILITY
  - `payout.created` → DR SELLER_PAYABLE, CR SELLER_PAID
  - `chargeback.opened` → DR DISPUTE_RESERVE, CR PLATFORM_LIABILITY
- **LEDGER-004** — `LedgerService.balance(account, sellerId?, currency)` — trial balance per account
- **LEDGER-005** — Daily reconciliation job: compare ledger balances to Stripe Balance API; alert on drift > $0.01
- **LEDGER-006** — Backfill: replay all Phase 1 orders into ledger (idempotent script)

### Tax invoicing
- **TAX-001** — Stripe Tax integration audit: ensure `automatic_tax` enabled, jurisdictions configured for US states + India GST
- **TAX-002** — Invoice PDF generator (React PDF or Puppeteer):
  - Buyer invoice: per-order, includes seller name + GSTIN/EIN, line items, taxes split (CGST/SGST/IGST in India)
  - Seller invoice (Onsective → seller): commission charged + GST on commission (reverse charge mechanism)
  - Stored in S3, signed-URL accessed
- **TAX-003** — Invoice numbering: per fiscal year, gap-free, per legal entity (e.g. `ONS/IN/2026-27/000001`)
- **TAX-004** — India e-invoicing API (NIC IRP) integration — required for B2B over ₹5 lakh; stub for now, full Phase 5
- **TAX-005** — Buyer download invoice button on order detail page
- **TAX-006** — Seller download monthly tax-summary CSV (commission earned, tax collected, payouts received)

### Reporting
- **REP-001** — Seller earnings dashboard: GMV, commission paid, net earnings, by date range, by product
- **REP-002** — Admin financial dashboard: GMV / take rate / payout TAT / refund rate / chargeback rate
- **REP-003** — Daily P&L email to founder

**Sprint 4 exit:** every Phase 1 order replayed cleanly into ledger; trial balance reconciles to zero; admin can change commission rule mid-day and next order picks it up.

---

## Sprint 5 — Automated Payouts + Refunds (Week 11–12)

### Backend
- **PAY-008** — Payout schedule policy:
  - Per-seller setting: `payout_frequency` (daily, weekly Mon, bi-weekly)
  - Per-region default: US weekly, India weekly (RBI requires settlement within T+1 for most cases — verify)
  - Per-seller min threshold (default $50 / ₹2000)
  - On-hold flags: KYC incomplete, chargeback open, fraud review
- **PAY-009** — Payout creation worker (BullMQ, runs hourly):
  - Lock seller row, compute eligible balance, create Payout if over threshold, post ledger
  - Idempotency key on Stripe Transfer = `payout.id`
- **PAY-010** — Negative balance handling: if seller balance < 0 (refund after payout), don't pay; reclaim from next payout; if persistent, debit the connected account balance
- **PAY-011** — Stripe webhook handlers: `transfer.created`, `transfer.paid`, `transfer.failed`, `transfer.reversed`, `payout.failed`
- **PAY-012** — Failed payout retry policy: 3 retries with exponential backoff; after that → human review queue
- **PAY-013** — Payout statement PDF (per period) — what was paid, list of orders, deductions

### Refunds
- **REF-001** — Buyer-initiated refund request flow (within return window):
  - States: REQUESTED → APPROVED / REJECTED → IN_TRANSIT (return shipping) → RECEIVED → PROCESSED
  - Seller approves/rejects; admin override after SLA
- **REF-002** — Seller-initiated refund (e.g. order cancelled before ship)
- **REF-003** — Admin-initiated refund (chargeback resolution)
- **REF-004** — Partial refunds (line-item or quantity)
- **REF-005** — Stripe Refund API call → reverse ledger entries → restore inventory if applicable
- **REF-006** — Refund commission policy: by default, return full commission to buyer (Onsective eats it); admin can override to keep commission for "buyer-fault" returns

### Disputes / Chargebacks
- **DISP-001** — Stripe webhook: `charge.dispute.created` → freeze related seller payouts, notify ops + seller
- **DISP-002** — Dispute response collection UI (seller uploads evidence: tracking, comms, photos)
- **DISP-003** — Submit evidence to Stripe via API
- **DISP-004** — Resolution handlers: won → release hold, lost → debit seller, post chargeback fee

### Compliance / Tax
- **TAX-007** — TDS deduction (India): for sellers > ₹5L turnover, 1% TDS on payouts; auto-deduct + remit, generate Form 16A
- **TAX-008** — 1099-K (US): track sellers crossing $600 threshold, prepare year-end form via Stripe 1099 API
- **TAX-009** — VAT/MOSS prep (EU) — stub only; full work when EU is added as anchor

### Admin & Ops
- **ADMIN-005** — Payout approval queue (above $10K auto-flagged for review)
- **ADMIN-006** — Manual ledger adjustment tool (audited, requires reason + 2-person approval)
- **ADMIN-007** — Reconciliation dashboard: ledger vs Stripe balance vs bank statement, daily diff

### Frontend
- **SEL-010** — Seller payouts page upgrade: scheduled vs in-transit vs paid, per-currency tabs
- **SEL-011** — Seller earnings drill-down: per-order commission breakdown
- **SEL-012** — Tax document download center
- **BUY-012** — Refund request UI on order detail (within return window)
- **BUY-013** — Refund status tracking page

### Hardening
- **AUDIT-001** — Quarterly external audit of ledger code by accounting firm — schedule
- **TEST-001** — Property-based tests on ledger: random order sequences, balance must stay zero
- **TEST-002** — Chaos test: kill payout worker mid-job, ensure no double-pay
- **DOC-001** — Internal accounting handbook: when to use which ledger account

**Sprint 5 exit:** A real seller in each anchor market gets an automated payout; a real refund flows through and reverses the ledger; chargeback dry-run completes end-to-end.

---

## Risks specific to Phase 2

| # | Risk | Mitigation |
|---|------|------------|
| 1 | Ledger imbalance from a code bug — silent money loss | DB constraint: every transaction must close balanced (Postgres trigger on commit) |
| 2 | Double-payout on retry | Idempotency key on Stripe Transfer = payout.id; DB unique constraint on (sellerId, periodEnd) |
| 3 | Refund after payout → seller balance negative | Stripe Connect supports negative balance; policy doc + monitoring |
| 4 | Tax mis-calculation → liability for Onsective (marketplace facilitator law) | Sandbox-validate every state/country pre-launch; tax counsel sign-off |
| 5 | TDS/1099 misreport → tax-authority fines | Use Stripe 1099 + India CA review; audit trail mandatory |
| 6 | FX rate divergence between Stripe quote and settlement | Use Stripe's quoted rate; record both; reconcile spreads |
| 7 | Commission rule change mid-flight orders | Rules evaluate-and-freeze at order_item creation; never re-read |
| 8 | Chargeback fraud (buyer keeps item, disputes) | Tracking + signature-on-delivery for orders > threshold; Stripe Radar enabled |

---

## Metrics added in Phase 2

- Ledger trial-balance drift (target: 0, alert at $0.01)
- Payout TAT p50 / p95 / p99
- Refund rate by category
- Chargeback rate (target < 0.5%)
- Commission realized vs invoiced (should be 100%)
- Tax remitted vs collected (should be 100%)
- Seller payout success rate (target > 99.5%)
