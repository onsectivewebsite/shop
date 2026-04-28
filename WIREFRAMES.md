# Onsective Wireframes — Screen-by-Screen

> ASCII wireframes covering buyer, seller, and admin surfaces. Treat each as the spec for one Figma frame. Focus on layout + content hierarchy; visual styling done in design phase.

## Screen Inventory

### Buyer (24 screens)
1. Home
2. Category landing
3. Search results
4. Product detail (PDP)
5. Cart drawer
6. Cart full page
7. Checkout — address
8. Checkout — shipping method
9. Checkout — payment + review
10. Order confirmation
11. Order list
12. Order detail
13. Tracking page (public)
14. Refund / return wizard
15. Reviews list
16. Account profile
17. Saved addresses
18. Notification preferences
19. Login / signup modal
20. OTP verification
21. Forgot password
22. Wishlist (Phase 4)
23. Help center / FAQ
24. Support ticket

### Seller (18 screens)
25. Seller signup
26. KYC wizard
27. Stripe Connect onboarding return
28. Dashboard home
29. Products list
30. Product create wizard (multi-step)
31. Product edit
32. Variants editor
33. Bulk inventory edit
34. Orders queue
35. Order detail (seller view)
36. Ship-now flow
37. Pickup scheduler
38. Returns inbox
39. Payouts page
40. Earnings analytics
41. Tax & invoices
42. Settings (profile, addresses, payout prefs, carriers)

### Admin (10 screens)
43. Admin dashboard
44. Seller approval queue
45. Seller detail
46. Product moderation queue
47. Order interventions
48. Refund queue
49. Commission rule editor
50. Ledger trial-balance dashboard
51. Disputes queue
52. Carrier health dashboard

---

## Buyer wireframes

