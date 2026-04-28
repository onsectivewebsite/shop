# Onsective API Surface — tRPC Routers

> All routers are versioned (`v1.*`). All inputs validated by zod. All outputs typed end-to-end. Prefix `protected` = requires auth, `seller` = requires seller role, `admin` = requires admin role.

```
api/
├── auth          public
├── me            protected (any logged-in user)
├── catalog       public read · seller write
├── search        public
├── cart          public read (session) · protected write
├── checkout      protected
├── order         protected (buyer reads own; seller reads own items)
├── shipping      seller (writes) · public (track via signed token)
├── seller        seller (own profile + inventory)
├── payout        seller
├── review        protected
├── support       protected
├── admin.*       admin
└── webhook.*     internal
```

---

## auth

```ts
auth.signupWithEmail({ email, password, fullName, countryCode, locale }) → { userId }
auth.requestEmailOtp({ email })                                          → { sent: true, expiresAt }
auth.verifyEmailOtp({ email, code })                                     → { sessionToken, user }
auth.requestPhoneOtp({ phone })                                          → { sent: true }
auth.verifyPhoneOtp({ phone, code })                                     → { sessionToken, user }
auth.login({ email, password })                                          → { sessionToken, user }
auth.logout()                                                            → { ok: true }
auth.refreshSession()                                                    → { sessionToken }
auth.requestPasswordReset({ email })                                     → { ok: true }
auth.resetPassword({ token, newPassword })                               → { ok: true }
auth.oauthInit({ provider: 'google'|'apple'|'facebook' })                → { redirectUrl }
auth.oauthCallback({ provider, code })                                   → { sessionToken, user }
```

## me

```ts
me.profile()                                       → User
me.updateProfile({ fullName?, locale?, phone? })   → User
me.changePassword({ old, new })                    → { ok }
me.deleteAccount({ confirmPassword? })             → { ok, deleteAt }
me.exportData()                                    → { downloadUrl, expiresAt }   // GDPR
me.notifications.preferences()                     → NotificationPrefs
me.notifications.update(prefs)                     → NotificationPrefs

me.addresses.list()                                → Address[]
me.addresses.create(input)                         → Address
me.addresses.update(id, patch)                     → Address
me.addresses.delete(id)                            → { ok }
me.addresses.setDefault(id, type)                  → Address
```

## catalog (public read)

```ts
catalog.categories.tree()                                           → Category[]   // hierarchical
catalog.categories.bySlug(slug)                                     → Category & { breadcrumbs }
catalog.products.bySlug(slug)                                       → Product & { variants, seller, reviews_summary }
catalog.products.byCategory({ slug, page, perPage, sort, filters }) → Paginated<ProductCard>
catalog.products.related(productId, { limit })                      → ProductCard[]
catalog.products.bestSellers({ categorySlug?, limit })              → ProductCard[]
catalog.products.newArrivals({ limit })                             → ProductCard[]
catalog.products.priceRange(categorySlug)                           → { min, max, currency }
```

## catalog (seller write)

```ts
seller.products.list({ status?, page })                  → Paginated<Product>
seller.products.create(input)                            → Product           // status=DRAFT
seller.products.update(id, patch)                        → Product
seller.products.publish(id)                              → Product           // → PENDING_REVIEW
seller.products.archive(id)                              → Product
seller.products.duplicate(id)                            → Product
seller.products.uploadImage(id, file) [REST multipart]   → { url, key }
seller.products.bulkImport({ csvUrl })                   → { jobId }         // async
seller.products.importStatus(jobId)                      → { state, processed, failed, errors[] }

seller.variants.list(productId)                          → Variant[]
seller.variants.create(productId, input)                 → Variant
seller.variants.update(id, patch)                        → Variant
seller.variants.delete(id)                               → { ok }
seller.variants.bulkUpdateStock([{ id, stockQty }])      → BulkResult
seller.variants.bulkUpdatePrice([{ id, price }])         → BulkResult
```

## search

```ts
search.query({
  q: string,
  filters?: {
    categoryId?, brand?, priceMin?, priceMax?, ratingMin?,
    inStock?, sellerId?, attrs?: Record<string, string[]>
  },
  sort?: 'relevance'|'price_asc'|'price_desc'|'newest'|'best_rated',
  page, perPage
}) → {
  results: ProductCard[],
  facets: { brand[], priceBuckets[], attributes{} },
  total, page
}

search.suggest({ q })       → { products: ProductCard[], categories: [], brands: [] }
search.recordImpression(productIds[])           // analytics
search.recordClick(productId, position)         // analytics
```

## cart

```ts
cart.get()                                              → Cart                 // creates if missing
cart.addItem({ variantId, qty })                        → Cart
cart.updateQty({ itemId, qty })                         → Cart
cart.removeItem(itemId)                                 → Cart
cart.applyCoupon({ code })                              → Cart                 // Phase 4
cart.removeCoupon()                                     → Cart
cart.estimateShipping({ countryCode, postalCode })      → { options[], byseller{} }
cart.merge({ guestCartToken })                          → Cart                 // post-login
```

