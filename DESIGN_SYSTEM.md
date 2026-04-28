# Onsective Design System
## UI · UX · Color · Layout · Motion · A11y

> **The single source of truth for what Onsective looks like and how it behaves.** Every phase references this document. Frontend devs implement from it; designers extend it; reviewers audit against it.

---

## 1. Brand essence

| Pillar | Meaning | UI implication |
|---|---|---|
| **Trustworthy** | money + identity + delivery flow safely | tight semantic colors, no flashy patterns near payment, verified badges, clear status states |
| **Fast** | every screen feels instant | skeletons not spinners, optimistic updates, < 100ms hover feedback |
| **Global** | one product, many locales | i18n-safe layouts (30% extra width reserve), RTL safe, multi-script type stack |
| **Accessible** | usable by everyone | WCAG 2.1 AA minimum, AAA where reasonable |
| **Functional > decorative** | commerce is utility | decoration must defer to information density and conversion |

Tone: **professional but human.** Microcopy is direct, never cute. Errors apologize once, then explain. Empty states suggest the next action.

---

## 2. Color system

### 2.1 Primary palette

| Token | Hex | Use |
|---|---|---|
| `brand-50`  | `#EEF2FF` | tinted backgrounds, hover highlights |
| `brand-100` | `#E0E7FF` | subtle fills, badge bg |
| `brand-300` | `#A5B4FC` | disabled primary, decorative |
| `brand-500` | `#6366F1` | accent, links |
| **`brand-600`** | **`#4F46E5`** | **primary brand color, default button** |
| `brand-700` | `#4338CA` | primary hover/active |
| `brand-900` | `#312E81` | dark headers, dark-mode primary |

### 2.2 Commerce-accent palette (CTAs that move money)

The "Buy Now" / "Add to Cart" buttons must stand out from the brand color. We use **amber** like Amazon's yellow — proven for commerce.

| Token | Hex | Use |
|---|---|---|
| `cta-50`  | `#FFFBEB` | banner backgrounds |
| `cta-400` | `#FBBF24` | secondary CTA |
| **`cta-500`** | **`#F59E0B`** | **primary CTA (buy now, checkout)** |
| `cta-600` | `#D97706` | CTA hover |
| `cta-900` | `#78350F` | text on cta-100 |

### 2.3 Neutrals

Default to Tailwind's `slate` scale. Not `gray` — slate has a slight blue undertone that pairs with indigo brand and avoids the "dead" look of pure gray.

```
slate-50  #F8FAFC   page backgrounds (light mode)
slate-100 #F1F5F9   subtle surface
slate-200 #E2E8F0   borders, dividers
slate-300 #CBD5E1   disabled text, placeholder
slate-400 #94A3B8   muted text
slate-500 #64748B   secondary text
slate-600 #475569   body text in light mode
slate-700 #334155   strong body
slate-800 #1E293B   headings (light mode), surfaces (dark)
slate-900 #0F172A   display headings (light), bg (dark)
slate-950 #020617   darkest background (dark mode)
```

### 2.4 Semantic colors

| Token | Hex | Use |
|---|---|---|
| `success-500` | `#10B981` | success toasts, "delivered" status, in-stock |
| `success-600` | `#059669` | success CTA |
| `warning-500` | `#F59E0B` | warnings (overlaps cta — use carefully; warnings get amber bg `cta-50`) |
| `error-500` | `#EF4444` | errors, "out of stock" |
| `error-600` | `#DC2626` | destructive button |
| `info-500` | `#0EA5E9` | info banners |

### 2.5 Marketplace-specific signal colors

| Signal | Color | Token |
|---|---|---|
| Verified seller | sky-500 (`#0EA5E9`) | `signal-verified` |
| Top rated | cta-500 amber | `signal-top-rated` |
| Free shipping | success-500 emerald | `signal-free-ship` |
| Onsective Choice (Phase 5) | brand-600 indigo | `signal-onsective-choice` |
| Limited stock (1–5 left) | error-500 red | `signal-low-stock` |
| Out of stock | slate-400 | `signal-oos` |
| Coming soon | info-500 sky | `signal-soon` |

