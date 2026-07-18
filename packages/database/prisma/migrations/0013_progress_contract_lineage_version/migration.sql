-- Separate immutable Progress Contract lineage from optimistic state transitions.
ALTER TABLE "ProgressContract"
ADD COLUMN "contractVersion" INTEGER;

ALTER TABLE "ProgressContract"
DISABLE TRIGGER "ProgressContract_guard_update";

WITH RECURSIVE contract_lineage AS (
  SELECT
    contract."id",
    1 AS "contractVersion"
  FROM "ProgressContract" AS contract
  WHERE contract."previousContractId" IS NULL

  UNION ALL

  SELECT
    successor."id",
    predecessor."contractVersion" + 1
  FROM "ProgressContract" AS successor
  INNER JOIN contract_lineage AS predecessor
    ON successor."previousContractId" = predecessor."id"
)
UPDATE "ProgressContract" AS contract
SET "contractVersion" = lineage."contractVersion"
FROM contract_lineage AS lineage
WHERE contract."id" = lineage."id";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "ProgressContract"
    WHERE "contractVersion" IS NULL
  ) THEN
    RAISE EXCEPTION 'Progress Contract lineage contains an unreachable row'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

ALTER TABLE "ProgressContract"
ALTER COLUMN "contractVersion" SET NOT NULL;

ALTER TABLE "ProgressContract"
ADD CONSTRAINT "ProgressContract_contract_version_positive"
CHECK ("contractVersion" > 0);

DROP INDEX "ProgressContract_project_version_unique";
DROP INDEX "ProgressContract_workstream_version_unique";

CREATE UNIQUE INDEX "ProgressContract_project_version_unique"
ON "ProgressContract" ("projectId", "contractVersion")
WHERE "scopeKind" = 'project';

CREATE UNIQUE INDEX "ProgressContract_workstream_version_unique"
ON "ProgressContract" ("workstreamId", "contractVersion")
WHERE "scopeKind" = 'workstream';

CREATE OR REPLACE FUNCTION "guard_progress_contract_update"() RETURNS trigger AS $$
BEGIN
  IF (
    NEW."id" <> OLD."id"
    OR NEW."scopeKind" <> OLD."scopeKind"
    OR NEW."projectId" <> OLD."projectId"
    OR NEW."workstreamId" IS DISTINCT FROM OLD."workstreamId"
    OR NEW."sourceDocumentId" <> OLD."sourceDocumentId"
    OR NEW."sourceDocumentVersionId" <> OLD."sourceDocumentVersionId"
    OR NEW."sourceDocumentVersionNo" <> OLD."sourceDocumentVersionNo"
    OR NEW."calculationKind" <> OLD."calculationKind"
    OR NEW."calculationSchemaVersion" <> OLD."calculationSchemaVersion"
    OR NEW."contractVersion" <> OLD."contractVersion"
    OR NEW."ownerId" <> OLD."ownerId"
    OR NEW."effectiveAt" <> OLD."effectiveAt"
    OR NEW."previousContractId" IS DISTINCT FROM OLD."previousContractId"
    OR NEW."createdById" <> OLD."createdById"
    OR NEW."createdAt" <> OLD."createdAt"
  ) THEN
    RAISE EXCEPTION 'Progress Contract core fields are immutable' USING ERRCODE = '55000';
  END IF;
  IF NEW."version" <> OLD."version" + 1 THEN
    RAISE EXCEPTION 'Progress Contract transition must increment version once'
      USING ERRCODE = '40001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE "ProgressContract"
ENABLE TRIGGER "ProgressContract_guard_update";

-- No shared Phase 2 data exists. Align locally seeded snapshots with the new
-- immutable contract lineage before the branch is published.
ALTER TABLE "ProgressSnapshot"
DISABLE TRIGGER "ProgressSnapshot_append_only";

UPDATE "ProgressSnapshot" AS snapshot
SET "contractVersion" = contract."contractVersion"
FROM "ProgressContract" AS contract
WHERE snapshot."contractId" = contract."id";

ALTER TABLE "ProgressSnapshot"
ENABLE TRIGGER "ProgressSnapshot_append_only";