### 1. Home
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ☰ ONSECTIVE       [search box                                  ]   🔍        │ ← header
│                                       [📍 Bangalore]  ❤  🛒(2)   👤 Login    │
├──────────────────────────────────────────────────────────────────────────────┤
│  Electronics  Fashion  Home  Beauty  Books  Toys  Grocery  More ▾            │ ← category strip
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ╔══════════════════════════════════════════════════════════════════════╗   │
│   ║                                                                      ║   │
│   ║      [HERO BANNER carousel — 3 slides]                               ║   │
│   ║                                                                      ║   │
│   ║      "Up to 60% off Electronics"      [Shop now →]                   ║   │
│   ║                                                                      ║   │
│   ╚══════════════════════════════════════════════════════════════════════╝   │
│                                                                              │
│   Shop by category                                                           │
│   ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                    │
│   │📱  │ │👕  │ │🏠  │ │💄  │ │📚  │ │🧸  │ │🛒  │ │ +  │                    │
│   │elec│ │fash│ │home│ │beau│ │book│ │toys│ │groc│ │all │                    │
│   └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘                    │
│                                                                              │
│   Trending now                                                       see all │
│   ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐                 │
│   │ img  │  │ img  │  │ img  │  │ img  │  │ img  │  │ img  │                 │
│   │      │  │      │  │      │  │      │  │      │  │      │                 │
│   │₹1499 │  │$24.99│  │₹999  │  │$12.50│  │₹2199 │  │$8.99 │                 │
│   │ ★4.5 │  │ ★4.7 │  │ ★4.2 │  │ ★4.6 │  │ ★4.8 │  │ ★4.1 │                 │
│   └──────┘  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘                 │
│                                                                              │
│   New arrivals                                                       see all │
│   [card] [card] [card] [card] [card] [card]                                  │
│                                                                              │
│   Best sellers in Electronics                                        see all │
│   [card] [card] [card] [card] [card] [card]                                  │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│  About · Sell on Onsective · Help · Privacy · Terms · 🌐 Locale ▾            │ ← footer
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4. Product Detail (PDP)
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Header (collapsed)                                                           │
├──────────────────────────────────────────────────────────────────────────────┤
│ Home › Electronics › Headphones › Brand X Wireless Pro                       │ ← breadcrumbs
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────┐ ┌──────────────────────────────────────────────┐  │
│ │                        │ │ Brand X Wireless Pro Headphones              │  │
│ │     [main image]       │ │ by Acme Audio  ·  ★ 4.6 (1,234 reviews)      │  │
│ │                        │ │ ─────────────────────────────────────────────│  │
│ │                        │ │                                              │  │
│ │                        │ │  ₹4,499  ̶₹̶6̶,̶9̶9̶9̶  Save 36%                    │  │
│ │                        │ │  Inclusive of all taxes                      │  │
│ │                        │ │  ─────────────────────────────────────────── │  │
│ │ ┌──┐ ┌──┐ ┌──┐ ┌──┐    │ │  Color:    [⚫][⚪][🟦][🟥]                    │  │
│ │ │t1│ │t2│ │t3│ │t4│    │ │  Variant:  [Standard ▾]                      │  │
│ │ └──┘ └──┘ └──┘ └──┘    │ │                                              │  │
│ └────────────────────────┘ │  📦 In stock — 12 left                       │  │
│                            │  🚚 Delivery to 560001 by Mon, 4 May         │  │
│                            │     [change pincode]                         │  │
│                            │                                              │  │
│                            │  Quantity: [─ 1 +]                           │  │
│                            │                                              │  │
│                            │  ┌────────────────────────────────────────┐  │  │
│                            │  │  ADD TO CART                           │  │  │
│                            │  └────────────────────────────────────────┘  │  │
│                            │  ┌────────────────────────────────────────┐  │  │
│                            │  │  BUY NOW                               │  │  │
│                            │  └────────────────────────────────────────┘  │  │
│                            │                                              │  │
│                            │  ❤ Add to wishlist                           │  │
│                            │                                              │  │
│                            │  Sold by:  Acme Audio  (★ 4.7 · 8K orders)   │  │
│                            │  Returns:  7-day return window               │  │
│                            │  Warranty: 1 year manufacturer               │  │
│                            └──────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Description] [Specifications] [Q&A (12)] [Reviews (1,234)]                  │ ← tabs
├──────────────────────────────────────────────────────────────────────────────┤
│ Description content...                                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│ Frequently bought together                                                   │
│ [card]+[card]+[card]  Total ₹5,997  [Add all to cart]                        │
├──────────────────────────────────────────────────────────────────────────────┤
│ Customers also viewed                                                        │
│ [card] [card] [card] [card] [card] [card]                                    │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 6. Cart full page
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Your cart (3 items from 2 sellers)                                           │
├────────────────────────────────────────────┬─────────────────────────────────┤
│                                            │  Order summary                  │
│  Sold by Acme Audio                        │  ─────────────────────────────  │
│  ┌──────────────────────────────────────┐  │  Subtotal       ₹6,997          │
│  │ [img] Brand X Headphones      ₹4,499 │  │  Shipping       ₹150            │
│  │       Color: Black                   │  │  Tax (GST 18%)  ₹1,287          │
│  │       Qty: [−1+]   [Save] [Remove]   │  │  ─────────────────────────────  │
│  └──────────────────────────────────────┘  │  Total          ₹8,434          │
│  ┌──────────────────────────────────────┐  │                                 │
│  │ [img] Phone Case               ₹499  │  │  ┌───────────────────────────┐  │
│  │       Variant: iPhone 15             │  │  │  PROCEED TO CHECKOUT      │  │
│  │       Qty: [−1+]   [Save] [Remove]   │  │  └───────────────────────────┘  │
│  └──────────────────────────────────────┘  │                                 │
│                                            │  🔒 Secure checkout · Stripe    │
│  Sold by Cotton Co.                        │                                 │
│  ┌──────────────────────────────────────┐  │  Have a coupon?  [    ] Apply   │
│  │ [img] T-Shirt Blue M           ₹999  │  │                                 │
│  │       Qty: [−2+]   [Save] [Remove]   │  │                                 │
│  └──────────────────────────────────────┘  │                                 │
│                                            │                                 │
│  [Continue shopping]                       │                                 │
└────────────────────────────────────────────┴─────────────────────────────────┘
```

### 9. Checkout — payment + review
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Checkout                                                       Step 3 of 3   │
│  ●━━━━━━●━━━━━━○                                                             │
│  Address  Shipping  Pay                                                      │
├────────────────────────────────────────────┬─────────────────────────────────┤
│  Payment method                            │  Order summary                  │
│  ─────────────────────────────────────     │  ─────────────────────────────  │
│  ⦿ Credit / Debit card                     │  3 items                        │
│     [Stripe Elements card form]            │  Subtotal       ₹6,997          │
│                                            │  Shipping       ₹150            │
│  ○ UPI / GPay / PhonePe                    │  Tax (GST 18%)  ₹1,287          │
│  ○ Netbanking                              │  ─────────────────────────────  │
│  ○ Cash on Delivery (eligible items only)  │  Total          ₹8,434          │
│                                            │                                 │
│  ☑ Save card for future purchases          │  ─────────────────────────────  │
│                                            │  Ship to: Rishabh Kumar         │
│                                            │  12 MG Road, Bangalore 560001   │
│  ─────────────────────────────────────     │  [edit]                         │
│                                            │                                 │
│  Review your order                         │  Delivery: by Mon 4 May         │
│  ─ Brand X Headphones ×1     ₹4,499        │  [edit]                         │
│  ─ Phone Case ×1             ₹499          │                                 │
│  ─ T-Shirt Blue M ×2         ₹1,998        │  ┌───────────────────────────┐  │
│                                            │  │   PLACE ORDER             │  │
│  By placing the order you agree to T&Cs    │  │   ₹8,434                  │  │
│                                            │  └───────────────────────────┘  │
└────────────────────────────────────────────┴─────────────────────────────────┘
```

