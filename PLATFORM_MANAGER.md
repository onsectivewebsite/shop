# Platform Manager — Onsective Operations Role
## Detailed phased spec

> **Mission:** Platform Managers (PMs) are the human operations layer between buyers, sellers, and the system. They unblock customers, fix orders, resolve payment issues, recover accounts, moderate content, and escalate to engineering or finance only when needed. They are not super-admins — their power is bounded, audited, and increases with phase maturity.

---

## 1. Why this role exists (and why not just "admin")

A flat "admin" role is dangerous and lazy. A platform manager:

- Can fix 90% of customer issues without engineering.
- Should NOT be able to modify commission rates, edit the ledger, change system config, or run SQL.
- Should be hireable as ops talent (not engineers) — ~$25K–60K/yr globally — at a 1:5,000 buyers ratio in v1, scaling thinner as automation kicks in.
- Every action they take is audited and reviewable.
- Above defined dollar thresholds, their actions require a second-person approval ("4-eyes principle").

**The role's existence forces good architecture:** every powerful action must be exposed as a UI feature, not a SQL query. That's a healthy constraint.

---

## 2. Role hierarchy

```
                            ┌──────────────────┐
                            │     OWNER        │   founder(s) — rare,
                            │  (super-admin)   │   highest auth, billing
                            └────────┬─────────┘
                                     │
                            ┌────────┴─────────┐
                            │     ADMIN        │   eng leads, head-of-ops
                            │  (full system)   │   commission rules, ledger, RBAC
                            └────────┬─────────┘
                                     │
                ┌────────────────────┼────────────────────┐
                │                    │                    │
        ┌───────┴───────┐    ┌───────┴───────┐    ┌───────┴───────┐
        │   PLATFORM    │    │   FINANCE     │    │   CATALOG     │   specialist tracks
        │   MANAGER     │    │   OPS         │    │   MODERATOR   │   (added Phase 4+)
        │  (this doc)   │    │ (refunds,     │    │ (product      │
        │               │    │  reconciles)  │    │  approvals,   │
        │               │    │               │    │  takedowns)   │
        └───────┬───────┘    └───────────────┘    └───────────────┘
                │
        ┌───────┴───────┐
        │   SUPPORT     │   front-line, narrowest scope, view-mostly
        │   AGENT       │
        └───────────────┘
```

In v1 you only need three: **ADMIN, PLATFORM_MANAGER, SUPPORT_AGENT**. The rest are organizational specializations of the PM role; all use the same Console.

---

## 3. Permission matrix

Read this table left-to-right. **✓ = can do, with audit. ⚠ = can do, requires 2-person approval. ✗ = cannot.**