## checkout

```ts
checkout.start()                                                       → CheckoutSession
checkout.setAddress({ shippingAddressId, billingAddressId? })          → CheckoutSession
checkout.setShippingMethods([{ sellerId, rateId }])                    → CheckoutSession
checkout.estimateTax()                                                 → { taxBreakdown[], total }
checkout.placeOrder({
  paymentMethodId,                  // from Stripe Elements
  saveAddress?, savePayment?,
  giftMessage?, deliveryInstructions?
}) → {
  orderId, orderNumber,
  paymentIntentClientSecret,        // for SCA challenge
  status: 'requires_action' | 'paid'
}

checkout.confirmPayment({ paymentIntentId })                           → { orderId, status }
```

## order

```ts
// Buyer
order.list({ status?, page })                          → Paginated<OrderSummary>
order.detail(orderId)                                  → Order & { items, shipments, payments, refunds }
order.cancel({ orderId, reason })                      → Order              // only if not shipped
order.requestRefund({ orderItemId, reason, photos? }) → RefundRequest      // Phase 2

// Seller (only own items)
seller.orders.list({ status?, dateRange, page })       → Paginated<SellerOrderRow>
seller.orders.detail(orderId)                          → SellerOrderView    // only their items
seller.orders.acceptCancel(itemId)                     → { ok }
seller.orders.rejectCancel(itemId, reason)             → { ok }
```

## shipping

```ts
// Seller
seller.shipping.rates({ orderItemIds[] })                          → ShippingRate[]
seller.shipping.create({
  orderItemIds[],
  pickupAddressId,
  rateId,
  packageWeightGrams, lengthMm, widthMm, heightMm
}) → Shipment

seller.shipping.bulkCreate({ orderItemIds[], rateId })             → Shipment[]
seller.shipping.cancel(shipmentId)                                 → Shipment
seller.shipping.reprintLabel(shipmentId)                           → { labelUrl }
seller.shipping.schedulePickup({ pickupAddressId, dateTime, shipmentIds[] })
                                                                   → { confirmation, pickupId }
seller.shipping.cancelPickup(pickupId)                             → { ok }
seller.shipping.list({ status?, page })                            → Paginated<Shipment>

// Buyer / public
shipping.track({ orderId | publicToken })                          → {
  shipments: [{
    awb, carrier, status, items[],
    timeline: TrackingEvent[],
    expectedDeliveryAt, currentLocation?
  }]
}
shipping.subscribeSms({ orderId, phone })                          → { ok }
```

## payout (seller)

```ts
seller.payouts.balance()                              → { available[currency], pending[currency], onHold[currency] }
seller.payouts.list({ status?, dateRange, page })     → Paginated<Payout>
seller.payouts.detail(id)                             → Payout & { ledgerEntries, statementUrl }
seller.payouts.statement({ from, to })                → { downloadUrl }    // PDF
seller.payouts.taxDocs({ year })                      → { documents[{ type, year, downloadUrl }] }
seller.payouts.preferences()                          → { frequency, minThreshold, currency }
seller.payouts.updatePreferences(patch)               → PayoutPreferences

seller.connect.startOnboarding()                      → { redirectUrl }    // Stripe Connect
seller.connect.refreshOnboarding()                    → { redirectUrl }
seller.connect.status()                               → { onboardingComplete, payoutsEnabled, requirements[] }
```

## seller (profile + KYC)

```ts
seller.profile.get()                                  → Seller
seller.profile.update(patch)                          → Seller
seller.kyc.status()                                   → { status, documents[], missingFields[] }
seller.kyc.uploadDoc({ type, file }) [multipart]      → KycDocument
seller.kyc.submit()                                   → { status: 'KYC_SUBMITTED' }

seller.dashboard.summary({ dateRange })               → {
  gmv, orderCount, conversionRate,
  topProducts[], lowStock[], pendingOrders, openReturns,
  payoutsThisPeriod
}
seller.analytics.salesByDay({ from, to })             → TimeSeries
seller.analytics.salesByProduct({ from, to })         → ProductSales[]
seller.analytics.returnsRate({ from, to })            → number
```

## review

```ts
review.create({ orderItemId, rating, title?, body?, images[] })   → Review
review.update(reviewId, patch)                                    → Review        // within 30d
review.delete(reviewId)                                           → { ok }
review.list({ productId, page, sort, ratingFilter? })             → Paginated<Review>

seller.reviews.list({ productId?, page })                         → Paginated<Review>
seller.reviews.reply(reviewId, body)                              → Review
seller.reviews.flag(reviewId, reason)                             → { ok }
```

## support

```ts
support.tickets.list({ status? })                     → Ticket[]
support.tickets.create({ subject, body, orderId?, attachments[] }) → Ticket
support.tickets.detail(id)                            → Ticket & { messages }
support.tickets.reply(id, body, attachments[])        → Ticket
support.tickets.close(id, resolution)                 → Ticket
```

