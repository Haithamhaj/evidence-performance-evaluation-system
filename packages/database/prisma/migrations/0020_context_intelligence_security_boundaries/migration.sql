CREATE TYPE "SourceProjectLinkOrigin" AS ENUM (
    'EMPLOYEE_MANUAL',
    'CONTEXT_SUGGESTION'
);

ALTER TABLE "SourceProjectLink"
ADD COLUMN "origin" "SourceProjectLinkOrigin" NOT NULL DEFAULT 'EMPLOYEE_MANUAL',
ADD COLUMN "contextSuggestionId" UUID;

CREATE UNIQUE INDEX "ProjectLinkSuggestion_id_sourceItemId_employeeId_projectId_key"
ON "ProjectLinkSuggestion"("id", "sourceItemId", "employeeId", "projectId");

ALTER TABLE "SourceProjectLink"
ADD CONSTRAINT "SourceProjectLink_context_provenance"
CHECK (
    ("origin" = 'EMPLOYEE_MANUAL' AND "contextSuggestionId" IS NULL)
    OR
    ("origin" = 'CONTEXT_SUGGESTION' AND "contextSuggestionId" IS NOT NULL)
),
ADD CONSTRAINT "SourceProjectLink_contextSuggestion_owner_fkey"
FOREIGN KEY ("contextSuggestionId", "sourceItemId", "employeeId", "projectId")
REFERENCES "ProjectLinkSuggestion"("id", "sourceItemId", "employeeId", "projectId")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "SourceProjectLink_contextSuggestionId_idx"
ON "SourceProjectLink"("contextSuggestionId");

CREATE FUNCTION "validate_source_project_link_context_suggestion"() RETURNS trigger AS $$
DECLARE
  valid_suggestion_id UUID;
BEGIN
  IF NEW."origin" = 'CONTEXT_SUGGESTION' THEN
    SELECT suggestion.id
    INTO valid_suggestion_id
    FROM "ProjectLinkSuggestion" suggestion
    WHERE suggestion.id = NEW."contextSuggestionId"
      AND suggestion."sourceItemId" = NEW."sourceItemId"
      AND suggestion."employeeId" = NEW."employeeId"
      AND suggestion."projectId" = NEW."projectId"
      AND suggestion."reviewStatus" IN ('CONFIRMED', 'CORRECTED')
      AND suggestion."revisionOrigin" = 'EMPLOYEE'
      AND NOT EXISTS (
        SELECT 1
        FROM "ProjectLinkSuggestion" superseding
        WHERE superseding."supersedesSuggestionId" = suggestion.id
      )
    FOR SHARE OF suggestion;

    IF valid_suggestion_id IS NULL THEN
      RAISE EXCEPTION 'SourceProjectLink requires a current confirmed or corrected suggestion'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SourceProjectLink_validate_context_suggestion"
BEFORE INSERT ON "SourceProjectLink"
FOR EACH ROW EXECUTE FUNCTION "validate_source_project_link_context_suggestion"();

CREATE OR REPLACE FUNCTION "guard_source_project_link_update"() RETURNS trigger AS $$
BEGIN
  IF OLD."unlinkedAt" IS NOT NULL
    OR NEW."unlinkedAt" IS NULL
    OR ROW(
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