| Capability | Buyer | Seller | Support | Platform Mgr | Admin | Owner |
|---|---|---|---|---|---|---|
| **User accounts** | | | | | | |
| Search any user | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Send password-reset email | self | self | ✓ | ✓ | ✓ | ✓ |
| Force-set password (last resort) | ✗ | ✗ | ✗ | ⚠ | ✓ | ✓ |
| Update user email/phone (post-verify) | self | self | ✗ | ✓ | ✓ | ✓ |
| Suspend user | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Delete user (GDPR/DPDP request) | self | self | ✗ | ⚠ | ✓ | ✓ |
| Read-only "View as user" (no actions) | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Login-as user (act as them) | ✗ | ✗ | ✗ | ✗ | ⚠ | ⚠ |
| **Sellers** | | | | | | |
| View seller details | ✗ | self | ✓ | ✓ | ✓ | ✓ |
| Approve KYC | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Reject KYC | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Suspend seller (small) | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Suspend top seller (>$50K MTD GMV) | ✗ | ✗ | ✗ | ⚠ | ✓ | ✓ |
| Adjust seller commission % (one-off) | ✗ | ✗ | ✗ | ⚠ | ✓ | ✓ |
| Permanently ban seller | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| **Orders** | | | | | | |
| View any order | self | own items | ✓ | ✓ | ✓ | ✓ |
| Cancel order pre-ship | self | own items | ✓ | ✓ | ✓ | ✓ |
| Cancel order post-ship | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Issue refund < $500 | ✗ | own | ✗ | ✓ | ✓ | ✓ |
| Issue refund $500–$5,000 | ✗ | ✗ | ✗ | ⚠ | ✓ | ✓ |
| Issue refund > $5,000 | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| Override refund policy | ✗ | ✗ | ✗ | ⚠ | ✓ | ✓ |
| Re-deliver / re-ship at platform cost | ✗ | ✗ | ✗ | ⚠ | ✓ | ✓ |
| **Payments** | | | | | | |
| Retry failed payout | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Hold seller payouts (fraud/dispute) | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Release held payout | ✗ | ✗ | ✗ | ⚠ | ✓ | ✓ |
| View payment details for any order | ✗ | own | ✓ | ✓ | ✓ | ✓ |
| Manually mark COD remitted | ✗ | ✗ | ✗ | ⚠ | ✓ | ✓ |
| **Catalog** | | | | | | |
| View any product | ✓ | own | ✓ | ✓ | ✓ | ✓ |
| Approve product listing | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Reject product listing | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Take down live product | ✗ | own | ✗ | ✓ | ✓ | ✓ |
| Hide review | ✗ | flag | ✓ | ✓ | ✓ | ✓ |
| **Shipping** | | | | | | |
| Re-create shipment after carrier loss | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Override declared weight | ✗ | ✗ | ✗ | ⚠ | ✓ | ✓ |
| File insurance claim on behalf of seller | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Assign carrier exception to ops queue | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| **System / risky** | | | | | | |
| Edit commission rules | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| Edit/adjust ledger entries | ✗ | ✗ | ✗ | ✗ | ⚠ | ⚠ |
| Toggle feature flags | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| Change RBAC, add admins | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Run SQL / data export | ✗ | ✗ | ✗ | ✗ | ⚠ | ✓ |

**4-eyes implementation:** any ⚠ action shows a "Request approval" UI; second authorized user gets notification + approval link; action executes only after second click. Both actors recorded in audit log. Self-approval blocked.

---

## 4. Platform Manager Console — overview

A dedicated app at `console.onsective.com` (separate from buyer/seller webs and from super-admin). Single-purpose, fast, keyboard-first. Designed for someone working a queue of tickets all day.

### 4.1 Console layout

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ Onsective Console                       [Cmd-K search]              Alex K. ▾  │
├──────────┬─────────────────────────────────────────────────────────────────────┤
│ ▶ Inbox  │  Inbox · My queue                       [refresh] [filters]         │
│ Tickets  │ ─────────────────────────────────────────────────────────────────── │
│ Orders   │ ⏰ SLA  Type      Subject                          From    Updated  │
│ Users    │ 🔴 OVR  Refund    "haven't received order"        sneha@   3m       │
│ Sellers  │ 🟠 1h   Shipping  "package marked delivered, not  john@    18m      │
│ Catalog  │            received"                                                │
│ Disputes │ 🟢 4h   Account   "can't log in"                  ramesh@  31m      │
│ Returns  │ 🟢 4h   Order     "wrong item delivered"          tina@    47m      │
│ Tools ▾  │ 🔵 ovrn Question  "how do I add a tracking #?"    amit@    2h       │
│          │                                                                     │
│ ↓ Macros │ Bulk: ☐ select all  [Assign to...] [Add tag] [Set priority]         │
│ ↓ Reports│                                                            ◀ 1 2 3 ▶│
└──────────┴─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Cmd-K palette (universal search + actions)

```
┌─────────────────────────────────────────────────────────────┐
│ 🔍  ord 00123                                               │
├─────────────────────────────────────────────────────────────┤
│ ORDERS                                                      │
│   📦 ONS-2026-00123 — ₹8,434 — DELIVERED — sneha@gmail.com  │
│   📦 ONS-2026-00124 — $12.50 — SHIPPED — john@yahoo.com     │
│ USERS                                                       │
│   👤 Sneha Kumar — sneha@gmail.com — buyer — IN             │
│ ACTIONS                                                     │
│   ⚡ Issue refund for order ONS-2026-00123                  │
│   ⚡ Send password reset to sneha@gmail.com                 │
│   ⚡ View as Sneha (read-only)                              │
│ MACROS                                                      │
│   🤖 "Send 'order delayed' template"                        │
└─────────────────────────────────────────────────────────────┘
```

