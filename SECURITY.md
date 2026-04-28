# Onsective Security Architecture
## Threat model · Controls · Per-phase rollout

> **Promise to users:** their money, identity, and data are not lost, stolen, or misused. Every decision in this doc traces back to that promise.

---

## 1. Threat model (STRIDE)

We score each threat per surface; high-impact ones get explicit controls.

| Threat | Buyer surface | Seller surface | Console (PM/admin) | Payment / ledger | Shipping |
|---|---|---|---|---|---|
| **Spoofing** (impersonation) | account takeover | seller takeover | admin takeover | fake payments | fake tracking |
| **Tampering** (data integrity) | cart manipulation | inventory abuse | audit log forgery | ledger tamper | shipment record tamper |
| **Repudiation** (deny action) | "I didn't order" | "I didn't ship" | "I didn't approve" | "I didn't refund" | "I didn't pickup" |
| **Information disclosure** | PII leak | competitor seeing prices | mass PII export | card data leak | shipping addresses leak |
| **DoS** | site down | seller can't sell | ops can't work | ledger frozen | shipments stall |
| **EoP** (privilege escalation) | buyer→seller | seller→admin | PM→admin | normal→ledger write | seller→carrier API |

The control matrix in the rest of this doc maps directly to these.

---

## 2. Authentication & access

### 2.1 Buyer/seller auth (web)

- **Email + password** (argon2id, m=64MB, t=3, p=1)
- **Email OTP** as primary alt; OTPs are 6-digit, valid 10 min, 5-attempt lockout
- **Phone OTP** for India; Twilio + MSG91 fallback
- **Passkeys (WebAuthn)** added Phase 4; both as alt and as MFA
- **Social login** (Google, Apple) added Phase 4
- Passwords ≥ 10 chars, checked against haveibeenpwned k-anonymity API at signup + reset
- Password reset link: 1-hour expiry, single use, signed token; prompts session revocation on success
- Failed-login throttle: 5/min/IP, 10/hour/account; CAPTCHA after 3
- Account lockout: 30 min after 10 failed; manual unlock via support after 3 lockouts in 24h

### 2.2 Console / admin auth (PM, ADMIN, OWNER)

- **Mandatory TOTP** at minimum; passkey strongly recommended
- **IP allowlist** per role (Cloudflare Access or AWS WAF)
- Session **8-hour TTL**; hard re-auth at 24h
- Idle auto-lock at **10 min**
- No password-reset email path — admins must request reset via security team
- All actions audited (see §10)

### 2.3 Sessions

- HTTP-only, Secure, SameSite=Lax cookie containing opaque session ID
- Server-side `Session` table → revocable instantly
- Cached in Redis 60s for read perf
- Rotated on privilege change (login → MFA upgrade)
- Per-user cap: 10 active sessions; FIFO when exceeded
- "Sign out everywhere" available in account settings (deletes all sessions)

### 2.4 API auth (Phase 5 partner API)

- OAuth 2.0 client credentials for service-to-service
- Scoped tokens (read:orders, write:shipments, etc.)
- Tokens 30-day expiry, rotatable
- Webhook signing on outbound

---

## 3. Authorization (RBAC + RLS)

### 3.1 Roles

`BUYER · SELLER · SUPPORT_AGENT · PLATFORM_MANAGER · CATALOG_MODERATOR · FINANCE_OPS · ADMIN · OWNER`

### 3.2 Permissions

Defined as `<resource>.<action>` strings. Stored in code (not DB) for v1, moved to DB in Phase 4 for runtime granting. Examples:

```
order.read.any          ADMIN, PLATFORM_MANAGER, SUPPORT_AGENT
order.cancel.preship    PLATFORM_MANAGER, ADMIN
order.refund.lt500      PLATFORM_MANAGER, ADMIN
order.refund.5K_50K     ADMIN (4-eyes)
seller.kyc.approve      PLATFORM_MANAGER, ADMIN
seller.suspend.large    ADMIN (4-eyes)
ledger.adjust           ADMIN (4-eyes)
rbac.modify             OWNER
```

### 3.3 Database row-level security (Postgres RLS)

Every multi-tenant table has policies. Application sets `app.current_seller_id` and `app.current_user_id` per transaction.