### 12. Order detail (buyer)
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Order #ONS-2026-00123              Placed Sat, 26 Apr 2026 · ₹8,434          │
├──────────────────────────────────────────────────────────────────────────────┤
│  ●━━━━━━━●━━━━━━━●━━━━━━━●─────────○                                         │
│  Placed   Confirmed Packed  Shipped  Delivered                               │
│  26 Apr   26 Apr   27 Apr   28 Apr   est. 4 May                              │
├──────────────────────────────────────────────────────────────────────────────┤
│  Shipment 1 of 2 — Acme Audio              [Track] [Need help?]              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ [img] Brand X Headphones  ×1                              ₹4,499       │  │
│  │ [img] Phone Case          ×1                              ₹499         │  │
│  │ ──────────────────────────────────────────────────────────             │  │
│  │ Status: SHIPPED via Delhivery  ·  AWB 1Z999AA10123456784               │  │
│  │ Latest: "At Mumbai sorting hub" · 1h ago                                │  │
│  │ Expected delivery: Mon, 4 May 2026                                     │  │
│  │ [View tracking timeline]                                               │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  Shipment 2 of 2 — Cotton Co.              [Track]                           │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ [img] T-Shirt Blue M  ×2                                  ₹1,998       │  │
│  │ Status: PACKED — pickup scheduled today                                 │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  Shipping address           Payment              Need help?                  │
│  Rishabh Kumar              Visa ending 4242    [Cancel order]               │
│  12 MG Road                 ₹8,434              [Contact seller]             │
│  Bangalore 560001           Charged Sat 26 Apr  [Return / refund]            │
│                                                  [Download invoice]          │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 13. Public tracking page
```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Tracking — Order #ONS-2026-00123                                            │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│      Estimated delivery                                                      │
│      ┌───────────────────────┐                                               │
│      │   Mon, 4 May 2026     │                                               │
│      │   between 10am–4pm    │                                               │
│      └───────────────────────┘                                               │
│                                                                              │
│  ●━━━━━━━●━━━━━━━●━━━━━━━●─────────○                                         │
│  Placed   Packed  Shipped  Out for   Delivered                               │
│                            delivery                                          │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  TIMELINE                                                              │  │
│  │  ●  Mon 28 Apr 14:32  Mumbai sorting hub                               │  │
│  │  ●  Mon 28 Apr 09:10  Picked up · Pune                                 │  │
│  │  ●  Sun 27 Apr 18:00  Label created                                    │  │
│  │  ●  Sat 26 Apr 22:15  Order placed                                     │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  AWB: 1Z999AA10123456784    Carrier: Delhivery   [View on Delhivery ↗]       │
│                                                                              │
│  [📱 Get SMS updates]   [✉ Email me when delivered]                          │
│                                                                              │
│  Items in this shipment                                                      │
│  ─ Brand X Headphones, Black  ×1                                             │
│  ─ Phone Case  ×1                                                            │
│                                                                              │
│  Delivery to:  Rishabh K., 12 MG Rd, Bangalore 560001                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 14. Return wizard
```
Step 1/4 — Pick item                Step 2/4 — Reason                Step 3/4 — Photos             Step 4/4 — Review
┌──────────────────────┐            ┌──────────────────────┐         ┌──────────────────────┐      ┌──────────────────────┐
│ Return which item?   │            │ Why are you returning?         │ Add photos (optional, │      │ Return summary       │
│ ○ Brand X Headphones │            │ ⦿ Defective / not working      │ required for           │      │ Item: Brand X HP     │
│ ○ Phone Case         │  ──►       │ ○ Not as described             │ "defective")           │  ──► │ Reason: Defective    │
│ ○ T-Shirt Blue M     │            │ ○ Wrong item received          │ [📷 + add]             │      │ Refund: ₹4,499       │
│                      │            │ ○ Damaged in shipping          │ [photo1] [photo2]      │      │ Return ship: free    │
│ [Next]               │            │ ○ Changed my mind              │                        │      │ Pickup: Tue 30 Apr   │
│                      │            │ ○ Other                        │ [Next]                 │      │ [Submit return]      │
│                      │            │ Notes: [           ]           │                        │      │                      │
│                      │            │ [Next]                         │                        │      │                      │
└──────────────────────┘            └──────────────────────┘         └──────────────────────┘      └──────────────────────┘
```

---

## Seller wireframes

### 28. Seller dashboard home
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Acme Audio · Seller dashboard                          [🔔] [⚙]  RK ▾        │
├────────────┬─────────────────────────────────────────────────────────────────┤
│            │  Welcome back, Rishabh                  [Last 30 days ▾]        │
│ 🏠 Home    │  ─────────────────────────────────────────────────────────────  │
│ 📦 Products│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│ 🛒 Orders  │  │ GMV       │ │ Orders   │ │ AOV      │ │ Returns  │           │
│ 🚚 Ship    │  │ ₹8,42,500 │ │ 1,234    │ │ ₹682     │ │ 4.2%     │           │
│ ↩  Returns │  │ ▲ 12%     │ │ ▲ 8%     │ │ ▲ 4%     │ │ ▼ 0.6%   │           │
│ 💰 Payouts │  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
│ 📊 Analytics  ┌─────────────────────────────────────────────────────────┐    │
│ ⭐ Reviews │  │ Sales (line chart, daily)                                │   │
│ ⚙  Settings  │  │ ────/\────/\────/\────                                   │  │
│            │  └─────────────────────────────────────────────────────────┘    │
│            │                                                                 │
│            │  ⚠ Action needed                                                │
│            │  • 3 orders waiting to ship                  [Ship now]         │
│            │  • 2 returns pending your approval           [Review]           │
│            │  • 1 product low stock                       [Restock]          │
│            │                                                                 │
│            │  Top products this period                                       │
│            │  1. Brand X Headphones  ·  ₹3,12,000 (124 sold)                 │
│            │  2. Travel Speaker      ·  ₹1,45,000 (87 sold)                  │
│            │  3. Phone Case          ·  ₹98,000  (245 sold)                  │
│            │                                                                 │
│            │  Next payout: ₹62,400 on Mon, 4 May                             │
└────────────┴─────────────────────────────────────────────────────────────────┘
```

