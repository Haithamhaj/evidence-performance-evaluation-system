-- CreateEnum
CREATE TYPE "UpdateInputKind" AS ENUM ('text', 'voice');

-- CreateEnum
CREATE TYPE "UpdateSessionState" AS ENUM ('clarifying', 'ready_for_review', 'confirmed', 'cancelled');

-- CreateEnum
CREATE TYPE "Phase2ExecutionMode" AS ENUM ('manual', 'ai_assisted', 'agent_generated', 'mixed');

-- CreateEnum
CREATE TYPE "UpdateDraftRevisionKind" AS ENUM ('ai_draft', 'employee_edit');

-- CreateEnum
CREATE TYPE "ManualEvidenceSourceKind" AS ENUM ('image', 'screenshot', 'file', 'document', 'pasted_code', 'pasted_text', 'cli_snapshot', 'url');

-- CreateEnum
CREATE TYPE "EvidenceRecordState" AS ENUM ('draft', 'confirmed', 'rejected');

-- CreateEnum
CREATE TYPE "EvidenceRevisionKind" AS ENUM ('ai_draft', 'employee_edit', 'manual_draft');

-- CreateEnum
CREATE TYPE "EvidenceVerificationOutcome" AS ENUM ('unverified', 'pending', 'supported', 'partial', 'conflicting', 'rejected');

-- CreateEnum
CREATE TYPE "EvidenceAttributionState" AS ENUM ('proposed', 'acknowledged', 'disputed');

-- CreateEnum
CREATE TYPE "ProgressRecalculationState" AS ENUM ('pending', 'completed', 'failed');

