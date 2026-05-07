/* eslint-disable no-console */
/**
 * Local SQLite backfill for the Lead status simplification rollout.
 *
 *   * Adds the wonAt column (idempotent — skips if already present)
 *   * Migrates legacy WON rows to QUALIFIED + stamps wonAt
 *   * Migrates NEGOTIATION / PROPOSAL_SENT to QUALIFIED
 *
 * Production migrations live in prisma/migrations/20260507120000_lead_status_simplified/
 * and run via `prisma migrate deploy`. This script targets the local
 * `prisma/dev.db` SQLite database used during development; it is safe to
 * re-run.
 */
import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const DB_PATH = path.join(process.cwd(), "prisma", "dev.db");
const db = new DatabaseSync(DB_PATH);

function columnExists(table, column) {
  const cols = db.prepare(`PRAGMA table_info('${table}')`).all();
  return cols.some((c) => c.name === column);
}

function indexExists(name) {
  const rows = db
    .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name=?")
    .all(name);
  return rows.length > 0;
}

console.log(`[backfill] target: ${DB_PATH}`);

if (!columnExists("Lead", "wonAt")) {
  db.exec(`ALTER TABLE "Lead" ADD COLUMN "wonAt" DATETIME`);
  console.log("[backfill] added Lead.wonAt");
} else {
  console.log("[backfill] Lead.wonAt already present, skipping ALTER");
}

const wonStamped = db
  .prepare(
    `UPDATE "Lead"
        SET "wonAt"  = COALESCE("convertedAt", CURRENT_TIMESTAMP),
            "status" = 'QUALIFIED'
      WHERE "status" = 'WON'`,
  )
  .run();
console.log(`[backfill] WON -> QUALIFIED + wonAt: ${wonStamped.changes}`);

const collapsed = db
  .prepare(
    `UPDATE "Lead"
        SET "status" = 'QUALIFIED'
      WHERE "status" IN ('NEGOTIATION','PROPOSAL_SENT')`,
  )
  .run();
console.log(`[backfill] NEGOTIATION/PROPOSAL_SENT -> QUALIFIED: ${collapsed.changes}`);

if (!indexExists("Lead_wonAt_idx")) {
  db.exec(`CREATE INDEX "Lead_wonAt_idx" ON "Lead"("wonAt")`);
  console.log("[backfill] created Lead_wonAt_idx");
} else {
  console.log("[backfill] Lead_wonAt_idx already present");
}

const finalStatuses = db
  .prepare(
    `SELECT status, COUNT(*) AS c FROM "Lead" GROUP BY status ORDER BY status`,
  )
  .all();
console.log("[backfill] final status distribution:");
for (const row of finalStatuses) {
  console.log(`    ${row.status.padEnd(10)} ${row.c}`);
}

db.close();
console.log("[backfill] done.");
