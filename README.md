# Waypoint

Summer conference & student life management — a modern replacement for legacy camp staff tools.

## Stack

- **Frontend**: Next.js 16, TypeScript, Tailwind CSS v4, shadcn/ui
- **Backend**: Next.js Route Handlers
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: NextAuth.js (Auth.js) with RBAC

Waypoint is **single-org per deployment** — one conference organization per instance. No multi-tenant switching UI.

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Set `AUTH_SECRET` (generate with `openssl rand -base64 32`) and `DATABASE_URL` (see database options below).

### Auth.js (NextAuth v5) — Vercel / production env vars

| Variable | Required? | Notes |
|----------|-----------|--------|
| **`AUTH_SECRET`** | **Yes** | Signing secret for JWTs/cookies. This is what the middleware and Auth.js expect. `NEXTAUTH_SECRET` works as a legacy alias, but prefer `AUTH_SECRET`. |
| **`AUTH_TRUST_HOST`** | Recommended | Set to `true` on Vercel so Auth.js trusts `X-Forwarded-Host`. Also set explicitly in `src/lib/auth.ts` via `trustHost: true`. |
| `AUTH_URL` | Optional | Canonical site URL (e.g. `https://your-app.vercel.app`). **Do not** leave it set to `http://localhost:3000` in production — that breaks host trust. Prefer omitting it on Vercel so Auth.js auto-detects. |
| `NEXTAUTH_URL` / `NEXTAUTH_SECRET` | Legacy | v4 names; Auth.js still aliases them, but configure **`AUTH_*`** going forward. |

After login, session cookies on HTTPS are named `__Secure-authjs.session-token`. Middleware must decode with `secureCookie: true` (fixed in `src/middleware.ts`).

### 3. Database setup

#### Option A — Local development (`prisma dev`)

Best for day-to-day development on your machine:

```bash
npx prisma dev
```

Prisma starts a local Postgres instance and writes a `DATABASE_URL` to `.env`. Then apply the schema:

```bash
npm run db:migrate
npm run db:seed    # optional demo data
```

#### Option B — Production with [Neon](https://neon.tech)

1. Create a Neon project and copy the **pooled** connection string.
2. Set in `.env` (or Vercel environment variables):

```env
DATABASE_URL="postgresql://USER:PASSWORD@ep-XXXX.us-east-2.aws.neon.tech/neondb?sslmode=require"
```

3. Apply schema to Neon:

```bash
npm run db:migrate
```

**Notes for Neon + Vercel:**
- Use the pooled connection string for serverless/API routes.
- Add `?sslmode=require` if not already present.
- Run migrations from your machine or CI before deploying.

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Demo accounts (after seeding)

| Email | Role | Password |
|---|---|---|
| admin@demo.camp | Super Admin | campadmin123 |
| counselor@demo.camp | Staff | campadmin123 |
| parent@demo.camp | Parent | campadmin123 |

Or create a new organization at `/onboarding`.

## Roster CSV import

See [`docs/ROSTER_CSV_FORMAT.md`](docs/ROSTER_CSV_FORMAT.md) for column headers and rules.

Template file: [`docs/roster-import-template.csv`](docs/roster-import-template.csv)

## Build stages

See `CHANGELOG.md` for progress.

- **Stage 1** — Foundation ✅
- **Stage 2** — Roster & student profiles ✅

## Project structure

```
src/
  app/
    (auth)/          # Login, forgot password, onboarding
    (app)/           # Staff/admin protected routes
    (parent)/parent/ # Parent portal
    api/             # Route handlers (students, auth, onboarding)
  components/
    roster/          # Roster list, profile, import, forms
    design-system/   # Shared UI patterns
    layout/          # App shell, sidebar, mobile nav
    ui/              # shadcn primitives
  lib/               # Auth, prisma, roster, permissions, CSV import
docs/
  ROSTER_CSV_FORMAT.md
  roster-import-template.csv
prisma/
  schema.prisma
  seed.ts
```
