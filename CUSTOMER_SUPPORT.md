# Onsective Customer Support System
## Multi-channel · Ticketing · RMA · Automation · Feedback

> **Why this is its own document:** the support system is not a feature, it's a product. PLATFORM_MANAGER.md describes the *role*; this describes the *system*. Together they define how Onsective handles every customer issue.

---

## 1. Goals

| Goal | Metric | Target by Phase 4 |
|---|---|---|
| Customers can self-serve simple issues | self-service resolution rate | ≥ 40% |
| Real humans reachable when needed | first response p50 (chat) | < 5 min |
| Issues resolved without ping-pong | first contact resolution | ≥ 65% |
| Customers feel heard | CSAT post-resolution | ≥ 4.3 / 5 |
| Patterns trigger product fixes | tickets per 1,000 orders | trending down |
| Cost per ticket under control | $ / ticket | within market norm |

---

## 2. Channel architecture

```
                          ┌─────────────────────────────┐
                          │    UNIFIED INBOX (Console)  │
                          │   one queue, one workflow   │
                          └──────────┬──────────────────┘
                                     │
       ┌─────────────────────────────┼─────────────────────────────┐
       │                             │                             │
       ▼                             ▼                             ▼
┌─────────────┐              ┌──────────────┐              ┌──────────────┐
│  In-app     │              │ Email-to-    │              │ Phone (IVR)  │
│  chat       │              │ ticket       │              │ → callback   │
│ (Phase 4    │              │              │              │ scheduler    │
│  realtime)  │              │ help@        │              │ (Phase 4)    │
└──────┬──────┘              └──────┬───────┘              └──────┬───────┘
       │                            │                             │
       ▼                            ▼                             ▼
┌─────────────┐              ┌──────────────┐              ┌──────────────┐
│ Web form    │              │ WhatsApp     │              │ Social DM    │
│ (any user)  │              │ (Phase 4 IN) │              │ (Phase 5)    │
└─────────────┘              └──────────────┘              └──────────────┘
                                     │
                                     ▼
                          ┌─────────────────────────────┐
                          │   AI Chatbot (Phase 4)      │
                          │   handles 30–50% before     │
                          │   handoff to human          │
                          └─────────────────────────────┘
```

### 2.1 In-app chat
- Embedded widget on every authenticated page (buyer + seller)
- Context-aware: knows current page, recent order, user identity
- Phase 1: form-based (offline mode, ticket creates, email reply)
- Phase 4: realtime via WebSocket; typing indicators; file attachments

### 2.2 Email
- `help@onsective.com` → SES inbound rule → S3 → Lambda → ticket creator
- Threads matched by ticket ID in subject `[ONS-T-2026-000123]`
- Outbound from `support@onsective.com` (DMARC-aligned, SPF, DKIM)

### 2.3 Phone (Phase 4)
- Twilio Voice IVR: language selection → topic → callback request (no live queue v1)
- Callback within SLA hours scheduled into PM's calendar
- Live calls Phase 5 (call center buildout if volume warrants)

### 2.4 WhatsApp (Phase 4, India anchor)
- WhatsApp Business API via Twilio or Gupshup
- Template messages for transactional (order shipped, OTP)
- Two-way for support — same ticket pipeline

### 2.5 Web form
- Public unauthenticated form for "I can't log in"
- Captures email + phone for verification
- Spam protection: hCaptcha + email verification on first ticket

### 2.6 Social DMs (Phase 5)
- X / Twitter, Instagram, Facebook DMs piped via Sprout Social or Khoros
- Same unified inbox

---

## 3. Ticketing system

### 3.1 Ticket lifecycle

```
                    ┌────────────┐
                    │   OPEN     │  newly created
                    └─────┬──────┘
                          │ PM picks up / auto-assign
                          ▼
                    ┌────────────┐
              ┌──── │ IN_PROGRESS│ ───┐
              │     └─────┬──────┘    │
   PM replies │           │           │ awaiting customer info
              │           │           │
              ▼           ▼           ▼
   ┌──────────────┐  ┌──────────┐  ┌──────────────────┐
   │PENDING_      │  │ON_HOLD   │  │PENDING_CUSTOMER  │
   │INTERNAL      │  │(parts    │  │                  │
   │(eng/finance) │  │needed)   │  │                  │
   └──────┬───────┘  └────┬─────┘  └──────┬───────────┘
          │               │               │
          └───────┬───────┴───────────────┘
                  │ resolved
                  ▼
            ┌──────────────┐
            │   RESOLVED   │
            └──────┬───────┘
                   │ CSAT survey sent; auto-close 7 days
                   ▼
            ┌──────────────┐
            │   CLOSED     │  customer can REOPENED within 30d
            └──────────────┘
```

