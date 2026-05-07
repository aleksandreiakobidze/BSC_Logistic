-- AlterTable: Contact - add new columns
ALTER TABLE "Contact" ADD COLUMN "code" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Contact" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Contact" ADD COLUMN "relationshipType" TEXT NOT NULL DEFAULT 'OTHER';
ALTER TABLE "Contact" ADD COLUMN "taxId" TEXT;
ALTER TABLE "Contact" ADD COLUMN "industry" TEXT;

-- Rename position -> jobTitle
ALTER TABLE "Contact" RENAME COLUMN "position" TO "jobTitle";

-- Backfill unique codes for existing contacts
DO $$
DECLARE
  rec RECORD;
  counter INT := 0;
BEGIN
  FOR rec IN SELECT id FROM "Contact" ORDER BY "createdAt" ASC
  LOOP
    counter := counter + 1;
    UPDATE "Contact" SET "code" = 'CNT-' || LPAD(counter::TEXT, 6, '0') WHERE id = rec.id;
  END LOOP;
END $$;

-- Add unique constraint on (orgId, code)
CREATE UNIQUE INDEX "Contact_orgId_code_key" ON "Contact"("orgId", "code");

-- CreateTable: ContactLookupValue
CREATE TABLE "ContactLookupValue" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactLookupValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContactLookupValue_orgId_kind_value_key" ON "ContactLookupValue"("orgId", "kind", "value");
CREATE INDEX "ContactLookupValue_orgId_kind_idx" ON "ContactLookupValue"("orgId", "kind");

-- AddForeignKey
ALTER TABLE "ContactLookupValue" ADD CONSTRAINT "ContactLookupValue_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default lookup values for all existing organizations
INSERT INTO "ContactLookupValue" ("id", "orgId", "kind", "value", "sortOrder", "createdAt")
SELECT
  gen_random_uuid()::TEXT,
  o.id,
  v.kind,
  v.value,
  v.sort_order,
  NOW()
FROM "Organization" o
CROSS JOIN (VALUES
  ('INDUSTRY', 'Logistics', 0),
  ('INDUSTRY', 'Manufacturing', 1),
  ('INDUSTRY', 'Retail', 2),
  ('INDUSTRY', 'E-commerce', 3),
  ('INDUSTRY', 'Construction', 4),
  ('INDUSTRY', 'Automotive', 5),
  ('INDUSTRY', 'Pharmaceuticals', 6),
  ('INDUSTRY', 'FMCG', 7),
  ('INDUSTRY', 'Energy', 8),
  ('INDUSTRY', 'Other', 9),
  ('JOB_TITLE', 'Operations Manager', 0),
  ('JOB_TITLE', 'Sales Manager', 1),
  ('JOB_TITLE', 'Logistics Coordinator', 2),
  ('JOB_TITLE', 'CFO', 3),
  ('JOB_TITLE', 'CEO', 4),
  ('JOB_TITLE', 'Customer Service', 5)
) AS v(kind, value, sort_order)
ON CONFLICT DO NOTHING;