### 2.6 Dark mode

Dark mode is **not** light mode inverted. The mappings:

| Light | Dark |
|---|---|
| Page bg `slate-50` | `slate-950` |
| Surface `white` | `slate-900` |
| Elevated surface | `slate-800` |
| Border `slate-200` | `slate-800` |
| Body text `slate-700` | `slate-300` |
| Heading `slate-900` | `slate-50` |
| Brand button `brand-600` | `brand-500` (slightly lighter for contrast) |
| CTA button `cta-500` | `cta-400` (lighter for contrast on dark) |

**Rule:** every component must be tested in both modes. Storybook themes both.

### 2.7 Color contrast checklist (WCAG)

- Body text on background: **≥ 4.5:1**
- Large text (≥ 18px or 14px bold) on background: **≥ 3:1**
- UI controls (button border, input border, focus ring): **≥ 3:1**
- Decorative icons: no requirement; meaningful icons must have alt text
- Tested via axe-core in CI; PRs blocked on fail

---

## 3. Typography

### 3.1 Type stack

```
font-sans:   Inter, "Noto Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
font-display: "Inter Display", Inter, sans-serif       /* tighter for headings ≥36px */
font-mono:    "JetBrains Mono", ui-monospace, monospace
font-script:  "Noto Sans Devanagari", "Noto Sans Arabic", "Noto Sans CJK"  /* per-locale fallback */
```

Inter for Latin. Noto for everything else. System monospace is fine; we ship JetBrains via CDN for the order-number / SKU areas where consistent width helps.

### 3.2 Type scale (rem at 16px root)

| Step | Size / Line-height | Weight | Use |
|---|---|---|---|
| micro | 12 / 16 | 500 | captions, micro-labels, badges |
| sm | 14 / 20 | 400 | secondary text, captions |
| base | 16 / 24 | 400 | body |
| lg | 18 / 28 | 500 | emphasized body, lead-in |
| xl | 20 / 28 | 600 | h4, card title |
| 2xl | 24 / 32 | 600 | h3, section title |
| 3xl | 30 / 38 | 700 | h2 |
| 4xl | 36 / 44 | 700 | h1 |
| 5xl | 48 / 56 | 800 | display |
| 6xl | 60 / 72 | 800 | hero display (rare) |

**Rules:**
- One H1 per page, period.
- Numbers in finance/order contexts → use `font-feature-settings: 'tnum'` (tabular nums) so columns align.
- Never set font sizes below `sm` for body content.
- Line-height shrinks slightly at display sizes (-2px from rule of thumb).

### 3.3 i18n-safe typography

- Reserve **30% extra horizontal space** for non-English layouts (German averages +30%, French +25%, Russian +20%).
- Never truncate critical UI (price, CTA, error). Truncate descriptions at most.
- For RTL (Arabic, Hebrew): use logical properties (`margin-inline-start` not `margin-left`); test full mirroring.
- Devanagari (Hindi) needs more line-height: bump line-height by 0.25 line-units in `lang="hi"` blocks.

---

## 4. Spacing system

Base unit: **4px.** Stick to the scale.

```
0  · 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80 · 96 · 128 px
```

**Component padding rules:**
- Buttons: vertical=10/12/14 (sm/md/lg), horizontal=16/20/24
- Cards: 16 (mobile), 24 (desktop)
- Sections: 48 (mobile), 80 (desktop) vertical
- Form fields: 12 vertical, 14 horizontal

**Stack spacing rules:**
- Items in a list: 8 (tight), 16 (normal), 24 (loose)
- Forms: 16 between fields, 24 between groups
- Page sections: 48 (mobile), 80 (desktop)

---

## 5. Layout

### 5.1 Breakpoints