Universal search is non-negotiable. PMs are paid by the ticket; every click matters.

### 4.3 Order Workspace (the most-used screen)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ ◀ Inbox   Order ONS-2026-00123                    Status: SHIPPED  ⏰ SLA 1h   │
├────────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────┬──────────────────────────────────────────────┐│
│ │  CUSTOMER                    │  CONVERSATION                                ││
│ │  Sneha Kumar                 │  ─────────────────────────────────────────── ││
│ │  sneha@gmail.com             │  Sneha · 14:02 (chat)                        ││
│ │  +91 98765 43210             │  > I haven't received my order, the          ││
│ │  4 prior orders · ₹12,450    │  > tracking says delivered but it isn't here ││
│ │  Member since 2025-11        │                                              ││
│ │  [View profile] [View as]    │  📎 photo.jpg attached                       ││
│ │                              │                                              ││
│ │  ORDER                       │  ─────────────────────────────────────────── ││
│ │  Total: ₹8,434               │  [Compose reply] [Macro ▾] [Internal note]   ││
│ │  Placed: Sat 26 Apr          │                                              ││
│ │  Items: 2                    │  ╭──────────────────────────────────────────╮││
│ │  Seller: Acme Audio          │  │ Hi Sneha, I'm sorry to hear that. I've   │││
│ │  Shipment: Delhivery         │  │ ...                                      │││
│ │  AWB: 1Z999AA1...            │  │                                          │││
│ │  Status: DELIVERED 28 Apr    │  ╰──────────────────────────────────────────╯││
│ │  POD photo: [view]           │  [Send]   [Send + Resolve]                   ││
│ │                              │                                              ││
│ │  ACTIONS                     │  ── Internal notes (not visible to buyer) ── ││
│ │  [Cancel order]              │  No internal notes yet.                      ││
│ │  [Issue refund]              │                                              ││
│ │  [Re-deliver at platform $]  │                                              ││
│ │  [Open dispute with carrier] │                                              ││
│ │  [Escalate to FinOps]        │                                              ││
│ │  [Mark unsolvable]           │                                              ││
│ └──────────────────────────────┴──────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────────────────────┘
```

### 4.4 User Workspace

Same shape as Order Workspace but shows: profile, recent orders, recent tickets, recent IPs/devices, fraud-score (Phase 4), notes from past interactions, password-reset history. Actions: send reset, force-reset (⚠), suspend, view-as (read-only).

---

## 5. Phased capability rollout

The PM role exists from day 1, but capabilities ramp with the platform.

### Phase 1 (Weeks 3–10) — bare-minimum PM tools
- Ticket inbox (fed by buyer-support form, seller-support form, email-to-ticket via SES)
- Order workspace: view, cancel pre-ship, issue refund < $500
- User workspace: view profile, send password-reset email
- Seller KYC review queue (approve / reject / request-more-info)
- Internal notes per ticket / per user / per seller
- Audit log: every PM action recorded

### Phase 2 (Weeks 11–14) — payment ops added
- Refund queue with reason codes
- 4-eyes refund approval ($500–$5K tier) — second-PM approves via in-console review
- Hold/release seller payouts
- Failed payout retry button
- Stripe dispute response collection (gather evidence; upload via Stripe API)
- COD remittance flagging (for India)
- "Match buyer to seller" tool — when a buyer says "the seller said this": shows messaging history

### Phase 3 (Weeks 15–22) — shipping exceptions
- Stuck-shipment dashboard (no movement > N days)
- One-click "open carrier ticket" with pre-filled context
- Re-deliver / re-ship at platform expense (PM authority within $ limit)
- Mark shipment lost → triggers refund + insurance claim workflow
- RTO inbox: PM contacts buyer to retry delivery before forcing RTO
- Weight-discrepancy review queue
- POD review (proof-of-delivery photo / signature)

### Phase 4 (Weeks 23–30) — content, fraud, scale
- Product moderation queue (catalog moderator role becomes a sub-track)
- Review moderation: hide / unhide / appeal-review
- Fraud signals dashboard (Phase 4 fraud engine outputs)
- Bulk actions (bulk-cancel an event-affected order set, bulk-message buyers)
- Macros / canned responses with variable substitution
- Auto-routing: tickets routed by SLA, language, seller-tier
- Multi-language inbox tabs
- Mobile companion app (PM on call)

### Phase 5 (Month 8+) — team management & analytics
- Per-PM productivity dashboard (tickets/day, FCR rate, CSAT)
- Workforce management (shift schedules, coverage, on-call)
- Tier-2 escalation tree
- Dedicated Catalog Moderator + Finance Ops sub-tracks
- AI-assist: suggested replies, auto-categorization, auto-resolve simple tickets (with human review)
- Onsective University (training videos for new PM hires)
- Quality-assurance program: senior PM audits 5% of tickets

---

## 6. Security model

### 6.1 Identity & access
- Mandatory **TOTP 2FA** (or hardware key) on every PM/admin login.
- Optional **passkey** (WebAuthn) — recommended.
- IP allowlist per PM team (office VPN or named ranges).
- Session TTL: 8 hours, hard re-auth at 24h.
- Auto-lock after 10 min idle.

### 6.2 Audit & accountability
- Every read of customer-PII: logged (who, what, when, ticket-id-context).
- Every mutation: full diff in audit log; who, when, why (reason field required).
- Audit log is **append-only**, replicated to S3 with object-lock 90-day; 7-year cold-archive.
- Weekly automated review: anomaly detection on PM activity (sudden spike in refunds, late-night account access, repeated password resets for same user).
- Quarterly random sample: SecOps reviews 100 PM actions for policy compliance.

### 6.3 Privacy
- PII fields masked by default: card last-4 only, full address only on click ("reveal address" auto-logged), tax ID never shown to PM tier.
- "View as user" is **read-only impersonation** with banner; PM can see what user sees but cannot click anything.
- "Login as user" (full impersonation) is **admin-only with 4-eyes** and only for severe debug.

### 6.4 4-eyes (two-person approval) flow
```
PM clicks ⚠ action  →  "Request approval" modal: reason required, target named
                    →  webhook to #pm-approvals Slack channel + in-console banner
                    →  Second PM (any qualified) clicks Approve / Deny
                    →  Mutex: same person can't approve their own
                    →  Action executes; both names + timestamp on audit row
