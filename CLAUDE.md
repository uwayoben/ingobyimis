# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev          # start dev server (Turbopack)
npm run build        # production build
npm run lint         # ESLint

npm run db:push      # sync schema to DB (no migration files)
npm run db:migrate   # create and apply a migration
npm run db:seed      # populate DB with sample data (tsx prisma/seed.ts)
npm run db:studio    # open Prisma Studio GUI
npm run db:generate  # regenerate Prisma client after schema changes
npm run db:reset     # drop + re-migrate + re-seed
```

**Database**: XAMPP MariaDB 10.4 on port 3306, no root password. `.env` must use `mysql://root:@localhost:3306/ingobyi_mis` (empty password — not `root:password`).

**After any schema change**: run `npm run db:push` (dev) or `npm run db:migrate` (prod), then `npm run db:generate` if the client was not auto-regenerated.

## Architecture

### App structure

```
app/
  (auth)/          # login + OTP pages — no sidebar/navbar layout
  (dashboard)/     # all protected pages — Sidebar + Navbar layout
  api/v1/          # REST API route handlers
lib/               # prisma singleton, auth helpers, response helpers, utils
components/
  ui/              # primitive components (Button, Card, Badge, Modal, etc.)
  layout/          # Sidebar, Navbar, ThemeToggle
  dashboard/       # KPICard, LoanChart, RecentActivity widgets
types/index.ts     # shared TypeScript interfaces (separate from Prisma types)
prisma/
  schema.prisma    # source of truth for DB schema
  seed.ts          # run with tsx, not ts-node
```

### API layer

All route handlers live under `app/api/v1/` and use the Web API `Request`/`Response` (no `req`/`res`). Every handler follows the same pattern:

```ts
import { getAuthUser } from "@/lib/auth";
import { ok, badRequest, unauthorized } from "@/lib/api-response";

export async function GET(request: Request) {
  const auth = getAuthUser(request);
  if (!auth) return unauthorized();
  // scope all queries to auth.companyId
  return ok(data);
}
```

Response helpers (`lib/api-response.ts`):
- `ok(data)` → `{ data }` 200
- `paginated(data, total, page, limit)` → `{ data, meta: { total, page, limit, pages } }`
- `created(data)` → `{ data }` 201
- `badRequest(msg)` / `unauthorized()` / `forbidden()` / `notFound()` / `serverError()` → `{ error }`

### Authentication flow

Password → OTP → JWT (two-factor). The OTP is stored on the `User` row (`otpCode`, `otpExpiry`). In dev it is printed to the server console; SMS integration is a TODO.

`lib/auth.ts` — `getAuthUser(request)` checks in order:
1. `Authorization: Bearer <token>` header (mobile app)
2. HTTP-only `token` cookie (web app)

Both are supported simultaneously so the same API serves web and mobile. JWT payload shape: `{ userId, email, role, companyId, name }`.

### Prisma

- **Generator**: `provider = "prisma-client"` (Prisma 6 — not the old `prisma-client-js`)
- **Output**: `lib/generated/prisma` — always import as `@/lib/generated/prisma/client`
- **Singleton**: `lib/prisma.ts` stores the client on `globalThis` to survive HMR restarts
- **Config file**: `prisma.config.ts` at root loads `.env` via `import "dotenv/config"` — do not pass `--env-file` flags
- **Monetary values**: stored as `Int` (whole RWF, no decimals). `Decimal` is only used for rates. Cast `Decimal` fields with `Number(field)` before returning them in JSON responses.

### Role permissions

| Role | Key permissions |
|---|---|
| `super_admin` | cross-company access, create companies + managing directors |
| `managing_director` | full access within own company, approve/reject loans, create users |
| `loan_officer` | create loans, record payments |
| `receptionist` | record payments, view-only |
| `shareholder` | read-only |

`RoleGate` in `components/RoleContext.tsx` wraps UI to show/hide elements by role. It currently reads from mock data — needs JWT wiring once auth is fully connected.

### Frontend / API connection status

Pages currently use `lib/mock-data.ts` for display data — they are **not yet wired** to the `/api/v1/` endpoints. The login and OTP pages simulate the flow with a `setTimeout` rather than calling the real API.

### Styling conventions

- Tailwind CSS v4: use `@import "tailwindcss"` in CSS (not `@tailwind base/components/utilities`)
- Dark mode: class strategy via `@variant dark (&:where(.dark, .dark *))`
- Brand green: `green-600`/`green-700` light, `green-500`/`green-600` dark
- Page banner pattern: `bg-gradient-to-r from-green-900 to-green-800` header with KPI cards beneath
- `Button` variant `primary` already applies `bg-green-600` — do **not** add a competing `bg-*` class. Use a plain `<button>` element when you need a white or custom-coloured button inside a green banner.

### Zod v4

Use `.issues[0].message` (not `.errors[0].message`) when reading parse failures:
```ts
if (!parsed.success) return badRequest(parsed.error.issues[0].message);
```
