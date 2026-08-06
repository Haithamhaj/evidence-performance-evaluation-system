CREATE TYPE "ExperimentAiDraftKind" AS ENUM ('METHOD_REVIEW', 'RUN_INTERPRETATION');

CREATE TABLE "ExperimentAiDraft" (
  "id" UUID NOT NULL,
  "experimentId" UUID NOT NULL,
  "methodRevisionId" UUID NOT NULL,
  "runId" UUID,
  "kind" "ExperimentAiDraftKind" NOT NULL,
  "body" JSONB NOT NULL,
  "sourceReferences" JSONB NOT NULL,
  "outputReference" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "routeTrace" JSONB NOT NULL,
  "aiRunId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ExperimentAiDraft_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExperimentAiDraft_kind_lineage" CHECK (
    ("kind" = 'METHOD_REVIEW' AND "runId" IS NULL)
    OR ("kind" = 'RUN_INTERPRETATION' AND "runId" IS NOT NULL)
  ),
  CONSTRAINT "ExperimentAiDraft_body_object" CHECK (jsonb_typeof("body") = 'object'),
  CONSTRAINT "ExperimentAiDraft_sources_array" CHECK (jsonb_typeof("sourceReferences") = 'array'),
  CONSTRAINT "ExperimentAiDraft_route_trace_object" CHECK (jsonb_typeof("routeTrace") = 'object')
);

CREATE UNIQUE INDEX "ExperimentAiDraft_outputReference_key"
  ON "ExperimentAiDraft"("outputReference");
CREATE INDEX "ExperimentAiDraft_experimentId_createdAt_id_idx"
  ON "ExperimentAiDraft"("experimentId", "createdAt", "id");
CREATE INDEX "ExperimentAiDraft_methodRevisionId_createdAt_idx"
  ON "ExperimentAiDraft"("methodRevisionId", "createdAt");
CREATE INDEX "ExperimentAiDraft_runId_createdAt_idx"
  ON "ExperimentAiDraft"("runId", "createdAt");
CREATE INDEX "ExperimentAiDraft_aiRunId_idx" ON "ExperimentAiDraft"("aiRunId");

ALTER TABLE "ExperimentAiDraft"
  ADD CONSTRAINT "ExperimentAiDraft_experimentId_fkey"
  FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ExperimentAiDraft_methodRevisionId_fkey"
  FOREIGN KEY ("methodRevisionId") REFERENCES "ExperimentMethodRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ExperimentAiDraft_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "ExperimentRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "validate_experiment_ai_draft_lineage"() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "ExperimentMethodRevision" method
    WHERE method."id" = NEW."methodRevisionId"
      AND method."experimentId" = NEW."experimentId"
  ) THEN
    RAISE EXCEPTION 'Experiment AI draft method lineage foreign key constraint violated'
      USING ERRCODE = '23503';
  END IF;

  IF NEW."runId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "ExperimentRun" run
    WHERE run."id" = NEW."runId"
      AND run."experimentId" = NEW."experimentId"
      AND run."methodRevisionId" = NEW."methodRevisionId"
  ) THEN
    RAISE EXCEPTION 'Experiment AI draft run lineage foreign key constraint violated'
      USING ERRCODE = '23503';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ExperimentAiDraft_validate_lineage"
BEFORE INSERT ON "ExperimentAiDraft"
FOR EACH ROW EXECUTE FUNCTION "validate_experiment_ai_draft_lineage"();

CREATE TRIGGER "ExperimentAiDraft_append_only"
BEFORE UPDATE OR DELETE ON "ExperimentAiDraft"
FOR EACH ROW EXECUTE FUNCTION "prevent_phase2_history_mutation"();