```

### 6.5 Sensitive action throttles
- Per-PM daily caps: refund total, suspend count, password-reset count.
- Cap exceedance pages PM Lead.

---

## 7. Workflows (in detail)

### 7.1 Support ticket lifecycle

```
   ┌──────────────────────────────────────────────────────────┐
   │   INTAKE (buyer/seller form, email, chat widget)         │
   └────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
        ┌───────────────────────────────────┐
        │  AUTO-CLASSIFY                    │
        │  category, language, priority     │
        │  attach related order/user        │
        │  assign SLA                       │
        └───────────────────┬───────────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
                ▼                       ▼
        ┌───────────────┐    ┌─────────────────────┐
        │  Auto-resolve │    │  Round-robin assign │
        │  (Phase 4):   │    │  to available PM    │
        │  e.g. "where  │    │  by skill + load    │
        │  is my order" │    └──────────┬──────────┘
        │  reply with   │               │
        │  tracking link│               ▼
        └───────────────┘    ┌─────────────────────┐
                             │  PM works ticket    │
                             │  (replies, actions, │
                             │   internal notes)   │
                             └──────────┬──────────┘
                                        │
                          ┌─────────────┼─────────────┐
                          │             │             │
                          ▼             ▼             ▼
                    ┌──────────┐  ┌──────────┐  ┌──────────┐
                    │ RESOLVED │  │ESCALATED │  │ ON HOLD  │
                    │ + CSAT   │  │ to FinOps│  │ (waiting)│
                    │ survey   │  │ /Eng/Ops │  │          │
                    └──────────┘  └──────────┘  └──────────┘