```sql
-- Example: a seller can only read their own products
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;

CREATE POLICY seller_owns_product ON "Product"
  FOR ALL
  USING (
    "sellerId" = current_setting('app.current_seller_id', true)
    OR current_setting('app.bypass_rls', true) = 'true'
  );
```

Admin queries set `app.bypass_rls = true` in their connection pool — separate pool, separate DB role with `BYPASSRLS`. RLS-bypassing reads always log to audit.

### 3.4 4-eyes (two-person approval)

For destructive or high-$ actions (see PLATFORM_MANAGER.md §3 for full matrix). Implemented as `ApprovalRequest` model — initiator creates, second user approves, action executes from worker. Cannot self-approve. Both names + reason persisted forever.

---

## 4. API security

### 4.1 Rate limiting

| Endpoint group | Limit | Scope |
|---|---|---|
| Auth (login, signup, OTP req) | 5/min, 30/h | per IP + per email |
| Public catalog read | 60/min | per IP |
| Authenticated reads | 200/min | per user |
| Mutations (cart, order) | 30/min | per user |
| Webhooks (inbound) | 1000/min | per source IP (Stripe, EasyPost ranges) |
| Admin actions | 30/min | per admin |

Implemented at edge (Cloudflare) and app layer (Redis token bucket). Burst allowance 20%.

### 4.2 CORS

- Strict allowlist: `onsective.com`, `console.onsective.com`, `seller.onsective.com`, `*.onsective.dev` (preview)
- No `*` ever
- Cookie-based auth → must pair with CSRF (§4.3)

### 4.3 CSRF

- Double-submit token: `csrf_token` cookie + matching header on every mutation
- SameSite=Lax cookie blocks most cross-site requests by default

### 4.4 Input validation

- **zod schema** at every API boundary (tRPC inputs, REST webhooks, form submits)
- File uploads: MIME sniff + size limit + extension whitelist + virus scan (ClamAV) async
- HTML in user-generated content (review body, seller description) sanitized via DOMPurify on read
- SQL via Prisma parameterized — no raw SQL except admin tooling (and that gates by role)

### 4.5 Output

- JSON responses: never include extra fields (Prisma `select` projection enforced)
- Error messages: don't leak stack traces, table names, or internal IDs
- Cache headers: `Cache-Control: private, no-store` on auth'd responses; public CDN caching only on truly public endpoints (catalog read)

---

## 5. Data protection

### 5.1 Encryption in transit

