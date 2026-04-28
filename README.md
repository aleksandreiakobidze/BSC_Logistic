# BSC Logistics

A full-featured, multi-tenant transportation logistics management web app.

## Stack

- **Framework**: Next.js 15 (App Router, Server Actions) + TypeScript
- **UI**: Tailwind CSS + shadcn/ui primitives + framer-motion + lucide-react
- **DB**: PostgreSQL + Prisma ORM
- **Auth**: Auth.js v5 (NextAuth) with RBAC
- **i18n**: next-intl (EN / KA / RU)
- **Maps**: Mapbox GL
- **Queue**: BullMQ + Redis
- **Email/SMS**: Resend + Twilio
- **Storage**: S3-compatible (Cloudflare R2 / AWS S3)

## Feature modules

- Multi-tenant organizations & branches
- Users, roles & RBAC (Admin, Dispatcher, Driver, Accountant, Customer)
- Customers (CRM-lite) with contracts & credit limits
- Fleet: vehicles, trailers, maintenance, documents, fuel
- Drivers: profiles, licenses, availability, payroll
- Orders → Shipments with stops, cargo, pricing
- Dispatch board (drag & drop) + live Mapbox tracking
- Driver mobile PWA: assigned shipments, status updates, POD upload
- Warehouse: locations, bins, items, movements
- Invoicing, payments, expenses, driver settlements (PDF)
- Notifications (email/SMS) via BullMQ
- Customer portal: public tracking, invoices, quote requests
- KPI analytics dashboard + CSV/PDF exports
- Audit log of all mutations

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Copy env
cp .env.example .env
# edit .env (generate AUTH_SECRET with: openssl rand -base64 32)

# 3. Start infra (Postgres, Redis, Mailhog)
docker compose up -d

# 4. Migrate & seed the database
npm run db:push
npm run db:seed

# 5. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Default seeded accounts

| Role       | Email                   | Password    |
|------------|-------------------------|-------------|
| Admin      | admin@bsc.local         | admin12345  |
| Dispatcher | dispatcher@bsc.local    | pass12345   |
| Driver     | driver@bsc.local        | pass12345   |
| Accountant | accountant@bsc.local    | pass12345   |
| Customer   | customer@bsc.local      | pass12345   |

## Scripts

- `npm run dev` - Next.js dev server
- `npm run build` / `start` - production build / start
- `npm run lint` / `typecheck` - linting & types
- `npm run db:push` / `db:migrate` / `db:seed` / `db:studio`
- `npm run worker` - BullMQ notification worker
- `npm run test` / `test:e2e` - unit / e2e tests

## Project layout

```
app/[locale]/
  (auth)/       # login, register, forgot
  (dashboard)/  # admin/dispatch UI
  (driver)/     # mobile driver PWA
  (portal)/     # customer portal
components/ui/  # shadcn primitives
components/app/ # feature components
lib/            # db, auth, mail, sms, storage, maps, rbac, i18n helpers
prisma/         # schema + seed
messages/       # i18n translation files (en.json, ka.json, ru.json)
workers/        # BullMQ job workers
```

## Deployment

Works on Vercel with managed Postgres (Neon/Supabase), Upstash Redis, and Cloudflare R2. See `docs/deploy.md`.