```
sm  640px    phone landscape, large phone
md  768px    small tablet
lg  1024px   tablet landscape, small laptop
xl  1280px   laptop, default desktop
2xl 1536px   wide desktop
```

### 5.2 Container widths

| Surface | Max width | Padding (mobile / desktop) |
|---|---|---|
| Marketing pages, PDP | 1280px | 16 / 32 |
| Dashboard (seller, console) | 1440px (or full-width) | 16 / 24 |
| Account pages | 768px | 16 / 32 |
| Email content | 600px | n/a |

### 5.3 Grid

- **Desktop**: 12 columns, 24px gutter, 32px outer
- **Tablet**: 8 columns, 20px gutter, 24px outer
- **Mobile**: 4 columns, 16px gutter, 16px outer

### 5.4 Standard layouts

```
PDP (desktop)              Dashboard (desktop)         Mobile (any page)
┌─────────────────────┐    ┌──┬──────────────────┐    ┌─────────────┐
│      Header         │    │  │     Top bar      │    │   Header    │
├─────────────────────┤    │  ├──────────────────┤    ├─────────────┤
│┌─────────┬────────┐ │    │  │                  │    │             │
││ Gallery │ Buybox │ │    │S │   Content        │    │   Content   │
││         │        │ │    │i │                  │    │             │
│└─────────┴────────┘ │    │d │                  │    │             │
├─────────────────────┤    │e │                  │    │             │
│   Description       │    │  │                  │    │             │
├─────────────────────┤    │  │                  │    ├─────────────┤
│   Reviews           │    │  │                  │    │  Bottom nav │
├─────────────────────┤    └──┴──────────────────┘    └─────────────┘
│      Footer         │
└─────────────────────┘
```

### 5.5 Z-index scale

```
0     base
10    sticky elements (header, sticky CTA)
20    dropdowns, popovers
30    drawer (mobile menu, cart drawer)
40    modal backdrop
50    modal content
60    toast / snackbar
70    tooltip
100   debug overlays (dev only)
```

---

## 6. Component library

Built on **shadcn/ui** (Radix UI primitives + Tailwind + class-variance-authority). Owned in `packages/ui/`.

### 6.1 Buttons

| Variant | Use |
|---|---|
| `primary` (brand-600) | default action: Save, Submit |
| `cta` (cta-500) | commerce action: Buy Now, Add to Cart, Checkout |
| `secondary` (slate-200 fill) | secondary action |
| `outline` | tertiary action |
| `ghost` (no fill) | quiet action, dense lists |
| `link` (text-only) | inline link-style action |
| `destructive` (error-600) | delete, cancel order |

Sizes: `sm / md / lg / icon`. Loading state shows spinner replacing label, button stays width-stable. Disabled state at 40% opacity, no pointer events, no hover.

### 6.2 Inputs

- `Input` — text, email, number, password, search
- `Textarea`
- `Select` — native on mobile, custom on desktop
- `Combobox` — searchable select (countries, categories)
- `Checkbox`, `Radio`, `Switch`
- `DatePicker`
- `FileUpload` — drag-and-drop area

All inputs:
- Label always visible (no placeholder-as-label)
- Error message below, error border `error-500`
- Helper text in slate-500
- Required asterisk in error-500
- 44×44 minimum hit target

### 6.3 Cards

- **ProductCard** — image, title, price, rating, badge slot, hover lift
- **SummaryCard** — title, value (large), delta (% change), sparkline (optional)
- **MetricCard** — used in dashboards (KPI display)
- **OrderCard** — for order lists; status pill, items snippet, amount, action button
- **EmptyCard** — illustration + headline + body + CTA

### 6.4 Feedback

- `Toast` — top-right desktop, top-center mobile; auto-dismiss 4s; success / error / warn / info variants
- `Banner` — full-width announcement; dismissible vs persistent; severity variants
- `Modal` — desktop center, mobile bottom-drawer
- `Drawer` — slide from edge; cart drawer is a specialized one
- `Skeleton` — shimmer animation; one per major content type (product card, list row, paragraph)
- `EmptyState` — when there's nothing to show; never blank

