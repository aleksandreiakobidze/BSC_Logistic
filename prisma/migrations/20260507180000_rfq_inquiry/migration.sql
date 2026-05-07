-- RFQ Inquiry tab + supplier tendering.
--
-- This migration:
--   1. Adds new RFQ header fields to Quotation (mode, incoterms, origin/destination,
--      cargo info, sales manager, requested teams, won/lost timestamps...).
--   2. Creates the Supplier table (separate from Contact) so logistics
--      providers (carriers, brokers, 3PLs) can be reused across quotations.
--   3. Creates the SupplierOffer table — bids from suppliers attached to a
--      Quotation. Exactly one offer per (quotationId, team) can be selected.
--   4. Creates the QuotationActivity table — free-form timeline mirroring
--      LeadActivity for the inquiry tab's Activity sub-tab.
--
-- Backwards compatibility:
--   * The Quotation.status default flips from 'DRAFT' to 'PRICING' for new
--     records, but existing rows keep their current status — no UPDATE.
--   * All new columns are NULLable / have defaults so existing rows stay valid.

-- ─── 1. Quotation: new RFQ columns + sales-manager FK ────────────────────────
ALTER TABLE "Quotation" ADD COLUMN     "salesManagerId"      TEXT;
ALTER TABLE "Quotation" ADD COLUMN     "requestedTeams"      TEXT;
ALTER TABLE "Quotation" ADD COLUMN     "priority"            TEXT NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "Quotation" ADD COLUMN     "mode"                TEXT;
ALTER TABLE "Quotation" ADD COLUMN     "incoterms"           TEXT;
ALTER TABLE "Quotation" ADD COLUMN     "originPort"          TEXT;
ALTER TABLE "Quotation" ADD COLUMN     "originAddress"       TEXT;
ALTER TABLE "Quotation" ADD COLUMN     "destinationPort"     TEXT;
ALTER TABLE "Quotation" ADD COLUMN     "destinationAddress"  TEXT;
ALTER TABLE "Quotation" ADD COLUMN     "cargoDescription"    TEXT;
ALTER TABLE "Quotation" ADD COLUMN     "shipmentDetails"     TEXT;
ALTER TABLE "Quotation" ADD COLUMN     "cargoValue"          DECIMAL(14,2);
ALTER TABLE "Quotation" ADD COLUMN     "cargoValueCurrency"  TEXT;
ALTER TABLE "Quotation" ADD COLUMN     "cargoReadyDate"      TIMESTAMP(3);
ALTER TABLE "Quotation" ADD COLUMN     "specialRequirements" TEXT;
ALTER TABLE "Quotation" ADD COLUMN     "wonAt"               TIMESTAMP(3);
ALTER TABLE "Quotation" ADD COLUMN     "lostAt"              TIMESTAMP(3);
ALTER TABLE "Quotation" ADD COLUMN     "lostReason"          TEXT;

-- New default for fresh records; existing rows untouched.
ALTER TABLE "Quotation" ALTER COLUMN "status" SET DEFAULT 'PRICING';

ALTER TABLE "Quotation"
  ADD CONSTRAINT "Quotation_salesManagerId_fkey"
  FOREIGN KEY ("salesManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Quotation_salesManagerId_idx" ON "Quotation"("salesManagerId");

-- ─── 2. Supplier ─────────────────────────────────────────────────────────────
CREATE TABLE "Supplier" (
    "id"                     TEXT NOT NULL,
    "orgId"                  TEXT NOT NULL,
    "code"                   TEXT,
    "name"                   TEXT NOT NULL,
    "type"                   TEXT NOT NULL DEFAULT 'OTHER',
    "status"                 TEXT NOT NULL DEFAULT 'ACTIVE',
    "email"                  TEXT,
    "phone"                  TEXT,
    "website"                TEXT,
    "taxId"                  TEXT,
    "address"                TEXT,
    "city"                   TEXT,
    "country"                TEXT,
    "currency"               TEXT NOT NULL DEFAULT 'USD',
    "paymentTerms"           TEXT,
    "defaultTransitTimeDays" INTEGER,
    "notes"                  TEXT,
    "ownerId"                TEXT,
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"              TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Supplier_orgId_code_key" ON "Supplier"("orgId", "code");
CREATE INDEX "Supplier_orgId_status_idx" ON "Supplier"("orgId", "status");
CREATE INDEX "Supplier_orgId_type_idx"   ON "Supplier"("orgId", "type");

ALTER TABLE "Supplier"
  ADD CONSTRAINT "Supplier_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Supplier"
  ADD CONSTRAINT "Supplier_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── 3. SupplierOffer ────────────────────────────────────────────────────────
CREATE TABLE "SupplierOffer" (
    "id"              TEXT NOT NULL,
    "quotationId"     TEXT NOT NULL,
    "supplierId"      TEXT NOT NULL,
    "team"            TEXT NOT NULL,
    "managerUserId"   TEXT,
    "status"          TEXT NOT NULL DEFAULT 'DRAFT',
    "totalCost"       DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency"        TEXT NOT NULL DEFAULT 'USD',
    "transitTimeDays" INTEGER,
    "incoterms"       TEXT,
    "validUntil"      TIMESTAMP(3),
    "terms"           TEXT,
    "notes"           TEXT,
    "isSelected"      BOOLEAN NOT NULL DEFAULT false,
    "requestedAt"     TIMESTAMP(3),
    "receivedAt"      TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierOffer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupplierOffer_quotationId_idx" ON "SupplierOffer"("quotationId");
CREATE INDEX "SupplierOffer_supplierId_idx"  ON "SupplierOffer"("supplierId");
CREATE INDEX "SupplierOffer_quotationId_team_isSelected_idx"
  ON "SupplierOffer"("quotationId", "team", "isSelected");

ALTER TABLE "SupplierOffer"
  ADD CONSTRAINT "SupplierOffer_quotationId_fkey"
  FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierOffer"
  ADD CONSTRAINT "SupplierOffer_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupplierOffer"
  ADD CONSTRAINT "SupplierOffer_managerUserId_fkey"
  FOREIGN KEY ("managerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── 4. QuotationActivity ────────────────────────────────────────────────────
CREATE TABLE "QuotationActivity" (
    "id"          TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "userId"      TEXT,
    "kind"        TEXT NOT NULL,
    "note"        TEXT,
    "meta"        TEXT,
    "at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuotationActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QuotationActivity_quotationId_at_idx"
  ON "QuotationActivity"("quotationId", "at");

ALTER TABLE "QuotationActivity"
  ADD CONSTRAINT "QuotationActivity_quotationId_fkey"
  FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
