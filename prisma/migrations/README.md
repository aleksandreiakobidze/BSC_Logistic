# Prisma migrations

The schema targets PostgreSQL. Before the very first deploy, generate the
initial migration locally against a Postgres instance:

```bash
# 1. Spin up local Postgres (one-off)
docker run -d --name bsc-pg -p 5432:5432 \
  -e POSTGRES_USER=bsc -e POSTGRES_PASSWORD=bsc -e POSTGRES_DB=bsc postgres:16

# 2. Point Prisma at it
export DATABASE_URL="postgresql://bsc:bsc@localhost:5432/bsc?schema=public"

# 3. Generate the initial migration
npx prisma migrate dev --name init_postgres
```

Prisma writes the new folder to `prisma/migrations/<timestamp>_init_postgres/`.
Commit it. The pre-existing `99990101000000_perf_indexes/` folder is engineered
to always sort *after* whatever timestamp `init_postgres` ends up with, so it
runs second and adds extension/index DDL on top of the base schema.

In production we use `prisma migrate deploy` (driven by the `bsc-migrate` ACA
Job) which only applies migrations that already exist on disk — it never
generates new ones.
