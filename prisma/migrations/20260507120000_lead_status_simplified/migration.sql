-- Lead status simplification:
--   * Reduce LeadStatus to NEW | CONTACTED | QUALIFIED | LOST
--   * Stop overloading lead.status as a "won" flag — promote Lead.wonAt as
--     the source of truth for won deals.
--
-- This migration:
--   1. Adds Lead.wonAt + supporting index
--   2. Backfills wonAt from old WON rows (using convertedAt, falling back to
--      now() so reports always have a non-null timestamp)
--   3. Collapses WON, NEGOTIATION and PROPOSAL_SENT into QUALIFIED (the new
--      "active in pipeline" terminal state before LOST)

ALTER TABLE "Lead" ADD COLUMN "wonAt" TIMESTAMP(3);

UPDATE "Lead"
SET    "wonAt"  = COALESCE("convertedAt", NOW()),
       "status" = 'QUALIFIED'
WHERE  "status" = 'WON';

UPDATE "Lead"
SET    "status" = 'QUALIFIED'
WHERE  "status" IN ('NEGOTIATION', 'PROPOSAL_SENT');

CREATE INDEX "Lead_wonAt_idx" ON "Lead"("wonAt");