### 29. Products list (seller)
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Products (47)                              [+ Add product]  [⬇ Bulk import]  │
│ ─────────────────────────────────────────────────────────────────────────    │
│ [search...]   Status: [All ▾]   Category: [All ▾]   Stock: [Any ▾]           │
├──────────────────────────────────────────────────────────────────────────────┤
│  ☐ │ Image │ Title             │ SKU      │ Price  │ Stock │ Status │ ⋯      │
│  ☐ │ [im]  │ Brand X HP Pro    │ BX-HP-01 │ ₹4,499 │  12   │ Active │ ⋯      │
│  ☐ │ [im]  │ Travel Speaker    │ TS-001   │ ₹1,899 │  3 ⚠  │ Active │ ⋯      │
│  ☐ │ [im]  │ Phone Case iPh15  │ PC-15-BK │ ₹499   │  88   │ Active │ ⋯      │
│  ☐ │ [im]  │ USB-C Cable       │ CBL-001  │ ₹249   │  0    │ Paused │ ⋯      │
│  ☐ │ [im]  │ Wireless Charger  │ WC-001   │ ₹999   │ 124   │ Pending│ ⋯      │
│ ─────────────────────────────────────────────────────────────────────────    │
│ Bulk: [Activate] [Pause] [Adjust price] [Adjust stock] [Export CSV]          │
│                                                              ◀ 1 2 3 ▶       │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 30. Product create (wizard)
```
Step 1: Basic info             Step 2: Variants               Step 3: Images                Step 4: Pricing & Tax            Step 5: Review
┌────────────────┐             ┌────────────────┐             ┌────────────────┐             ┌────────────────┐               ┌────────────────┐
│Title:          │             │ Has variants?  │             │ [drop zone]    │             │Currency: INR ▾ │               │Preview:        │
│Category: ▾     │   ──►       │ ⦿ No  ○ Yes    │     ──►     │                │     ──►     │MRP: 6,999      │       ──►     │  [PDP-like     │
│Brand:          │             │                │             │ [+] [+] [+]    │             │Sale: 4,499     │               │   preview]     │
│Description:    │             │ Variants are   │             │ [+] [+] [+]    │             │Tax: GST 18%    │               │                │
│ [           ]  │             │ skipped if "No"│             │                │             │HSN: 8518       │               │ [Save draft]   │
│Bullets:        │             │                │             │ Drag to reorder│             │                │               │ [Submit for    │
│• [           ] │             │ ─ Color: variants                              │             │                │               │  approval]     │
│• [           ] │             │   Black/White  │             │                │             │                │               │                │
│Country: IN ▾   │             │ ─ Size: ─      │             │                │             │                │               │                │
│ [Next]         │             │ ─ [+ option]   │             │ [Next]         │             │ [Next]         │               │                │
│                │             │ [Next]         │             │                │             │                │               │                │
└────────────────┘             └────────────────┘             └────────────────┘             └────────────────┘               └────────────────┘
```

