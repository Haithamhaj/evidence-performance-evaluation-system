CREATE TABLE "ExperiencePreparedItem" (
  "id" UUID NOT NULL,
  "employeeId" UUID NOT NULL,
  "idempotencyKey" UUID NOT NULL,
  "schemaVersion" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "sourceReferences" JSONB NOT NULL,
  "why" TEXT NOT NULL,
  "freshness" JSONB NOT NULL,
  "consequence" TEXT NOT NULL,
  "editableDraft" JSONB NOT NULL,
  "assistanceMode" TEXT NOT NULL,
  "assistanceLabel" TEXT NOT NULL,
  "outputReference" TEXT NOT NULL,
  "correlationId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExperiencePreparedItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExperiencePreparedItem_contract_check" CHECK (
    "schemaVersion" = 'experience-prepared-output.v1'
    AND "state" IN ('prepared', 'needs-clarification', 'stale')
    AND "kind" IN ('next_action', 'clarification_question')
    AND "assistanceMode" IN ('deterministic', 'ai_assisted')
    AND jsonb_typeof("sourceReferences") = 'array'
    AND jsonb_array_length("sourceReferences") BETWEEN 1 AND 20
    AND jsonb_typeof("freshness") = 'object'
    AND jsonb_typeof("editableDraft") = 'object'
    AND length(btrim("why")) BETWEEN 1 AND 1000
    AND length(btrim("consequence")) BETWEEN 1 AND 1000
    AND length(btrim("assistanceLabel")) BETWEEN 1 AND 240
    AND "outputReference" ~ '^experience-prepared:[0-9a-f-]{36}$'
  )
);

CREATE UNIQUE INDEX "ExperiencePreparedItem_idempotencyKey_key"
  ON "ExperiencePreparedItem"("idempotencyKey");
CREATE UNIQUE INDEX "ExperiencePreparedItem_outputReference_key"
  ON "ExperiencePreparedItem"("outputReference");
CREATE INDEX "ExperiencePreparedItem_employeeId_createdAt_id_idx"
  ON "ExperiencePreparedItem"("employeeId", "createdAt", "id");
CREATE INDEX "ExperiencePreparedItem_correlationId_idx"
  ON "ExperiencePreparedItem"("correlationId");

ALTER TABLE "ExperiencePreparedItem"
  ADD CONSTRAINT "ExperiencePreparedItem_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