```

### 7.2 Order intervention workflow

```
PM opens Order Workspace
        │
        ▼
What does the customer want?
   │
   ├─ "Cancel my order" (not yet shipped)
   │      → [Cancel pre-ship] → automatic refund → restock inventory
   │
   ├─ "Cancel" (shipped)
   │      → [Cancel post-ship]: RTO flow + buyer-paid OR platform-paid return
   │      → if > $500: ⚠ approval
   │
   ├─ "I didn't receive it" (carrier shows delivered)
   │      → check POD photo
   │      → contact buyer for porch/neighbor check
   │      → file claim with carrier (insurance)
   │      → if claim accepted: refund buyer, recover from insurance
   │      → if claim denied + buyer credible: refund anyway, eat cost (≤$500 PM auth)
   │
   ├─ "Wrong item received"
   │      → request photo evidence
   │      → confirm with seller
   │      → return + replacement workflow
   │
   ├─ "Item damaged"
   │      → photo evidence
   │      → return + refund or replacement
   │      → seller's RMA queue, not PM auth (unless seller absent > 48h)
   │
   └─ "Late delivery — want refund"
          → check carrier exception flag
          → goodwill credit (Phase 4 store credit) or partial refund
          → escalate carrier SLA breach
```

### 7.3 Password reset workflow

```
PM verifies identity (challenge questions, recent order details, last 4 of card on file)
        │
        ▼
[Send reset email]  ← standard path; user clicks link in email, sets new password
        │
        ▼
If user can't access email:
        │
        ▼
[Update email]  → requires owner-of-account proof + 4-eyes
        │
        ▼
[Force-set password] (last resort, ⚠ approval)
   → generates random temp password
   → sends to verified-secondary-channel only (phone SMS if phone verified)
   → forces password change on first login
   → audit row + notification to user via all channels
   → Slack alert to security team
```

### 7.4 Refund authorization workflow

```
                  Refund requested
                        │
                        ▼
              Auto-classify amount tier
                        │
        ┌───────────────┼───────────────┬────────────────┐
        │               │               │                │
        ▼               ▼               ▼                ▼
    < $500          $500–$5K        $5K–$50K          > $50K
    PM acts         PM ⚠ + 2nd PM   Admin ⚠            Owner ⚠
                                    + Finance Ops      + Finance lead
        │
        ▼
Reason code required: defective | not received | not as described |
                       fraud | goodwill | duplicate | other
        │
        ▼
Refund target: buyer's original payment method (default) | store credit | bank
        │
        ▼
Stripe Refund API → Ledger reversal entries → Inventory restock if applicable
        │
        ▼
Notify buyer (email + SMS) with timeline
        │
        ▼
Auto-CSAT in 7d
```

### 7.5 KYC review workflow

```
Seller submits KYC
        │
        ▼
PM picks from queue (priority: oldest first; flagged: high-risk-country)
        │
        ▼
Verify each document:
    ─ Govt ID matches name
    ─ Tax cert matches business name
    ─ Bank statement matches payout account
    ─ Address proof matches registered address
    ─ Cross-check sanctions lists (auto by Stripe; PM verifies clean)
        │
        ▼
Decision:
    ┌─ Approve  → seller status APPROVED, can list
    ├─ Request more info  → reason coded, seller notified, status remains
    └─ Reject  → reason coded, seller notified, retry blocked 90d
        │
        ▼
SLA: KYC decision within 2 business days (alert if breached)
        │
        ▼
Audit: full doc-view log + decision recorded
```

### 7.6 Shipping exception resolution

```
Stuck shipment alert (no carrier event in 5d)
        │
        ▼
PM clicks shipment in queue
        │
        ▼
Console shows: full timeline, last known location, carrier dashboard link, comparable lane SLA
        │
        ▼
Decision tree:
    ┌─ Carrier-side delay (covid, weather, hub backup) → notify buyer + ETA bump
    ├─ Address issue → contact buyer to confirm/correct → reissue if needed
    ├─ Truly lost → mark lost → refund buyer → file insurance claim → notify seller
    └─ Buyer unresponsive 3 attempts → mark RTO → refund on RTO_DELIVERED
        │
        ▼