-- CreateTable
CREATE TABLE "UpdateSource" (
    "id" UUID NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "workstreamId" UUID,
    "workItemId" UUID,
    "employeeId" UUID NOT NULL,
    "inputKind" "UpdateInputKind" NOT NULL,
    "rawText" TEXT NOT NULL,
    "executionMode" "Phase2ExecutionMode" NOT NULL,
    "sourceVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UpdateSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClarificationSession" (
    "id" UUID NOT NULL,
    "updateSourceId" UUID NOT NULL,
    "state" "UpdateSessionState" NOT NULL DEFAULT 'clarifying',
    "version" INTEGER NOT NULL DEFAULT 1,
    "unresolvedFields" JSONB NOT NULL,
    "currentTurnNo" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ClarificationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClarificationTurn" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "turnNo" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "affects" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClarificationTurn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClarificationAnswer" (
    "id" UUID NOT NULL,
    "turnId" UUID NOT NULL,
    "answer" TEXT NOT NULL,
    "employeeId" UUID NOT NULL,
    "resultingSessionVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClarificationAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StructuredUpdateDraftRevision" (
    "id" UUID NOT NULL,
    "updateSourceId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "blocker" TEXT,
    "nextAction" TEXT NOT NULL,
    "contributionContext" TEXT NOT NULL,
    "executionMode" "Phase2ExecutionMode" NOT NULL,
    "revisionKind" "UpdateDraftRevisionKind" NOT NULL,
    "sourceReferences" JSONB NOT NULL,
    "evidenceClaimDrafts" JSONB NOT NULL,
    "comparison" JSONB NOT NULL,
    "aiRunId" UUID,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StructuredUpdateDraftRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UpdateConfirmation" (
    "id" UUID NOT NULL,
    "updateSourceId" UUID NOT NULL,
    "draftRevisionId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "confirmedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UpdateConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcceptedUpdateEvent" (
    "id" UUID NOT NULL,
    "confirmationId" UUID NOT NULL,
    "updateSourceId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "workstreamId" UUID,
    "workItemId" UUID,
    "employeeId" UUID NOT NULL,
    "sourceReferences" JSONB NOT NULL,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcceptedUpdateEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressRecalculationRequest" (
    "id" UUID NOT NULL,
    "acceptedEventId" UUID NOT NULL,
    "contractId" UUID,
    "state" "ProgressRecalculationState" NOT NULL DEFAULT 'pending',
    "version" INTEGER NOT NULL DEFAULT 1,
    "operationId" UUID NOT NULL,
    "correlationId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(6),

    CONSTRAINT "ProgressRecalculationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceRecord" (
    "id" UUID NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "workstreamId" UUID,
    "workItemId" UUID,
    "capturedFromWorkItem" BOOLEAN NOT NULL DEFAULT false,
    "updateSourceId" UUID,
    "employeeId" UUID NOT NULL,
    "state" "EvidenceRecordState" NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "currentRevision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "EvidenceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceRevision" (
    "id" UUID NOT NULL,
    "evidenceId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "revisionKind" "EvidenceRevisionKind" NOT NULL,
    "sourceKind" "ManualEvidenceSourceKind" NOT NULL,
    "objectKey" TEXT,
    "sourceText" TEXT,
    "sourceUrl" TEXT,
    "mediaType" TEXT,
    "checksumSha256" TEXT,
    "sizeBytes" INTEGER,
    "supportedClaim" TEXT NOT NULL,
    "contributionContext" TEXT NOT NULL,
    "executionMode" "Phase2ExecutionMode" NOT NULL,
    "aiRunId" UUID,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceLink" (
    "id" UUID NOT NULL,
    "evidenceRevisionId" UUID NOT NULL,
    "workItemId" UUID,
    "progressComponentId" UUID,
    "dynamicCriterionId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceAttribution" (
    "id" UUID NOT NULL,
    "evidenceRevisionId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "contributionContext" TEXT NOT NULL,
    "state" "EvidenceAttributionState" NOT NULL,
    "proposedById" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceVerification" (
    "id" UUID NOT NULL,
    "evidenceRevisionId" UUID NOT NULL,
    "outcome" "EvidenceVerificationOutcome" NOT NULL,
    "sourceReferences" JSONB NOT NULL,
    "actorId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceConfirmation" (
    "id" UUID NOT NULL,
    "evidenceId" UUID NOT NULL,
    "evidenceRevisionId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "confirmedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcceptedEvidenceEvent" (
    "id" UUID NOT NULL,
    "confirmationId" UUID NOT NULL,
    "evidenceId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "workstreamId" UUID,
    "sourceReferences" JSONB NOT NULL,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcceptedEvidenceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UpdateSource_idempotencyKey_key" ON "UpdateSource"("idempotencyKey");

-- CreateIndex
CREATE INDEX "UpdateSource_employeeId_createdAt_idx" ON "UpdateSource"("employeeId", "createdAt");

-- CreateIndex
CREATE INDEX "UpdateSource_projectId_workstreamId_createdAt_idx" ON "UpdateSource"("projectId", "workstreamId", "createdAt");

-- CreateIndex
CREATE INDEX "UpdateSource_workItemId_createdAt_idx" ON "UpdateSource"("workItemId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UpdateSource_id_projectId_key" ON "UpdateSource"("id", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ClarificationSession_updateSourceId_key" ON "ClarificationSession"("updateSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "ClarificationTurn_sessionId_turnNo_key" ON "ClarificationTurn"("sessionId", "turnNo");

-- CreateIndex
CREATE UNIQUE INDEX "ClarificationAnswer_turnId_key" ON "ClarificationAnswer"("turnId");

-- CreateIndex
CREATE INDEX "ClarificationAnswer_employeeId_createdAt_idx" ON "ClarificationAnswer"("employeeId", "createdAt");

-- CreateIndex
CREATE INDEX "StructuredUpdateDraftRevision_updateSourceId_revision_idx" ON "StructuredUpdateDraftRevision"("updateSourceId", "revision");

-- CreateIndex
CREATE INDEX "StructuredUpdateDraftRevision_aiRunId_idx" ON "StructuredUpdateDraftRevision"("aiRunId");

-- CreateIndex
CREATE INDEX "StructuredUpdateDraftRevision_createdById_createdAt_idx" ON "StructuredUpdateDraftRevision"("createdById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StructuredUpdateDraftRevision_sessionId_revision_key" ON "StructuredUpdateDraftRevision"("sessionId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "StructuredUpdateDraftRevision_id_updateSourceId_key" ON "StructuredUpdateDraftRevision"("id", "updateSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "UpdateConfirmation_updateSourceId_key" ON "UpdateConfirmation"("updateSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "UpdateConfirmation_draftRevisionId_key" ON "UpdateConfirmation"("draftRevisionId");

-- CreateIndex
CREATE INDEX "UpdateConfirmation_employeeId_confirmedAt_idx" ON "UpdateConfirmation"("employeeId", "confirmedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UpdateConfirmation_id_updateSourceId_key" ON "UpdateConfirmation"("id", "updateSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "UpdateConfirmation_draftRevisionId_updateSourceId_key" ON "UpdateConfirmation"("draftRevisionId", "updateSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "AcceptedUpdateEvent_confirmationId_key" ON "AcceptedUpdateEvent"("confirmationId");

-- CreateIndex
CREATE UNIQUE INDEX "AcceptedUpdateEvent_updateSourceId_key" ON "AcceptedUpdateEvent"("updateSourceId");

-- CreateIndex
CREATE INDEX "AcceptedUpdateEvent_projectId_occurredAt_id_idx" ON "AcceptedUpdateEvent"("projectId", "occurredAt", "id");

-- CreateIndex
CREATE INDEX "AcceptedUpdateEvent_workstreamId_occurredAt_id_idx" ON "AcceptedUpdateEvent"("workstreamId", "occurredAt", "id");

-- CreateIndex
CREATE INDEX "AcceptedUpdateEvent_workItemId_occurredAt_id_idx" ON "AcceptedUpdateEvent"("workItemId", "occurredAt", "id");

-- CreateIndex
CREATE INDEX "AcceptedUpdateEvent_employeeId_occurredAt_idx" ON "AcceptedUpdateEvent"("employeeId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "AcceptedUpdateEvent_confirmationId_updateSourceId_key" ON "AcceptedUpdateEvent"("confirmationId", "updateSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgressRecalculationRequest_acceptedEventId_key" ON "ProgressRecalculationRequest"("acceptedEventId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgressRecalculationRequest_operationId_key" ON "ProgressRecalculationRequest"("operationId");

-- CreateIndex
CREATE INDEX "ProgressRecalculationRequest_state_createdAt_idx" ON "ProgressRecalculationRequest"("state", "createdAt");

-- CreateIndex
CREATE INDEX "ProgressRecalculationRequest_contractId_createdAt_idx" ON "ProgressRecalculationRequest"("contractId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceRecord_idempotencyKey_key" ON "EvidenceRecord"("idempotencyKey");

-- CreateIndex
CREATE INDEX "EvidenceRecord_employeeId_state_createdAt_idx" ON "EvidenceRecord"("employeeId", "state", "createdAt");

-- CreateIndex
CREATE INDEX "EvidenceRecord_projectId_workstreamId_state_createdAt_idx" ON "EvidenceRecord"("projectId", "workstreamId", "state", "createdAt");

-- CreateIndex
CREATE INDEX "EvidenceRecord_workItemId_createdAt_idx" ON "EvidenceRecord"("workItemId", "createdAt");

-- CreateIndex
CREATE INDEX "EvidenceRecord_updateSourceId_idx" ON "EvidenceRecord"("updateSourceId");

-- CreateIndex
CREATE INDEX "EvidenceRevision_aiRunId_idx" ON "EvidenceRevision"("aiRunId");

-- CreateIndex
CREATE INDEX "EvidenceRevision_createdById_createdAt_idx" ON "EvidenceRevision"("createdById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceRevision_evidenceId_revision_key" ON "EvidenceRevision"("evidenceId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceRevision_id_evidenceId_key" ON "EvidenceRevision"("id", "evidenceId");

-- CreateIndex
CREATE INDEX "EvidenceLink_workItemId_idx" ON "EvidenceLink"("workItemId");

-- CreateIndex
CREATE INDEX "EvidenceLink_progressComponentId_idx" ON "EvidenceLink"("progressComponentId");

-- CreateIndex
CREATE INDEX "EvidenceLink_dynamicCriterionId_idx" ON "EvidenceLink"("dynamicCriterionId");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceLink_evidenceRevisionId_workItemId_progressComponen_key" ON "EvidenceLink"("evidenceRevisionId", "workItemId", "progressComponentId", "dynamicCriterionId");

-- CreateIndex
CREATE INDEX "EvidenceAttribution_evidenceRevisionId_employeeId_createdAt_idx" ON "EvidenceAttribution"("evidenceRevisionId", "employeeId", "createdAt");

-- CreateIndex
CREATE INDEX "EvidenceAttribution_employeeId_state_createdAt_idx" ON "EvidenceAttribution"("employeeId", "state", "createdAt");

-- CreateIndex
CREATE INDEX "EvidenceVerification_evidenceRevisionId_createdAt_idx" ON "EvidenceVerification"("evidenceRevisionId", "createdAt");

-- CreateIndex
CREATE INDEX "EvidenceVerification_actorId_createdAt_idx" ON "EvidenceVerification"("actorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceConfirmation_evidenceId_key" ON "EvidenceConfirmation"("evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceConfirmation_evidenceRevisionId_key" ON "EvidenceConfirmation"("evidenceRevisionId");

-- CreateIndex
CREATE INDEX "EvidenceConfirmation_employeeId_confirmedAt_idx" ON "EvidenceConfirmation"("employeeId", "confirmedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceConfirmation_id_evidenceId_key" ON "EvidenceConfirmation"("id", "evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceConfirmation_evidenceRevisionId_evidenceId_key" ON "EvidenceConfirmation"("evidenceRevisionId", "evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "AcceptedEvidenceEvent_confirmationId_key" ON "AcceptedEvidenceEvent"("confirmationId");

-- CreateIndex
CREATE UNIQUE INDEX "AcceptedEvidenceEvent_evidenceId_key" ON "AcceptedEvidenceEvent"("evidenceId");

-- CreateIndex
CREATE INDEX "AcceptedEvidenceEvent_projectId_occurredAt_id_idx" ON "AcceptedEvidenceEvent"("projectId", "occurredAt", "id");

-- CreateIndex
CREATE INDEX "AcceptedEvidenceEvent_workstreamId_occurredAt_id_idx" ON "AcceptedEvidenceEvent"("workstreamId", "occurredAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "AcceptedEvidenceEvent_confirmationId_evidenceId_key" ON "AcceptedEvidenceEvent"("confirmationId", "evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkItem_id_projectId_key" ON "WorkItem"("id", "projectId");

-- AddForeignKey
ALTER TABLE "UpdateSource" ADD CONSTRAINT "UpdateSource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpdateSource" ADD CONSTRAINT "UpdateSource_workstreamId_projectId_fkey" FOREIGN KEY ("workstreamId", "projectId") REFERENCES "Workstream"("id", "projectId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpdateSource" ADD CONSTRAINT "UpdateSource_workItemId_projectId_fkey" FOREIGN KEY ("workItemId", "projectId") REFERENCES "WorkItem"("id", "projectId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpdateSource" ADD CONSTRAINT "UpdateSource_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClarificationSession" ADD CONSTRAINT "ClarificationSession_updateSourceId_fkey" FOREIGN KEY ("updateSourceId") REFERENCES "UpdateSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClarificationTurn" ADD CONSTRAINT "ClarificationTurn_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClarificationSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClarificationAnswer" ADD CONSTRAINT "ClarificationAnswer_turnId_fkey" FOREIGN KEY ("turnId") REFERENCES "ClarificationTurn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClarificationAnswer" ADD CONSTRAINT "ClarificationAnswer_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StructuredUpdateDraftRevision" ADD CONSTRAINT "StructuredUpdateDraftRevision_updateSourceId_fkey" FOREIGN KEY ("updateSourceId") REFERENCES "UpdateSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StructuredUpdateDraftRevision" ADD CONSTRAINT "StructuredUpdateDraftRevision_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClarificationSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StructuredUpdateDraftRevision" ADD CONSTRAINT "StructuredUpdateDraftRevision_aiRunId_fkey" FOREIGN KEY ("aiRunId") REFERENCES "AiRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StructuredUpdateDraftRevision" ADD CONSTRAINT "StructuredUpdateDraftRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpdateConfirmation" ADD CONSTRAINT "UpdateConfirmation_updateSourceId_fkey" FOREIGN KEY ("updateSourceId") REFERENCES "UpdateSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpdateConfirmation" ADD CONSTRAINT "UpdateConfirmation_draftRevisionId_updateSourceId_fkey" FOREIGN KEY ("draftRevisionId", "updateSourceId") REFERENCES "StructuredUpdateDraftRevision"("id", "updateSourceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpdateConfirmation" ADD CONSTRAINT "UpdateConfirmation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcceptedUpdateEvent" ADD CONSTRAINT "AcceptedUpdateEvent_confirmationId_updateSourceId_fkey" FOREIGN KEY ("confirmationId", "updateSourceId") REFERENCES "UpdateConfirmation"("id", "updateSourceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcceptedUpdateEvent" ADD CONSTRAINT "AcceptedUpdateEvent_updateSourceId_fkey" FOREIGN KEY ("updateSourceId") REFERENCES "UpdateSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcceptedUpdateEvent" ADD CONSTRAINT "AcceptedUpdateEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcceptedUpdateEvent" ADD CONSTRAINT "AcceptedUpdateEvent_workstreamId_projectId_fkey" FOREIGN KEY ("workstreamId", "projectId") REFERENCES "Workstream"("id", "projectId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcceptedUpdateEvent" ADD CONSTRAINT "AcceptedUpdateEvent_workItemId_projectId_fkey" FOREIGN KEY ("workItemId", "projectId") REFERENCES "WorkItem"("id", "projectId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcceptedUpdateEvent" ADD CONSTRAINT "AcceptedUpdateEvent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressRecalculationRequest" ADD CONSTRAINT "ProgressRecalculationRequest_acceptedEventId_fkey" FOREIGN KEY ("acceptedEventId") REFERENCES "AcceptedUpdateEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressRecalculationRequest" ADD CONSTRAINT "ProgressRecalculationRequest_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "ProgressContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressRecalculationRequest" ADD CONSTRAINT "ProgressRecalculationRequest_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceRecord" ADD CONSTRAINT "EvidenceRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceRecord" ADD CONSTRAINT "EvidenceRecord_workstreamId_projectId_fkey" FOREIGN KEY ("workstreamId", "projectId") REFERENCES "Workstream"("id", "projectId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceRecord" ADD CONSTRAINT "EvidenceRecord_workItemId_projectId_fkey" FOREIGN KEY ("workItemId", "projectId") REFERENCES "WorkItem"("id", "projectId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceRecord" ADD CONSTRAINT "EvidenceRecord_updateSourceId_fkey" FOREIGN KEY ("updateSourceId") REFERENCES "UpdateSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceRecord" ADD CONSTRAINT "EvidenceRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceRevision" ADD CONSTRAINT "EvidenceRevision_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "EvidenceRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceRevision" ADD CONSTRAINT "EvidenceRevision_aiRunId_fkey" FOREIGN KEY ("aiRunId") REFERENCES "AiRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceRevision" ADD CONSTRAINT "EvidenceRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceLink" ADD CONSTRAINT "EvidenceLink_evidenceRevisionId_fkey" FOREIGN KEY ("evidenceRevisionId") REFERENCES "EvidenceRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceLink" ADD CONSTRAINT "EvidenceLink_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceLink" ADD CONSTRAINT "EvidenceLink_progressComponentId_fkey" FOREIGN KEY ("progressComponentId") REFERENCES "ProgressContractComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceLink" ADD CONSTRAINT "EvidenceLink_dynamicCriterionId_fkey" FOREIGN KEY ("dynamicCriterionId") REFERENCES "DynamicCriterion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceAttribution" ADD CONSTRAINT "EvidenceAttribution_evidenceRevisionId_fkey" FOREIGN KEY ("evidenceRevisionId") REFERENCES "EvidenceRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceAttribution" ADD CONSTRAINT "EvidenceAttribution_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceAttribution" ADD CONSTRAINT "EvidenceAttribution_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceVerification" ADD CONSTRAINT "EvidenceVerification_evidenceRevisionId_fkey" FOREIGN KEY ("evidenceRevisionId") REFERENCES "EvidenceRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceVerification" ADD CONSTRAINT "EvidenceVerification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceConfirmation" ADD CONSTRAINT "EvidenceConfirmation_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "EvidenceRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceConfirmation" ADD CONSTRAINT "EvidenceConfirmation_evidenceRevisionId_evidenceId_fkey" FOREIGN KEY ("evidenceRevisionId", "evidenceId") REFERENCES "EvidenceRevision"("id", "evidenceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceConfirmation" ADD CONSTRAINT "EvidenceConfirmation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcceptedEvidenceEvent" ADD CONSTRAINT "AcceptedEvidenceEvent_confirmationId_evidenceId_fkey" FOREIGN KEY ("confirmationId", "evidenceId") REFERENCES "EvidenceConfirmation"("id", "evidenceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcceptedEvidenceEvent" ADD CONSTRAINT "AcceptedEvidenceEvent_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "EvidenceRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcceptedEvidenceEvent" ADD CONSTRAINT "AcceptedEvidenceEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcceptedEvidenceEvent" ADD CONSTRAINT "AcceptedEvidenceEvent_workstreamId_projectId_fkey" FOREIGN KEY ("workstreamId", "projectId") REFERENCES "Workstream"("id", "projectId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain invariants: one-question clarification, source-backed evidence, and
-- positive optimistic versions. Persisted AI drafts remain source-referenced
-- and cannot contain an unbounded provider/model override.
ALTER TABLE "UpdateSource"
ADD CONSTRAINT "UpdateSource_source_version_positive" CHECK ("sourceVersion" > 0),
ADD CONSTRAINT "UpdateSource_raw_text_present" CHECK (length(btrim("rawText")) > 0);

ALTER TABLE "ClarificationSession"
ADD CONSTRAINT "ClarificationSession_version_positive" CHECK ("version" > 0),
ADD CONSTRAINT "ClarificationSession_turn_nonnegative" CHECK ("currentTurnNo" >= 0),
ADD CONSTRAINT "ClarificationSession_unresolved_fields_array"
  CHECK (jsonb_typeof("unresolvedFields") = 'array');

ALTER TABLE "ClarificationTurn"
ADD CONSTRAINT "ClarificationTurn_number_positive" CHECK ("turnNo" > 0),
ADD CONSTRAINT "ClarificationTurn_question_present" CHECK (length(btrim("question")) > 0),
ADD CONSTRAINT "ClarificationTurn_affects_array" CHECK (jsonb_typeof("affects") = 'array');

ALTER TABLE "ClarificationAnswer"
ADD CONSTRAINT "ClarificationAnswer_version_positive" CHECK ("resultingSessionVersion" > 1),
ADD CONSTRAINT "ClarificationAnswer_present" CHECK (length(btrim("answer")) > 0);

ALTER TABLE "StructuredUpdateDraftRevision"
ADD CONSTRAINT "StructuredUpdateDraftRevision_revision_positive" CHECK ("revision" > 0),
ADD CONSTRAINT "StructuredUpdateDraftRevision_sources_array"
  CHECK (jsonb_typeof("sourceReferences") = 'array'),
ADD CONSTRAINT "StructuredUpdateDraftRevision_claims_array"
  CHECK (jsonb_typeof("evidenceClaimDrafts") = 'array'),
ADD CONSTRAINT "StructuredUpdateDraftRevision_comparison_object"
  CHECK (jsonb_typeof("comparison") = 'object');

ALTER TABLE "ProgressRecalculationRequest"
ADD CONSTRAINT "ProgressRecalculationRequest_version_positive" CHECK ("version" > 0),
ADD CONSTRAINT "ProgressRecalculationRequest_completed_state"
  CHECK (
    ("state" = 'pending' AND "completedAt" IS NULL)
    OR ("state" IN ('completed', 'failed') AND "completedAt" IS NOT NULL)
  );

ALTER TABLE "EvidenceRecord"
ADD CONSTRAINT "EvidenceRecord_version_positive" CHECK ("version" > 0),
ADD CONSTRAINT "EvidenceRecord_revision_positive" CHECK ("currentRevision" > 0),
ADD CONSTRAINT "EvidenceRecord_work_item_capture"
  CHECK (NOT "capturedFromWorkItem" OR "workItemId" IS NOT NULL);

ALTER TABLE "EvidenceRevision"
ADD CONSTRAINT "EvidenceRevision_revision_positive" CHECK ("revision" > 0),
ADD CONSTRAINT "EvidenceRevision_size_positive" CHECK ("sizeBytes" IS NULL OR "sizeBytes" > 0),
ADD CONSTRAINT "EvidenceRevision_claim_present" CHECK (length(btrim("supportedClaim")) > 0),
ADD CONSTRAINT "EvidenceRevision_context_present"
  CHECK (length(btrim("contributionContext")) > 0),
ADD CONSTRAINT "EvidenceRevision_source_shape"
  CHECK (
    (
      "sourceKind" IN ('image', 'screenshot', 'file', 'document')
      AND "objectKey" IS NOT NULL
      AND "sourceText" IS NULL
      AND "sourceUrl" IS NULL
      AND "mediaType" IS NOT NULL
      AND "checksumSha256" IS NOT NULL
      AND "sizeBytes" IS NOT NULL
    )
    OR (
      "sourceKind" IN ('pasted_code', 'pasted_text')
      AND "sourceText" IS NOT NULL
      AND "objectKey" IS NULL
      AND "sourceUrl" IS NULL
    )
    OR (
      "sourceKind" = 'cli_snapshot'
      AND num_nonnulls("objectKey", "sourceText") = 1
      AND "sourceUrl" IS NULL
      AND (
        "objectKey" IS NULL
        OR (
          "mediaType" IS NOT NULL
          AND "checksumSha256" IS NOT NULL
          AND "sizeBytes" IS NOT NULL
        )
      )
    )
    OR (
      "sourceKind" = 'url'
      AND "sourceUrl" IS NOT NULL
      AND "objectKey" IS NULL
      AND "sourceText" IS NULL
    )
  );

ALTER TABLE "EvidenceLink"
ADD CONSTRAINT "EvidenceLink_exactly_one_target"
  CHECK (num_nonnulls("workItemId", "progressComponentId", "dynamicCriterionId") = 1);

ALTER TABLE "EvidenceVerification"
ADD CONSTRAINT "EvidenceVerification_sources_array"
  CHECK (jsonb_typeof("sourceReferences") = 'array');

ALTER TABLE "AcceptedUpdateEvent"
ADD CONSTRAINT "AcceptedUpdateEvent_sources_array"
  CHECK (jsonb_typeof("sourceReferences") = 'array');

ALTER TABLE "AcceptedEvidenceEvent"
ADD CONSTRAINT "AcceptedEvidenceEvent_sources_array"
  CHECK (jsonb_typeof("sourceReferences") = 'array');

-- PostgreSQL treats NULLs as distinct in a four-column unique index. These
-- target-specific indexes enforce one link per revision and target.
CREATE UNIQUE INDEX "EvidenceLink_revision_work_item_unique"
ON "EvidenceLink" ("evidenceRevisionId", "workItemId")
WHERE "workItemId" IS NOT NULL;

CREATE UNIQUE INDEX "EvidenceLink_revision_progress_component_unique"
ON "EvidenceLink" ("evidenceRevisionId", "progressComponentId")
WHERE "progressComponentId" IS NOT NULL;

CREATE UNIQUE INDEX "EvidenceLink_revision_dynamic_criterion_unique"
ON "EvidenceLink" ("evidenceRevisionId", "dynamicCriterionId")
WHERE "dynamicCriterionId" IS NOT NULL;

-- Mutable heads have narrowly guarded state/version transitions. Source,
-- revisions, confirmations, attribution, verification, links, and accepted
-- events remain append-only.
CREATE FUNCTION "guard_clarification_session_update"() RETURNS trigger AS $$
BEGIN
  IF (
    NEW."id" <> OLD."id"
    OR NEW."updateSourceId" <> OLD."updateSourceId"
    OR NEW."createdAt" <> OLD."createdAt"
  ) THEN
    RAISE EXCEPTION 'Clarification Session core fields are immutable' USING ERRCODE = '55000';
  END IF;
  IF NEW."version" <> OLD."version" + 1 THEN
    RAISE EXCEPTION 'Clarification Session transition must increment version once'
      USING ERRCODE = '40001';
  END IF;
  IF (
    (OLD."state" = 'confirmed' OR OLD."state" = 'cancelled')
    AND NEW."state" <> OLD."state"
  ) THEN
    RAISE EXCEPTION 'Terminal Clarification Session cannot transition'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "guard_evidence_record_update"() RETURNS trigger AS $$
BEGIN
  IF (
    NEW."id" <> OLD."id"
    OR NEW."projectId" <> OLD."projectId"
    OR NEW."workstreamId" IS DISTINCT FROM OLD."workstreamId"
    OR NEW."workItemId" IS DISTINCT FROM OLD."workItemId"
    OR NEW."capturedFromWorkItem" <> OLD."capturedFromWorkItem"
    OR NEW."updateSourceId" IS DISTINCT FROM OLD."updateSourceId"
    OR NEW."employeeId" <> OLD."employeeId"
    OR NEW."createdAt" <> OLD."createdAt"
  ) THEN
    RAISE EXCEPTION 'Evidence Record core fields are immutable' USING ERRCODE = '55000';
  END IF;
  IF NEW."version" <> OLD."version" + 1 THEN
    RAISE EXCEPTION 'Evidence Record transition must increment version once'
      USING ERRCODE = '40001';
  END IF;
  IF NEW."currentRevision" NOT IN (OLD."currentRevision", OLD."currentRevision" + 1) THEN
    RAISE EXCEPTION 'Evidence revision must advance by at most one'
      USING ERRCODE = '40001';
  END IF;
  IF OLD."state" <> 'draft' AND NEW."state" <> OLD."state" THEN
    RAISE EXCEPTION 'Terminal Evidence Record cannot transition'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "guard_progress_recalculation_update"() RETURNS trigger AS $$
BEGIN
  IF (
    NEW."id" <> OLD."id"
    OR NEW."acceptedEventId" <> OLD."acceptedEventId"
    OR NEW."contractId" IS DISTINCT FROM OLD."contractId"
    OR NEW."operationId" <> OLD."operationId"
    OR NEW."correlationId" <> OLD."correlationId"
    OR NEW."createdAt" <> OLD."createdAt"
  ) THEN
    RAISE EXCEPTION 'Progress recalculation request core fields are immutable'
      USING ERRCODE = '55000';
  END IF;
  IF NEW."version" <> OLD."version" + 1 THEN
    RAISE EXCEPTION 'Progress recalculation transition must increment version once'
      USING ERRCODE = '40001';
  END IF;
  IF OLD."state" <> 'pending' AND NEW."state" <> OLD."state" THEN
    RAISE EXCEPTION 'Terminal progress recalculation request cannot transition'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ClarificationSession_prevent_delete"
BEFORE DELETE ON "ClarificationSession"
FOR EACH ROW EXECUTE FUNCTION "prevent_phase2_history_mutation"();
CREATE TRIGGER "ClarificationSession_guard_update"
BEFORE UPDATE ON "ClarificationSession"
FOR EACH ROW EXECUTE FUNCTION "guard_clarification_session_update"();

CREATE TRIGGER "EvidenceRecord_prevent_delete"
BEFORE DELETE ON "EvidenceRecord"
FOR EACH ROW EXECUTE FUNCTION "prevent_phase2_history_mutation"();
CREATE TRIGGER "EvidenceRecord_guard_update"
BEFORE UPDATE ON "EvidenceRecord"
FOR EACH ROW EXECUTE FUNCTION "guard_evidence_record_update"();

CREATE TRIGGER "ProgressRecalculationRequest_prevent_delete"
BEFORE DELETE ON "ProgressRecalculationRequest"
FOR EACH ROW EXECUTE FUNCTION "prevent_phase2_history_mutation"();
CREATE TRIGGER "ProgressRecalculationRequest_guard_update"
BEFORE UPDATE ON "ProgressRecalculationRequest"
FOR EACH ROW EXECUTE FUNCTION "guard_progress_recalculation_update"();

CREATE TRIGGER "UpdateSource_append_only"
BEFORE UPDATE OR DELETE ON "UpdateSource"
FOR EACH ROW EXECUTE FUNCTION "prevent_phase2_history_mutation"();
CREATE TRIGGER "ClarificationTurn_append_only"
BEFORE UPDATE OR DELETE ON "ClarificationTurn"
FOR EACH ROW EXECUTE FUNCTION "prevent_phase2_history_mutation"();
CREATE TRIGGER "ClarificationAnswer_append_only"
BEFORE UPDATE OR DELETE ON "ClarificationAnswer"
FOR EACH ROW EXECUTE FUNCTION "prevent_phase2_history_mutation"();
CREATE TRIGGER "StructuredUpdateDraftRevision_append_only"
BEFORE UPDATE OR DELETE ON "StructuredUpdateDraftRevision"
FOR EACH ROW EXECUTE FUNCTION "prevent_phase2_history_mutation"();
CREATE TRIGGER "UpdateConfirmation_append_only"
BEFORE UPDATE OR DELETE ON "UpdateConfirmation"
FOR EACH ROW EXECUTE FUNCTION "prevent_phase2_history_mutation"();
CREATE TRIGGER "AcceptedUpdateEvent_append_only"
BEFORE UPDATE OR DELETE ON "AcceptedUpdateEvent"
FOR EACH ROW EXECUTE FUNCTION "prevent_phase2_history_mutation"();
CREATE TRIGGER "EvidenceRevision_append_only"
BEFORE UPDATE OR DELETE ON "EvidenceRevision"
FOR EACH ROW EXECUTE FUNCTION "prevent_phase2_history_mutation"();
CREATE TRIGGER "EvidenceLink_append_only"
BEFORE UPDATE OR DELETE ON "EvidenceLink"
FOR EACH ROW EXECUTE FUNCTION "prevent_phase2_history_mutation"();
CREATE TRIGGER "EvidenceAttribution_append_only"
BEFORE UPDATE OR DELETE ON "EvidenceAttribution"
FOR EACH ROW EXECUTE FUNCTION "prevent_phase2_history_mutation"();
CREATE TRIGGER "EvidenceVerification_append_only"
BEFORE UPDATE OR DELETE ON "EvidenceVerification"
FOR EACH ROW EXECUTE FUNCTION "prevent_phase2_history_mutation"();
CREATE TRIGGER "EvidenceConfirmation_append_only"
BEFORE UPDATE OR DELETE ON "EvidenceConfirmation"
FOR EACH ROW EXECUTE FUNCTION "prevent_phase2_history_mutation"();
CREATE TRIGGER "AcceptedEvidenceEvent_append_only"
BEFORE UPDATE OR DELETE ON "AcceptedEvidenceEvent"
FOR EACH ROW EXECUTE FUNCTION "prevent_phase2_history_mutation"();
