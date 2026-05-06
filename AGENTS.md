# BSC Logistics - Agent Instructions

## Cursor Cloud specific instructions

### Overview

BSC Logistics is a Next.js 15 (App Router) multi-tenant transportation logistics management app. Single-package repo (not a monorepo).

### Required infrastructure

The `docker-compose.yml` at project root provides all necessary infrastructure:

- **PostgreSQL 16** on port 5432 (required)
- **Redis 7** on port 6379 (optional but recommended)
- **MailHog** on ports 1025/8025 (optional, for email testing)

Start with: `docker compose up -d`

### Key commands

| Task | Command |
|------|---------|
| Install deps | `npm install --legacy-peer-deps` |
| Generate Prisma client | `npx prisma generate` |
| Push schema to DB | `npm run db:push` |
| Seed database | `npm run db:seed` |
| Dev server | `npm run dev` (port 3000) |
| Lint | `npm run lint` |
| Type check | `npm run typecheck` |
| Unit tests | `npm run test` (vitest, use `-- --run` for CI) |
| E2E tests | `npm run test:e2e` (playwright) |
| BullMQ worker | `npm run worker` |

### Gotchas

- **`--legacy-peer-deps` is required** for `npm install` because the project uses React 19 RC which causes peer dependency conflicts with several packages.
- The `DATABASE_URL` in `.env` must match the docker-compose credentials: `postgresql://postgres:postgres@localhost:5432/bsc_logistics?schema=public`
- `AUTH_SECRET` env var is required for Auth.js — generate with `openssl rand -base64 32`.
- The app needs `npx prisma generate` after installing deps (or after schema changes) before the dev server will start.
- After `db:push`, run `db:seed` to create test accounts. Default admin login: `admin@bsc.local` / `admin12345`.
- Docker must be running (with `fuse-overlayfs` storage driver and `iptables-legacy`) in Cloud Agent VMs due to nested container environment.

### Services startup order

1. `docker compose up -d` (Postgres, Redis, MailHog)
2. `npm run db:push` (if fresh DB or schema changed)
3. `npm run db:seed` (if fresh DB)
4. `npm run dev` (Next.js dev server on port 3000)
5. Optionally: `npm run worker` (BullMQ notification worker, requires Redis)