All steps logged; carrier-ticket # captured
```

### 7.7 Payout dispute (seller says "where's my money")

```
Seller opens ticket: "missing payout for [date]"
        │
        ▼
PM opens seller's payout view
        │
        ▼
Run reconciliation tool: ledger SELLER_PAYABLE - SELLER_PAID = expected balance
        │
        ▼
Cases:
    ┌─ Balance correct, payout pending → explain T+N schedule, give next-payout-date
    ├─ Balance correct, payout failed → click [Retry payout]; if Stripe rejects → check connect account requirements; explain to seller
    ├─ Balance off vs seller's calc → drill into orders; usually buyer refunded after seller calc'd
    ├─ KYC issue → seller must complete; payouts on hold until done
    └─ Genuine ledger drift (rare) → ESCALATE to FinOps + Eng; freeze
        │
        ▼
PM never edits ledger directly (ADMIN-only via 4-eyes)
```

---

## 8. Console wireframes

### 8.1 Sellers list (KYC queue)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Sellers                                                  [+ All sellers] [⚙]  │
├─────────────────────────────────────────────────────────────────────────────────┤
│  Tab: [Pending KYC (17)] [All sellers] [Suspended (3)] [Watchlist (5)]         │
│  ──────────────────────────────────────────────────────────────────────────────│
│  ☐ │ Submitted  │ Legal name        │ Country │ Days waiting │ Risk │ Action  │
│  ☐ │ 26 Apr 9am │ Acme Audio Pvt    │ IN      │ 1d 5h        │ low  │ Review  │
│  ☐ │ 25 Apr     │ J Smith Trading   │ US      │ 2d 1h        │ med  │ Review  │
│  ☐ │ 24 Apr     │ FastFashion Co    │ IN      │ 3d ⚠         │ high │ Review  │
│  ──────────────────────────────────────────────────────────────────────────────│
│  Bulk: ☐  [Reject with reason ▾]                                                │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Seller KYC review screen

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ ◀ Sellers   Acme Audio Pvt Ltd                                  Status: PENDING│
├─────────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────┬────────────────────────────────────────┐ │
│ │ APPLICANT                        │ DOCUMENTS                              │ │
│ │ Legal: Acme Audio Pvt Ltd        │ ┌────────────────────────────────────┐ │ │
│ │ Display: Acme Audio              │ │ [PDF preview] PAN.pdf              │ │ │
│ │ Owner: Rishabh Kumar             │ │ Type: Govt ID                      │ │ │
│ │ Email: rishabh@acmeaudio.in      │ │ Status: ⏳ Verify  [✓] [✗]         │ │ │
│ │ Phone: +91 98765 43210           │ └────────────────────────────────────┘ │ │
│ │ Country: IN                      │ ┌────────────────────────────────────┐ │ │
│ │ Tax ID: 27AAEFI1234B1Z3 (GSTIN)  │ │ [PDF preview] GST_cert.pdf         │ │ │
│ │ Stripe Connect: onboarded        │ │ Type: Tax certificate              │ │ │
│ │                                  │ │ Status: ⏳ Verify  [✓] [✗]         │ │ │
│ │ Stripe risk: 12/100 (low)        │ └────────────────────────────────────┘ │ │
│ │ Sanctions: clean                 │ ┌────────────────────────────────────┐ │ │
│ │                                  │ │ [PDF preview] bank_stmt.pdf        │ │ │
│ │ DECISION                         │ │ Type: Bank statement               │ │ │
│ │ ┌────────────────────────────┐   │ │ Status: ⏳ Verify  [✓] [✗]         │ │ │
│ │ │  ✓ Approve                 │   │ └────────────────────────────────────┘ │ │
│ │ │  ⓘ Request more info       │   │                                        │ │
│ │ │  ✗ Reject                  │   │ INTERNAL NOTES                         │ │
│ │ └────────────────────────────┘   │ ─ none yet ─                           │ │
│ │ Reason: [textarea required]      │ [Add note]                             │ │
│ └──────────────────────────────────┴────────────────────────────────────────┘ │
│ Audit: created 26 Apr · last viewed by Alex K just now                         │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 8.3 4-eyes approval modal

```
┌─────────────────────────────────────────────────────────────┐
│  Approval required                              [esc]       │
├─────────────────────────────────────────────────────────────┤
│  You're about to: Issue refund of ₹4,499 on order           │
│                   ONS-2026-00123                            │
│                                                             │
│  This needs a second approver because amount > ₹5,000.      │
│                                                             │
│  Reason  *                                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Buyer reports item not received; carrier POD photo   │   │
│  │ shows wrong house number. Goodwill refund.           │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  Notify approver  *                                         │
│  ☑ #pm-approvals Slack         ☑ Email                     │
│                                                             │
│           [Cancel]              [Submit for approval]       │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. KPIs for the Platform Manager team