### 6.5 Navigation

- `Header` — sticky on scroll past hero; condenses (smaller logo, hides categories) when condensed
- `BottomNav` (mobile only) — Home / Search / Cart / Orders / Account
- `Sidebar` (dashboard) — collapsible to icon-only at < 1280px
- `Breadcrumbs` — every catalog page; SEO-relevant

### 6.6 Status & badges

- **Status pill** — used for order/shipment/seller status; colored bg, colored text, rounded-full
- **Badge** — small label (Verified, Top Rated, New, Sale)
- **Progress bar** — for KYC completion, multi-step checkout
- **Stepper** — horizontal on desktop, vertical on mobile

### 6.7 Data display

- **Table** — virtualized at >100 rows; sortable headers; sticky first column on mobile (horizontal scroll)
- **List** — denser than table, mobile-friendly
- **Stat group** — cluster of metrics
- **Chart** — Recharts; line, bar, pie, sparkline only; no 3D, no exotic types

### 6.8 Pricing display

A canonical component because price formatting bugs are expensive.

```
<Price
  amount={4499}
  currency="INR"
  locale="en-IN"
  strikethroughAmount={6999}    // optional MRP
  size="lg"                      // sm | md | lg | xl
/>
→ ₹4,499  ̶₹̶6̶,̶9̶9̶9̶  -36%
```

Internationalization, currency symbol, thousands separator, decimal handling — all live in this one component. Never raw-format price elsewhere.

---

## 7. Motion

### 7.1 Durations

| Token | ms | Use |
|---|---|---|
| `motion-instant` | 0 | reduced-motion users |
| `motion-fast` | 100 | hover, focus |
| `motion-base` | 200 | most transitions |
| `motion-slow` | 350 | modals, drawers |
| `motion-page` | 500 | page transitions (rare) |

### 7.2 Easings

```
ease-out      cubic-bezier(0, 0, 0.2, 1)        — entering elements
ease-in       cubic-bezier(0.4, 0, 1, 1)        — leaving elements
ease-in-out   cubic-bezier(0.4, 0, 0.2, 1)      — moving elements
ease-spring   cubic-bezier(0.34, 1.56, 0.64, 1) — playful, sparingly
```

### 7.3 Reduced motion

Respect `prefers-reduced-motion`. All non-essential animations disabled (carousels become tap-to-advance; modal slide → fade). Loading shimmer remains.

### 7.4 Library

- CSS transitions for simple property changes
- **Framer Motion** for layout animations, gestures, complex sequencing

---

## 8. Iconography

- **Lucide** for system icons (consistent stroke, outline style)
- 24×24 default, 16×16 micro, 20×20 in dense lists
- Stroke 2px, stroke-linecap round, stroke-linejoin round
- Icons-only buttons require `aria-label`
- Avoid decorative icons in headings — use only when they convey meaning

---

## 9. Imagery

### 9.1 Product photos

- **1200×1200 minimum** uploaded by sellers; rejected below
- White or transparent background preferred (badge applied on PDP if not)
- Lifestyle photos additionally allowed (up to 3 per product)
- Auto-resized variants: 200, 400, 800, 1200 (square)
- **Format**: WebP with AVIF preferred, JPG fallback
- Served via CloudFront with `srcset` for responsive
- Lazy load below the fold

### 9.2 Hero & marketing imagery

- 1920×800 for desktop hero
- 1080×1350 (4:5) for mobile hero
- Subjects offset to allow text overlay area

### 9.3 Illustrations (empty states, errors)

- Custom set in Phase 4
- Style: flat, brand-color-tinted, single-stroke
- Reuse across surfaces (cart empty / search empty / orders empty share visual language)

---

## 10. Accessibility (WCAG 2.1 AA target)

