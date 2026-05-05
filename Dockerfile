# syntax=docker/dockerfile:1.7
# Multi-stage build for the BSC Logistics Next.js app + tsx-based worker.
# Single image; the runtime command is overridden per Container App in ACA:
#   - bsc-web:    node server.js
#   - bsc-worker: node node_modules/tsx/dist/cli.mjs workers/index.ts
#   - bsc-migrate (Job): npx prisma migrate deploy
#   - bsc-cron    (Job): node node_modules/tsx/dist/cli.mjs scripts/cron-maintenance.ts

# Base image hosted on Microsoft Container Registry (no Docker Hub rate limit).
# Azure Linux 3.0 is glibc-based with `tdnf` package manager; Prisma picks the
# `debian-openssl-3.0.x` / `rhel-openssl-3.0.x` engines we declared in
# prisma/schema.prisma. Alpine could not be used because ACR Tasks regularly
# hit Docker Hub anonymous pull limits during builds.
ARG NODE_BASE=mcr.microsoft.com/azurelinux/base/nodejs:20

# ---------------------------------------------------------------------------
# Stage 1: deps -- install full dep tree (incl. dev) for Prisma + tsx + build
# ---------------------------------------------------------------------------
FROM ${NODE_BASE} AS deps
WORKDIR /app
RUN tdnf install -y openssl ca-certificates tar shadow-utils && tdnf clean all
COPY package.json package-lock.json ./
# `--legacy-peer-deps` matches local install due to React 19 RC + dnd-kit peer
# resolution. Drop once dependencies stabilise on a non-RC React.
RUN npm ci --legacy-peer-deps

# ---------------------------------------------------------------------------
# Stage 2: build -- compile Next, generate Prisma client, copy standalone assets
# ---------------------------------------------------------------------------
FROM ${NODE_BASE} AS build
WORKDIR /app
RUN tdnf install -y openssl ca-certificates tar shadow-utils && tdnf clean all
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Azure Linux ships Node with `small-icu`, which lacks `windows-1252` etc.
# `fontkit` (a transitive dep of `@react-pdf/renderer`) hits this during the
# Next.js build's "collecting page data" phase. Point Node at the `full-icu`
# package so all ICU encodings are available.
ENV NODE_ICU_DATA=/app/node_modules/full-icu
# Build-time env stub so `lib/env.ts` doesn't fail-fast during `next build`.
# Real values are injected at runtime via Container App secrets.
ENV DATABASE_URL="postgresql://build:build@build:5432/build?schema=public"
ENV NEXTAUTH_SECRET="build-time-placeholder"
ENV NEXTAUTH_URL="http://localhost:3000"
ENV NEXT_PUBLIC_APP_URL="http://localhost:3000"
ENV MAIL_FROM="noreply@example.com"
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build
RUN node scripts/copy-standalone-assets.mjs

# ---------------------------------------------------------------------------
# Stage 3: runner -- minimal image with just the standalone server + tsx
# ---------------------------------------------------------------------------
FROM ${NODE_BASE} AS runner
WORKDIR /app
RUN tdnf install -y openssl ca-certificates curl shadow-utils && tdnf clean all

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Same full-ICU pointer as build stage; needed at runtime when `/api/invoice-*`
# routes call into fontkit.
ENV NODE_ICU_DATA=/app/node_modules/full-icu

# Non-root user (Mariner uses shadow-utils' groupadd/useradd)
RUN groupadd --system --gid 1001 nodejs \
 && useradd  --system --uid 1001 --gid 1001 --no-create-home --shell /sbin/nologin nextjs

# Standalone server bundle (includes its own minimal node_modules tree)
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
# Static assets
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
# Public assets (favicons, /uploads dev fallback, etc.)
COPY --from=build --chown=nextjs:nodejs /app/public ./public
# Prisma schema + migrations (needed by `prisma migrate deploy` ACA Job and by
# the standalone server when it touches the engine binary).
COPY --from=build --chown=nextjs:nodejs /app/prisma ./prisma
# Full node_modules from build stage. We tried selectively copying tsx /
# bullmq / prisma / etc. but the dependency graph is too wide (tsx -> esbuild
# platform binaries, worker -> bullmq -> ioredis, lib/* -> azure-sdk -> ...).
# Copying everything keeps the runner ~500MB larger but eliminates "Cannot
# find module" surprises and gives both `node server.js` (standalone web) and
# `tsx workers/index.ts` (worker / cron / migrate jobs) a uniform module graph.
COPY --from=build --chown=nextjs:nodejs /app/node_modules ./node_modules
# Worker source + scripts (referenced by bsc-worker / bsc-cron commands)
COPY --from=build --chown=nextjs:nodejs /app/workers ./workers
COPY --from=build --chown=nextjs:nodejs /app/scripts ./scripts
# tsconfig.json so tsx can resolve path aliases at runtime
COPY --from=build --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json
COPY --from=build --chown=nextjs:nodejs /app/lib ./lib
COPY --from=build --chown=nextjs:nodejs /app/package.json ./package.json

USER nextjs

EXPOSE 3000

# Container Apps `liveness` probe hits this every 30s.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
