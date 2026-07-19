-- CreateEnum
CREATE TYPE "ProgressContractAiDraftRequestState" AS ENUM (
  'pending',
  'ready',
  'failed',
  'applied',
  'rejected'
);

-- CreateEnum
CREATE TYPE "ProgressContractAiDraftRevisionOrigin" AS ENUM ('ai', 'human');

-- AlterEnum
ALTER TYPE "ProgressConfirmationMode" ADD VALUE 'deterministic';

-- CreateTable
CREATE TABLE "ProgressContractAiDraftRequest" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "documentId" UUID NOT NULL,
  "documentVersionId" UUID NOT NULL,
  "requestedById" UUID NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "state" "ProgressContractAiDraftRequestState" NOT NULL DEFAULT 'pending',
  "sourceChecksum" TEXT NOT NULL,
  "routeKey" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "outputSchemaVersion" TEXT NOT NULL,
  "locale" TEXT NOT NULL,
  "timezone" TEXT NOT NULL,
  "effectiveAt" TIMESTAMPTZ(6) NOT NULL,
  "aiRunTraceId" UUID,
  "failureCode" TEXT,
  "appliedContractId" UUID,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "ProgressContractAiDraftRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressContractAiDraftRevision" (
  "id" UUID NOT NULL,
  "requestId" UUID NOT NULL,
  "revision" INTEGER NOT NULL,
  "content" JSONB NOT NULL,
  "origin" "ProgressContractAiDraftRevisionOrigin" NOT NULL,
  "editorId" UUID NOT NULL,
  "reason" TEXT NOT NULL,
  "sourceReferences" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProgressContractAiDraftRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProgressContractAiDraftRevision_positive_revision"
    CHECK ("revision" > 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "ProgressContractAiDraftRequest_requestedById_idempotencyKey_key"
ON "ProgressContractAiDraftRequest"("requestedById", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "ProgressContractAiDraftRequest_appliedContractId_key"
ON "ProgressContractAiDraftRequest"("appliedContractId");

-- CreateIndex
CREATE INDEX "ProgressContractAiDraftRequest_projectId_state_createdAt_idx"
ON "ProgressContractAiDraftRequest"("projectId", "state", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ProgressContractAiDraftRequest_documentVersionId_idx"
ON "ProgressContractAiDraftRequest"("documentVersionId");

-- CreateIndex
CREATE INDEX "ProgressContractAiDraftRequest_state_createdAt_idx"
ON "ProgressContractAiDraftRequest"("state", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ProgressContractAiDraftRequest_aiRunTraceId_idx"
ON "ProgressContractAiDraftRequest"("aiRunTraceId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgressContractAiDraftRevision_requestId_revision_key"
ON "ProgressContractAiDraftRevision"("requestId", "revision");

-- CreateIndex
CREATE INDEX "ProgressContractAiDraftRevision_requestId_createdAt_idx"
ON "ProgressContractAiDraftRevision"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "ProgressContractAiDraftRevision_editorId_createdAt_idx"
ON "ProgressContractAiDraftRevision"("editorId", "createdAt");

-- AddForeignKey
ALTER TABLE "ProgressContractAiDraftRequest"
ADD CONSTRAINT "ProgressContractAiDraftRequest_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressContractAiDraftRequest"
ADD CONSTRAINT "ProgressContractAiDraftRequest_documentId_fkey"
FOREIGN KEY ("documentId") REFERENCES "DocumentRecord"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressContractAiDraftRequest"
ADD CONSTRAINT "ProgressContractAiDraftRequest_documentVersionId_documentI_fkey"
FOREIGN KEY ("documentVersionId", "documentId")
REFERENCES "DocumentVersion"("id", "documentId")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressContractAiDraftRequest"
ADD CONSTRAINT "ProgressContractAiDraftRequest_requestedById_fkey"
FOREIGN KEY ("requestedById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressContractAiDraftRequest"
ADD CONSTRAINT "ProgressContractAiDraftRequest_aiRunTraceId_fkey"
FOREIGN KEY ("aiRunTraceId") REFERENCES "AiRun"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressContractAiDraftRequest"
ADD CONSTRAINT "ProgressContractAiDraftRequest_appliedContractId_fkey"
FOREIGN KEY ("appliedContractId") REFERENCES "ProgressContract"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressContractAiDraftRevision"
ADD CONSTRAINT "ProgressContractAiDraftRevision_requestId_fkey"
FOREIGN KEY ("requestId") REFERENCES "ProgressContractAiDraftRequest"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressContractAiDraftRevision"
ADD CONSTRAINT "ProgressContractAiDraftRevision_editorId_fkey"
FOREIGN KEY ("editorId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Guard request lineage and lifecycle.
CREATE FUNCTION "guard_progress_contract_ai_draft_request"() RETURNS trigger AS $$
BEGIN
  IF (
    NEW."id" <> OLD."id"
    OR NEW."projectId" <> OLD."projectId"
    OR NEW."documentId" <> OLD."documentId"
    OR NEW."documentVersionId" <> OLD."documentVersionId"
    OR NEW."requestedById" <> OLD."requestedById"
    OR NEW."idempotencyKey" <> OLD."idempotencyKey"
    OR NEW."payloadHash" <> OLD."payloadHash"
    OR NEW."sourceChecksum" <> OLD."sourceChecksum"
    OR NEW."routeKey" <> OLD."routeKey"
    OR NEW."promptVersion" <> OLD."promptVersion"
    OR NEW."outputSchemaVersion" <> OLD."outputSchemaVersion"
    OR NEW."locale" <> OLD."locale"
    OR NEW."timezone" <> OLD."timezone"
    OR NEW."effectiveAt" <> OLD."effectiveAt"
    OR NEW."createdAt" <> OLD."createdAt"
  ) THEN
    RAISE EXCEPTION 'Progress Contract AI draft request lineage is immutable'
      USING ERRCODE = '55000';
  END IF;

  IF NEW."state" <> OLD."state" AND NOT (
    (OLD."state" = 'pending' AND NEW."state" IN ('ready', 'failed'))
    OR (OLD."state" = 'failed' AND NEW."state" IN ('pending', 'rejected'))
    OR (OLD."state" = 'ready' AND NEW."state" IN ('applied', 'rejected'))
  ) THEN
    RAISE EXCEPTION 'Invalid Progress Contract AI draft request transition'
      USING ERRCODE = '55000';
  END IF;

  IF NEW."state" = 'failed' AND NEW."failureCode" IS NULL THEN
    RAISE EXCEPTION 'Failed Progress Contract AI draft request requires a safe failure code'
      USING ERRCODE = '23514';
  END IF;
  IF NEW."state" <> 'failed' AND NEW."failureCode" IS NOT NULL THEN
    RAISE EXCEPTION 'Only failed Progress Contract AI draft requests retain a failure code'
      USING ERRCODE = '23514';
  END IF;
  IF NEW."state" = 'applied' AND NEW."appliedContractId" IS NULL THEN
    RAISE EXCEPTION 'Applied Progress Contract AI draft request requires a contract'
      USING ERRCODE = '23514';
  END IF;
  IF NEW."state" <> 'applied' AND NEW."appliedContractId" IS NOT NULL THEN
    RAISE EXCEPTION 'Only applied Progress Contract AI draft requests link a contract'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Serialize and enforce gap-free append-only revisions per request.
CREATE FUNCTION "guard_progress_contract_ai_draft_revision_insert"() RETURNS trigger AS $$
DECLARE
  next_revision INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW."requestId"::text, 0));
  SELECT COALESCE(MAX("revision"), 0) + 1
  INTO next_revision
  FROM "ProgressContractAiDraftRevision"
  WHERE "requestId" = NEW."requestId";
  IF NEW."revision" <> next_revision THEN
    RAISE EXCEPTION 'Progress Contract AI draft revision must be the next revision'
      USING ERRCODE = '40001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ProgressContractAiDraftRequest_prevent_delete"
BEFORE DELETE ON "ProgressContractAiDraftRequest"
FOR EACH ROW EXECUTE FUNCTION "prevent_phase2_history_mutation"();

CREATE TRIGGER "ProgressContractAiDraftRequest_guard_update"
BEFORE UPDATE ON "ProgressContractAiDraftRequest"
FOR EACH ROW EXECUTE FUNCTION "guard_progress_contract_ai_draft_request"();

CREATE TRIGGER "ProgressContractAiDraftRevision_next_revision"
BEFORE INSERT ON "ProgressContractAiDraftRevision"
FOR EACH ROW EXECUTE FUNCTION "guard_progress_contract_ai_draft_revision_insert"();

CREATE TRIGGER "ProgressContractAiDraftRevision_append_only"
BEFORE UPDATE OR DELETE ON "ProgressContractAiDraftRevision"
FOR EACH ROW EXECUTE FUNCTION "prevent_phase2_history_mutation"();