### 34. Orders queue (seller)
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Orders (47 unfulfilled)                                                      │
│ ─────────────────────────────────────────────────────────────────────────    │
│ [All] [To pack (12)] [Ready (5)] [In transit] [Delivered] [Returns]          │
├──────────────────────────────────────────────────────────────────────────────┤
│ ☐ │Order #          │Buyer    │Items  │Total   │Placed   │Action             │
│ ☐ │ONS-2026-00123  │R Kumar  │HP, Cs │₹4,998  │2h ago   │[Ship now]         │
│ ☐ │ONS-2026-00122  │A Singh  │T-shrt │₹999    │5h ago   │[Ship now]         │
│ ☐ │ONS-2026-00120  │J Smith  │WC     │$24.99  │6h ago   │[Ship now]         │
│ ☐ │ONS-2026-00119  │M Patel  │Sp+Cs  │₹2,398  │1d ago   │[Ship now]         │
│ ─────────────────────────────────────────────────────────────────────────    │
│ Bulk: ☐ select all  [📦 Generate labels]  [📅 Schedule pickup]               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 36. Ship-now flow
```
Step 1: Confirm package         Step 2: Pick rate                     Step 3: Done
┌────────────────────────┐     ┌──────────────────────────────────┐   ┌────────────────────────┐
│ Order #ONS-2026-00123  │     │ Choose carrier                   │   │ ✓ Shipment created     │
│                        │     │                                  │   │                        │
│ Items                  │     │ ⦿ Delhivery Express  ₹85         │   │ AWB: 1Z999AA1...       │
│ ─ HP ×1                │     │   Delivery: Mon 4 May            │   │ Carrier: Delhivery     │
│ ─ Phone Case ×1        │     │ ○ Bluedart Std       ₹110        │   │                        │
│                        │     │   Delivery: Tue 5 May            │   │ [Print label]          │
│ Pickup from:           │     │ ○ Shadowfax COD-elig ₹125        │   │ [Schedule pickup]      │
│ Acme HQ Pune  [change] │     │   Delivery: Mon 4 May            │   │ [Mark as picked up]    │
│                        │     │                                  │   │                        │
│ Package weight: [500]g │     │ Insurance: ☑ ₹15 (declared val   │   │ [Done]                 │
│ Dimensions: 30×20×10cm │     │   ₹4,998)                        │   │                        │
│                        │     │                                  │   │                        │
│ [Next]                 │     │ [Create shipment & buy label]    │   │                        │
└────────────────────────┘     └──────────────────────────────────┘   └────────────────────────┘
```

