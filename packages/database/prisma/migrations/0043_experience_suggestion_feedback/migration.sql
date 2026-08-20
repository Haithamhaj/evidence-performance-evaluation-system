CREATE TABLE "ExperienceSuggestionFeedback" (
  "id" UUID NOT NULL,
  "preparedItemId" UUID NOT NULL,
  "employeeId" UUID NOT NULL,
  "idempotencyKey" UUID NOT NULL,
  "category" TEXT NOT NULL,
  "surface" TEXT NOT NULL,
  "outputReference" TEXT NOT NULL,
  "correlationId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExperienceSuggestionFeedback_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExperienceSuggestionFeedback_category_check" CHECK (
    "category" IN (
      'HELPFUL',
      'WRONG_PROJECT',
      'WRONG_SOURCE_RELATION',
      'UNNECESSARY',
      'MISSING_CONTEXT',
      'BAD_DRAFT',
      'WRONG_TIMING',
      'TECHNICAL_ERROR'
    )
  ),
  CONSTRAINT "ExperienceSuggestionFeedback_surface_check" CHECK ("surface" = 'work_prepared_item'),
  CONSTRAINT "ExperienceSuggestionFeedback_preparedItemId_fkey" FOREIGN KEY ("preparedItemId") REFERENCES "ExperiencePreparedItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ExperienceSuggestionFeedback_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ExperienceSuggestionFeedback_idempotencyKey_key"
ON "ExperienceSuggestionFeedback"("idempotencyKey");

CREATE INDEX "ExperienceSuggestionFeedback_preparedItemId_createdAt_id_idx"
ON "ExperienceSuggestionFeedback"("preparedItemId", "createdAt", "id");

CREATE INDEX "ExperienceSuggestionFeedback_employeeId_createdAt_id_idx"
ON "ExperienceSuggestionFeedback"("employeeId", "createdAt", "id");

CREATE INDEX "ExperienceSuggestionFeedback_correlationId_idx"
ON "ExperienceSuggestionFeedback"("correlationId");

CREATE FUNCTION reject_experience_suggestion_feedback_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Experience suggestion feedback is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ExperienceSuggestionFeedback_append_only"
BEFORE UPDATE OR DELETE ON "ExperienceSuggestionFeedback"
FOR EACH ROW EXECUTE FUNCTION reject_experience_suggestion_feedback_mutation();
