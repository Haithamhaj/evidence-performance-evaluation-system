CREATE TYPE "SourceProjectLinkOrigin" AS ENUM (
    'EMPLOYEE_MANUAL',
    'CONTEXT_SUGGESTION'
);

ALTER TABLE "SourceProjectLink"
ADD COLUMN "origin" "SourceProjectLinkOrigin" NOT NULL DEFAULT 'EMPLOYEE_MANUAL',
ADD COLUMN "contextSuggestionId" UUID;

ALTER TABLE "SourceProjectLink"
ADD CONSTRAINT "SourceProjectLink_context_provenance"
CHECK (
    ("origin" = 'EMPLOYEE_MANUAL' AND "contextSuggestionId" IS NULL)
    OR
    ("origin" = 'CONTEXT_SUGGESTION' AND "contextSuggestionId" IS NOT NULL)
),
ADD CONSTRAINT "SourceProjectLink_contextSuggestion_owner_fkey"
FOREIGN KEY ("contextSuggestionId", "sourceItemId", "employeeId")
REFERENCES "ProjectLinkSuggestion"("id", "sourceItemId", "employeeId")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "SourceProjectLink_contextSuggestionId_idx"
ON "SourceProjectLink"("contextSuggestionId");

CREATE OR REPLACE FUNCTION "guard_source_project_link_update"() RETURNS trigger AS $$
BEGIN
  IF ROW(
      NEW."id",
      NEW."sourceItemId",
      NEW."employeeId",
      NEW."projectId",
      NEW."origin",
      NEW."contextSuggestionId",
      NEW."linkedById",
      NEW."linkedAt"
    ) IS DISTINCT FROM ROW(
      OLD."id",
      OLD."sourceItemId",
      OLD."employeeId",
      OLD."projectId",
      OLD."origin",
      OLD."contextSuggestionId",
      OLD."linkedById",
      OLD."linkedAt"
    )
  THEN
    RAISE EXCEPTION 'SourceProjectLink history is immutable'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
