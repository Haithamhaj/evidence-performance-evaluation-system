-- CreateEnum
CREATE TYPE "ResearchState" AS ENUM ('DRAFT', 'ACTIVE', 'CONCLUDED', 'CANCELLED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ExperimentState" AS ENUM ('DRAFT', 'READY', 'RUNNING', 'RESULT_RECORDED', 'CONCLUDED', 'ABANDONED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ResearchSourceReviewState" AS ENUM ('PENDING_RETRIEVAL', 'READY_FOR_REVIEW', 'PARTIAL', 'BLOCKED', 'CONFIRMED', 'DISMISSED', 'STALE');

-- CreateEnum
CREATE TYPE "ResearchRetrievalState" AS ENUM ('PENDING', 'RETRIEVED', 'PARTIAL', 'BLOCKED', 'STALE');

-- CreateEnum
CREATE TYPE "ResearchRevisionOrigin" AS ENUM ('EMPLOYEE', 'AI_DRAFT');

-- CreateEnum
CREATE TYPE "ResearchHypothesisKind" AS ENUM ('TESTABLE', 'NO_HYPOTHESIS');

-- CreateEnum
CREATE TYPE "ResearchParticipantRole" AS ENUM ('OWNER', 'CONTRIBUTOR');

-- CreateEnum
CREATE TYPE "ResearchParticipantAction" AS ENUM ('STARTED', 'ENDED');

-- CreateEnum
CREATE TYPE "ResearchSourceInputKind" AS ENUM ('URL', 'CONNECTED_CONTEXT', 'DOCUMENT_VERSION');

-- CreateEnum
CREATE TYPE "ResearchProposalKind" AS ENUM ('RESEARCH', 'EXPERIMENT', 'WORK_ITEM');

-- CreateEnum
CREATE TYPE "ResearchProposalState" AS ENUM ('DRAFT', 'CONFIRMED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ResearchProposalTransitionKind" AS ENUM ('CONFIRMED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ResearchSourceReferenceKind" AS ENUM ('PAPER', 'REPOSITORY', 'DOCUMENTATION', 'DATASET', 'BENCHMARK', 'COURSE_VIDEO', 'INTERNAL_DOCUMENT', 'LINK', 'OTHER');

-- CreateEnum
CREATE TYPE "ResearchSourceReferenceState" AS ENUM ('ACTIVE', 'RETRACTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ExperimentMeasureKind" AS ENUM ('NUMERIC', 'CATEGORICAL', 'BOOLEAN', 'QUALITATIVE');

-- CreateEnum
CREATE TYPE "ExperimentMeasureDirection" AS ENUM ('HIGHER', 'LOWER', 'TARGET_RANGE', 'MATCH', 'DESCRIPTIVE');

-- CreateEnum
CREATE TYPE "ExperimentRunResultStatus" AS ENUM ('COMPLETED', 'FAILED', 'INVALID', 'STOPPED');

-- CreateEnum
CREATE TYPE "ExperimentConclusionOutcome" AS ENUM ('SUPPORTED', 'NOT_SUPPORTED', 'INCONCLUSIVE', 'INVALID', 'ABANDONED');

-- CreateEnum
CREATE TYPE "ResearchDecision" AS ENUM ('ADOPT', 'REJECT', 'DEFER', 'REFINE', 'RUN_ANOTHER_EXPERIMENT', 'NO_DECISION');

-- CreateEnum
CREATE TYPE "AppliedLearningTargetKind" AS ENUM ('WORK_ITEM', 'UPDATE', 'DOCUMENT_VERSION', 'PROGRESS_CONTRACT_PROPOSAL', 'CRITERION_PROPOSAL', 'RESEARCH', 'EXPERIMENT', 'KNOWLEDGE_TRANSFER');

-- CreateTable
CREATE TABLE "ResearchRecord" (
    "id" UUID NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "workstreamId" UUID,
    "workItemId" UUID,
    "ownerId" UUID NOT NULL,
    "state" "ResearchState" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transitionedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchRevision" (
    "id" UUID NOT NULL,
    "researchId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "origin" "ResearchRevisionOrigin" NOT NULL,
    "problemStatement" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "hypothesisKind" "ResearchHypothesisKind" NOT NULL,
    "hypothesisStatement" TEXT,
    "noHypothesisReason" TEXT,
    "assumptions" JSONB NOT NULL,
    "constraints" JSONB NOT NULL,
    "knownUncertainty" JSONB NOT NULL,
    "alternatives" JSONB NOT NULL,
    "decisionQuestion" TEXT NOT NULL,
    "sourceReferences" JSONB NOT NULL,
    "executionMode" "Phase2ExecutionMode" NOT NULL,
    "aiRunId" UUID,
    "promptVersion" TEXT,
    "routeTrace" JSONB,
    "authorId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchParticipantEvent" (
    "id" UUID NOT NULL,
    "researchId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "role" "ResearchParticipantRole" NOT NULL,
    "action" "ResearchParticipantAction" NOT NULL,
    "effectiveAt" TIMESTAMPTZ(6) NOT NULL,
    "reason" TEXT NOT NULL,
    "actorId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchParticipantEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchTransition" (
    "id" UUID NOT NULL,
    "researchId" UUID NOT NULL,
    "fromState" "ResearchState",
    "toState" "ResearchState" NOT NULL,
    "reason" TEXT,
    "successorResearchId" UUID,
    "actorId" UUID NOT NULL,
    "resultingVersion" INTEGER NOT NULL,
    "effectiveAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchSourceReview" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "workstreamId" UUID,
    "workItemId" UUID,
    "ownerId" UUID NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "sourceKind" "ResearchSourceInputKind" NOT NULL,
    "sealedSource" JSONB NOT NULL,
    "documentVersionId" UUID,
    "state" "ResearchSourceReviewState" NOT NULL DEFAULT 'PENDING_RETRIEVAL',
    "retrievalState" "ResearchRetrievalState" NOT NULL DEFAULT 'PENDING',
    "retrievalReason" TEXT,
    "displayUrl" TEXT,
    "contentFingerprint" TEXT,
    "currentRevision" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ResearchSourceReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchSourceReviewRevision" (
    "id" UUID NOT NULL,
    "reviewId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "retrievalState" "ResearchRetrievalState" NOT NULL,
    "retrievalReason" TEXT,
    "displayUrl" TEXT,
    "contentFingerprint" TEXT,
    "projectContextFingerprint" TEXT,
    "sealedRetrievedContent" TEXT,
    "sealedOutput" TEXT,
    "outputFragments" JSONB,
    "citations" JSONB NOT NULL,
    "schemaVersion" TEXT,
    "promptVersion" TEXT,
    "routeTrace" JSONB,
    "aiRunId" UUID,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchSourceReviewRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchProposal" (
    "id" UUID NOT NULL,
    "reviewId" UUID NOT NULL,
    "kind" "ResearchProposalKind" NOT NULL,
    "state" "ResearchProposalState" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "sourceReferences" JSONB NOT NULL,
    "targetId" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ResearchProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchProposalTransition" (
    "id" UUID NOT NULL,
    "proposalId" UUID NOT NULL,
    "kind" "ResearchProposalTransitionKind" NOT NULL,
    "reason" TEXT NOT NULL,
    "actorId" UUID NOT NULL,
    "resultingVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchProposalTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchSourceReference" (
    "id" UUID NOT NULL,
    "researchId" UUID NOT NULL,
    "sourceReviewId" UUID,
    "documentVersionId" UUID,
    "kind" "ResearchSourceReferenceKind" NOT NULL,
    "title" TEXT NOT NULL,
    "canonicalUrl" TEXT,
    "relevanceNote" TEXT NOT NULL,
    "credibilityNote" TEXT NOT NULL,
    "comparedAlternative" TEXT,
    "retrievalState" "ResearchRetrievalState" NOT NULL,
    "retrievedAt" TIMESTAMPTZ(6),
    "resolvedCanonicalUrl" TEXT,
    "contentFingerprint" TEXT,
    "citedLocations" JSONB NOT NULL,
    "observedLicense" TEXT,
    "reuseWarning" TEXT,
    "state" "ResearchSourceReferenceState" NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT,
    "successorResearchId" UUID,
    "addedById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchSourceReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Experiment" (
    "id" UUID NOT NULL,
    "researchId" UUID NOT NULL,
    "workstreamId" UUID,
    "workItemId" UUID,
    "idempotencyKey" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "state" "ExperimentState" NOT NULL DEFAULT 'DRAFT',
    "methodRevision" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transitionedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Experiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentMethodRevision" (
    "id" UUID NOT NULL,
    "experimentId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "baselineDescription" TEXT NOT NULL,
    "baselineValue" TEXT,
    "baselineReference" JSONB,
    "conditions" JSONB NOT NULL,
    "reproducibilityInstructions" TEXT NOT NULL,
    "knownRisks" JSONB NOT NULL,
    "failureCases" JSONB NOT NULL,
    "sourceReferences" JSONB NOT NULL,
    "executionMode" "Phase2ExecutionMode" NOT NULL,
    "origin" "ResearchRevisionOrigin" NOT NULL,
    "aiRunId" UUID,
    "promptVersion" TEXT,
    "routeTrace" JSONB,
    "authorId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExperimentMethodRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentMeasure" (
    "id" UUID NOT NULL,
    "methodRevisionId" UUID NOT NULL,
    "stableId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ExperimentMeasureKind" NOT NULL,
    "unit" TEXT,
    "direction" "ExperimentMeasureDirection" NOT NULL,
    "baselineValue" TEXT,
    "baselineReference" JSONB,
    "interpretationRule" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExperimentMeasure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentTestCase" (
    "id" UUID NOT NULL,
    "methodRevisionId" UUID NOT NULL,
    "inputIdentity" TEXT NOT NULL,
    "expectedObservation" TEXT,
    "category" TEXT NOT NULL,
    "inclusionReason" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExperimentTestCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentControl" (
    "id" UUID NOT NULL,
    "methodRevisionId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "comparisonTarget" TEXT NOT NULL,
    "constantConditions" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExperimentControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentRun" (
    "id" UUID NOT NULL,
    "experimentId" UUID NOT NULL,
    "methodRevisionId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "executorId" UUID NOT NULL,
    "startedAt" TIMESTAMPTZ(6) NOT NULL,
    "completedAt" TIMESTAMPTZ(6) NOT NULL,
    "resultStatus" "ExperimentRunResultStatus" NOT NULL,
    "environment" JSONB NOT NULL,
    "inputs" JSONB NOT NULL,
    "modelConfigurations" JSONB NOT NULL,
    "unexpectedConditions" JSONB NOT NULL,
    "executionNotes" TEXT NOT NULL,
    "sourceReferences" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExperimentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentObservation" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "measureId" UUID NOT NULL,
    "testCaseId" UUID,
    "observedValue" TEXT NOT NULL,
    "unit" TEXT,
    "note" TEXT,
    "supersedesObservationId" UUID,
    "correctionReason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExperimentObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentConclusion" (
    "id" UUID NOT NULL,
    "experimentId" UUID NOT NULL,
    "outcome" "ExperimentConclusionOutcome" NOT NULL,
    "summary" TEXT NOT NULL,
    "runIds" JSONB NOT NULL,
    "measureStableIds" JSONB NOT NULL,
    "limitations" JSONB NOT NULL,
    "confidenceDescription" TEXT NOT NULL,
    "decisionRelevance" TEXT NOT NULL,
    "nextStep" TEXT NOT NULL,
    "aiRunId" UUID,
    "confirmerId" UUID NOT NULL,
    "confirmedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExperimentConclusion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchConclusion" (
    "id" UUID NOT NULL,
    "researchId" UUID NOT NULL,
    "synthesis" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "remainingUncertainty" JSONB NOT NULL,
    "decision" "ResearchDecision" NOT NULL,
    "rationale" TEXT NOT NULL,
    "nextAction" TEXT NOT NULL,
    "sourceReferences" JSONB NOT NULL,
    "experimentIds" JSONB NOT NULL,
    "aiRunId" UUID,
    "confirmerId" UUID NOT NULL,
    "confirmedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchConclusion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppliedLearning" (
    "id" UUID NOT NULL,
    "researchId" UUID NOT NULL,
    "researchConclusionId" UUID NOT NULL,
    "targetKind" "AppliedLearningTargetKind" NOT NULL,
    "targetId" UUID NOT NULL,
    "targetResearchId" UUID,
    "targetExperimentId" UUID,
    "documentVersionId" UUID,
    "whatChanged" TEXT NOT NULL,
    "causalRationale" TEXT NOT NULL,
    "confirmerId" UUID NOT NULL,
    "confirmedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppliedLearning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchEvidenceLink" (
    "id" UUID NOT NULL,
    "researchId" UUID NOT NULL,
    "evidenceId" UUID NOT NULL,
    "evidenceRevisionId" UUID NOT NULL,
    "supportedClaim" TEXT NOT NULL,
    "experimentId" UUID,
    "experimentRunId" UUID,
    "experimentConclusionId" UUID,
    "confirmerId" UUID NOT NULL,
    "confirmedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchEvidenceLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResearchRecord_projectId_state_createdAt_idx" ON "ResearchRecord"("projectId", "state", "createdAt");

-- CreateIndex
CREATE INDEX "ResearchRecord_ownerId_state_createdAt_idx" ON "ResearchRecord"("ownerId", "state", "createdAt");

-- CreateIndex
CREATE INDEX "ResearchRecord_workstreamId_createdAt_idx" ON "ResearchRecord"("workstreamId", "createdAt");

-- CreateIndex
CREATE INDEX "ResearchRecord_workItemId_createdAt_idx" ON "ResearchRecord"("workItemId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchRecord_ownerId_projectId_idempotencyKey_key" ON "ResearchRecord"("ownerId", "projectId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "ResearchRevision_aiRunId_idx" ON "ResearchRevision"("aiRunId");

-- CreateIndex
CREATE INDEX "ResearchRevision_authorId_createdAt_idx" ON "ResearchRevision"("authorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchRevision_researchId_revision_key" ON "ResearchRevision"("researchId", "revision");

-- CreateIndex
CREATE INDEX "ResearchParticipantEvent_researchId_employeeId_effectiveAt__idx" ON "ResearchParticipantEvent"("researchId", "employeeId", "effectiveAt", "id");

-- CreateIndex
CREATE INDEX "ResearchParticipantEvent_employeeId_effectiveAt_id_idx" ON "ResearchParticipantEvent"("employeeId", "effectiveAt", "id");

-- CreateIndex
CREATE INDEX "ResearchParticipantEvent_actorId_createdAt_idx" ON "ResearchParticipantEvent"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "ResearchTransition_researchId_effectiveAt_id_idx" ON "ResearchTransition"("researchId", "effectiveAt", "id");

-- CreateIndex
CREATE INDEX "ResearchTransition_successorResearchId_idx" ON "ResearchTransition"("successorResearchId");

-- CreateIndex
CREATE INDEX "ResearchTransition_actorId_createdAt_idx" ON "ResearchTransition"("actorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchTransition_researchId_resultingVersion_key" ON "ResearchTransition"("researchId", "resultingVersion");

-- CreateIndex
CREATE INDEX "ResearchSourceReview_ownerId_state_createdAt_idx" ON "ResearchSourceReview"("ownerId", "state", "createdAt");

-- CreateIndex
CREATE INDEX "ResearchSourceReview_projectId_state_createdAt_idx" ON "ResearchSourceReview"("projectId", "state", "createdAt");

-- CreateIndex
CREATE INDEX "ResearchSourceReview_workstreamId_createdAt_idx" ON "ResearchSourceReview"("workstreamId", "createdAt");

-- CreateIndex
CREATE INDEX "ResearchSourceReview_workItemId_createdAt_idx" ON "ResearchSourceReview"("workItemId", "createdAt");

-- CreateIndex
CREATE INDEX "ResearchSourceReview_documentVersionId_idx" ON "ResearchSourceReview"("documentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchSourceReview_owner_project_idempotency_key" ON "ResearchSourceReview"("ownerId", "projectId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "ResearchSourceReviewRevision_aiRunId_idx" ON "ResearchSourceReviewRevision"("aiRunId");

-- CreateIndex
CREATE INDEX "ResearchSourceReviewRevision_createdById_createdAt_idx" ON "ResearchSourceReviewRevision"("createdById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchSourceReviewRevision_reviewId_revision_key" ON "ResearchSourceReviewRevision"("reviewId", "revision");

-- CreateIndex
CREATE INDEX "ResearchProposal_reviewId_state_createdAt_idx" ON "ResearchProposal"("reviewId", "state", "createdAt");

-- CreateIndex
CREATE INDEX "ResearchProposal_targetId_idx" ON "ResearchProposal"("targetId");

-- CreateIndex
CREATE INDEX "ResearchProposalTransition_actorId_createdAt_idx" ON "ResearchProposalTransition"("actorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchProposalTransition_proposalId_resultingVersion_key" ON "ResearchProposalTransition"("proposalId", "resultingVersion");

-- CreateIndex
CREATE INDEX "ResearchSourceReference_researchId_createdAt_idx" ON "ResearchSourceReference"("researchId", "createdAt");

-- CreateIndex
CREATE INDEX "ResearchSourceReference_sourceReviewId_idx" ON "ResearchSourceReference"("sourceReviewId");

-- CreateIndex
CREATE INDEX "ResearchSourceReference_documentVersionId_idx" ON "ResearchSourceReference"("documentVersionId");

-- CreateIndex
CREATE INDEX "ResearchSourceReference_successorResearchId_idx" ON "ResearchSourceReference"("successorResearchId");

-- CreateIndex
CREATE INDEX "ResearchSourceReference_addedById_createdAt_idx" ON "ResearchSourceReference"("addedById", "createdAt");

-- CreateIndex
CREATE INDEX "Experiment_researchId_state_createdAt_idx" ON "Experiment"("researchId", "state", "createdAt");

-- CreateIndex
CREATE INDEX "Experiment_workstreamId_createdAt_idx" ON "Experiment"("workstreamId", "createdAt");

-- CreateIndex
CREATE INDEX "Experiment_workItemId_createdAt_idx" ON "Experiment"("workItemId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Experiment_researchId_idempotencyKey_key" ON "Experiment"("researchId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "ExperimentMethodRevision_aiRunId_idx" ON "ExperimentMethodRevision"("aiRunId");

-- CreateIndex
CREATE INDEX "ExperimentMethodRevision_authorId_createdAt_idx" ON "ExperimentMethodRevision"("authorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExperimentMethodRevision_experimentId_revision_key" ON "ExperimentMethodRevision"("experimentId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "ExperimentMeasure_methodRevisionId_stableId_key" ON "ExperimentMeasure"("methodRevisionId", "stableId");

-- CreateIndex
CREATE INDEX "ExperimentTestCase_methodRevisionId_category_idx" ON "ExperimentTestCase"("methodRevisionId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "ExperimentControl_methodRevisionId_position_key" ON "ExperimentControl"("methodRevisionId", "position");

-- CreateIndex
CREATE INDEX "ExperimentRun_methodRevisionId_createdAt_idx" ON "ExperimentRun"("methodRevisionId", "createdAt");

-- CreateIndex
CREATE INDEX "ExperimentRun_executorId_createdAt_idx" ON "ExperimentRun"("executorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExperimentRun_experimentId_sequence_key" ON "ExperimentRun"("experimentId", "sequence");

-- CreateIndex
CREATE INDEX "ExperimentObservation_runId_measureId_testCaseId_idx" ON "ExperimentObservation"("runId", "measureId", "testCaseId");

-- CreateIndex
CREATE INDEX "ExperimentObservation_supersedesObservationId_idx" ON "ExperimentObservation"("supersedesObservationId");

-- CreateIndex
CREATE INDEX "ExperimentConclusion_experimentId_confirmedAt_id_idx" ON "ExperimentConclusion"("experimentId", "confirmedAt", "id");

-- CreateIndex
CREATE INDEX "ExperimentConclusion_aiRunId_idx" ON "ExperimentConclusion"("aiRunId");

-- CreateIndex
CREATE INDEX "ExperimentConclusion_confirmerId_confirmedAt_idx" ON "ExperimentConclusion"("confirmerId", "confirmedAt");

-- CreateIndex
CREATE INDEX "ResearchConclusion_researchId_confirmedAt_id_idx" ON "ResearchConclusion"("researchId", "confirmedAt", "id");

-- CreateIndex
CREATE INDEX "ResearchConclusion_aiRunId_idx" ON "ResearchConclusion"("aiRunId");

-- CreateIndex
CREATE INDEX "ResearchConclusion_confirmerId_confirmedAt_idx" ON "ResearchConclusion"("confirmerId", "confirmedAt");

-- CreateIndex
CREATE INDEX "AppliedLearning_researchId_confirmedAt_id_idx" ON "AppliedLearning"("researchId", "confirmedAt", "id");

-- CreateIndex
CREATE INDEX "AppliedLearning_researchConclusionId_idx" ON "AppliedLearning"("researchConclusionId");

-- CreateIndex
CREATE INDEX "AppliedLearning_targetKind_targetId_idx" ON "AppliedLearning"("targetKind", "targetId");

-- CreateIndex
CREATE INDEX "AppliedLearning_confirmerId_confirmedAt_idx" ON "AppliedLearning"("confirmerId", "confirmedAt");

-- CreateIndex
CREATE INDEX "ResearchEvidenceLink_evidenceId_evidenceRevisionId_idx" ON "ResearchEvidenceLink"("evidenceId", "evidenceRevisionId");

-- CreateIndex
CREATE INDEX "ResearchEvidenceLink_experimentId_idx" ON "ResearchEvidenceLink"("experimentId");

-- CreateIndex
CREATE INDEX "ResearchEvidenceLink_experimentRunId_idx" ON "ResearchEvidenceLink"("experimentRunId");

-- CreateIndex
CREATE INDEX "ResearchEvidenceLink_experimentConclusionId_idx" ON "ResearchEvidenceLink"("experimentConclusionId");

-- CreateIndex
CREATE INDEX "ResearchEvidenceLink_confirmerId_confirmedAt_idx" ON "ResearchEvidenceLink"("confirmerId", "confirmedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchEvidenceLink_researchId_evidenceRevisionId_supporte_key" ON "ResearchEvidenceLink"("researchId", "evidenceRevisionId", "supportedClaim");

-- AddForeignKey
ALTER TABLE "ResearchRecord" ADD CONSTRAINT "ResearchRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchRecord" ADD CONSTRAINT "ResearchRecord_workstreamId_projectId_fkey" FOREIGN KEY ("workstreamId", "projectId") REFERENCES "Workstream"("id", "projectId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchRecord" ADD CONSTRAINT "ResearchRecord_workItemId_projectId_fkey" FOREIGN KEY ("workItemId", "projectId") REFERENCES "WorkItem"("id", "projectId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchRecord" ADD CONSTRAINT "ResearchRecord_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchRevision" ADD CONSTRAINT "ResearchRevision_researchId_fkey" FOREIGN KEY ("researchId") REFERENCES "ResearchRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchRevision" ADD CONSTRAINT "ResearchRevision_aiRunId_fkey" FOREIGN KEY ("aiRunId") REFERENCES "AiRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchRevision" ADD CONSTRAINT "ResearchRevision_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchParticipantEvent" ADD CONSTRAINT "ResearchParticipantEvent_researchId_fkey" FOREIGN KEY ("researchId") REFERENCES "ResearchRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchParticipantEvent" ADD CONSTRAINT "ResearchParticipantEvent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchParticipantEvent" ADD CONSTRAINT "ResearchParticipantEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchTransition" ADD CONSTRAINT "ResearchTransition_researchId_fkey" FOREIGN KEY ("researchId") REFERENCES "ResearchRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchTransition" ADD CONSTRAINT "ResearchTransition_successorResearchId_fkey" FOREIGN KEY ("successorResearchId") REFERENCES "ResearchRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchTransition" ADD CONSTRAINT "ResearchTransition_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchSourceReview" ADD CONSTRAINT "ResearchSourceReview_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchSourceReview" ADD CONSTRAINT "ResearchSourceReview_workstreamId_projectId_fkey" FOREIGN KEY ("workstreamId", "projectId") REFERENCES "Workstream"("id", "projectId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchSourceReview" ADD CONSTRAINT "ResearchSourceReview_workItemId_projectId_fkey" FOREIGN KEY ("workItemId", "projectId") REFERENCES "WorkItem"("id", "projectId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchSourceReview" ADD CONSTRAINT "ResearchSourceReview_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchSourceReview" ADD CONSTRAINT "ResearchSourceReview_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchSourceReviewRevision" ADD CONSTRAINT "ResearchSourceReviewRevision_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "ResearchSourceReview"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchSourceReviewRevision" ADD CONSTRAINT "ResearchSourceReviewRevision_aiRunId_fkey" FOREIGN KEY ("aiRunId") REFERENCES "AiRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchSourceReviewRevision" ADD CONSTRAINT "ResearchSourceReviewRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchProposal" ADD CONSTRAINT "ResearchProposal_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "ResearchSourceReview"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchProposalTransition" ADD CONSTRAINT "ResearchProposalTransition_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "ResearchProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchProposalTransition" ADD CONSTRAINT "ResearchProposalTransition_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchSourceReference" ADD CONSTRAINT "ResearchSourceReference_researchId_fkey" FOREIGN KEY ("researchId") REFERENCES "ResearchRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchSourceReference" ADD CONSTRAINT "ResearchSourceReference_sourceReviewId_fkey" FOREIGN KEY ("sourceReviewId") REFERENCES "ResearchSourceReview"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchSourceReference" ADD CONSTRAINT "ResearchSourceReference_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchSourceReference" ADD CONSTRAINT "ResearchSourceReference_successorResearchId_fkey" FOREIGN KEY ("successorResearchId") REFERENCES "ResearchRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchSourceReference" ADD CONSTRAINT "ResearchSourceReference_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experiment" ADD CONSTRAINT "Experiment_researchId_fkey" FOREIGN KEY ("researchId") REFERENCES "ResearchRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experiment" ADD CONSTRAINT "Experiment_workstreamId_fkey" FOREIGN KEY ("workstreamId") REFERENCES "Workstream"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experiment" ADD CONSTRAINT "Experiment_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentMethodRevision" ADD CONSTRAINT "ExperimentMethodRevision_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentMethodRevision" ADD CONSTRAINT "ExperimentMethodRevision_aiRunId_fkey" FOREIGN KEY ("aiRunId") REFERENCES "AiRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentMethodRevision" ADD CONSTRAINT "ExperimentMethodRevision_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentMeasure" ADD CONSTRAINT "ExperimentMeasure_methodRevisionId_fkey" FOREIGN KEY ("methodRevisionId") REFERENCES "ExperimentMethodRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentTestCase" ADD CONSTRAINT "ExperimentTestCase_methodRevisionId_fkey" FOREIGN KEY ("methodRevisionId") REFERENCES "ExperimentMethodRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentControl" ADD CONSTRAINT "ExperimentControl_methodRevisionId_fkey" FOREIGN KEY ("methodRevisionId") REFERENCES "ExperimentMethodRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentRun" ADD CONSTRAINT "ExperimentRun_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentRun" ADD CONSTRAINT "ExperimentRun_methodRevisionId_fkey" FOREIGN KEY ("methodRevisionId") REFERENCES "ExperimentMethodRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentRun" ADD CONSTRAINT "ExperimentRun_executorId_fkey" FOREIGN KEY ("executorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentObservation" ADD CONSTRAINT "ExperimentObservation_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ExperimentRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentObservation" ADD CONSTRAINT "ExperimentObservation_measureId_fkey" FOREIGN KEY ("measureId") REFERENCES "ExperimentMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentObservation" ADD CONSTRAINT "ExperimentObservation_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "ExperimentTestCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentObservation" ADD CONSTRAINT "ExperimentObservation_supersedesObservationId_fkey" FOREIGN KEY ("supersedesObservationId") REFERENCES "ExperimentObservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentConclusion" ADD CONSTRAINT "ExperimentConclusion_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentConclusion" ADD CONSTRAINT "ExperimentConclusion_aiRunId_fkey" FOREIGN KEY ("aiRunId") REFERENCES "AiRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentConclusion" ADD CONSTRAINT "ExperimentConclusion_confirmerId_fkey" FOREIGN KEY ("confirmerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchConclusion" ADD CONSTRAINT "ResearchConclusion_researchId_fkey" FOREIGN KEY ("researchId") REFERENCES "ResearchRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchConclusion" ADD CONSTRAINT "ResearchConclusion_aiRunId_fkey" FOREIGN KEY ("aiRunId") REFERENCES "AiRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchConclusion" ADD CONSTRAINT "ResearchConclusion_confirmerId_fkey" FOREIGN KEY ("confirmerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppliedLearning" ADD CONSTRAINT "AppliedLearning_researchId_fkey" FOREIGN KEY ("researchId") REFERENCES "ResearchRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppliedLearning" ADD CONSTRAINT "AppliedLearning_researchConclusionId_fkey" FOREIGN KEY ("researchConclusionId") REFERENCES "ResearchConclusion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppliedLearning" ADD CONSTRAINT "AppliedLearning_targetResearchId_fkey" FOREIGN KEY ("targetResearchId") REFERENCES "ResearchRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppliedLearning" ADD CONSTRAINT "AppliedLearning_targetExperimentId_fkey" FOREIGN KEY ("targetExperimentId") REFERENCES "Experiment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppliedLearning" ADD CONSTRAINT "AppliedLearning_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppliedLearning" ADD CONSTRAINT "AppliedLearning_confirmerId_fkey" FOREIGN KEY ("confirmerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchEvidenceLink" ADD CONSTRAINT "ResearchEvidenceLink_researchId_fkey" FOREIGN KEY ("researchId") REFERENCES "ResearchRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchEvidenceLink" ADD CONSTRAINT "ResearchEvidenceLink_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "EvidenceRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchEvidenceLink" ADD CONSTRAINT "ResearchEvidenceLink_evidenceRevisionId_evidenceId_fkey" FOREIGN KEY ("evidenceRevisionId", "evidenceId") REFERENCES "EvidenceRevision"("id", "evidenceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchEvidenceLink" ADD CONSTRAINT "ResearchEvidenceLink_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchEvidenceLink" ADD CONSTRAINT "ResearchEvidenceLink_experimentRunId_fkey" FOREIGN KEY ("experimentRunId") REFERENCES "ExperimentRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchEvidenceLink" ADD CONSTRAINT "ResearchEvidenceLink_experimentConclusionId_fkey" FOREIGN KEY ("experimentConclusionId") REFERENCES "ExperimentConclusion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchEvidenceLink" ADD CONSTRAINT "ResearchEvidenceLink_confirmerId_fkey" FOREIGN KEY ("confirmerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Bounded version, provenance, normalized-list, and temporal invariants.
ALTER TABLE "ResearchRecord"
  ADD CONSTRAINT "ResearchRecord_revision_positive" CHECK ("revision" > 0),
  ADD CONSTRAINT "ResearchRecord_version_positive" CHECK ("version" > 0);

ALTER TABLE "ResearchRevision"
  ADD CONSTRAINT "ResearchRevision_revision_positive" CHECK ("revision" > 0),
  ADD CONSTRAINT "ResearchRevision_hypothesis_shape" CHECK (
    ("hypothesisKind" = 'TESTABLE' AND "hypothesisStatement" IS NOT NULL AND "noHypothesisReason" IS NULL)
    OR ("hypothesisKind" = 'NO_HYPOTHESIS' AND "hypothesisStatement" IS NULL AND "noHypothesisReason" IS NOT NULL)
  ),
  ADD CONSTRAINT "ResearchRevision_ai_provenance" CHECK (
    ("origin" = 'EMPLOYEE' AND "aiRunId" IS NULL AND "promptVersion" IS NULL AND "routeTrace" IS NULL)
    OR ("origin" = 'AI_DRAFT' AND "aiRunId" IS NOT NULL AND "promptVersion" IS NOT NULL AND "routeTrace" IS NOT NULL)
  ),
  ADD CONSTRAINT "ResearchRevision_lists" CHECK (
    jsonb_typeof("assumptions") = 'array'
    AND jsonb_typeof("constraints") = 'array'
    AND jsonb_typeof("knownUncertainty") = 'array'
    AND jsonb_typeof("alternatives") = 'array'
    AND jsonb_typeof("sourceReferences") = 'array'
  );

ALTER TABLE "ResearchTransition"
  ADD CONSTRAINT "ResearchTransition_resulting_version_positive" CHECK ("resultingVersion" > 0),
  ADD CONSTRAINT "ResearchTransition_reason_and_successor" CHECK (
    ("toState" NOT IN ('CANCELLED', 'SUPERSEDED') OR "reason" IS NOT NULL)
    AND ("toState" <> 'SUPERSEDED' OR "successorResearchId" IS NOT NULL)
  );

ALTER TABLE "ResearchSourceReview"
  ADD CONSTRAINT "ResearchSourceReview_version_positive" CHECK ("version" > 0),
  ADD CONSTRAINT "ResearchSourceReview_current_revision_nonnegative" CHECK ("currentRevision" >= 0),
  ADD CONSTRAINT "ResearchSourceReview_document_source" CHECK (
    ("sourceKind" = 'DOCUMENT_VERSION' AND "documentVersionId" IS NOT NULL)
    OR ("sourceKind" <> 'DOCUMENT_VERSION' AND "documentVersionId" IS NULL)
  );

ALTER TABLE "ResearchSourceReviewRevision"
  ADD CONSTRAINT "ResearchSourceReviewRevision_revision_positive" CHECK ("revision" > 0),
  ADD CONSTRAINT "ResearchSourceReviewRevision_citations_array" CHECK (jsonb_typeof("citations") = 'array'),
  ADD CONSTRAINT "ResearchSourceReviewRevision_ai_provenance" CHECK (
    ("aiRunId" IS NULL AND "schemaVersion" IS NULL AND "promptVersion" IS NULL AND "routeTrace" IS NULL)
    OR ("aiRunId" IS NOT NULL AND "schemaVersion" IS NOT NULL AND "promptVersion" IS NOT NULL AND "routeTrace" IS NOT NULL)
  );

ALTER TABLE "ResearchProposal"
  ADD CONSTRAINT "ResearchProposal_version_positive" CHECK ("version" > 0),
  ADD CONSTRAINT "ResearchProposal_sources_array" CHECK (jsonb_typeof("sourceReferences") = 'array');

ALTER TABLE "ResearchProposalTransition"
  ADD CONSTRAINT "ResearchProposalTransition_resulting_version_positive" CHECK ("resultingVersion" > 0);

ALTER TABLE "ResearchSourceReference"
  ADD CONSTRAINT "ResearchSourceReference_locations_array" CHECK (jsonb_typeof("citedLocations") = 'array'),
  ADD CONSTRAINT "ResearchSourceReference_terminal_reason" CHECK (
    ("state" = 'ACTIVE' AND "reason" IS NULL)
    OR ("state" IN ('RETRACTED', 'SUPERSEDED') AND "reason" IS NOT NULL)
  );

ALTER TABLE "Experiment"
  ADD CONSTRAINT "Experiment_method_revision_positive" CHECK ("methodRevision" > 0),
  ADD CONSTRAINT "Experiment_version_positive" CHECK ("version" > 0);

ALTER TABLE "ExperimentMethodRevision"
  ADD CONSTRAINT "ExperimentMethodRevision_revision_positive" CHECK ("revision" > 0),
  ADD CONSTRAINT "ExperimentMethodRevision_lists" CHECK (
    jsonb_typeof("conditions") = 'array'
    AND jsonb_typeof("knownRisks") = 'array'
    AND jsonb_typeof("failureCases") = 'array'
    AND jsonb_typeof("sourceReferences") = 'array'
  ),
  ADD CONSTRAINT "ExperimentMethodRevision_ai_provenance" CHECK (
    ("origin" = 'EMPLOYEE' AND "aiRunId" IS NULL AND "promptVersion" IS NULL AND "routeTrace" IS NULL)
    OR ("origin" = 'AI_DRAFT' AND "aiRunId" IS NOT NULL AND "promptVersion" IS NOT NULL AND "routeTrace" IS NOT NULL)
  );

ALTER TABLE "ExperimentMeasure"
  ADD CONSTRAINT "ExperimentMeasure_stable_id" CHECK ("stableId" ~ '^[a-z][a-z0-9_]*$');

ALTER TABLE "ExperimentControl"
  ADD CONSTRAINT "ExperimentControl_position_nonnegative" CHECK ("position" >= 0);

ALTER TABLE "ExperimentRun"
  ADD CONSTRAINT "ExperimentRun_sequence_positive" CHECK ("sequence" > 0),
  ADD CONSTRAINT "ExperimentRun_time_order" CHECK ("completedAt" >= "startedAt"),
  ADD CONSTRAINT "ExperimentRun_lists" CHECK (
    jsonb_typeof("environment") = 'array'
    AND jsonb_typeof("inputs") = 'array'
    AND jsonb_typeof("modelConfigurations") = 'array'
    AND jsonb_typeof("unexpectedConditions") = 'array'
    AND jsonb_typeof("sourceReferences") = 'array'
  );

ALTER TABLE "ExperimentObservation"
  ADD CONSTRAINT "ExperimentObservation_correction_shape" CHECK (
    ("supersedesObservationId" IS NULL AND "correctionReason" IS NULL)
    OR ("supersedesObservationId" IS NOT NULL AND "correctionReason" IS NOT NULL)
  );

ALTER TABLE "ExperimentConclusion"
  ADD CONSTRAINT "ExperimentConclusion_lists" CHECK (
    jsonb_typeof("runIds") = 'array'
    AND jsonb_array_length("runIds") > 0
    AND jsonb_typeof("measureStableIds") = 'array'
    AND jsonb_array_length("measureStableIds") > 0
    AND jsonb_typeof("limitations") = 'array'
  );

ALTER TABLE "ResearchConclusion"
  ADD CONSTRAINT "ResearchConclusion_lists" CHECK (
    jsonb_typeof("remainingUncertainty") = 'array'
    AND jsonb_typeof("sourceReferences") = 'array'
    AND jsonb_array_length("sourceReferences") > 0
    AND jsonb_typeof("experimentIds") = 'array'
  );

ALTER TABLE "AppliedLearning"
  ADD CONSTRAINT "AppliedLearning_target_shape" CHECK (
    ("targetKind" = 'RESEARCH' AND "targetResearchId" = "targetId" AND "targetExperimentId" IS NULL AND "documentVersionId" IS NULL)
    OR ("targetKind" = 'EXPERIMENT' AND "targetExperimentId" = "targetId" AND "targetResearchId" IS NULL AND "documentVersionId" IS NULL)
    OR ("targetKind" IN ('DOCUMENT_VERSION', 'KNOWLEDGE_TRANSFER') AND "documentVersionId" = "targetId" AND "targetResearchId" IS NULL AND "targetExperimentId" IS NULL)
    OR ("targetKind" IN ('WORK_ITEM', 'UPDATE', 'PROGRESS_CONTRACT_PROPOSAL', 'CRITERION_PROPOSAL') AND "targetResearchId" IS NULL AND "targetExperimentId" IS NULL AND "documentVersionId" IS NULL)
  );

-- Reuse the repository's established database-level append-only guard.
CREATE TRIGGER "ResearchRevision_append_only" BEFORE UPDATE OR DELETE ON "ResearchRevision" FOR EACH ROW EXECUTE FUNCTION "prevent_phase2_history_mutation"();
CREATE TRIGGER "ResearchParticipantEvent_append_only" BEFORE UPDATE OR DELETE ON "ResearchParticipantEvent" FOR EACH ROW EXECUTE FUNCTION "prevent_phase2_history_mutation"();
CREATE TRIGGER "ResearchTransition_append_only" BEFORE UPDATE OR DELETE ON "ResearchTransition" FOR EACH ROW EXECUTE FUNCTION "prevent_phase2_history_mutation"();
CREATE TRIGGER "ResearchSourceReviewRevision_append_only" BEFORE UPDATE OR DELETE ON "ResearchSourceReviewRevision" FOR EACH ROW EXECUTE FUNCTION "prevent_phase2_history_mutation"();
CREATE TRIGGER "ResearchProposalTransition_append_only" BEFORE UPDATE OR DELETE ON "ResearchProposalTransition" FOR EACH ROW EXECUTE FUNCTION "prevent_phase2_history_mutation"();
CREATE TRIGGER "ExperimentMethodRevision_append_only" BEFORE UPDATE OR DELETE ON "ExperimentMethodRevision" FOR EACH ROW EXECUTE FUNCTION "prevent_phase2_history_mutation"();
CREATE TRIGGER "ExperimentMeasure_append_only" BEFORE UPDATE OR DELETE ON "ExperimentMeasure" FOR EACH ROW EXECUTE FUNCTION "prevent_phase2_history_mutation"();
CREATE TRIGGER "ExperimentTestCase_append_only" BEFORE UPDATE OR DELETE ON "ExperimentTestCase" FOR EACH ROW EXECUTE FUNCTION "prevent_phase2_history_mutation"();
CREATE TRIGGER "ExperimentControl_append_only" BEFORE UPDATE OR DELETE ON "ExperimentControl" FOR EACH ROW EXECUTE FUNCTION "prevent_phase2_history_mutation"();
CREATE TRIGGER "ExperimentRun_append_only" BEFORE UPDATE OR DELETE ON "ExperimentRun" FOR EACH ROW EXECUTE FUNCTION "prevent_phase2_history_mutation"();
CREATE TRIGGER "ExperimentObservation_append_only" BEFORE UPDATE OR DELETE ON "ExperimentObservation" FOR EACH ROW EXECUTE FUNCTION "prevent_phase2_history_mutation"();
CREATE TRIGGER "ExperimentConclusion_append_only" BEFORE UPDATE OR DELETE ON "ExperimentConclusion" FOR EACH ROW EXECUTE FUNCTION "prevent_phase2_history_mutation"();
CREATE TRIGGER "ResearchConclusion_append_only" BEFORE UPDATE OR DELETE ON "ResearchConclusion" FOR EACH ROW EXECUTE FUNCTION "prevent_phase2_history_mutation"();
CREATE TRIGGER "AppliedLearning_append_only" BEFORE UPDATE OR DELETE ON "AppliedLearning" FOR EACH ROW EXECUTE FUNCTION "prevent_phase2_history_mutation"();
CREATE TRIGGER "ResearchEvidenceLink_append_only" BEFORE UPDATE OR DELETE ON "ResearchEvidenceLink" FOR EACH ROW EXECUTE FUNCTION "prevent_phase2_history_mutation"();

-- Research source lifecycle rows are history. Retraction and supersession append
-- new source-state rows; neither operation rewrites the cited source record.
CREATE TRIGGER "ResearchSourceReference_append_only"
BEFORE UPDATE OR DELETE ON "ResearchSourceReference"
FOR EACH ROW EXECUTE FUNCTION "prevent_phase2_history_mutation"();

-- A run must pin a method revision owned by the same Experiment.
CREATE FUNCTION "validate_experiment_run_lineage"() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "ExperimentMethodRevision" method
    WHERE method."id" = NEW."methodRevisionId"
      AND method."experimentId" = NEW."experimentId"
  ) THEN
    RAISE EXCEPTION 'Experiment Run lineage foreign key constraint violated'
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ExperimentRun_validate_lineage"
BEFORE INSERT ON "ExperimentRun"
FOR EACH ROW EXECUTE FUNCTION "validate_experiment_run_lineage"();

-- Observations must use the run's pinned method, including optional test cases.
-- A corrected observation may supersede only an observation from the same run,
-- measure, and test case; a new run remains the correction path across runs.
CREATE FUNCTION "validate_experiment_observation_lineage"() RETURNS trigger AS $$
DECLARE
  pinned_method_id UUID;
BEGIN
  SELECT run."methodRevisionId" INTO pinned_method_id
  FROM "ExperimentRun" run
  WHERE run."id" = NEW."runId";

  IF pinned_method_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM "ExperimentMeasure" measure
    WHERE measure."id" = NEW."measureId"
      AND measure."methodRevisionId" = pinned_method_id
  ) THEN
    RAISE EXCEPTION 'Experiment Observation measure lineage foreign key constraint violated'
      USING ERRCODE = '23503';
  END IF;

  IF NEW."testCaseId" IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM "ExperimentTestCase" test_case
    WHERE test_case."id" = NEW."testCaseId"
      AND test_case."methodRevisionId" = pinned_method_id
  ) THEN
    RAISE EXCEPTION 'Experiment Observation test-case lineage foreign key constraint violated'
      USING ERRCODE = '23503';
  END IF;

  IF NEW."supersedesObservationId" IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM "ExperimentObservation" previous
    WHERE previous."id" = NEW."supersedesObservationId"
      AND previous."runId" = NEW."runId"
      AND previous."measureId" = NEW."measureId"
      AND previous."testCaseId" IS NOT DISTINCT FROM NEW."testCaseId"
  ) THEN
    RAISE EXCEPTION 'Experiment Observation supersession lineage foreign key constraint violated'
      USING ERRCODE = '23503';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ExperimentObservation_validate_lineage"
BEFORE INSERT ON "ExperimentObservation"
FOR EACH ROW EXECUTE FUNCTION "validate_experiment_observation_lineage"();

-- Applied Learning keeps its conclusion and every concrete target inside the
-- source Research Project.
CREATE FUNCTION "validate_applied_learning_lineage"() RETURNS trigger AS $$
DECLARE
  source_project_id UUID;
BEGIN
  SELECT research."projectId" INTO source_project_id
  FROM "ResearchRecord" research
  WHERE research."id" = NEW."researchId";

  IF source_project_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM "ResearchConclusion" conclusion
    WHERE conclusion."id" = NEW."researchConclusionId"
      AND conclusion."researchId" = NEW."researchId"
  ) THEN
    RAISE EXCEPTION 'Applied Learning conclusion lineage foreign key constraint violated'
      USING ERRCODE = '23503';
  END IF;

  IF NEW."targetKind" = 'RESEARCH' AND NOT EXISTS (
    SELECT 1 FROM "ResearchRecord" target
    WHERE target."id" = NEW."targetResearchId"
      AND target."id" = NEW."targetId"
      AND target."projectId" = source_project_id
  ) THEN
    RAISE EXCEPTION 'Applied Learning Research target foreign key constraint violated'
      USING ERRCODE = '23503';
  END IF;

  IF NEW."targetKind" = 'EXPERIMENT' AND NOT EXISTS (
    SELECT 1
    FROM "Experiment" target
    JOIN "ResearchRecord" target_research ON target_research."id" = target."researchId"
    WHERE target."id" = NEW."targetExperimentId"
      AND target."id" = NEW."targetId"
      AND target_research."projectId" = source_project_id
  ) THEN
    RAISE EXCEPTION 'Applied Learning Experiment target foreign key constraint violated'
      USING ERRCODE = '23503';
  END IF;

  IF NEW."targetKind" = 'WORK_ITEM' AND NOT EXISTS (
    SELECT 1 FROM "WorkItem" target
    WHERE target."id" = NEW."targetId"
      AND target."projectId" = source_project_id
  ) THEN
    RAISE EXCEPTION 'Applied Learning Work Item target foreign key constraint violated'
      USING ERRCODE = '23503';
  END IF;

  IF NEW."targetKind" = 'UPDATE' AND NOT EXISTS (
    SELECT 1 FROM "AcceptedUpdateEvent" target
    WHERE target."id" = NEW."targetId"
      AND target."projectId" = source_project_id
  ) THEN
    RAISE EXCEPTION 'Applied Learning Update target foreign key constraint violated'
      USING ERRCODE = '23503';
  END IF;

  IF NEW."targetKind" IN ('DOCUMENT_VERSION', 'KNOWLEDGE_TRANSFER') AND NOT EXISTS (
    SELECT 1
    FROM "DocumentVersion" version
    JOIN "DocumentRecord" document ON document."id" = version."documentId"
    LEFT JOIN "Workstream" workstream ON workstream."id" = document."workstreamId"
    WHERE version."id" = NEW."documentVersionId"
      AND version."id" = NEW."targetId"
      AND COALESCE(document."projectId", workstream."projectId") = source_project_id
  ) THEN
    RAISE EXCEPTION 'Applied Learning Document target foreign key constraint violated'
      USING ERRCODE = '23503';
  END IF;

  IF NEW."targetKind" = 'PROGRESS_CONTRACT_PROPOSAL' AND NOT EXISTS (
    SELECT 1 FROM "ProgressContractAiDraftRequest" target
    WHERE target."id" = NEW."targetId"
      AND target."projectId" = source_project_id
  ) THEN
    RAISE EXCEPTION 'Applied Learning Progress proposal foreign key constraint violated'
      USING ERRCODE = '23503';
  END IF;

  IF NEW."targetKind" = 'CRITERION_PROPOSAL' AND NOT EXISTS (
    SELECT 1
    FROM "DynamicCriteriaProposal" target
    LEFT JOIN "Workstream" workstream ON workstream."id" = target."workstreamId"
    WHERE target."id" = NEW."targetId"
      AND COALESCE(target."projectId", workstream."projectId") = source_project_id
  ) THEN
    RAISE EXCEPTION 'Applied Learning Criterion proposal foreign key constraint violated'
      USING ERRCODE = '23503';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AppliedLearning_validate_lineage"
BEFORE INSERT ON "AppliedLearning"
FOR EACH ROW EXECUTE FUNCTION "validate_applied_learning_lineage"();

-- Confirmed Evidence support must stay in the Research Project. Optional
-- Experiment, Run, and Experiment Conclusion IDs must form one lineage.
CREATE FUNCTION "validate_research_evidence_link_lineage"() RETURNS trigger AS $$
DECLARE
  research_project_id UUID;
BEGIN
  SELECT research."projectId" INTO research_project_id
  FROM "ResearchRecord" research
  WHERE research."id" = NEW."researchId";

  IF research_project_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM "EvidenceRecord" evidence
    WHERE evidence."id" = NEW."evidenceId"
      AND evidence."projectId" = research_project_id
  ) THEN
    RAISE EXCEPTION 'Research Evidence Project lineage foreign key constraint violated'
      USING ERRCODE = '23503';
  END IF;

  IF NEW."experimentId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "Experiment" experiment
    WHERE experiment."id" = NEW."experimentId"
      AND experiment."researchId" = NEW."researchId"
  ) THEN
    RAISE EXCEPTION 'Research Evidence Experiment lineage foreign key constraint violated'
      USING ERRCODE = '23503';
  END IF;

  IF NEW."experimentRunId" IS NOT NULL AND (
    NEW."experimentId" IS NULL OR NOT EXISTS (
      SELECT 1 FROM "ExperimentRun" run
      WHERE run."id" = NEW."experimentRunId"
        AND run."experimentId" = NEW."experimentId"
    )
  ) THEN
    RAISE EXCEPTION 'Research Evidence Run lineage foreign key constraint violated'
      USING ERRCODE = '23503';
  END IF;

  IF NEW."experimentConclusionId" IS NOT NULL AND (
    NEW."experimentId" IS NULL OR NOT EXISTS (
      SELECT 1 FROM "ExperimentConclusion" conclusion
      WHERE conclusion."id" = NEW."experimentConclusionId"
        AND conclusion."experimentId" = NEW."experimentId"
    )
  ) THEN
    RAISE EXCEPTION 'Research Evidence Experiment conclusion lineage foreign key constraint violated'
      USING ERRCODE = '23503';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ResearchEvidenceLink_validate_lineage"
BEFORE INSERT ON "ResearchEvidenceLink"
FOR EACH ROW EXECUTE FUNCTION "validate_research_evidence_link_lineage"();

-- Persisted source-review output and AI provenance are all-or-none. Pending,
-- blocked, and other non-output revisions retain a fully absent tuple.
ALTER TABLE "ResearchSourceReviewRevision"
DROP CONSTRAINT "ResearchSourceReviewRevision_ai_provenance",
ADD CONSTRAINT "ResearchSourceReviewRevision_ai_provenance" CHECK (
  (
    "sealedOutput" IS NULL
    AND "outputFragments" IS NULL
    AND "aiRunId" IS NULL
    AND "schemaVersion" IS NULL
    AND "promptVersion" IS NULL
    AND "routeTrace" IS NULL
  )
  OR (
    ("sealedOutput" IS NOT NULL OR "outputFragments" IS NOT NULL)
    AND "aiRunId" IS NOT NULL
    AND "schemaVersion" IS NOT NULL
    AND "promptVersion" IS NOT NULL
    AND "routeTrace" IS NOT NULL
  )
);
