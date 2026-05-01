# syntax=docker/dockerfile:1.6
# ---- 1) deps ----------------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app

# Prisma needs OpenSSL on alpine
RUN apk add --no-cache libc6-compat openssl

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# ---- 2) builder -------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Bake schema -> client; build standalone.
RUN npx prisma generate
RUN npm run build
RUN node scripts/copy-standalone-assets.mjs

# ---- 3) runner --------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apk add --no-cache openssl \
    && addgroup -S app && adduser -S app -G app

# Prisma needs the schema and the engine inside the standalone bundle (already
# placed there by next build's tracer + our copy script).
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public
# Mount /app/prisma at runtime (-v) to persist the SQLite file outside the
# image. The empty directory keeps the bind-mount target deterministic.
COPY --from=builder --chown=app:app /app/prisma ./prisma

USER app
EXPOSE 3000

CMD ["node", "server.js"]