- TLS 1.2+ everywhere; TLS 1.3 preferred
- HSTS preload (after launch stable): `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- HTTPS-only cookies; no mixed content

### 5.2 Encryption at rest

- RDS encrypted at rest (AES-256, AWS KMS-managed key)
- S3 buckets encrypted (SSE-KMS)
- EBS volumes encrypted
- Backups encrypted; restore tested quarterly

### 5.3 Sensitive field encryption (column-level)

These fields are encrypted at the application layer with envelope encryption (KMS data key per row):

| Field | Why |
|---|---|
| User.phone | PII, identifier |
| Address.* | PII, doxxing risk |
| Seller.taxId (PAN/EIN/GSTIN) | regulated |
| KycDocument.fileKey (object) | reg, identity docs |
| Otp.codeHash | one-way hash; not encrypted |
| Payment.gatewayClientSecret | short-lived secret |

Cards/bank details: **never stored.** Stripe tokens only.

### 5.4 PII masking in admin/console

- Phone: `+91 ••••• ••210` (last 3 visible only on click → "reveal" audit row)
- Address: city + first line of street; full address gated
- Email: full visible (we accept this; email is a primary identifier)
- Tax ID: last 4 visible only

### 5.5 Secret management

- AWS Secrets Manager for runtime secrets (DB creds, Stripe keys, Twilio, etc.)
- IAM roles for service auth — no long-lived keys
- GitHub Actions: OIDC to AWS, no static keys
- Local dev: `.env.local` (gitignored), 1Password CLI integration optional
- Pre-commit hook: `gitleaks` scans
- CI: `trufflehog` on every PR

### 5.6 Key rotation

- Database password: 90 days
- API keys (Stripe, carriers): on personnel change or yearly
- Session signing secret: 180 days, rolling (old still validates 30d)
- KMS data keys: auto-rotated yearly by AWS

---

## 6. Payment security (PCI-DSS)

### 6.1 Scope minimization

- We are **PCI SAQ-A** (the easiest tier): card data never enters our systems.
- **Stripe Elements** iframes the card input directly to Stripe's domain; only the resulting payment-method token reaches our servers.
- We never log full card numbers. The token (`pm_...`) is logged only with last-4 + brand + exp.
- No card storage. We refer by Stripe customer + payment method ID.

### 6.2 Tokenization

- Card → Stripe token (frontend) → Stripe `Customer` saved (backend) → reference future
- For India RBI tokenization mandate: Stripe handles bank-issued network tokens automatically

### 6.3 3DS / SCA

- All EU/UK/IN charges trigger 3DS via Stripe (auto when required)
- `requires_action` PaymentIntent state handled in checkout; client confirms via `stripe.confirmCardPayment`

### 6.4 Refunds

- Refund initiated server-side via Stripe API
- Idempotency key on every Refund call: `refund:{orderId}:{lineItemId}:{requestId}`
- Webhook reconciliation: compare local Refund state to Stripe event

### 6.5 Webhook security

- Stripe webhook signature verified via `Stripe-Signature` header (Stripe SDK helper)
- EasyPost / Shippo / Shiprocket: each adapter implements `verifyWebhookSig()`
- Webhook source IP allowlist as defense-in-depth (Cloudflare layer)
- Replay protection: dedupe by `event.id` in `WebhookEvent` table; reject events older than 5 min

### 6.6 Fraud / dispute hardening

- **Stripe Radar** enabled (rules + ML)
- Custom rules: velocity (same card > 3 orders/hour), shipping-mismatch (billing country ≠ shipping country with high-fraud combo), new-seller + high-value first order
- 3DS required above thresholds
- Manual review queue for flagged orders
- COD limits per buyer (India)

---

## 7. Privacy & compliance

### 7.1 Frameworks we comply with

| Region | Framework | Key obligations |
|---|---|---|
| EU/UK | GDPR / UK-GDPR | consent, right of access, deletion, portability, DPO if scale demands, ROPA, breach notification 72h |
| US/CA | CCPA / CPRA | opt-out of sale, right to know, right to delete, GPC signal, "do not sell" link |
| India | DPDP Act 2023 | consent manager, breach notification, data fiduciary duties |
| Brazil | LGPD | similar to GDPR |
| Global | ISO 27001 (Phase 5) | management system; long roadmap |

### 7.2 Lawful bases (GDPR)

- **Contract** — most processing for order fulfillment
- **Legitimate interest** — fraud prevention, analytics aggregated
- **Consent** — marketing emails, optional cookies (analytics, ads)
- **Legal obligation** — tax records, sanctions screening

### 7.3 Cookie & tracking

- Strictly necessary cookies (session, CSRF, locale): no consent needed
- Analytics, ads: opt-in via cookie banner (Cookiebot or self-built)
- Banner respects Global Privacy Control header (auto-decline)
- No third-party trackers in v1; PostHog or self-hosted analytics

### 7.4 Data subject rights endpoints

- `GET /me/export` → JSON of all data, signed S3 URL, valid 7d
- `DELETE /me/account` → 30-day soft delete window, then PII anonymized; orders retained for accounting (legal obligation)
- "Do not sell" link in footer (CA users)

### 7.5 Data retention

| Data | Retention | Reason |
|---|---|---|
| Order/payment records | 7 years (10 in some jurisdictions) | tax/audit |
| Ledger entries | forever (append-only) | financial accuracy |
| User account | until deletion request | service |
| Sessions | 90 days expired then purge | |
| OTPs | 24h then purge | |
| Webhook events | 90 days (raw payload) | |
| Audit log | 7 years cold archive | compliance |
| Marketing consent | until withdrawn | regulatory |
| Cart abandoned | 30 days | reactivation |
| KYC docs | 7 years post-account-closure (regulator-set) | regulator |

### 7.6 Data residency

- US user data: us-east-1 + us-west-2 backup
- India user data: replicated to ap-south-1; RDS row-pinning by `countryCode` (Phase 4)
- EU user data (when EU added): eu-west-1 primary

### 7.7 Sub-processors (transparency)

Public list at `onsective.com/legal/subprocessors` updated when changed; advance notice for material changes (GDPR requirement).

---

## 8. Trust & Safety

### 8.1 Fraud detection

| Signal | Detection | Action |
|---|---|---|
| Card velocity | same card > 3 orders/h | flag for review |
| New buyer + high-value first order | rule | 3DS required, manual review |
| Address mismatch (billing vs shipping country) | rule | review |
| Device fingerprint (Phase 4: FingerprintJS) | shared device across many accounts | block account creation |
| Behavioral (Phase 4) | bot-like clicks, abnormal speed | CAPTCHA |
| Email/phone reputation | disposable email, voip-only phone | review |

### 8.2 Seller fraud

- KYC verification (govt ID + tax cert + bank stmt)
- Sanctions screening (Stripe + supplemental for buyers)
- New-seller cap: $5K GMV before payouts unfreeze (Phase 2)
- Pattern detection: products copied from another seller, suspicious price drops, identity reuse
- Suspicious-listing review queue

### 8.3 Fake reviews

- **Verified-purchase only** — review tied to OrderItem.id (already enforced in schema)
- Velocity caps per buyer (max 5 reviews / week)
- Sentiment + similarity ML (Phase 4) detects review farms
- Flag/appeal flow

### 8.4 Counterfeits

- Brand-protection list (registered brand owners can flag)
- Keyword/image matching against known counterfeit patterns
- Reactive takedown SLA: 48h after credible report
- Repeat offender → seller suspension

### 8.5 Dispute resolution (buyer ↔ seller)

```
Buyer files dispute (in console: order.dispute)
     ↓
