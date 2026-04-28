# Onsective

Multi-seller ecommerce marketplace. Worldwide architecture, anchor markets US + India for v1.

> Full plan: see `PLAN.md` and `PHASE_DETAILS.md`. Schema: `packages/db/prisma/schema.prisma`.

---

## Stack

- **Next.js 14** (App Router) + **TypeScript** — `apps/web`
- **Prisma** + **Postgres 16** — `packages/db`
- **Tailwind CSS** + **shadcn/ui pattern** — `packages/ui`
- **next-intl** for i18n (en, hi at start)
- **pnpm** workspaces + **Turborepo**

---

## Prerequisites

- Node 20.10+ (use `nvm use`)
- pnpm 9+ (`npm install -g pnpm`)
- Docker (for local Postgres) or any reachable Postgres 16 instance

---

## First-time setup

```bash
# 1. Install dependencies
pnpm install

# 2. Copy env file and fill in values
cp .env.example .env

# 3. Start Postgres locally (one option):
docker run -d --name onsective-pg \
  -e POSTGRES_USER=onsective \
  -e POSTGRES_PASSWORD=onsective \
  -e POSTGRES_DB=onsective \
  -p 5432:5432 \
  postgres:16-alpine

# 4. Generate Prisma client + run initial migration
pnpm db:generate
pnpm db:migrate

# 5. Run dev server
pnpm dev
```

Then open http://localhost:3000 — you'll be redirected to `/en` (the default locale).

---

## Repo layout

```
onsective/
├── apps/
│   └── web/                    # buyer + seller web app (Next.js)
├── packages/
│   ├── db/                     # Prisma schema + client
│   └── ui/                     # design system (tokens + components)
├── PLAN.md                     # master plan
├── PHASE_DETAILS.md            # per-phase: features, UI, security, support, ops
├── PHASE{1,2,3}_SPRINTS.md     # sprint-level tickets
├── DESIGN_SYSTEM.md            # colors, typography, components
├── SECURITY.md                 # threat model + controls
├── CUSTOMER_SUPPORT.md         # support system spec
├── PLATFORM_MANAGER.md         # ops role spec
├── API_SURFACE.md              # tRPC contract
├── WIREFRAMES.md               # all screens
└── ADRs.md                     # architecture decisions
```

---

## Common commands

```bash
pnpm dev               # dev server (all apps)
pnpm build             # production build
pnpm lint              # lint everything
pnpm type-check        # TypeScript check across the monorepo
pnpm format            # prettier write
pnpm db:studio         # Prisma Studio GUI for the DB
pnpm db:migrate        # create + apply a new migration
```

---

## What's wired up so far (Phase 0)

- ✅ Monorepo (pnpm + Turbo)
- ✅ Next.js 14 App Router with locale routing (`/en`, `/hi`)
- ✅ Tailwind + design tokens (light mode)
- ✅ Prisma schema (~30 models, see `packages/db/prisma/schema.prisma`)
- ✅ i18n message catalogs (en, hi) via `next-intl`
- ✅ Theme provider + Header + Footer + Home layout
- ✅ Env validation via zod
- ⏳ Auth, cart, checkout, payments, shipping — Phases 1–3

---

## Next steps in code (after install)

1. **Set up auth** — see `PHASE1_SPRINTS.md` Sprint 0 (`AUTH-001` to `AUTH-003`)
2. **Add tRPC** — wire `apps/web/src/server/` and `packages/api`
3. **Implement catalog** — Sprint 1 in `PHASE1_SPRINTS.md`
4. **Storybook** — `pnpm dlx storybook@latest init` in `packages/ui`
5. **CI** — copy a starter from `.github/workflows/` (TBD)

---

## Notes

- Source of truth for design choices: `DESIGN_SYSTEM.md`. Don't add ad-hoc colors.
- Source of truth for security posture: `SECURITY.md`. PRs touching auth/payments must include the SECURITY.md PR checklist.
- Source of truth for architectural decisions: `ADRs.md`. Add a new ADR rather than re-arguing.
