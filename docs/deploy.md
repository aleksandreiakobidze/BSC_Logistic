# Deployment Guide

This document describes a production deployment of **BSC Logistics** using managed services.

## Recommended topology

| Concern       | Service                                            |
| ------------- | -------------------------------------------------- |
| App hosting   | [Vercel](https://vercel.com) (Next.js 15 runtime)  |
| Database      | Neon / Supabase / RDS (PostgreSQL 15+)             |
| Redis / queue | [Upstash Redis](https://upstash.com)               |
| Object store  | Cloudflare R2 (S3-compatible)                      |
| Email         | Resend                                             |
| SMS           | Twilio                                             |
| Maps          | Mapbox                                             |
| Worker        | Railway / Fly / Render (runs `npm run worker`)     |

## 1. Provision managed services

1. **PostgreSQL**: create a database and copy the connection string.
2. **Upstash Redis**: enable the REST+TCP endpoint and copy the `redis://` URL.
3. **Cloudflare R2**: create a bucket; generate S3-compatible credentials.
4. **Resend**: create an API key; verify sending domain.
5. **Twilio**: provision a number; grab Account SID, Auth Token.
6. **Mapbox**: get a public access token.

## 2. Configure environment variables

On Vercel (and on your worker host) set:

```
DATABASE_URL=postgres://...
DIRECT_URL=postgres://...        # optional, used for Prisma migrations
AUTH_SECRET=$(openssl rand -base64 32)
AUTH_URL=https://your-domain.com
REDIS_URL=rediss://...
RESEND_API_KEY=...
RESEND_FROM="BSC Logistics <noreply@your-domain.com>"
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM=+1555...
S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=bsc-logistics
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
NEXT_PUBLIC_MAPBOX_TOKEN=pk.ey...
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXT_PUBLIC_DEFAULT_LOCALE=en
QUOTE_INBOX=dispatch@your-domain.com
```

## 3. Migrate & seed

From a workstation with `DATABASE_URL` pointing at production:

```bash
npm ci
npx prisma migrate deploy
# (optional) npm run db:seed  -- only on a fresh environment
```

## 4. Deploy the web app (Vercel)

1. Import the Git repo.
2. Set the environment variables above.
3. Build command: `next build`. Output: `.next`.
4. Deploy.

## 5. Run the notifications worker

The worker is a separate long-running process that consumes the `notifications` BullMQ queue.

```bash
# On Railway/Fly/Render
npm ci
npm run worker
```

Give the worker the same `REDIS_URL`, `RESEND_*` and `TWILIO_*` env vars as the web app.

## 6. Hardening checklist

- [ ] Enforce HTTPS + HSTS in your edge config.
- [ ] Restrict `AUTH_URL` to a single canonical domain.
- [ ] Rotate `AUTH_SECRET` and DB credentials regularly.
- [ ] Enable Postgres backups (daily + PITR where possible).
- [ ] Enable Upstash daily persistence snapshot.
- [ ] Configure R2 bucket CORS for your web origin only.
- [ ] Put Mapbox key behind a URL-restricted token.
- [ ] Enable Vercel Web Analytics / Sentry for error tracking.
- [ ] Configure automated `prisma migrate deploy` on release.

## 7. Observability

- Health: `/api/health` returns `{ ok: true }`.
- Worker logs: redirect stdout to your platform's log sink.
- DB connection pool: use `pgbouncer` in transaction mode if your provider offers one.

## 8. Running e2e tests against a preview

```bash
E2E_BASE_URL=https://<preview>.vercel.app npx playwright test
```