**Service quality**
- First Response Time (FRT) — p50 / p95 (target p50 < 30 min for 24/7 anchor markets)
- Time to Resolution (TTR) — p50 / p95
- First Contact Resolution rate (target > 65%)
- Customer Satisfaction (CSAT) — post-resolution survey (target > 4.3 / 5)
- Net Promoter Score on support touchpoints

**Operational throughput**
- Tickets handled per PM per shift
- Backlog age (oldest open ticket; alert if > 24h)
- Auto-resolution rate (Phase 4)
- Reassignment rate (high = mis-routing)

**Risk / quality**
- Refund $ per PM per week (anomaly detection)
- Reversed-decision rate (PM approved KYC, later flagged fraud)
- 4-eyes denial rate (high may indicate over-aggressive approvals)
- Audit-violation count (zero target)

**Cost**
- Cost per ticket (PM payroll / tickets handled)
- Tickets per 1,000 orders (proxy for product/UX health — as it drops, the team scales sub-linearly with GMV)

---

## 10. Risks & mitigations

| # | Risk | Mitigation |
|---|------|------------|
| 1 | PM colludes with seller for fake refunds | 4-eyes above $500; anomaly detection on refund-to-same-seller pattern; quarterly audit |
| 2 | PM accidentally exposes PII | Field-level masking by default; reveal-clicks audited; quarterly DLP scan |
| 3 | PM force-resets password to take over a buyer account | Force-reset is ⚠ + secondary-channel-only delivery; user notified on every channel |
| 4 | Refund abuse by buyers ("never received" repeatedly) | Per-buyer refund-rate flag in console; auto-escalate after 3rd refund; PM sees flag |
| 5 | Burnout / churn (support is high-stress) | Daily ticket caps; mandatory breaks; rotation between queues; CSAT tied to compensation but not in punitive way |
| 6 | Single point of failure when PM team is small | Round-robin auto-assign; on-call escalation; PM lead can re-assign |
| 7 | Manual KYC errors lead to fraud sellers approved | Risk score from Stripe + sanctions checks pre-shown; PM cannot approve a high-risk seller without ⚠ |
| 8 | Off-platform escalations (PM gives personal email) | Console-only communication policy; outbound emails go from no-reply@ with secure-reply links; violations terminable |
| 9 | Tickets pile up during incident (Stripe down, carrier outage) | Macro: bulk-message all affected; status-page integration; escalation tree to engineering |
| 10 | Multi-language coverage gaps as anchors expand | Hire native-speaking PMs in time-zone bands; ticket auto-translate (Phase 4) |

---

## 11. Hiring & training

### Hiring sequence
- **Month 1–2**: 1 PM Lead (will become head-of-ops). Senior, marketplace-experienced, hires the rest.
- **Month 3–4**: 2 PMs covering US-day + India-day timezones.
- **Month 5–6** (launch): 4 total PMs + 1 PM Lead.
- **Month 7+**: scale at ~1 PM per 5,000 monthly active buyers; sub-tracks (catalog moderator, finance ops) when each tops 50% of one PM's time.

### Onboarding curriculum (2 weeks)
- Week 1
  - Day 1: marketplace 101, Onsective values, customer obsession
  - Day 2: console tour, all queues, Cmd-K
  - Day 3: order anatomy, payments, shipping
  - Day 4: shadow-mode (read tickets, no actions)
  - Day 5: handle low-risk tickets pair-programmed with senior
