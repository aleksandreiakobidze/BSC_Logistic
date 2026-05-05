-- Performance indexes that the auto-generated `init_postgres` migration does
-- not produce. Applied after the initial migration thanks to the artificially
-- late timestamp on the parent folder, which keeps it last in lexicographic
-- order regardless of when init_postgres is generated.
--
-- Safe to re-run: every statement uses IF NOT EXISTS / CREATE EXTENSION IF NOT EXISTS.

-- Trigram extension for fast Customer.name ILIKE / similarity search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Time-series-friendly indexes -----------------------------------------------
CREATE INDEX IF NOT EXISTS "AuditLog_orgId_createdAt_idx"
  ON "AuditLog" ("orgId", "createdAt");

CREATE INDEX IF NOT EXISTS "ShipmentEvent_shipmentId_at_idx"
  ON "ShipmentEvent" ("shipmentId", "at");

CREATE INDEX IF NOT EXISTS "Payment_orgId_paidAt_idx2"
  ON "Payment" ("orgId", "paidAt");

CREATE INDEX IF NOT EXISTS "Quotation_orgId_status_validUntil_idx"
  ON "Quotation" ("orgId", "status", "validUntil");

-- Customer name fuzzy search -------------------------------------------------
CREATE INDEX IF NOT EXISTS "Customer_name_trgm_idx"
  ON "Customer" USING gin ("name" gin_trgm_ops);

-- Open invoices (AR aging) -- partial index keeps it small
CREATE INDEX IF NOT EXISTS "Invoice_open_orgId_dueDate_idx"
  ON "Invoice" ("orgId", "dueDate")
  WHERE status IN ('SENT', 'PARTIAL', 'OVERDUE');