### 3.2 Ticket attributes

- Channel (chat, email, phone, etc.)
- Subject
- Priority: `LOW / NORMAL / HIGH / URGENT` (auto-set by classifier; PM can override)
- Status (above)
- Assignee (one PM at a time; assignee history kept)
- Tags (customizable: refund, shipping-lost, login-issue, ...)
- Linked entities: order, seller, shipment, product
- Language (auto-detected; routing uses)
- SLA due time (computed from priority + plan)

### 3.3 SLA targets

| Priority | First response | Resolution |
|---|---|---|
| URGENT (payment, security, missing $$$) | 15 min | 2 h |
| HIGH (lost shipment, can't log in, account locked) | 1 h | 8 h |
| NORMAL (refund, return, generic) | 4 h | 24 h |
| LOW (question, feedback) | 1 day | 3 days |

24/7 coverage in Phase 4; business-hours-by-anchor before that.

### 3.4 Attachments

- Up to 10 per message
- Image, PDF, audio, common formats
- 25 MB / file
- Stored in S3, signed-URL access expires 1h
- ClamAV scan async; quarantine on positive

### 3.5 Internal notes

- Visible only to PMs; never to customer
- Tagged: `@user` for mentions, `#tag` for searchable
- Used for handoffs, context, escalation reasoning

---

## 4. Returns & Refunds (RMA)

### 4.1 Why RMA is hardest

Returns are where ops, money, inventory, and shipping all collide. A clean RMA:
- restores money to buyer correctly
- gets goods back to seller (or NOT, depending on cost)
- adjusts inventory accurately
- doesn't get gamed
- doesn't take 6 weeks

### 4.2 Return reason taxonomy

| Reason | Buyer-paid return? | Seller-paid? | Restocking fee? | Auto-approve? |
|---|---|---|---|---|
| Defective / not working | no | yes | no | yes (with photos) |
| Damaged in shipping | no | no (carrier insurance) | no | yes (with photos) |
| Not as described | no | yes | no | review |
| Wrong item received | no | yes | no | review |
| Changed mind | yes | no | up to 15% | review |
| Doesn't fit (apparel) | yes | no | no | yes |
| Better price elsewhere | n/a | n/a | n/a | reject (out of policy) |

Reasons feed analytics — high "not as described" rates point to bad listings (intervene with seller).

### 4.3 RMA flow (canonical)

```
Buyer opens "Return this item" on order detail
    ↓
Reason picker → photo upload (required for defective/damaged)
    ↓
System creates ReturnRequest (status: REQUESTED)
    ↓
Auto-rules:
   - "defective" + photos + within window → AUTO_APPROVED
   - "changed mind" within window + low-value → AUTO_APPROVED
   - else → seller queue
    ↓
Seller approves / rejects / asks more info (24h SLA)
    ↓
On approve: reverse shipment created (carrier picks up from buyer)
    ↓
Carrier delivers to seller pickup address
    ↓
Seller inspects → ACCEPT or REJECT (with reason)
    ↓
On ACCEPT:
   - refund to buyer (full or partial per policy)
   - inventory restock (seller toggles "resaleable" flag)
   - ledger reversal
On REJECT:
   - escalate to PM mediation
   - PM may force-refund (eats into seller payout)
    ↓
Buyer notified at every step
```

### 4.4 Replacement orders

When replacement is preferred over refund:
- New order created (zero buyer charge; ledger entry from REPLACEMENT_RESERVE)
- Linked to original via `replaces_order_id`
- Seller ships replacement; refund of original held until both legs confirmed

### 4.5 Refund timelines (set buyer expectation honestly)

- Card refunds: 3–5 business days back to card
- UPI: same day usually
- Bank transfer (rare): 5–7 days
- Store credit: instant

Buyer-facing language: "You'll see this within 5 working days" not "instant" — better expected disappointment than felt.

### 4.6 Anti-abuse

- Per-buyer return-rate flag in console
- Auto-flag at 3rd return in 90 days
- After 5 in 90 days: auto-restocking fee on next, or block returns
- Photo evidence retained for evidence in case of chargeback

---

## 5. Order issue handling

For order-level problems beyond RMA.

### 5.1 Lost shipment

Detection: tracking stuck N days; carrier-confirmed lost.

Resolution decision tree:
```
Was insurance attached?
  Yes → file claim → wait outcome → refund buyer
                   → if claim won: recover funds
                   → if claim lost: platform eats cost (or seller, per policy)

  No  → buyer credibility check (history, IP, address):
        Credible → refund buyer (PM auth ≤ $500), platform eats cost
        Suspicious → require police report / signed denial → refund only after
```

### 5.2 Damaged in transit

Photo evidence required. Insurance claim if possible. Replacement preferred over refund.

### 5.3 Wrong item delivered

Seller error. Replacement free; original returned at seller's cost.

### 5.4 Address-not-found / RTO
- Auto-detect from carrier exception
- PM contacts buyer 3 attempts (call + SMS + email) within 48h
- If reached: reissue with corrected address
- If not: process RTO; buyer charged return shipping (configurable per region)

### 5.5 Payment failure post-order
- PaymentIntent failed → order remains CREATED 30 min
- Notification to buyer with retry link
- Auto-cancel after 30 min; release inventory reservation

### 5.6 Escalation system

```
PM (level 1) — < $500 refund authority
    ↓ unable to resolve in SLA / above threshold
Senior PM (level 2) — < $5K refund authority
    ↓
PM Lead — escalation owner
    ↓
Admin / Finance Ops — > $5K refund, ledger questions
    ↓
VP Operations — policy decisions, repeat issues
    ↓
Owner — only for crisis / brand
```

Each escalation step records why; we use the data to expand level-1 authority where patterns prove safe.

---

## 6. Automation

### 6.1 Auto-replies

On ticket creation, buyer gets:
- Ticket ID
- Estimated first response time
- Self-service link relevant to category (e.g. tracking link if category=shipping)

### 6.2 Self-service deflection

Before ticket form submits, "Is this what you mean?" with suggested help articles. ~20% of users find their answer here. Tracked as "deflected."

### 6.3 AI chatbot (Phase 4)

Capabilities:
- Order status lookups ("where is my order?")
- Tracking info
- Return request initiation (gathers info, creates ticket pre-filled)
- FAQ answers (powered by knowledge base)
- Language detection + response

Limits:
- Can NOT issue refunds
- Can NOT change account details
- Can NOT promise outcomes ("we'll absolutely refund you")
- Hard handoff to human at any sign of frustration

Implementation: Claude/OpenAI with retrieval over our help-center articles + structured order data tool. Logged + reviewable.

### 6.4 Smart routing

Route by: language, channel, ticket category, PM skill (Phase 4 skill matrix), queue depth, time-zone availability.

Round-robin within eligible pool. Sticky reassignment on customer reply (back to same PM if available).

### 6.5 Auto-categorization & priority

- Subject + body → ML classifier (Phase 4) → category + priority
- Pre-Phase-4: keyword rules table
- Always overridable by PM

### 6.6 Auto-resolve safe categories (Phase 4)

| Category | Auto-resolve when |
|---|---|
| "Where is my order?" | tracking has movement in last 24h → reply with link |
| "When will I get my refund?" | refund initiated, < SLA → reply with status + ETA |
| "Forgot password" | trigger reset email → close |
| "How to return?" | redirect to return wizard |

Auto-resolve always sends to a "validation" queue — first 100 spot-checked daily; CSAT measured.

---

## 7. Customer feedback loop

### 7.1 CSAT post-resolution

- Email survey 1h after ticket closed
- 1–5 stars + free text
- Score below 4 triggers manual review by PM Lead

### 7.2 Post-delivery feedback (separate from product reviews)

- Triggered 3 days post-delivery
- Single-question NPS: "How likely to recommend Onsective?"
- Optional follow-up

### 7.3 Complaint analytics

Dashboard for product team:
- Tickets per 1,000 orders, trending
- Top categories last 7 / 30 days
- Sellers driving disproportionate tickets
- Geographies driving disproportionate tickets
- Product SKUs driving disproportionate returns

These feed weekly product/ops standup. The whole point of support is to find patterns and *fix the product* so the ticket doesn't happen next time.

### 7.4 Voice of Customer reports

Monthly: senior PM compiles "what hurts" — top 10 themes, suggested product/UX fixes. Eng leadership commits to one per quarter.

---

## 8. Knowledge base / Help center

- Public help articles at `help.onsective.com`
- Categories: Buying / Selling / Shipping / Returns / Account / Payments
- SEO-optimized (each article: title, structured data, internal links)
- Breadcrumb back to homepage
- Search across articles
- Localized (Phase 4)
- "Was this helpful?" feedback drives content priorities
- Articles version-controlled in repo (markdown), CMS UI for non-eng editing (Phase 4)

---

## 9. Internal team management (support side)

Detailed in `PLATFORM_MANAGER.md` — this section calls out support-specific concerns.

### 9.1 Roles inside support

- **Support Agent** — front-line; handles low-complexity tickets; escalates rest
- **Platform Manager** — full PM scope (per PLATFORM_MANAGER.md)
- **Senior PM** — escalation target; tier-2 authority; mentors
- **PM Lead** — manages team, schedules, audits
- **Trust & Safety specialist** (Phase 4) — fraud, disputes, prohibited items

### 9.2 Workflow management

- Auto-assignment with skill match
- SLA timer visible on every ticket
- Reassignment requires reason
- "Watch" feature: senior PMs can subscribe to escalations

### 9.3 Activity logs

Every PM action audited (see SECURITY.md §10).

### 9.4 Communication system (outbound from support)

- Email templates: order updates, refund initiated, refund completed, KYC approved, KYC rejected, dispute opened, dispute resolved, return label, return received
- SMS for: OTP, order shipped, out-for-delivery, delivered, refund credited
- Push (Phase 4): same surface set
- All transactional templates localized

---

## 10. Trust & Safety integration

The Trust & Safety surface uses the same console + ticket system but with elevated workflows:

- Fraud signals dashboard surfaces tickets created by automated detection
- Dispute resolution flows through the same ticket + escalation
- Fake review reports become tickets
- Counterfeit reports become tickets
- Each TS category has a separate queue PM Lead can audit

---

## 11. Build vs buy: should we use Zendesk / Freshdesk / Intercom?

Decision:

| Phase | Choice | Reasoning |
|---|---|---|
| **Phase 1** | **Build** (in PM Console) | Tight integration with order data is core to support quality; off-shelf adds latency between systems |
| **Phase 2–3** | Build | Same |
| **Phase 4** | **Re-evaluate** | If volume crosses 5,000 tickets/mo and we lack an AI chatbot of our own, integrate Intercom Fin or buy AI add-on |
| **Phase 5** | Possibly hybrid | Built-in queue + Intercom widget for chat / WhatsApp orchestration |

Off-shelf systems are excellent for support but they assume support is separate from your business. Marketplaces are different — every ticket is intimately tied to an order, a seller, a payment. Building first, reconsidering later, lets us avoid that integration friction.

---

## 12. Per-phase rollout summary

### Phase 1
- Web form ticket creation
- Email-to-ticket
- PM Console inbox + ticket workspace
- Internal notes
- Manual assignment (round-robin)
- Email outbound
- Order-context attached (linked entity)

### Phase 2
- Refund queue (within ticket workspace)
- Approval flow integrated with tickets
- SLA timers
- Reason taxonomy enforced

### Phase 3
- Shipping exception ticket types
- RMA full flow inside support workspace
- Stuck shipment auto-tickets
- Carrier-side ticket creation tooling

### Phase 4
- In-app realtime chat
- AI chatbot with handoff
- Phone IVR / callback
- WhatsApp Business
- Multi-language inbox
- Auto-resolve safe categories
- Smart routing + skill matrix
- Macros library
- Help center / knowledge base public
- CSAT + NPS surveys

### Phase 5
- Social DMs
- Dedicated Trust & Safety queues
- Voice (live agents)
- Workforce management
- Predictive escalation (ML flags likely-to-escalate tickets early)
- Customer health score (proactive outreach to at-risk buyers/sellers)

---

## 13. KPIs (canonical)

**Volume & velocity**
- Tickets / day
- Tickets / 1,000 orders (must trend down — proxy for product quality)
- Per-channel volume distribution

**Response & resolution**
- First response time p50/p95 per channel
- Time to resolution p50/p95
- Reopen rate (target < 5%)
- Backlog age

**Quality**
- First contact resolution
- CSAT (target 4.3+)
- NPS
- Auto-resolution accuracy (Phase 4)
- Escalation rate (sweet spot: 10–20%; too low = not escalating enough; too high = front-line undertrained)

**Cost**
- $ / ticket
- Self-service deflection rate
- Cost per refund processed

**Pattern outcomes**
- Tickets traced to a product fix → fix shipped within X weeks
- "Repeat offender" sellers (high return rate) → action taken
