-- Cleanup: keep only aleksandre.iakobidze and temo users + their orgs
-- All other orgs cascade-delete their business data

-- Step 1: Identify keeper org IDs
CREATE TEMP TABLE _keep_orgs AS
SELECT DISTINCT "orgId" AS id FROM "User"
WHERE email LIKE '%aleksandre.iakobidze%' OR email LIKE '%temo%';

CREATE TEMP TABLE _keep_users AS
SELECT id FROM "User"
WHERE email LIKE '%aleksandre.iakobidze%' OR email LIKE '%temo%';

-- Step 2: Clean up user-referencing tables for non-keeper users
DELETE FROM "Session" WHERE "userId" NOT IN (SELECT id FROM _keep_users);
DELETE FROM "Account" WHERE "userId" NOT IN (SELECT id FROM _keep_users);
DELETE FROM "Invitation" WHERE "orgId" NOT IN (SELECT id FROM _keep_orgs);

-- Step 3: Nullify user FK refs in business tables before deleting users
UPDATE "Lead" SET "assignedToId" = NULL WHERE "assignedToId" IS NOT NULL AND "assignedToId" NOT IN (SELECT id FROM _keep_users);
UPDATE "LeadTask" SET "assignedToId" = NULL WHERE "assignedToId" IS NOT NULL AND "assignedToId" NOT IN (SELECT id FROM _keep_users);
UPDATE "LeadActivity" SET "userId" = NULL WHERE "userId" IS NOT NULL AND "userId" NOT IN (SELECT id FROM _keep_users);
UPDATE "Payment" SET "createdById" = NULL WHERE "createdById" IS NOT NULL AND "createdById" NOT IN (SELECT id FROM _keep_users);
UPDATE "Quotation" SET "ownerId" = NULL WHERE "ownerId" IS NOT NULL AND "ownerId" NOT IN (SELECT id FROM _keep_users);
UPDATE "QuotationRevision" SET "authorUserId" = NULL WHERE "authorUserId" IS NOT NULL AND "authorUserId" NOT IN (SELECT id FROM _keep_users);
UPDATE "QuotationMessage" SET "authorUserId" = NULL WHERE "authorUserId" IS NOT NULL AND "authorUserId" NOT IN (SELECT id FROM _keep_users);
UPDATE "AuditLog" SET "userId" = NULL WHERE "userId" IS NOT NULL AND "userId" NOT IN (SELECT id FROM _keep_users);
UPDATE "Driver" SET "userId" = NULL WHERE "userId" IS NOT NULL AND "userId" NOT IN (SELECT id FROM _keep_users);

-- Step 4: Delete non-keeper users
DELETE FROM "User"
WHERE id NOT IN (SELECT id FROM _keep_users);

-- Step 5: Delete non-keeper organizations (cascade cleans all business data)
DELETE FROM "Organization"
WHERE id NOT IN (SELECT id FROM _keep_orgs);

-- Step 6: Cleanup temp tables
DROP TABLE IF EXISTS _keep_users;
DROP TABLE IF EXISTS _keep_orgs;