### 39. Payouts page
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Payouts                                                  [Settings]          │
├──────────────────────────────────────────────────────────────────────────────┤
│  Available now           Pending (T+7)         On hold                       │
│  ┌──────────────┐        ┌──────────────┐      ┌──────────────┐              │
│  │ ₹62,400      │        │ ₹1,24,800    │      │ ₹0           │              │
│  │ paid Mon 4 May        │ next 11 May  │      │              │              │
│  └──────────────┘        └──────────────┘      └──────────────┘              │
│                                                                              │
│  Currency:  [INR ▾]                                                          │
│  ─────────────────────────────────────────────────────────────────────────   │
│  Date         │ Status   │ Amount     │ Method      │ Statement              │
│  4 May 2026   │ PAID     │ ₹62,400    │ Stripe→ICICI│ [download PDF]         │
│  27 Apr 2026  │ PAID     │ ₹58,200    │ Stripe→ICICI│ [download PDF]         │
│  20 Apr 2026  │ PAID     │ ₹71,400    │ Stripe→ICICI│ [download PDF]         │
│  13 Apr 2026  │ PAID     │ ₹49,800    │ Stripe→ICICI│ [download PDF]         │
│                                                                              │
│  [Export CSV]                                                ◀ 1 2 3 ▶       │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Admin wireframes