### 10.1 Requirements (non-negotiable)

- Color contrast ≥ 4.5:1 (text), ≥ 3:1 (UI)
- All interactive elements keyboard-reachable (Tab order logical)
- Visible focus indicator on every focusable (2px outline, brand-500)
- Hit targets ≥ 44×44 (touch screens)
- Form inputs labeled (visible, not placeholder-only)
- Error messages associated with inputs (`aria-describedby`)
- Modals trap focus, Escape closes, return focus on close
- Images have alt text (or `alt=""` if decorative)
- Headings nest correctly (no skipping levels)
- Lang attribute set per locale (`<html lang="en-IN">`)
- Skip-to-content link first focusable
- Status updates announced (`aria-live="polite"` for non-critical, `assertive` for errors)

### 10.2 Tools / process

- **axe-core** in CI (Playwright + axe-playwright); PR blocks on critical/serious
- Manual screen reader test (VoiceOver, NVDA) per major release
- Lighthouse Accessibility score ≥ 95 for buyer pages

---

## 11. Mobile principles

- **Mobile first.** Design 360px wide first; expand up.
- Bottom nav, not hamburger, for primary destinations
- Sticky CTA bar on PDP and cart pages (desktop top, mobile bottom)
- Touch gestures: swipe carousels, pull-to-refresh on order list, swipe-to-delete cart items
- Forms: numeric keyboard for numeric inputs, autocomplete attributes everywhere
- Viewport-adaptive font sizes for very small phones (320px)
- Avoid hover-dependent UI (no hover-reveal)
- Bottom-sheet over modal on mobile

---

## 12. Page anatomy reference (canonical)

### 12.1 Buyer header (sticky)

```
[Logo]  [search ────────────────────]  [📍 location]  [❤ wishlist] [🛒 cart] [👤 account]
        [▼ Electronics] [Fashion] [Home] ...
```

Condensed (after scroll):

```
[Logo]  [search ────────]  [🛒(2)]  [👤]
```

### 12.2 Footer (4 columns desktop, accordion mobile)

```
About             Customer service       Sell on Onsective       Stay connected
- About us        - Help center          - Become a seller       [Email signup]
- Careers         - Track order          - Seller policies       [Apple appstore]
- Press           - Returns              - Pricing               [Google play]
- Investor        - Contact us           - Resources             [Social icons]

Locale ▾   Currency ▾   © 2026 Onsective   Privacy   Terms   Cookies   Sitemap
```

---

## 13. Per-phase UI/UX evolution

| Phase | UI focus | Color additions | Layout milestones |
|---|---|---|---|
| **Phase 1** | functional MVP polish; light mode only; web + PWA | brand + slate + cta + semantic | header/footer/PDP/cart/checkout/dashboards |
| **Phase 2** | financial visualization (charts, ledger displays); seller payout polish | tabular numbers, money component | dashboard widgets matured |
| **Phase 3** | tracking page (real-time vibes); shipping queue density | badge palette grows (carriers, tracking states) | live-update components, map polish |
| **Phase 4** | reviews/ratings UI; **dark mode launch**; mobile apps; design polish | dark mode palette, illustration set, gradient accents | review showcase, recommendations carousel |
| **Phase 5** | brand refresh; sponsored ads slots; FBO branding | Onsective Choice gold; Prime-style purple accent | ad placements, FBO seller surface, B2B mode |

---

## 14. Where the design system lives

```
packages/ui/
├── primitives/        radix wrappers
├── components/        designed components (Button, ProductCard, ...)
├── tokens/
│   ├── colors.ts
│   ├── typography.ts
│   ├── spacing.ts
│   ├── motion.ts
│   └── breakpoints.ts
├── themes/
│   ├── light.ts
│   └── dark.ts
└── stories/           Storybook
```

Storybook deployed to `storybook.onsective.com` (auth-protected). PRs touching `packages/ui` auto-deploy preview.