## admin (admin role required)

```ts
// Sellers
admin.sellers.list({ status?, search?, page })                    → Paginated<Seller>
admin.sellers.detail(id)                                          → Seller & { kyc, financials }
admin.sellers.approve(id, { notes })                              → Seller
admin.sellers.reject(id, { reason })                              → Seller
admin.sellers.suspend(id, { reason, freezePayouts })              → Seller
admin.sellers.unsuspend(id)                                       → Seller
admin.sellers.adjustCommission(id, pct)                           → Seller

// Products
admin.products.queue({ status: 'PENDING_REVIEW', page })          → Paginated<Product>
admin.products.approve(id)                                        → Product
admin.products.reject(id, { reason })                             → Product
admin.products.takedown(id, { reason })                           → Product

// Orders
admin.orders.search({ orderNumber?, buyerEmail?, status? })       → Paginated<Order>
admin.orders.cancel(id, { reason, refund: boolean })              → Order
admin.orders.refund(id, { amount, reason })                       → Refund
admin.orders.intervene(id, { action, notes })                     → AuditedAction

// Commission rules
admin.commission.list()                                           → CommissionRule[]
admin.commission.create(rule)                                     → CommissionRule
admin.commission.update(id, patch)                                → CommissionRule
admin.commission.delete(id)                                       → { ok }
admin.commission.dryRun({ rule, dateRange })                      → { ordersAffected, deltaRevenue }

// Ledger
admin.ledger.trialBalance({ asOf, currency })                     → { accounts[{ name, debit, credit, net }] }
admin.ledger.entries({ filters, page })                           → Paginated<LedgerEntry>
admin.ledger.adjust({ debit, credit, amount, reason })            → LedgerEntry[]   // 2-person approval

// Payouts
admin.payouts.queue({ status })                                   → Payout[]
admin.payouts.holdSeller(sellerId, reason)                        → { ok }
admin.payouts.releaseSeller(sellerId)                             → { ok }
admin.payouts.retryFailed(id)                                     → Payout

// Disputes
admin.disputes.list({ status, page })                             → Dispute[]
admin.disputes.assignTo(id, userId)                               → Dispute
admin.disputes.submitEvidence(id, evidence)                       → Dispute

// Carriers / shipping
admin.shipping.carrierHealth({ days })                            → CarrierStats[]
admin.shipping.exceptions({ status })                             → Shipment[]
admin.shipping.weightDiscrepancyQueue()                           → WeightAdjustment[]

// Tax & compliance
admin.tax.summary({ region, period })                             → TaxReport
admin.compliance.exportLogs({ from, to })                         → { downloadUrl }
admin.compliance.userDataDelete(userId)                           → { jobId }

// Feature flags & config
admin.flags.list()                                                → FeatureFlag[]
admin.flags.set({ key, enabled, rolloutPct })                     → FeatureFlag
admin.config.get()                                                → SystemConfig
admin.config.update(patch)                                        → SystemConfig
```

## webhook (internal — REST not tRPC; signature-verified)

```
POST /webhooks/stripe
POST /webhooks/easypost
POST /webhooks/shippo
POST /webhooks/shiprocket
POST /webhooks/delhivery
```

Each handler:
1. Verify signature
2. Persist `WebhookEvent` row (dedupe via externalId)
3. Enqueue async processor
4. Return 200 immediately (carriers retry on non-2xx)

---

## Cross-cutting middleware

```ts
// Applied to every router
withRequestId               // attach request ID for tracing
withLocale                  // detect locale from header / user pref
withRateLimit               // per IP + per user; tighter on auth/checkout
withCsrf                    // for cookie-based sessions
withAuth                    // sets ctx.user
withSellerScope             // sets ctx.sellerId, enforces RLS
withAuditLog                // mutations of importance auto-audited
withMetrics                 // p50/p95/p99 per procedure
```

---

## Error taxonomy

```ts
// All errors typed end-to-end via tRPC
type ErrorCode =
  | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND'
  | 'VALIDATION_FAILED' | 'CONFLICT'
  | 'PAYMENT_REQUIRED' | 'PAYMENT_DECLINED' | 'SCA_REQUIRED'
  | 'OUT_OF_STOCK' | 'SHIPPING_UNAVAILABLE'
  | 'KYC_INCOMPLETE' | 'SELLER_SUSPENDED'
  | 'RATE_LIMITED' | 'INTERNAL'

interface AppError {
  code: ErrorCode
  message: string                    // user-safe
  developerMessage?: string          // never shown to user
  fields?: Record<string, string[]>  // for validation
  traceId: string
}
```

---

## Pagination convention

All list endpoints take `{ page: number, perPage?: number }` and return:

```ts
type Paginated<T> = {
  items: T[]
  page: number
  perPage: number
  total: number
  hasNext: boolean
}
```

For very-large lists (search), prefer cursor-based:
```ts
type CursorPaginated<T> = {
  items: T[]
  nextCursor: string | null
}
```
