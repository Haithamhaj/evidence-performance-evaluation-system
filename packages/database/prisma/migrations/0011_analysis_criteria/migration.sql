-- CreateEnum
CREATE TYPE "DocumentAnalysisKind" AS ENUM ('readiness', 'comparison', 'criteria_project', 'criteria_workstream');

-- CreateEnum
CREATE TYPE "DocumentAnalysisRequestState" AS ENUM ('queued', 'running', 'succeeded', 'failed', 'superseded');

-- CreateEnum
CREATE TYPE "DocumentReadinessAnalysisState" AS ENUM ('incomplete', 'ready_for_criteria_generation');

-- CreateEnum
CREATE TYPE "DocumentReadinessLifecycleState" AS ENUM ('draft', 'incomplete', 'ready_for_criteria_generation', 'criteria_approved', 'revision_required', 'superseded');

-- CreateEnum
CREATE TYPE "ManagerReadinessState" AS ENUM ('ready', 'needs_attention', 'missing_critical_information');

-- CreateEnum
CREATE TYPE "ExtractionCoverage" AS ENUM ('complete', 'partial', 'unsupported', 'failed');

-- CreateEnum
CREATE TYPE "AnalysisValidationOutcome" AS ENUM ('valid', 'invalid');

-- CreateEnum
CREATE TYPE "MaterialChangeClassification" AS ENUM ('editorial', 'routine_execution_update', 'material_scope_or_goal_change');

-- CreateEnum
CREATE TYPE "DynamicCriteriaKind" AS ENUM ('project', 'workstream');

-- CreateEnum
CREATE TYPE "DynamicCriteriaProposalState" AS ENUM ('owner_review', 'contributor_review', 'manager_resolution', 'approved', 'rejected', 'superseded', 'activated');

-- CreateEnum
CREATE TYPE "CriteriaReviewRole" AS ENUM ('owner', 'contributor');

-- CreateEnum
CREATE TYPE "CriteriaContributorResponseKind" AS ENUM ('acknowledge', 'object');

-- CreateEnum
CREATE TYPE "CriteriaManagerDecision" AS ENUM ('request_revision', 'accept_with_objections');

-- CreateEnum
CREATE TYPE "DynamicCriteriaSetTransitionKind" AS ENUM ('activated', 'retired');