### 43. Admin dashboard
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Onsective Admin                                       [search] alex.k ▾      │
├──────────────────────────────────────────────────────────────────────────────┤
│  Today  ·  Yesterday  ·  Week  ·  Month                                      │
│                                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ GMV      │ │ Take rate│ │ Orders   │ │ Active   │ │ Active   │            │
│  │ $214K    │ │ 11.2%    │ │ 4,289    │ │ buyers   │ │ sellers  │            │
│  │ ▲ 8%     │ │ ▲ 0.3pp  │ │ ▲ 12%    │ │ 18,420   │ │ 1,247    │            │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
│                                                                              │
│  ⚠ Action queues                                                             │
│  ─ Sellers awaiting approval ····················  17 [Review]               │
│  ─ Products pending moderation ··················  43 [Review]               │
│  ─ Open disputes ································   8 [Review]               │
│  ─ Refund queue (>$500) ·························   3 [Review]               │
│  ─ Failed payouts ································   2 [Review]               │
│  ─ Stuck shipments (>5d) ·························  11 [Review]               │
│  ─ Ledger drift alerts ·······························   0 ✓                  │
│                                                                              │
│  Live activity                                                               │
│  19:42  order placed ONS-2026-04287                          $124.50         │
│  19:42  seller signup pending                                acme-test       │
│  19:41  order shipped via Easy Post                          ONS-2026-04280  │
│  19:41  refund requested                                     ONS-2026-04150  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 49. Commission rule editor
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Commission rules                                                  [+ New]    │
├──────────────────────────────────────────────────────────────────────────────┤
│ Drag to reorder priority.  Higher = wins.  Wildcards match anything.         │
│                                                                              │
│ ⋮⋮ │ Pri │ Match                       │ Pct │ Effective       │ Status      │
│ ⋮⋮ │ 100 │ Promo: New seller (90d)     │ 5%  │ ongoing         │ Active │ ⋯  │
│ ⋮⋮ │  90 │ Country=IN, Cat=Electronics │ 12% │ from 1 Jan 2026 │ Active │ ⋯  │
│ ⋮⋮ │  80 │ Country=US, Cat=Fashion     │ 15% │ ongoing         │ Active │ ⋯  │
│ ⋮⋮ │  10 │ * (default)                 │ 10% │ ongoing         │ Active │ ⋯  │
│                                                                              │
│ [💡 Dry run]  Apply rules to [last 30 days ▾]                                │
│   → 4,289 orders affected · revenue delta: +$3,240 if rules existed then     │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 50. Ledger trial balance
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Trial balance                As of: 26 Apr 2026 23:59 UTC    Currency: INR ▾ │
├──────────────────────────────────────────────────────────────────────────────┤
│ Account                  │ Debit (₹)         │ Credit (₹)        │ Net (₹)   │
│ ──────────────────────── │ ───────────────── │ ───────────────── │ ─────────│
│ BUYER_RECEIVABLE         │  1,24,89,400      │  1,24,89,400      │      0   │
│ PLATFORM_LIABILITY       │      8,84,200     │     17,42,800     │ +8,58,600│
│ SELLER_PAYABLE           │     17,42,800     │     17,42,800     │      0   │
│ SELLER_PAID              │     14,28,600     │      0            │+14,28,600│
│ PLATFORM_REVENUE         │      0            │     12,38,420     │+12,38,420│
│ TAX_PAYABLE              │     2,10,000      │      4,28,500     │ +2,18,500│
│ GATEWAY_FEES             │      3,12,400     │      0            │+3,12,400 │
│ REFUND_LIABILITY         │      1,24,000     │      1,24,000     │      0   │
│ ──────────────────────── │ ───────────────── │ ───────────────── │ ─────────│
│ TOTALS                   │  1,71,90,400      │  1,71,90,400      │   ✓ 0    │
│                                                                              │
│ ✓ Trial balance reconciles. Stripe balance: ₹8,58,600 — matches PLATFORM_LIABILITY │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Cross-screen design tokens (for Figma handoff)

| Token | Value |
|---|---|
| Spacing scale | 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 px |
| Container max | 1280 px |
| Typography | Inter (Latin), Noto Sans (multi-script), system fallback |
| Type ramp | h1 32 · h2 24 · h3 20 · body 16 · small 14 · micro 12 |
| Radius | 4 / 8 / 12 px |
| Color (provisional) | Primary: deep indigo · Accent: amber (CTAs) · Success/Error/Warn standard |
| Elevation | 0 / 1 / 2 / 3 / 4 (subtle) |
| Iconography | Lucide |
| Breakpoints | sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1536 |
| Locale safety | Reserve 30% extra width for non-English layouts; never truncate critical UI |

---

## Interaction notes

- **Skeleton loaders** on every list/card — never blank. Use shimmer for first paint.
- **Optimistic updates** on cart, wishlist, qty change.
- **Empty states** for: cart, orders, products, wishlist, search no-results, filtered no-results.
- **Error states** for: payment failure (with retry), shipping unavailable (with alt), out-of-stock (with notify-when-back), KYC blocking (with checklist).
- **Toast notifications** for non-blocking actions; modal for blocking; inline for form errors.
- **Keyboard nav** — all CTAs reachable via Tab; Escape closes modals.
- **Accessibility** — WCAG 2.1 AA target; all interactive elements ≥ 44px hit area; alt text on every image.