Auto-routed to PM with priority based on $ and SLA
     ↓
PM reviews evidence:
  - communication history (in-platform messaging)
  - tracking (delivered? POD?)
  - photos
  - both parties' statements
     ↓
PM mediates: refund / partial / no action
     ↓
Either side can escalate to Admin arbitration
     ↓
Admin decision is final (binding T&Cs)
     ↓
Decision logged; precedent feeds policy library
```

### 8.6 Prohibited items

- Static blocklist (weapons, drugs, controlled substances, hate-symbol items, etc.)
- Per-jurisdiction overlays (alcohol shipping varies; CBD complex in US states)
- Listing-time check (keyword + image classifier — Phase 4)
- Reactive takedown queue

---

## 9. Infrastructure security

### 9.1 Network

- VPC private subnets for app + DB; public only for ALB
- Security groups least-privilege: app → DB only on 5432; nothing else
- NAT Gateway for outbound; no public IPs on app instances
- AWS WAF on ALB: OWASP rules, rate-limit, geo-block where required
- Cloudflare in front: DDoS mitigation, bot management, edge cache

### 9.2 Secrets & access

- IAM SSO via Google Workspace (or Okta)
- MFA required on AWS console
- Production access: break-glass only; routine work via deploy pipelines
- Quarterly access review

### 9.3 Vulnerability management

- **SAST**: GitHub Advanced Security or SonarCloud on every PR
- **SCA (deps)**: Dependabot + Snyk; auto-PR on patches
- **Container scanning**: Trivy on every build; block critical
- **DAST**: OWASP ZAP weekly against staging; manual pentests yearly
- **Bug bounty** (Phase 5): HackerOne or Bugcrowd

### 9.4 Backup & DR

- RDS automated backups daily, retained 30 days; PITR enabled
- WAL streaming to ap-south-1 + offsite S3 (cross-account)
- Quarterly restore drill: clone backup → run smoke tests → measure RTO/RPO
- **RTO target**: 4 hours; **RPO**: 5 minutes
- Runbooks documented in `ops/runbooks/`

### 9.5 Logging & observability

- Structured JSON logs → CloudWatch + Datadog (or Grafana Cloud)
- Application metrics: p50/p95/p99 latency, error rate per endpoint
- Distributed tracing: OpenTelemetry → Datadog APM
- Log retention: 30 days hot, 1 year cold
- PII never logged: middleware redactor; verified by sampling

### 9.6 Alerts

| Alert | Threshold | On-call action |
|---|---|---|
| 5xx spike | > 1% for 5 min | page eng on-call |
| p95 latency | > 500ms for 10 min | investigate |
| Failed payments spike | > 5% for 10 min | page payments lead |
| Webhook backlog | > 5 min lag | investigate ingestion |
| Ledger drift | any | page lead immediately |
| Unusual admin activity | bulk PII export, bulk refund | page security |

---

## 10. Audit & accountability

### 10.1 What is logged

Every action by an actor (user, PM, admin, system) on a sensitive resource, including:

- Actor (id, role, IP, user-agent, session)
- Action (`order.refund`, `seller.suspend`, `password.force_reset`, etc.)
- Target (id + type)
- Before / after state diff (JSON)
- Reason (free text, required for ⚠ actions)
- Timestamp (UTC, ms precision)

### 10.2 Storage

- Append-only `AuditLog` Postgres table (no UPDATE / DELETE permissions)
- Replicated nightly to S3 with **Object Lock (governance mode, 90 days)** then cold archive
- Total retention: 7 years minimum

### 10.3 Review

- Weekly automated anomaly detection (PM activity, refund patterns)
- Quarterly random sampling: SecOps reviews 1% of audit rows
- On-demand investigation tools (search by actor, target, date)

---

## 11. Incident response

### 11.1 Severity tiers

| Sev | Definition | Response |
|---|---|---|
| **SEV-1** | Site down, data loss, money loss, security breach | All-hands, status page, incident commander, postmortem |
| **SEV-2** | Major feature broken (checkout fails, payouts stuck) | Eng lead + relevant team; status if customer-visible |
| **SEV-3** | Minor degradation | Triage in next business hour |
| **SEV-4** | Cosmetic, nuisance | Bug ticket |

### 11.2 Process

1. **Detect** (alert or report) → on-call paged
2. **Triage** — assign sev within 5 min
3. **Mitigate** — restore service first, root-cause later
4. **Communicate** — internal Slack incident channel; external status page if customer-visible
5. **Resolve** — confirm metrics back to normal
6. **Postmortem** — within 5 business days, blameless, action items tracked

### 11.3 Breach notification

- Discovery → security lead within 1h
- Initial assessment within 4h
- GDPR: regulator notification within 72h if PII compromised
- DPDP: same 72h window
- User notification "without undue delay" if high risk to rights & freedoms
- Drafted templates in `ops/runbooks/breach-notification.md`

---

## 12. Per-phase security rollout

### Phase 1 (MVP)
- Auth: email+password, OTP, sessions, basic password reset
- TLS, encrypted at rest, HSTS prep
- RBAC roles defined; RLS on multi-tenant tables
- Stripe Elements (PCI SAQ-A scope)
- Rate limiting basic
- Audit log core (every admin action)
- Privacy basics: cookie banner, T&Cs, privacy policy
- Sentry + structured logging
- WAF rules (OWASP CRS)
- Pre-launch external pentest

### Phase 2 (Commission + Payouts)
- 4-eyes approval flow (refunds, payout adjustments)
- Stripe Connect KYC enforcement (sellers can't receive payouts pre-KYC)
- Anomaly detection on refund / payout patterns
- Ledger drift alarm
- Stripe Radar enabled
- 3DS for high-risk regions

### Phase 3 (Shipping)
- Webhook signature verification per carrier
- COD remittance reconciliation (India)
- Address validation pre-shipment
- Insurance claim workflow
- Stuck-shipment alert + ops queue

### Phase 4 (Trust & Growth)
- **Passkeys (WebAuthn)** for buyers + sellers
- Social login (Google, Apple) with account-linking guards
- Device fingerprinting for fraud
- Fake-review ML
- Counterfeit detection ML (image + text)
- Dark web monitoring of exposed creds (HIBP integration)
- Bug bounty soft launch
- ISO 27001 prep work

### Phase 5 (Scale)
- ISO 27001 certification
- SOC 2 Type II
- Bug bounty live
- Public partner API with OAuth + scoped tokens
- Continuous SAST/DAST
- Red-team exercise yearly

---

## 13. Security engineering checklist (every PR)

- [ ] Inputs validated by zod
- [ ] Output projection (no over-fetching)
- [ ] No raw SQL (Prisma only) unless gated by role
- [ ] No PII in logs
- [ ] Authn/authz checks on new endpoints
- [ ] Rate limit on new public endpoint
- [ ] Audit log on new mutations
- [ ] Tests cover unauthorized + invalid input
- [ ] axe-core a11y check passes
- [ ] No secrets in code (gitleaks pre-commit)
- [ ] Dependencies don't introduce known critical CVEs