-- CreateTable
CREATE TABLE "AnalysisPromptArtifact" (
    "id" UUID NOT NULL,
    "routeKey" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "bodyHash" TEXT NOT NULL,
    "trustedBody" TEXT NOT NULL,
    "expectedBehavior" TEXT NOT NULL,
    "registeredById" UUID NOT NULL,
    "registrationReason" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisPromptArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentAnalysisRequest" (
    "id" UUID NOT NULL,
    "kind" "DocumentAnalysisKind" NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "routeKey" TEXT NOT NULL,
    "documentId" UUID NOT NULL,
    "currentDocumentVersionId" UUID,
    "beforeVersionId" UUID,
    "afterVersionId" UUID,
    "pinnedReadinessCheckId" UUID,
    "pinnedProposalId" UUID,
    "expectedAggregateVersion" INTEGER NOT NULL,
    "outputSchemaArtifactId" UUID NOT NULL,
    "outputSchemaVersion" TEXT NOT NULL,
    "outputSchemaHash" TEXT NOT NULL,
    "promptArtifactId" UUID NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "promptHash" TEXT NOT NULL,
    "state" "DocumentAnalysisRequestState" NOT NULL DEFAULT 'queued',
    "operationId" UUID NOT NULL,
    "resultReference" TEXT,
    "errorCode" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "DocumentAnalysisRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentReadinessCheck" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "documentVersionId" UUID NOT NULL,
    "templateVersionId" UUID NOT NULL,
    "analyzedState" "DocumentReadinessAnalysisState" NOT NULL,
    "managerState" "ManagerReadinessState" NOT NULL,
    "extractionCoverage" "ExtractionCoverage" NOT NULL,
    "output" JSONB NOT NULL,
    "outputReference" TEXT NOT NULL,
    "inputSchemaVersion" TEXT NOT NULL,
    "outputSchemaVersion" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "promptHash" TEXT NOT NULL,
    "validationOutcome" "AnalysisValidationOutcome" NOT NULL,
    "stale" BOOLEAN NOT NULL DEFAULT false,
    "sourceReferences" JSONB NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentReadinessCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentReadinessLifecycleTransition" (
    "id" UUID NOT NULL,
    "readinessCheckId" UUID NOT NULL,
    "documentVersionId" UUID NOT NULL,
    "fromState" "DocumentReadinessLifecycleState" NOT NULL,
    "toState" "DocumentReadinessLifecycleState" NOT NULL,
    "actorId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "effectiveAt" TIMESTAMPTZ(6) NOT NULL,
    "criteriaSetId" UUID,
    "comparisonReviewId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentReadinessLifecycleTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentComparison" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "beforeVersionId" UUID NOT NULL,
    "afterVersionId" UUID NOT NULL,
    "aiClassification" "MaterialChangeClassification" NOT NULL,
    "output" JSONB NOT NULL,
    "outputReference" TEXT NOT NULL,
    "inputSchemaVersion" TEXT NOT NULL,
    "outputSchemaVersion" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "promptHash" TEXT NOT NULL,
    "validationOutcome" "AnalysisValidationOutcome" NOT NULL,
    "stale" BOOLEAN NOT NULL DEFAULT false,
    "sourceReferences" JSONB NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentComparison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentComparisonReview" (
    "id" UUID NOT NULL,
    "comparisonId" UUID NOT NULL,
    "effectiveClassification" "MaterialChangeClassification" NOT NULL,
    "reviewerId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentComparisonReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DynamicCriteriaProposal" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "kind" "DynamicCriteriaKind" NOT NULL,
    "projectId" UUID,
    "workstreamId" UUID,
    "sourceDocumentVersionId" UUID NOT NULL,
    "readinessCheckId" UUID NOT NULL,
    "materialComparisonReviewId" UUID,
    "priorSetId" UUID,
    "replacesProposalId" UUID,
    "proposalNumber" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "state" "DynamicCriteriaProposalState" NOT NULL DEFAULT 'owner_review',
    "outputReference" TEXT NOT NULL,
    "outputSchemaVersion" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "promptHash" TEXT NOT NULL,
    "createdById" UUID NOT NULL,
    "approvedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "DynamicCriteriaProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DynamicCriteriaProposalItem" (
    "id" UUID NOT NULL,
    "proposalId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "selectionReason" TEXT NOT NULL,
    "successLink" TEXT NOT NULL,
    "expectedBehaviorOrResult" TEXT NOT NULL,
    "evaluationMethod" TEXT NOT NULL,
    "suggestedEvidence" JSONB NOT NULL,
    "sourceReferences" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DynamicCriteriaProposalItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DynamicCriteriaProposalTransition" (
    "id" UUID NOT NULL,
    "proposalId" UUID NOT NULL,
    "fromState" "DynamicCriteriaProposalState" NOT NULL,
    "toState" "DynamicCriteriaProposalState" NOT NULL,
    "actorId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "resultingVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DynamicCriteriaProposalTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CriteriaReviewSnapshot" (
    "id" UUID NOT NULL,
    "proposalId" UUID NOT NULL,
    "primaryOwnerId" UUID NOT NULL,
    "responsibilityAt" TIMESTAMPTZ(6) NOT NULL,
    "publishedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CriteriaReviewSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CriteriaReviewEligibility" (
    "id" UUID NOT NULL,
    "snapshotId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "role" "CriteriaReviewRole" NOT NULL,
    "responseRequired" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CriteriaReviewEligibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CriteriaContributorResponse" (
    "id" UUID NOT NULL,
    "proposalId" UUID NOT NULL,
    "snapshotId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "responseRequired" BOOLEAN NOT NULL DEFAULT true,
    "response" "CriteriaContributorResponseKind" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CriteriaContributorResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CriteriaManagerResolution" (
    "id" UUID NOT NULL,
    "proposalId" UUID NOT NULL,
    "decision" "CriteriaManagerDecision" NOT NULL,
    "reason" TEXT NOT NULL,
    "actorId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CriteriaManagerResolution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DynamicCriteriaSet" (
    "id" UUID NOT NULL,
    "kind" "DynamicCriteriaKind" NOT NULL,
    "projectId" UUID,
    "workstreamId" UUID,
    "version" INTEGER NOT NULL,
    "sourceDocumentVersionId" UUID NOT NULL,
    "proposalId" UUID NOT NULL,
    "priorSetId" UUID,
    "approvedAt" TIMESTAMPTZ(6) NOT NULL,
    "effectiveFrom" TIMESTAMPTZ(6) NOT NULL,
    "effectiveTo" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DynamicCriteriaSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DynamicCriterion" (
    "id" UUID NOT NULL,
    "criteriaSetId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "selectionReason" TEXT NOT NULL,
    "successLink" TEXT NOT NULL,
    "expectedBehaviorOrResult" TEXT NOT NULL,
    "evaluationMethod" TEXT NOT NULL,
    "suggestedEvidence" JSONB NOT NULL,
    "sourceReferences" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DynamicCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DynamicCriteriaSetTransition" (
    "id" UUID NOT NULL,
    "criteriaSetId" UUID NOT NULL,
    "kind" "DynamicCriteriaSetTransitionKind" NOT NULL,
    "effectiveAt" TIMESTAMPTZ(6) NOT NULL,
    "actorId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DynamicCriteriaSetTransition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalysisPromptArtifact_bodyHash_idx" ON "AnalysisPromptArtifact"("bodyHash");

-- CreateIndex
CREATE INDEX "AnalysisPromptArtifact_registeredById_createdAt_idx" ON "AnalysisPromptArtifact"("registeredById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisPromptArtifact_routeKey_version_key" ON "AnalysisPromptArtifact"("routeKey", "version");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisPromptArtifact_id_routeKey_version_bodyHash_key" ON "AnalysisPromptArtifact"("id", "routeKey", "version", "bodyHash");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentAnalysisRequest_idempotencyKey_key" ON "DocumentAnalysisRequest"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentAnalysisRequest_operationId_key" ON "DocumentAnalysisRequest"("operationId");

-- CreateIndex
CREATE INDEX "DocumentAnalysisRequest_documentId_kind_state_createdAt_idx" ON "DocumentAnalysisRequest"("documentId", "kind", "state", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentAnalysisRequest_state_createdAt_idx" ON "DocumentAnalysisRequest"("state", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentAnalysisRequest_currentDocumentVersionId_idx" ON "DocumentAnalysisRequest"("currentDocumentVersionId");

-- CreateIndex
CREATE INDEX "DocumentAnalysisRequest_beforeVersionId_afterVersionId_idx" ON "DocumentAnalysisRequest"("beforeVersionId", "afterVersionId");

-- CreateIndex
CREATE INDEX "DocumentAnalysisRequest_pinnedReadinessCheckId_idx" ON "DocumentAnalysisRequest"("pinnedReadinessCheckId");

-- CreateIndex
CREATE INDEX "DocumentAnalysisRequest_pinnedProposalId_idx" ON "DocumentAnalysisRequest"("pinnedProposalId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentReadinessCheck_requestId_key" ON "DocumentReadinessCheck"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentReadinessCheck_outputReference_key" ON "DocumentReadinessCheck"("outputReference");

-- CreateIndex
CREATE INDEX "DocumentReadinessCheck_documentId_documentVersionId_created_idx" ON "DocumentReadinessCheck"("documentId", "documentVersionId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "DocumentReadinessCheck_documentVersionId_stale_createdAt_idx" ON "DocumentReadinessCheck"("documentVersionId", "stale", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "DocumentReadinessCheck_analyzedState_stale_createdAt_idx" ON "DocumentReadinessCheck"("analyzedState", "stale", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentReadinessLifecycleTransition_documentVersionId_effe_idx" ON "DocumentReadinessLifecycleTransition"("documentVersionId", "effectiveAt", "id");

-- CreateIndex
CREATE INDEX "DocumentReadinessLifecycleTransition_readinessCheckId_effec_idx" ON "DocumentReadinessLifecycleTransition"("readinessCheckId", "effectiveAt", "id");

-- CreateIndex
CREATE INDEX "DocumentReadinessLifecycleTransition_criteriaSetId_idx" ON "DocumentReadinessLifecycleTransition"("criteriaSetId");

-- CreateIndex
CREATE INDEX "DocumentReadinessLifecycleTransition_comparisonReviewId_idx" ON "DocumentReadinessLifecycleTransition"("comparisonReviewId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentComparison_requestId_key" ON "DocumentComparison"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentComparison_outputReference_key" ON "DocumentComparison"("outputReference");

-- CreateIndex
CREATE INDEX "DocumentComparison_documentId_afterVersionId_createdAt_idx" ON "DocumentComparison"("documentId", "afterVersionId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "DocumentComparison_beforeVersionId_afterVersionId_idx" ON "DocumentComparison"("beforeVersionId", "afterVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentComparison_documentId_beforeVersionId_afterVersionI_key" ON "DocumentComparison"("documentId", "beforeVersionId", "afterVersionId", "promptVersion", "outputSchemaVersion");

-- CreateIndex
CREATE INDEX "DocumentComparisonReview_reviewerId_createdAt_idx" ON "DocumentComparisonReview"("reviewerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentComparisonReview_comparisonId_key" ON "DocumentComparisonReview"("comparisonId");

-- CreateIndex
CREATE UNIQUE INDEX "DynamicCriteriaProposal_outputReference_key" ON "DynamicCriteriaProposal"("outputReference");

-- CreateIndex
CREATE UNIQUE INDEX "DynamicCriteriaProposal_requestId_key" ON "DynamicCriteriaProposal"("requestId");

-- CreateIndex
CREATE INDEX "DynamicCriteriaProposal_projectId_state_createdAt_idx" ON "DynamicCriteriaProposal"("projectId", "state", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "DynamicCriteriaProposal_workstreamId_state_createdAt_idx" ON "DynamicCriteriaProposal"("workstreamId", "state", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "DynamicCriteriaProposal_sourceDocumentVersionId_idx" ON "DynamicCriteriaProposal"("sourceDocumentVersionId");

-- CreateIndex
CREATE INDEX "DynamicCriteriaProposal_priorSetId_idx" ON "DynamicCriteriaProposal"("priorSetId");

-- CreateIndex
CREATE INDEX "DynamicCriteriaProposal_replacesProposalId_idx" ON "DynamicCriteriaProposal"("replacesProposalId");

-- CreateIndex
CREATE UNIQUE INDEX "DynamicCriteriaProposal_projectId_proposalNumber_key" ON "DynamicCriteriaProposal"("projectId", "proposalNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DynamicCriteriaProposal_workstreamId_proposalNumber_key" ON "DynamicCriteriaProposal"("workstreamId", "proposalNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DynamicCriteriaProposalItem_proposalId_position_key" ON "DynamicCriteriaProposalItem"("proposalId", "position");

-- CreateIndex
CREATE INDEX "DynamicCriteriaProposalTransition_proposalId_createdAt_id_idx" ON "DynamicCriteriaProposalTransition"("proposalId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "DynamicCriteriaProposalTransition_actorId_createdAt_idx" ON "DynamicCriteriaProposalTransition"("actorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DynamicCriteriaProposalTransition_proposalId_resultingVersi_key" ON "DynamicCriteriaProposalTransition"("proposalId", "resultingVersion");

-- CreateIndex
CREATE UNIQUE INDEX "CriteriaReviewSnapshot_proposalId_key" ON "CriteriaReviewSnapshot"("proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "CriteriaReviewSnapshot_id_proposalId_key" ON "CriteriaReviewSnapshot"("id", "proposalId");

-- CreateIndex
CREATE INDEX "CriteriaReviewSnapshot_primaryOwnerId_publishedAt_idx" ON "CriteriaReviewSnapshot"("primaryOwnerId", "publishedAt");

-- CreateIndex
CREATE INDEX "CriteriaReviewEligibility_snapshotId_responseRequired_emplo_idx" ON "CriteriaReviewEligibility"("snapshotId", "responseRequired", "employeeId");

-- CreateIndex
CREATE INDEX "CriteriaReviewEligibility_employeeId_createdAt_idx" ON "CriteriaReviewEligibility"("employeeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CriteriaReviewEligibility_snapshotId_employeeId_key" ON "CriteriaReviewEligibility"("snapshotId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "CriteriaReviewEligibility_snapshotId_employeeId_responseReq_key" ON "CriteriaReviewEligibility"("snapshotId", "employeeId", "responseRequired");

-- CreateIndex
CREATE INDEX "CriteriaContributorResponse_proposalId_response_createdAt_idx" ON "CriteriaContributorResponse"("proposalId", "response", "createdAt");

-- CreateIndex
CREATE INDEX "CriteriaContributorResponse_employeeId_createdAt_idx" ON "CriteriaContributorResponse"("employeeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CriteriaContributorResponse_snapshotId_employeeId_key" ON "CriteriaContributorResponse"("snapshotId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "CriteriaManagerResolution_proposalId_key" ON "CriteriaManagerResolution"("proposalId");

-- CreateIndex
CREATE INDEX "CriteriaManagerResolution_actorId_createdAt_idx" ON "CriteriaManagerResolution"("actorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DynamicCriteriaSet_proposalId_key" ON "DynamicCriteriaSet"("proposalId");

-- CreateIndex
CREATE INDEX "DynamicCriteriaSet_projectId_effectiveFrom_effectiveTo_idx" ON "DynamicCriteriaSet"("projectId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "DynamicCriteriaSet_workstreamId_effectiveFrom_effectiveTo_idx" ON "DynamicCriteriaSet"("workstreamId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "DynamicCriteriaSet_sourceDocumentVersionId_idx" ON "DynamicCriteriaSet"("sourceDocumentVersionId");

-- CreateIndex
CREATE INDEX "DynamicCriteriaSet_priorSetId_idx" ON "DynamicCriteriaSet"("priorSetId");

-- CreateIndex
CREATE UNIQUE INDEX "DynamicCriteriaSet_projectId_version_key" ON "DynamicCriteriaSet"("projectId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "DynamicCriteriaSet_workstreamId_version_key" ON "DynamicCriteriaSet"("workstreamId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "DynamicCriterion_criteriaSetId_position_key" ON "DynamicCriterion"("criteriaSetId", "position");

-- CreateIndex
CREATE INDEX "DynamicCriteriaSetTransition_criteriaSetId_effectiveAt_id_idx" ON "DynamicCriteriaSetTransition"("criteriaSetId", "effectiveAt", "id");

-- CreateIndex
CREATE INDEX "DynamicCriteriaSetTransition_actorId_createdAt_idx" ON "DynamicCriteriaSetTransition"("actorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DynamicCriteriaSetTransition_criteriaSetId_kind_key" ON "DynamicCriteriaSetTransition"("criteriaSetId", "kind");

-- AddForeignKey
ALTER TABLE "AnalysisPromptArtifact" ADD CONSTRAINT "AnalysisPromptArtifact_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAnalysisRequest" ADD CONSTRAINT "DocumentAnalysisRequest_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "DocumentRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAnalysisRequest" ADD CONSTRAINT "DocumentAnalysisRequest_currentDocumentVersionId_fkey" FOREIGN KEY ("currentDocumentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAnalysisRequest" ADD CONSTRAINT "DocumentAnalysisRequest_beforeVersionId_fkey" FOREIGN KEY ("beforeVersionId") REFERENCES "DocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAnalysisRequest" ADD CONSTRAINT "DocumentAnalysisRequest_afterVersionId_fkey" FOREIGN KEY ("afterVersionId") REFERENCES "DocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAnalysisRequest" ADD CONSTRAINT "DocumentAnalysisRequest_promptArtifactId_routeKey_promptVe_fkey" FOREIGN KEY ("promptArtifactId", "routeKey", "promptVersion", "promptHash") REFERENCES "AnalysisPromptArtifact"("id", "routeKey", "version", "bodyHash") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAnalysisRequest" ADD CONSTRAINT "DocumentAnalysisRequest_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentReadinessCheck" ADD CONSTRAINT "DocumentReadinessCheck_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "DocumentAnalysisRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentReadinessCheck" ADD CONSTRAINT "DocumentReadinessCheck_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "DocumentRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentReadinessCheck" ADD CONSTRAINT "DocumentReadinessCheck_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentReadinessCheck" ADD CONSTRAINT "DocumentReadinessCheck_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "DocumentTemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentReadinessCheck" ADD CONSTRAINT "DocumentReadinessCheck_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentReadinessLifecycleTransition" ADD CONSTRAINT "DocumentReadinessLifecycleTransition_readinessCheckId_fkey" FOREIGN KEY ("readinessCheckId") REFERENCES "DocumentReadinessCheck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentReadinessLifecycleTransition" ADD CONSTRAINT "DocumentReadinessLifecycleTransition_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentReadinessLifecycleTransition" ADD CONSTRAINT "DocumentReadinessLifecycleTransition_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentComparison" ADD CONSTRAINT "DocumentComparison_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "DocumentAnalysisRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentComparison" ADD CONSTRAINT "DocumentComparison_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "DocumentRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentComparison" ADD CONSTRAINT "DocumentComparison_beforeVersionId_fkey" FOREIGN KEY ("beforeVersionId") REFERENCES "DocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentComparison" ADD CONSTRAINT "DocumentComparison_afterVersionId_fkey" FOREIGN KEY ("afterVersionId") REFERENCES "DocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentComparison" ADD CONSTRAINT "DocumentComparison_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentComparisonReview" ADD CONSTRAINT "DocumentComparisonReview_comparisonId_fkey" FOREIGN KEY ("comparisonId") REFERENCES "DocumentComparison"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentComparisonReview" ADD CONSTRAINT "DocumentComparisonReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DynamicCriteriaProposal" ADD CONSTRAINT "DynamicCriteriaProposal_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "DocumentAnalysisRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DynamicCriteriaProposal" ADD CONSTRAINT "DynamicCriteriaProposal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DynamicCriteriaProposal" ADD CONSTRAINT "DynamicCriteriaProposal_workstreamId_fkey" FOREIGN KEY ("workstreamId") REFERENCES "Workstream"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DynamicCriteriaProposal" ADD CONSTRAINT "DynamicCriteriaProposal_sourceDocumentVersionId_fkey" FOREIGN KEY ("sourceDocumentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DynamicCriteriaProposal" ADD CONSTRAINT "DynamicCriteriaProposal_readinessCheckId_fkey" FOREIGN KEY ("readinessCheckId") REFERENCES "DocumentReadinessCheck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DynamicCriteriaProposal" ADD CONSTRAINT "DynamicCriteriaProposal_materialComparisonReviewId_fkey" FOREIGN KEY ("materialComparisonReviewId") REFERENCES "DocumentComparisonReview"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DynamicCriteriaProposal" ADD CONSTRAINT "DynamicCriteriaProposal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DynamicCriteriaProposalItem" ADD CONSTRAINT "DynamicCriteriaProposalItem_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "DynamicCriteriaProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DynamicCriteriaProposalTransition" ADD CONSTRAINT "DynamicCriteriaProposalTransition_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "DynamicCriteriaProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DynamicCriteriaProposalTransition" ADD CONSTRAINT "DynamicCriteriaProposalTransition_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriteriaReviewSnapshot" ADD CONSTRAINT "CriteriaReviewSnapshot_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "DynamicCriteriaProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriteriaReviewSnapshot" ADD CONSTRAINT "CriteriaReviewSnapshot_primaryOwnerId_fkey" FOREIGN KEY ("primaryOwnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriteriaReviewEligibility" ADD CONSTRAINT "CriteriaReviewEligibility_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "CriteriaReviewSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriteriaReviewEligibility" ADD CONSTRAINT "CriteriaReviewEligibility_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriteriaContributorResponse" ADD CONSTRAINT "CriteriaContributorResponse_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "DynamicCriteriaProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriteriaContributorResponse" ADD CONSTRAINT "CriteriaContributorResponse_snapshot_proposal_fkey" FOREIGN KEY ("snapshotId", "proposalId") REFERENCES "CriteriaReviewSnapshot"("id", "proposalId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriteriaContributorResponse" ADD CONSTRAINT "CriteriaContributorResponse_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriteriaManagerResolution" ADD CONSTRAINT "CriteriaManagerResolution_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "DynamicCriteriaProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriteriaManagerResolution" ADD CONSTRAINT "CriteriaManagerResolution_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DynamicCriteriaSet" ADD CONSTRAINT "DynamicCriteriaSet_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DynamicCriteriaSet" ADD CONSTRAINT "DynamicCriteriaSet_workstreamId_fkey" FOREIGN KEY ("workstreamId") REFERENCES "Workstream"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DynamicCriteriaSet" ADD CONSTRAINT "DynamicCriteriaSet_sourceDocumentVersionId_fkey" FOREIGN KEY ("sourceDocumentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DynamicCriteriaSet" ADD CONSTRAINT "DynamicCriteriaSet_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "DynamicCriteriaProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DynamicCriteriaSet" ADD CONSTRAINT "DynamicCriteriaSet_priorSetId_fkey" FOREIGN KEY ("priorSetId") REFERENCES "DynamicCriteriaSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DynamicCriterion" ADD CONSTRAINT "DynamicCriterion_criteriaSetId_fkey" FOREIGN KEY ("criteriaSetId") REFERENCES "DynamicCriteriaSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DynamicCriteriaSetTransition" ADD CONSTRAINT "DynamicCriteriaSetTransition_criteriaSetId_fkey" FOREIGN KEY ("criteriaSetId") REFERENCES "DynamicCriteriaSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DynamicCriteriaSetTransition" ADD CONSTRAINT "DynamicCriteriaSetTransition_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Route-bound and pinned lineage foreign keys added after all Bundle C tables exist.
ALTER TABLE "DocumentAnalysisRequest" ADD CONSTRAINT "DocumentAnalysisRequest_pinnedReadinessCheckId_fkey"
FOREIGN KEY ("pinnedReadinessCheckId") REFERENCES "DocumentReadinessCheck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentAnalysisRequest" ADD CONSTRAINT "DocumentAnalysisRequest_pinnedProposalId_fkey"
FOREIGN KEY ("pinnedProposalId") REFERENCES "DynamicCriteriaProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentAnalysisRequest" ADD CONSTRAINT "DocumentAnalysisRequest_outputSchemaArtifactId_routeKey_ou_fkey"
FOREIGN KEY ("outputSchemaArtifactId", "routeKey", "outputSchemaVersion", "outputSchemaHash")
REFERENCES "AiOutputSchemaArtifact"("id", "routeKey", "version", "schemaHash") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentReadinessLifecycleTransition" ADD CONSTRAINT "DocumentReadinessLifecycleTransition_criteriaSetId_fkey"
FOREIGN KEY ("criteriaSetId") REFERENCES "DynamicCriteriaSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentReadinessLifecycleTransition" ADD CONSTRAINT "DocumentReadinessLifecycleTransition_comparisonReviewId_fkey"
FOREIGN KEY ("comparisonReviewId") REFERENCES "DocumentComparisonReview"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DynamicCriteriaProposal" ADD CONSTRAINT "DynamicCriteriaProposal_priorSetId_fkey"
FOREIGN KEY ("priorSetId") REFERENCES "DynamicCriteriaSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DynamicCriteriaProposal" ADD CONSTRAINT "DynamicCriteriaProposal_replacesProposalId_fkey"
FOREIGN KEY ("replacesProposalId") REFERENCES "DynamicCriteriaProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CriteriaContributorResponse" ADD CONSTRAINT "CriteriaContributorResponse_eligibility_fkey"
FOREIGN KEY ("snapshotId", "employeeId", "responseRequired")
REFERENCES "CriteriaReviewEligibility"("snapshotId", "employeeId", "responseRequired") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Shape, bounded-value, and source-binding constraints.
ALTER TABLE "AnalysisPromptArtifact" ADD CONSTRAINT "AnalysisPromptArtifact_content_check"
CHECK (
  length(btrim("routeKey")) BETWEEN 1 AND 200
  AND length(btrim("version")) BETWEEN 1 AND 200
  AND "bodyHash" ~ '^[a-f0-9]{64}$'
  AND length(btrim("trustedBody")) BETWEEN 1 AND 100000
  AND length(btrim("expectedBehavior")) BETWEEN 1 AND 4000
  AND length(btrim("registrationReason")) BETWEEN 1 AND 1000
);
ALTER TABLE "DocumentAnalysisRequest" ADD CONSTRAINT "DocumentAnalysisRequest_content_check"
CHECK (
  length(btrim("idempotencyKey")) BETWEEN 1 AND 500
  AND "payloadHash" ~ '^[a-f0-9]{64}$'
  AND length(btrim("routeKey")) BETWEEN 1 AND 200
  AND "expectedAggregateVersion" BETWEEN 0 AND 2147483647
  AND "outputSchemaHash" ~ '^[a-f0-9]{64}$'
  AND "promptHash" ~ '^[a-f0-9]{64}$'
);
ALTER TABLE "DocumentAnalysisRequest" ADD CONSTRAINT "DocumentAnalysisRequest_kind_shape_check"
CHECK (
  (
    "kind" = 'readiness'
    AND "currentDocumentVersionId" IS NOT NULL
    AND "beforeVersionId" IS NULL
    AND "afterVersionId" IS NULL
    AND "pinnedProposalId" IS NULL
  )
  OR (
    "kind" = 'comparison'
    AND "currentDocumentVersionId" IS NULL
    AND "beforeVersionId" IS NOT NULL
    AND "afterVersionId" IS NOT NULL
    AND "pinnedProposalId" IS NULL
  )
  OR (
    "kind" IN ('criteria_project', 'criteria_workstream')
    AND "currentDocumentVersionId" IS NOT NULL
    AND "beforeVersionId" IS NULL
    AND "afterVersionId" IS NULL
    AND "pinnedReadinessCheckId" IS NOT NULL
  )
);
ALTER TABLE "DocumentAnalysisRequest" ADD CONSTRAINT "DocumentAnalysisRequest_state_time_check"
CHECK (
  (
    "state" = 'queued'
    AND "startedAt" IS NULL
    AND "completedAt" IS NULL
    AND "resultReference" IS NULL
    AND "errorCode" IS NULL
  )
  OR (
    "state" = 'running'
    AND "startedAt" IS NOT NULL
    AND "completedAt" IS NULL
    AND "resultReference" IS NULL
    AND "errorCode" IS NULL
  )
  OR (
    "state" = 'succeeded'
    AND "startedAt" IS NOT NULL
    AND "completedAt" IS NOT NULL
    AND "resultReference" IS NOT NULL
    AND "errorCode" IS NULL
  )
  OR (
    "state" = 'failed'
    AND "completedAt" IS NOT NULL
    AND "resultReference" IS NULL
    AND "errorCode" IS NOT NULL
  )
  OR (
    "state" = 'superseded'
    AND "completedAt" IS NOT NULL
    AND "resultReference" IS NULL
  )
);
ALTER TABLE "DocumentReadinessCheck" ADD CONSTRAINT "DocumentReadinessCheck_ready_coverage_check"
CHECK ("analyzedState" <> 'ready_for_criteria_generation' OR "extractionCoverage" = 'complete');
ALTER TABLE "DocumentReadinessCheck" ADD CONSTRAINT "DocumentReadinessCheck_manager_projection_check"
CHECK (
  ("analyzedState" = 'ready_for_criteria_generation' AND "managerState" = 'ready')
  OR ("analyzedState" = 'incomplete' AND "managerState" IN ('needs_attention', 'missing_critical_information'))
);
ALTER TABLE "DocumentComparison" ADD CONSTRAINT "DocumentComparison_distinct_versions_check"
CHECK ("beforeVersionId" <> "afterVersionId");
ALTER TABLE "DynamicCriteriaProposal" ADD CONSTRAINT "DynamicCriteriaProposal_scope_check"
CHECK (
  ("kind" = 'project' AND "projectId" IS NOT NULL AND "workstreamId" IS NULL)
  OR ("kind" = 'workstream' AND "projectId" IS NULL AND "workstreamId" IS NOT NULL)
);
ALTER TABLE "DynamicCriteriaProposal" ADD CONSTRAINT "DynamicCriteriaProposal_version_check"
CHECK ("proposalNumber" BETWEEN 1 AND 2147483647 AND "version" BETWEEN 1 AND 2147483647);
ALTER TABLE "DynamicCriteriaProposal" ADD CONSTRAINT "DynamicCriteriaProposal_approval_check"
CHECK (
  ("state" IN ('approved', 'activated') AND "approvedAt" IS NOT NULL)
  OR ("state" NOT IN ('approved', 'activated') AND "approvedAt" IS NULL)
);
ALTER TABLE "DynamicCriteriaProposalItem" ADD CONSTRAINT "DynamicCriteriaProposalItem_content_check"
CHECK (
  "position" BETWEEN 1 AND 3
  AND length(btrim("name")) BETWEEN 1 AND 500
  AND length(btrim("selectionReason")) BETWEEN 1 AND 4000
  AND length(btrim("successLink")) BETWEEN 1 AND 2000
  AND length(btrim("expectedBehaviorOrResult")) BETWEEN 1 AND 4000
  AND length(btrim("evaluationMethod")) BETWEEN 1 AND 4000
);
ALTER TABLE "CriteriaReviewSnapshot" ADD CONSTRAINT "CriteriaReviewSnapshot_time_check"
CHECK ("responsibilityAt" <= "publishedAt");
ALTER TABLE "CriteriaReviewEligibility" ADD CONSTRAINT "CriteriaReviewEligibility_role_check"
CHECK (
  ("role" = 'owner' AND "responseRequired" = false)
  OR ("role" = 'contributor' AND "responseRequired" = true)
);
ALTER TABLE "CriteriaContributorResponse" ADD CONSTRAINT "CriteriaContributorResponse_shape_check"
CHECK (
  "responseRequired" = true
  AND (
    ("response" = 'acknowledge' AND "reason" IS NULL)
    OR (
      "response" = 'object'
      AND "reason" IS NOT NULL
      AND length(btrim("reason")) BETWEEN 1 AND 4000
    )
  )
);
ALTER TABLE "CriteriaManagerResolution" ADD CONSTRAINT "CriteriaManagerResolution_reason_check"
CHECK (length(btrim("reason")) BETWEEN 1 AND 4000);
ALTER TABLE "DynamicCriteriaSet" ADD CONSTRAINT "DynamicCriteriaSet_scope_check"
CHECK (
  ("kind" = 'project' AND "projectId" IS NOT NULL AND "workstreamId" IS NULL)
  OR ("kind" = 'workstream' AND "projectId" IS NULL AND "workstreamId" IS NOT NULL)
);
ALTER TABLE "DynamicCriteriaSet" ADD CONSTRAINT "DynamicCriteriaSet_period_check"
CHECK (
  "version" BETWEEN 1 AND 2147483647
  AND "effectiveFrom" >= "approvedAt"
  AND ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom")
);
ALTER TABLE "DynamicCriterion" ADD CONSTRAINT "DynamicCriterion_content_check"
CHECK (
  "position" BETWEEN 1 AND 3
  AND length(btrim("name")) BETWEEN 1 AND 500
  AND length(btrim("selectionReason")) BETWEEN 1 AND 4000
  AND length(btrim("successLink")) BETWEEN 1 AND 2000
  AND length(btrim("expectedBehaviorOrResult")) BETWEEN 1 AND 4000
  AND length(btrim("evaluationMethod")) BETWEEN 1 AND 4000
);

ALTER TABLE "DynamicCriteriaSet" ADD CONSTRAINT "DynamicCriteriaSet_project_period_excl"
EXCLUDE USING gist (
  "projectId" WITH =,
  tstzrange("effectiveFrom", "effectiveTo", '[)') WITH &&
) WHERE ("projectId" IS NOT NULL);
ALTER TABLE "DynamicCriteriaSet" ADD CONSTRAINT "DynamicCriteriaSet_workstream_period_excl"
EXCLUDE USING gist (
  "workstreamId" WITH =,
  tstzrange("effectiveFrom", "effectiveTo", '[)') WITH &&
) WHERE ("workstreamId" IS NOT NULL);

-- Bundle C history is append-only except for explicit, guarded lifecycle transitions.
CREATE FUNCTION "prevent_analysis_criteria_history_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Analysis and criteria history is immutable' USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "guard_document_analysis_request_update"() RETURNS trigger AS $$
BEGIN
  IF ROW(
      NEW."id", NEW."kind", NEW."idempotencyKey", NEW."payloadHash", NEW."routeKey",
      NEW."documentId", NEW."currentDocumentVersionId", NEW."beforeVersionId", NEW."afterVersionId",
      NEW."pinnedReadinessCheckId", NEW."pinnedProposalId", NEW."expectedAggregateVersion",
      NEW."outputSchemaArtifactId", NEW."outputSchemaVersion", NEW."outputSchemaHash",
      NEW."promptArtifactId", NEW."promptVersion", NEW."promptHash", NEW."operationId", NEW."createdAt"
    ) IS DISTINCT FROM ROW(
      OLD."id", OLD."kind", OLD."idempotencyKey", OLD."payloadHash", OLD."routeKey",
      OLD."documentId", OLD."currentDocumentVersionId", OLD."beforeVersionId", OLD."afterVersionId",
      OLD."pinnedReadinessCheckId", OLD."pinnedProposalId", OLD."expectedAggregateVersion",
      OLD."outputSchemaArtifactId", OLD."outputSchemaVersion", OLD."outputSchemaHash",
      OLD."promptArtifactId", OLD."promptVersion", OLD."promptHash", OLD."operationId", OLD."createdAt"
    )
    OR NOT (
      (OLD."state" = 'queued' AND NEW."state" IN ('running', 'failed', 'superseded'))
      OR (OLD."state" = 'running' AND NEW."state" IN ('succeeded', 'failed', 'superseded'))
    )
  THEN
    RAISE EXCEPTION 'DocumentAnalysisRequest transition is invalid' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "validate_readiness_lifecycle_transition"() RETURNS trigger AS $$
DECLARE
  pinned_version UUID;
  latest_state "DocumentReadinessLifecycleState";
  latest_effective_at TIMESTAMPTZ;
BEGIN
  PERFORM 1
  FROM "DocumentVersion"
  WHERE "id" = NEW."documentVersionId"
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Readiness transition source mismatch' USING ERRCODE = '23514';
  END IF;

  SELECT "documentVersionId" INTO pinned_version
  FROM "DocumentReadinessCheck"
  WHERE "id" = NEW."readinessCheckId";
  IF pinned_version IS NULL OR pinned_version <> NEW."documentVersionId" THEN
    RAISE EXCEPTION 'Readiness transition source mismatch' USING ERRCODE = '23514';
  END IF;

  SELECT "toState", "effectiveAt" INTO latest_state, latest_effective_at
  FROM "DocumentReadinessLifecycleTransition"
  WHERE "documentVersionId" = NEW."documentVersionId"
  ORDER BY "effectiveAt" DESC, "createdAt" DESC, "id" DESC
  LIMIT 1;
  IF COALESCE(latest_state, 'draft'::"DocumentReadinessLifecycleState") <> NEW."fromState" THEN
    RAISE EXCEPTION 'Readiness transition skipped current state' USING ERRCODE = '23514';
  END IF;
  IF latest_effective_at IS NOT NULL AND NEW."effectiveAt" <= latest_effective_at THEN
    RAISE EXCEPTION 'Readiness transition effectiveAt must increase monotonically'
      USING ERRCODE = '23514';
  END IF;
  IF NOT (
    (NEW."fromState" = 'draft' AND NEW."toState" IN ('incomplete', 'ready_for_criteria_generation'))
    OR (NEW."fromState" = 'incomplete' AND NEW."toState" = 'superseded')
    OR (
      NEW."fromState" = 'ready_for_criteria_generation'
      AND NEW."toState" IN ('revision_required', 'criteria_approved', 'superseded')
    )
    OR (
      NEW."fromState" = 'revision_required'
      AND NEW."toState" IN ('criteria_approved', 'superseded')
    )
    OR (
      NEW."fromState" = 'criteria_approved'
      AND NEW."toState" IN ('revision_required', 'superseded')
    )
  ) THEN
    RAISE EXCEPTION 'Readiness lifecycle transition is invalid' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "guard_dynamic_criteria_proposal_update"() RETURNS trigger AS $$
BEGIN
  IF NEW."version" <> OLD."version" + 1
    OR ROW(
      NEW."id", NEW."kind", NEW."projectId", NEW."workstreamId", NEW."sourceDocumentVersionId",
      NEW."readinessCheckId", NEW."materialComparisonReviewId", NEW."priorSetId",
      NEW."replacesProposalId", NEW."proposalNumber", NEW."outputReference",
      NEW."outputSchemaVersion", NEW."promptVersion", NEW."promptHash", NEW."createdById", NEW."createdAt"
    ) IS DISTINCT FROM ROW(
      OLD."id", OLD."kind", OLD."projectId", OLD."workstreamId", OLD."sourceDocumentVersionId",
      OLD."readinessCheckId", OLD."materialComparisonReviewId", OLD."priorSetId",
      OLD."replacesProposalId", OLD."proposalNumber", OLD."outputReference",
      OLD."outputSchemaVersion", OLD."promptVersion", OLD."promptHash", OLD."createdById", OLD."createdAt"
    )
    OR NOT (
      (OLD."state" = 'owner_review' AND NEW."state" IN ('contributor_review', 'approved', 'rejected', 'superseded'))
      OR (OLD."state" = 'contributor_review' AND NEW."state" IN ('approved', 'manager_resolution', 'superseded'))
      OR (OLD."state" = 'manager_resolution' AND NEW."state" IN ('approved', 'superseded'))
      OR (OLD."state" = 'approved' AND NEW."state" IN ('activated', 'superseded'))
    )
    OR NOT EXISTS (
      SELECT 1
      FROM "DynamicCriteriaProposalTransition"
      WHERE "proposalId" = OLD."id"
        AND "fromState" = OLD."state"
        AND "toState" = NEW."state"
        AND "resultingVersion" = NEW."version"
    )
  THEN
    RAISE EXCEPTION 'DynamicCriteriaProposal transition is invalid' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "guard_dynamic_criteria_set_update"() RETURNS trigger AS $$
BEGIN
  IF OLD."effectiveTo" IS NOT NULL
    OR NEW."effectiveTo" IS NULL
    OR NEW."effectiveTo" <= NEW."effectiveFrom"
    OR NEW."effectiveTo" < CURRENT_TIMESTAMP
    OR ROW(
      NEW."id", NEW."kind", NEW."projectId", NEW."workstreamId", NEW."version",
      NEW."sourceDocumentVersionId", NEW."proposalId", NEW."priorSetId",
      NEW."approvedAt", NEW."effectiveFrom", NEW."createdAt"
    ) IS DISTINCT FROM ROW(
      OLD."id", OLD."kind", OLD."projectId", OLD."workstreamId", OLD."version",
      OLD."sourceDocumentVersionId", OLD."proposalId", OLD."priorSetId",
      OLD."approvedAt", OLD."effectiveFrom", OLD."createdAt"
    )
    OR NOT EXISTS (
      SELECT 1
      FROM "DynamicCriteriaSetTransition"
      WHERE "criteriaSetId" = OLD."id"
        AND "kind" = 'retired'
        AND "effectiveAt" = NEW."effectiveTo"
    )
  THEN
    RAISE EXCEPTION 'DynamicCriteriaSet history is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "validate_dynamic_criteria_proposal_count"() RETURNS trigger AS $$
DECLARE
  item_count INTEGER;
BEGIN
  SELECT count(*) INTO item_count
  FROM "DynamicCriteriaProposalItem"
  WHERE "proposalId" = NEW."id";
  IF (NEW."kind" = 'project' AND item_count NOT BETWEEN 1 AND 3)
    OR (NEW."kind" = 'workstream' AND item_count NOT BETWEEN 2 AND 3)
  THEN
    RAISE EXCEPTION 'Dynamic criteria proposal count is invalid' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "validate_dynamic_criteria_set_count"() RETURNS trigger AS $$
DECLARE
  item_count INTEGER;
BEGIN
  SELECT count(*) INTO item_count
  FROM "DynamicCriterion"
  WHERE "criteriaSetId" = NEW."id";
  IF (NEW."kind" = 'project' AND item_count NOT BETWEEN 1 AND 3)
    OR (NEW."kind" = 'workstream' AND item_count NOT BETWEEN 2 AND 3)
  THEN
    RAISE EXCEPTION 'Dynamic criteria set count is invalid' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "validate_analysis_request_success"() RETURNS trigger AS $$
DECLARE
  readiness_count INTEGER;
  comparison_count INTEGER;
  proposal_count INTEGER;
  stored_reference TEXT;
BEGIN
  IF NEW."state" <> 'succeeded' THEN
    RETURN NULL;
  END IF;
  SELECT count(*), max("outputReference") INTO readiness_count, stored_reference
  FROM "DocumentReadinessCheck" WHERE "requestId" = NEW."id";
  SELECT count(*) INTO comparison_count
  FROM "DocumentComparison" WHERE "requestId" = NEW."id";
  SELECT count(*) INTO proposal_count
  FROM "DynamicCriteriaProposal" WHERE "requestId" = NEW."id";

  IF (
      NEW."kind" = 'readiness'
      AND (readiness_count <> 1 OR comparison_count <> 0 OR proposal_count <> 0)
    )
    OR (
      NEW."kind" = 'comparison'
      AND (readiness_count <> 0 OR comparison_count <> 1 OR proposal_count <> 0)
    )
    OR (
      NEW."kind" IN ('criteria_project', 'criteria_workstream')
      AND (readiness_count <> 0 OR comparison_count <> 0 OR proposal_count <> 1)
    )
  THEN
    RAISE EXCEPTION 'Successful analysis request must have exactly one kind-matched result'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."kind" = 'comparison' THEN
    SELECT "outputReference" INTO stored_reference
    FROM "DocumentComparison" WHERE "requestId" = NEW."id";
  ELSIF NEW."kind" IN ('criteria_project', 'criteria_workstream') THEN
    SELECT "outputReference" INTO stored_reference
    FROM "DynamicCriteriaProposal" WHERE "requestId" = NEW."id";
  END IF;
  IF stored_reference IS DISTINCT FROM NEW."resultReference" THEN
    RAISE EXCEPTION 'Successful analysis result reference does not match request'
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "validate_new_dynamic_criteria_set"() RETURNS trigger AS $$
BEGIN
  IF NEW."effectiveTo" IS NOT NULL OR NEW."effectiveFrom" < CURRENT_TIMESTAMP THEN
    RAISE EXCEPTION 'New criteria set must start prospectively with an open effective period'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "require_proposal_construction_transaction"() RETURNS trigger AS $$
DECLARE
  parent_xmin TEXT;
BEGIN
  SELECT xmin::text INTO parent_xmin
  FROM "DynamicCriteriaProposal"
  WHERE "id" = NEW."proposalId";
  IF parent_xmin IS NULL OR parent_xmin <> pg_current_xact_id()::text THEN
    RAISE EXCEPTION 'Proposal items are frozen after proposal creation'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "require_set_construction_transaction"() RETURNS trigger AS $$
DECLARE
  parent_xmin TEXT;
BEGIN
  SELECT xmin::text INTO parent_xmin
  FROM "DynamicCriteriaSet"
  WHERE "id" = NEW."criteriaSetId";
  IF parent_xmin IS NULL OR parent_xmin <> pg_current_xact_id()::text THEN
    RAISE EXCEPTION 'Criteria are frozen after criteria-set creation'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "require_snapshot_construction_transaction"() RETURNS trigger AS $$
DECLARE
  parent_xmin TEXT;
BEGIN
  SELECT xmin::text INTO parent_xmin
  FROM "CriteriaReviewSnapshot"
  WHERE "id" = NEW."snapshotId";
  IF parent_xmin IS NULL OR parent_xmin <> pg_current_xact_id()::text THEN
    RAISE EXCEPTION 'Review eligibility is frozen after snapshot publication'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "validate_readiness_result_lineage"() RETURNS trigger AS $$
DECLARE
  request_row "DocumentAnalysisRequest"%ROWTYPE;
  version_document_id UUID;
  version_template_id UUID;
BEGIN
  SELECT * INTO request_row FROM "DocumentAnalysisRequest"
  WHERE "id" = NEW."requestId" FOR UPDATE;
  SELECT "documentId", "templateVersionId" INTO version_document_id, version_template_id
  FROM "DocumentVersion" WHERE "id" = NEW."documentVersionId";
  IF request_row."kind" <> 'readiness'
    OR request_row."state" <> 'running'
    OR request_row."routeKey" <> 'document.analyze'
    OR request_row."documentId" <> NEW."documentId"
    OR request_row."currentDocumentVersionId" <> NEW."documentVersionId"
    OR request_row."outputSchemaVersion" IS DISTINCT FROM NEW."outputSchemaVersion"
    OR request_row."promptVersion" IS DISTINCT FROM NEW."promptVersion"
    OR request_row."promptHash" IS DISTINCT FROM NEW."promptHash"
    OR version_document_id <> NEW."documentId"
    OR version_template_id <> NEW."templateVersionId"
  THEN
    RAISE EXCEPTION 'Readiness result lineage does not match its request pins'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "validate_comparison_result_lineage"() RETURNS trigger AS $$
DECLARE
  request_row "DocumentAnalysisRequest"%ROWTYPE;
  before_document_id UUID;
  after_document_id UUID;
  before_number INTEGER;
  after_number INTEGER;
BEGIN
  SELECT * INTO request_row FROM "DocumentAnalysisRequest"
  WHERE "id" = NEW."requestId" FOR UPDATE;
  SELECT "documentId", "version" INTO before_document_id, before_number
  FROM "DocumentVersion" WHERE "id" = NEW."beforeVersionId";
  SELECT "documentId", "version" INTO after_document_id, after_number
  FROM "DocumentVersion" WHERE "id" = NEW."afterVersionId";
  IF request_row."kind" <> 'comparison'
    OR request_row."state" <> 'running'
    OR request_row."routeKey" <> 'document.compare'
    OR request_row."documentId" <> NEW."documentId"
    OR request_row."beforeVersionId" <> NEW."beforeVersionId"
    OR request_row."afterVersionId" <> NEW."afterVersionId"
    OR request_row."outputSchemaVersion" IS DISTINCT FROM NEW."outputSchemaVersion"
    OR request_row."promptVersion" IS DISTINCT FROM NEW."promptVersion"
    OR request_row."promptHash" IS DISTINCT FROM NEW."promptHash"
    OR before_document_id <> NEW."documentId"
    OR after_document_id <> NEW."documentId"
    OR before_number >= after_number
  THEN
    RAISE EXCEPTION 'Comparison result lineage does not match its request pins'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "validate_proposal_result_lineage"() RETURNS trigger AS $$
DECLARE
  request_row "DocumentAnalysisRequest"%ROWTYPE;
  source_document_id UUID;
  readiness_version_id UUID;
  readiness_state "DocumentReadinessAnalysisState";
  readiness_stale BOOLEAN;
  expected_kind "DocumentAnalysisKind";
  expected_route TEXT;
  request_project_id UUID;
  request_workstream_id UUID;
BEGIN
  SELECT * INTO request_row FROM "DocumentAnalysisRequest"
  WHERE "id" = NEW."requestId" FOR UPDATE;
  SELECT "documentId" INTO source_document_id
  FROM "DocumentVersion" WHERE "id" = NEW."sourceDocumentVersionId";
  SELECT "documentVersionId", "analyzedState", "stale"
    INTO readiness_version_id, readiness_state, readiness_stale
  FROM "DocumentReadinessCheck" WHERE "id" = NEW."readinessCheckId";
  SELECT "projectId", "workstreamId" INTO request_project_id, request_workstream_id
  FROM "DocumentRecord" WHERE "id" = request_row."documentId";
  IF NEW."kind" = 'project' THEN
    expected_kind := 'criteria_project';
    expected_route := 'criteria.generate.project';
  ELSE
    expected_kind := 'criteria_workstream';
    expected_route := 'criteria.generate.workstream';
  END IF;
  IF request_row."kind" <> expected_kind
    OR request_row."state" <> 'running'
    OR request_row."routeKey" <> expected_route
    OR request_row."documentId" <> source_document_id
    OR request_row."currentDocumentVersionId" <> NEW."sourceDocumentVersionId"
    OR request_row."pinnedReadinessCheckId" <> NEW."readinessCheckId"
    OR request_row."outputSchemaVersion" IS DISTINCT FROM NEW."outputSchemaVersion"
    OR request_row."promptVersion" IS DISTINCT FROM NEW."promptVersion"
    OR request_row."promptHash" IS DISTINCT FROM NEW."promptHash"
    OR (
      NEW."kind" = 'project'
      AND (
        request_project_id IS NULL
        OR request_project_id IS DISTINCT FROM NEW."projectId"
        OR request_workstream_id IS NOT NULL
      )
    )
    OR (
      NEW."kind" = 'workstream'
      AND (
        request_workstream_id IS NULL
        OR request_workstream_id IS DISTINCT FROM NEW."workstreamId"
      )
    )
    OR readiness_version_id <> NEW."sourceDocumentVersionId"
    OR readiness_state <> 'ready_for_criteria_generation'
    OR readiness_stale
  THEN
    RAISE EXCEPTION 'Criteria proposal lineage or kind does not match its request pins'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "validate_proposal_transition_insert"() RETURNS trigger AS $$
DECLARE
  parent_state "DynamicCriteriaProposalState";
  parent_version INTEGER;
  parent_created_at TIMESTAMPTZ;
  parent_updated_at TIMESTAMPTZ;
BEGIN
  SELECT "state", "version", "createdAt", "updatedAt"
    INTO parent_state, parent_version, parent_created_at, parent_updated_at
  FROM "DynamicCriteriaProposal" WHERE "id" = NEW."proposalId" FOR UPDATE;
  IF parent_state <> NEW."fromState" OR NEW."resultingVersion" <> parent_version + 1
    OR NEW."createdAt" < parent_created_at
    OR NEW."createdAt" < parent_updated_at
    OR NEW."createdAt" > clock_timestamp()
    OR NOT (
      (NEW."fromState" = 'owner_review' AND NEW."toState" IN ('contributor_review', 'approved', 'rejected', 'superseded'))
      OR (NEW."fromState" = 'contributor_review' AND NEW."toState" IN ('approved', 'manager_resolution', 'superseded'))
      OR (NEW."fromState" = 'manager_resolution' AND NEW."toState" IN ('approved', 'superseded'))
      OR (NEW."fromState" = 'approved' AND NEW."toState" IN ('activated', 'superseded'))
    )
  THEN
    RAISE EXCEPTION 'Proposal transition does not match current parent state'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "validate_proposal_transition_commit"() RETURNS trigger AS $$
DECLARE
  parent_state "DynamicCriteriaProposalState";
  parent_version INTEGER;
  parent_updated_at TIMESTAMPTZ;
BEGIN
  SELECT "state", "version", "updatedAt" INTO parent_state, parent_version, parent_updated_at
  FROM "DynamicCriteriaProposal" WHERE "id" = NEW."proposalId";
  IF parent_state <> NEW."toState"
    OR parent_version <> NEW."resultingVersion"
    OR parent_updated_at < NEW."createdAt"
  THEN
    RAISE EXCEPTION 'Proposal transition was not coupled to its parent update'
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "validate_set_transition_insert"() RETURNS trigger AS $$
DECLARE
  parent_xmin TEXT;
  parent_effective_from TIMESTAMPTZ;
  parent_effective_to TIMESTAMPTZ;
BEGIN
  SELECT xmin::text, "effectiveFrom", "effectiveTo"
    INTO parent_xmin, parent_effective_from, parent_effective_to
  FROM "DynamicCriteriaSet" WHERE "id" = NEW."criteriaSetId" FOR UPDATE;
  IF NEW."kind" = 'activated' THEN
    IF parent_xmin <> pg_current_xact_id()::text OR NEW."effectiveAt" <> parent_effective_from THEN
      RAISE EXCEPTION 'Activation transition must be created with its criteria set'
        USING ERRCODE = '23514';
    END IF;
  ELSIF parent_effective_to IS NOT NULL
    OR NEW."effectiveAt" <= parent_effective_from
    OR NEW."effectiveAt" < CURRENT_TIMESTAMP
  THEN
    RAISE EXCEPTION 'Retirement transition is not prospective or set is already retired'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "validate_set_transition_commit"() RETURNS trigger AS $$
DECLARE
  parent_effective_from TIMESTAMPTZ;
  parent_effective_to TIMESTAMPTZ;
BEGIN
  SELECT "effectiveFrom", "effectiveTo" INTO parent_effective_from, parent_effective_to
  FROM "DynamicCriteriaSet" WHERE "id" = NEW."criteriaSetId";
  IF (NEW."kind" = 'activated' AND NEW."effectiveAt" <> parent_effective_from)
    OR (NEW."kind" = 'retired' AND NEW."effectiveAt" IS DISTINCT FROM parent_effective_to)
  THEN
    RAISE EXCEPTION 'Criteria-set transition was not coupled to its parent period'
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "require_set_activation_transition"() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "DynamicCriteriaSetTransition"
    WHERE "criteriaSetId" = NEW."id"
      AND "kind" = 'activated'
      AND "effectiveAt" = NEW."effectiveFrom"
  ) THEN
    RAISE EXCEPTION 'New criteria set requires an activation transition'
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "DocumentAnalysisRequest_guard_update"
BEFORE UPDATE ON "DocumentAnalysisRequest"
FOR EACH ROW EXECUTE FUNCTION "guard_document_analysis_request_update"();
CREATE TRIGGER "DocumentReadinessLifecycleTransition_validate"
BEFORE INSERT ON "DocumentReadinessLifecycleTransition"
FOR EACH ROW EXECUTE FUNCTION "validate_readiness_lifecycle_transition"();
CREATE TRIGGER "DocumentReadinessCheck_validate_lineage"
BEFORE INSERT ON "DocumentReadinessCheck"
FOR EACH ROW EXECUTE FUNCTION "validate_readiness_result_lineage"();
CREATE TRIGGER "DocumentComparison_validate_lineage"
BEFORE INSERT ON "DocumentComparison"
FOR EACH ROW EXECUTE FUNCTION "validate_comparison_result_lineage"();
CREATE TRIGGER "DynamicCriteriaProposal_validate_lineage"
BEFORE INSERT ON "DynamicCriteriaProposal"
FOR EACH ROW EXECUTE FUNCTION "validate_proposal_result_lineage"();
CREATE TRIGGER "DynamicCriteriaProposalItem_freeze"
BEFORE INSERT ON "DynamicCriteriaProposalItem"
FOR EACH ROW EXECUTE FUNCTION "require_proposal_construction_transaction"();
CREATE TRIGGER "DynamicCriterion_freeze"
BEFORE INSERT ON "DynamicCriterion"
FOR EACH ROW EXECUTE FUNCTION "require_set_construction_transaction"();
CREATE TRIGGER "CriteriaReviewEligibility_freeze"
BEFORE INSERT ON "CriteriaReviewEligibility"
FOR EACH ROW EXECUTE FUNCTION "require_snapshot_construction_transaction"();
CREATE TRIGGER "DynamicCriteriaProposalTransition_validate_insert"
BEFORE INSERT ON "DynamicCriteriaProposalTransition"
FOR EACH ROW EXECUTE FUNCTION "validate_proposal_transition_insert"();
CREATE TRIGGER "DynamicCriteriaSetTransition_validate_insert"
BEFORE INSERT ON "DynamicCriteriaSetTransition"
FOR EACH ROW EXECUTE FUNCTION "validate_set_transition_insert"();
CREATE TRIGGER "DynamicCriteriaProposal_guard_update"
BEFORE UPDATE ON "DynamicCriteriaProposal"
FOR EACH ROW EXECUTE FUNCTION "guard_dynamic_criteria_proposal_update"();
CREATE TRIGGER "DynamicCriteriaSet_guard_update"
BEFORE UPDATE ON "DynamicCriteriaSet"
FOR EACH ROW EXECUTE FUNCTION "guard_dynamic_criteria_set_update"();
CREATE CONSTRAINT TRIGGER "DynamicCriteriaProposal_count_constraint"
AFTER INSERT ON "DynamicCriteriaProposal"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "validate_dynamic_criteria_proposal_count"();
CREATE CONSTRAINT TRIGGER "DynamicCriteriaSet_count_constraint"
AFTER INSERT ON "DynamicCriteriaSet"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "validate_dynamic_criteria_set_count"();
CREATE CONSTRAINT TRIGGER "DocumentAnalysisRequest_success_constraint"
AFTER INSERT OR UPDATE ON "DocumentAnalysisRequest"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "validate_analysis_request_success"();
CREATE CONSTRAINT TRIGGER "DynamicCriteriaProposalTransition_validate_commit"
AFTER INSERT ON "DynamicCriteriaProposalTransition"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "validate_proposal_transition_commit"();
CREATE CONSTRAINT TRIGGER "DynamicCriteriaSetTransition_validate_commit"
AFTER INSERT ON "DynamicCriteriaSetTransition"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "validate_set_transition_commit"();
CREATE CONSTRAINT TRIGGER "DynamicCriteriaSet_activation_constraint"
AFTER INSERT ON "DynamicCriteriaSet"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "require_set_activation_transition"();
CREATE TRIGGER "DynamicCriteriaSet_validate_insert"
BEFORE INSERT ON "DynamicCriteriaSet"
FOR EACH ROW EXECUTE FUNCTION "validate_new_dynamic_criteria_set"();

CREATE TRIGGER "AnalysisPromptArtifact_prevent_mutation"
BEFORE UPDATE OR DELETE ON "AnalysisPromptArtifact"
FOR EACH ROW EXECUTE FUNCTION "prevent_analysis_criteria_history_mutation"();
CREATE TRIGGER "DocumentAnalysisRequest_prevent_delete"
BEFORE DELETE ON "DocumentAnalysisRequest"
FOR EACH ROW EXECUTE FUNCTION "prevent_analysis_criteria_history_mutation"();
CREATE TRIGGER "DocumentReadinessCheck_prevent_mutation"
BEFORE UPDATE OR DELETE ON "DocumentReadinessCheck"
FOR EACH ROW EXECUTE FUNCTION "prevent_analysis_criteria_history_mutation"();
CREATE TRIGGER "DocumentReadinessLifecycleTransition_prevent_mutation"
BEFORE UPDATE OR DELETE ON "DocumentReadinessLifecycleTransition"
FOR EACH ROW EXECUTE FUNCTION "prevent_analysis_criteria_history_mutation"();
CREATE TRIGGER "DocumentComparison_prevent_mutation"
BEFORE UPDATE OR DELETE ON "DocumentComparison"
FOR EACH ROW EXECUTE FUNCTION "prevent_analysis_criteria_history_mutation"();
CREATE TRIGGER "DocumentComparisonReview_prevent_mutation"
BEFORE UPDATE OR DELETE ON "DocumentComparisonReview"
FOR EACH ROW EXECUTE FUNCTION "prevent_analysis_criteria_history_mutation"();
CREATE TRIGGER "DynamicCriteriaProposal_prevent_delete"
BEFORE DELETE ON "DynamicCriteriaProposal"
FOR EACH ROW EXECUTE FUNCTION "prevent_analysis_criteria_history_mutation"();
CREATE TRIGGER "DynamicCriteriaProposalItem_prevent_mutation"
BEFORE UPDATE OR DELETE ON "DynamicCriteriaProposalItem"
FOR EACH ROW EXECUTE FUNCTION "prevent_analysis_criteria_history_mutation"();
CREATE TRIGGER "DynamicCriteriaProposalTransition_prevent_mutation"
BEFORE UPDATE OR DELETE ON "DynamicCriteriaProposalTransition"
FOR EACH ROW EXECUTE FUNCTION "prevent_analysis_criteria_history_mutation"();
CREATE TRIGGER "CriteriaReviewSnapshot_prevent_mutation"
BEFORE UPDATE OR DELETE ON "CriteriaReviewSnapshot"
FOR EACH ROW EXECUTE FUNCTION "prevent_analysis_criteria_history_mutation"();
CREATE TRIGGER "CriteriaReviewEligibility_prevent_mutation"
BEFORE UPDATE OR DELETE ON "CriteriaReviewEligibility"
FOR EACH ROW EXECUTE FUNCTION "prevent_analysis_criteria_history_mutation"();
CREATE TRIGGER "CriteriaContributorResponse_prevent_mutation"
BEFORE UPDATE OR DELETE ON "CriteriaContributorResponse"
FOR EACH ROW EXECUTE FUNCTION "prevent_analysis_criteria_history_mutation"();
CREATE TRIGGER "CriteriaManagerResolution_prevent_mutation"
BEFORE UPDATE OR DELETE ON "CriteriaManagerResolution"
FOR EACH ROW EXECUTE FUNCTION "prevent_analysis_criteria_history_mutation"();
CREATE TRIGGER "DynamicCriteriaSet_prevent_delete"
BEFORE DELETE ON "DynamicCriteriaSet"
FOR EACH ROW EXECUTE FUNCTION "prevent_analysis_criteria_history_mutation"();
CREATE TRIGGER "DynamicCriterion_prevent_mutation"
BEFORE UPDATE OR DELETE ON "DynamicCriterion"
FOR EACH ROW EXECUTE FUNCTION "prevent_analysis_criteria_history_mutation"();
CREATE TRIGGER "DynamicCriteriaSetTransition_prevent_mutation"
BEFORE UPDATE OR DELETE ON "DynamicCriteriaSetTransition"
FOR EACH ROW EXECUTE FUNCTION "prevent_analysis_criteria_history_mutation"();