- Week 2
  - Day 6–8: solo on low-risk tickets, senior reviews 100%
  - Day 9: KYC training, fraud signals, escalation rules
  - Day 10: certification quiz; ramp to full queue if passed

### Ongoing
- Weekly 30-min team huddle; monthly QA review of 5% of each PM's tickets.
- Quarterly: refresh on new features, policy changes.
- Career path: PM → Senior PM → PM Lead → Head of Ops; or Specialist (Catalog Mod, Finance Ops, Trust & Safety).

### Compensation principles
- Base salary primary; small bonus on CSAT + FCR — never on volume alone (incentive trap).
- 24/7 coverage = shift premium for nights/weekends.
- Career-ladder transparent; promote internally before hiring.

---

## 12. Schema additions needed

The current `schema.prisma` covers most of this, but needs:

1. **Expand `UserRole`** enum to include `PLATFORM_MANAGER`, `FINANCE_OPS`, `CATALOG_MODERATOR`, `OWNER`.
2. **`SupportTicket` model** — id, channel, subject, status, priority, slaDueAt, assignedToId, customerId, relatedOrderId, relatedSellerId, language, tags[], firstResponseAt, resolvedAt
3. **`SupportMessage` model** — id, ticketId, authorType (customer / pm / system), body, attachments[], internal: bool, createdAt
4. **`ApprovalRequest` model** — id, requesterId, action, payload(json), reason, status, approverId, approvedAt
5. **`ImpersonationSession` model** — id, pmId, targetUserId, mode (read-only / full), startedAt, endedAt, ticketContextId
6. **`AdminAction` log** — extension of AuditLog; includes ipAddress, sessionId, ticketContextId, beforeJson, afterJson — required for high-sensitivity actions

These get added in Phase 1 alongside the basic console.

---

## 13. Where this lives in the PLAN

This doc replaces the placeholder "Admin / Ops Console" boxes scattered across PLAN.md, PHASE1_SPRINTS.md, etc. The sprint tickets that build the PM Console are listed below per phase — fold into the existing sprint plans at hand-off:

**Phase 1 add-ons (add to PHASE1_SPRINTS.md Sprint 1 and 3):**
- CONSOLE-001 — Console app skeleton (separate Next.js app; same monorepo; auth via shared session; RBAC middleware)
- CONSOLE-002 — Cmd-K palette
- CONSOLE-003 — Inbox + ticket workspace
- CONSOLE-004 — Order workspace (read + cancel + refund < $500)
- CONSOLE-005 — User workspace (search, view, send password reset)
- CONSOLE-006 — Seller KYC queue + review screen
- CONSOLE-007 — Audit log writer + viewer
- CONSOLE-008 — 2FA enforcement + IP allowlist (Cloudflare Access or AWS WAF)

**Phase 2 add-ons:**
- CONSOLE-010 — 4-eyes approval workflow
- CONSOLE-011 — Refund queue + tier-based authorization
- CONSOLE-012 — Payout hold/release tools
- CONSOLE-013 — Stripe dispute evidence collection

**Phase 3 add-ons:**
- CONSOLE-020 — Stuck-shipment dashboard
- CONSOLE-021 — Carrier exception ticket creator
- CONSOLE-022 — Re-deliver / re-ship at platform expense
- CONSOLE-023 — Insurance claim filing UI

**Phase 4 add-ons:**
- CONSOLE-030 — Macros, canned responses
- CONSOLE-031 — Multi-language inbox
- CONSOLE-032 — Auto-routing + skill-based assignment
- CONSOLE-033 — Fraud signals dashboard
- CONSOLE-034 — Mobile companion app

**Phase 5 add-ons:**
- CONSOLE-040 — Productivity analytics + per-PM scorecards
- CONSOLE-041 — AI-assist (suggested replies, auto-categorize, auto-resolve safe tickets)
- CONSOLE-042 — Shift management + on-call rotation
- CONSOLE-043 — Onsective University (training portal)
