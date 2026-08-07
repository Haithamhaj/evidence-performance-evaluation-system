-- CreateEnum
CREATE TYPE "ManagerEvaluationTemplateStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "ManagerEvaluationVisibilityMode" AS ENUM ('IDENTIFIED', 'MANAGER_BLINDED', 'ANONYMOUS_AGGREGATED');

-- CreateEnum
CREATE TYPE "ManagerEvaluationCycleState" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ManagerEvaluatorEligibilityState" AS ENUM ('ELIGIBLE_PENDING', 'SUBMITTED', 'APPROVED_LEAVE', 'POSTPONED', 'EXCLUDED_BY_AUTHORIZED_MANAGER');

-- CreateTable
CREATE TABLE "ManagerEvaluationTemplate" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "departmentId" UUID,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ManagerEvaluationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagerEvaluationTemplateVersion" (
    "id" UUID NOT NULL,
    "templateId" UUID NOT NULL,
    "rubricVersionId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "ManagerEvaluationTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "commentRequired" BOOLEAN NOT NULL DEFAULT false,
    "ratingScale" JSONB NOT NULL,
    "localeAvailability" JSONB NOT NULL,
    "configuration" JSONB NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" UUID NOT NULL,
    "activatedById" UUID,
    "activatedAt" TIMESTAMPTZ(6),
    "retiredAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ManagerEvaluationTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagerEvaluationCriterion" (
    "id" UUID NOT NULL,
    "templateVersionId" UUID NOT NULL,
    "rubricCriterionId" UUID NOT NULL,
    "stableCriterionId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "commentRequired" BOOLEAN NOT NULL DEFAULT false,
    "anchorSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagerEvaluationCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagerEvaluationVisibilityPolicy" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "mode" "ManagerEvaluationVisibilityMode" NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "managerCanReadIdentity" BOOLEAN NOT NULL,
    "managerCanReadOriginals" BOOLEAN NOT NULL,
    "immediateVisibility" BOOLEAN NOT NULL,
    "policy" JSONB NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagerEvaluationVisibilityPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagerEvaluationCycle" (
    "id" UUID NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "employeeEvaluationCycleId" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "managerId" UUID NOT NULL,
    "templateVersionId" UUID NOT NULL,
    "visibilityMode" "ManagerEvaluationVisibilityMode" NOT NULL DEFAULT 'IDENTIFIED',
    "state" "ManagerEvaluationCycleState" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMPTZ(6) NOT NULL,
    "endsAt" TIMESTAMPTZ(6) NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" UUID NOT NULL,
    "openedAt" TIMESTAMPTZ(6),
    "closedAt" TIMESTAMPTZ(6),
    "cancelledAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ManagerEvaluationCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagerEvaluationCycleSnapshot" (
    "id" UUID NOT NULL,
    "cycleId" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "managerId" UUID NOT NULL,
    "templateVersionId" UUID NOT NULL,
    "rubricVersionId" UUID NOT NULL,
    "visibilityPolicyId" UUID NOT NULL,
    "visibilityMode" "ManagerEvaluationVisibilityMode" NOT NULL,
    "visibilityPolicyEnabled" BOOLEAN NOT NULL,
    "startsAt" TIMESTAMPTZ(6) NOT NULL,
    "endsAt" TIMESTAMPTZ(6) NOT NULL,
    "ratingScale" JSONB NOT NULL,
    "criteriaSnapshot" JSONB NOT NULL,
    "eligibilityRuleSnapshot" JSONB NOT NULL,
    "localeAvailability" JSONB NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagerEvaluationCycleSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagerEvaluatorEligibility" (
    "id" UUID NOT NULL,
    "cycleId" UUID NOT NULL,
    "evaluatorId" UUID NOT NULL,
    "state" "ManagerEvaluatorEligibilityState" NOT NULL DEFAULT 'ELIGIBLE_PENDING',
    "reason" TEXT NOT NULL,
    "relationshipSnapshot" JSONB NOT NULL,
    "leaveSnapshot" JSONB NOT NULL,
    "effectiveAt" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ManagerEvaluatorEligibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagerEvaluatorEligibilityDecision" (
    "id" UUID NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "eligibilityId" UUID NOT NULL,
    "fromState" "ManagerEvaluatorEligibilityState" NOT NULL,
    "toState" "ManagerEvaluatorEligibilityState" NOT NULL,
    "reason" TEXT NOT NULL,
    "effectiveAt" TIMESTAMPTZ(6) NOT NULL,
    "actorId" UUID NOT NULL,
    "resultingVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagerEvaluatorEligibilityDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagerEvaluationCycleTransition" (
    "id" UUID NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "cycleId" UUID NOT NULL,
    "fromState" "ManagerEvaluationCycleState" NOT NULL,
    "toState" "ManagerEvaluationCycleState" NOT NULL,
    "reason" TEXT NOT NULL,
    "effectiveAt" TIMESTAMPTZ(6) NOT NULL,
    "actorId" UUID NOT NULL,
    "resultingVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagerEvaluationCycleTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagerEvaluationResponse" (
    "id" UUID NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "cycleId" UUID NOT NULL,
    "cycleSnapshotId" UUID NOT NULL,
    "eligibilityId" UUID NOT NULL,
    "evaluatorId" UUID NOT NULL,
    "managerId" UUID NOT NULL,
    "visibilityMode" "ManagerEvaluationVisibilityMode" NOT NULL DEFAULT 'IDENTIFIED',
    "identifiedNoticeConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMPTZ(6) NOT NULL,
    "visibleToManagerAt" TIMESTAMPTZ(6) NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagerEvaluationResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagerCriterionResponse" (
    "id" UUID NOT NULL,
    "responseId" UUID NOT NULL,
    "criterionId" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagerCriterionResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagerEvaluationSummaryRevision" (
    "id" UUID NOT NULL,
    "cycleId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "visibilityMode" "ManagerEvaluationVisibilityMode" NOT NULL DEFAULT 'IDENTIFIED',
    "periodStartsAt" TIMESTAMPTZ(6) NOT NULL,
    "periodEndsAt" TIMESTAMPTZ(6) NOT NULL,
    "distributions" JSONB NOT NULL,
    "themes" JSONB NOT NULL,
    "limitations" JSONB NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "outputSchemaVersion" TEXT NOT NULL,
    "aiRunId" UUID NOT NULL,
    "requestedById" UUID NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagerEvaluationSummaryRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagerEvaluationSummarySource" (
    "summaryRevisionId" UUID NOT NULL,
    "responseId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagerEvaluationSummarySource_pkey" PRIMARY KEY ("summaryRevisionId","responseId")
);

-- CreateTable
CREATE TABLE "ManagerEvaluationPrivateIdentityLink" (
    "id" UUID NOT NULL,
    "cycleId" UUID NOT NULL,
    "responseId" UUID NOT NULL,
    "mode" "ManagerEvaluationVisibilityMode" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "sealedIdentityReference" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagerEvaluationPrivateIdentityLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManagerEvaluationTemplate_organizationId_key_idx" ON "ManagerEvaluationTemplate"("organizationId", "key");

-- CreateIndex
CREATE INDEX "ManagerEvaluationTemplate_departmentId_key_idx" ON "ManagerEvaluationTemplate"("departmentId", "key");

-- CreateIndex
CREATE INDEX "ManagerEvaluationTemplate_createdById_createdAt_idx" ON "ManagerEvaluationTemplate"("createdById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerEvaluationTemplate_organizationId_departmentId_key_key" ON "ManagerEvaluationTemplate"("organizationId", "departmentId", "key");

-- CreateIndex
CREATE INDEX "ManagerEvaluationTemplateVersion_templateId_status_versionN_idx" ON "ManagerEvaluationTemplateVersion"("templateId", "status", "versionNumber" DESC);

-- CreateIndex
CREATE INDEX "ManagerEvaluationTemplateVersion_rubricVersionId_idx" ON "ManagerEvaluationTemplateVersion"("rubricVersionId");

-- CreateIndex
CREATE INDEX "ManagerEvaluationTemplateVersion_createdById_createdAt_idx" ON "ManagerEvaluationTemplateVersion"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "ManagerEvaluationTemplateVersion_activatedById_activatedAt_idx" ON "ManagerEvaluationTemplateVersion"("activatedById", "activatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerEvaluationTemplateVersion_templateId_versionNumber_key" ON "ManagerEvaluationTemplateVersion"("templateId", "versionNumber");

-- CreateIndex
CREATE INDEX "ManagerEvaluationCriterion_rubricCriterionId_idx" ON "ManagerEvaluationCriterion"("rubricCriterionId");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerEvaluationCriterion_templateVersionId_stableCriterio_key" ON "ManagerEvaluationCriterion"("templateVersionId", "stableCriterionId");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerEvaluationCriterion_templateVersionId_displayOrder_key" ON "ManagerEvaluationCriterion"("templateVersionId", "displayOrder");

-- CreateIndex
CREATE INDEX "ManagerEvaluationVisibilityPolicy_createdById_createdAt_idx" ON "ManagerEvaluationVisibilityPolicy"("createdById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerEvaluationVisibilityPolicy_organizationId_mode_versi_key" ON "ManagerEvaluationVisibilityPolicy"("organizationId", "mode", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerEvaluationVisibilityPolicy_id_mode_enabled_key" ON "ManagerEvaluationVisibilityPolicy"("id", "mode", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerEvaluationCycle_idempotencyKey_key" ON "ManagerEvaluationCycle"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerEvaluationCycle_employeeEvaluationCycleId_key" ON "ManagerEvaluationCycle"("employeeEvaluationCycleId");

-- CreateIndex
CREATE INDEX "ManagerEvaluationCycle_departmentId_state_startsAt_idx" ON "ManagerEvaluationCycle"("departmentId", "state", "startsAt");

-- CreateIndex
CREATE INDEX "ManagerEvaluationCycle_managerId_state_startsAt_idx" ON "ManagerEvaluationCycle"("managerId", "state", "startsAt");

-- CreateIndex
CREATE INDEX "ManagerEvaluationCycle_templateVersionId_idx" ON "ManagerEvaluationCycle"("templateVersionId");

-- CreateIndex
CREATE INDEX "ManagerEvaluationCycle_createdById_createdAt_idx" ON "ManagerEvaluationCycle"("createdById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerEvaluationCycleSnapshot_cycleId_key" ON "ManagerEvaluationCycleSnapshot"("cycleId");

-- CreateIndex
CREATE INDEX "ManagerEvaluationCycleSnapshot_departmentId_startsAt_idx" ON "ManagerEvaluationCycleSnapshot"("departmentId", "startsAt");

-- CreateIndex
CREATE INDEX "ManagerEvaluationCycleSnapshot_managerId_startsAt_idx" ON "ManagerEvaluationCycleSnapshot"("managerId", "startsAt");

-- CreateIndex
CREATE INDEX "ManagerEvaluationCycleSnapshot_templateVersionId_idx" ON "ManagerEvaluationCycleSnapshot"("templateVersionId");

-- CreateIndex
CREATE INDEX "ManagerEvaluationCycleSnapshot_rubricVersionId_idx" ON "ManagerEvaluationCycleSnapshot"("rubricVersionId");

-- CreateIndex
CREATE INDEX "ManagerEvaluationCycleSnapshot_visibilityPolicyId_idx" ON "ManagerEvaluationCycleSnapshot"("visibilityPolicyId");

-- CreateIndex
CREATE INDEX "ManagerEvaluatorEligibility_evaluatorId_cycleId_idx" ON "ManagerEvaluatorEligibility"("evaluatorId", "cycleId");

-- CreateIndex
CREATE INDEX "ManagerEvaluatorEligibility_cycleId_state_idx" ON "ManagerEvaluatorEligibility"("cycleId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerEvaluatorEligibility_cycleId_evaluatorId_key" ON "ManagerEvaluatorEligibility"("cycleId", "evaluatorId");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerEvaluatorEligibility_id_cycleId_evaluatorId_key" ON "ManagerEvaluatorEligibility"("id", "cycleId", "evaluatorId");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerEvaluatorEligibilityDecision_idempotencyKey_key" ON "ManagerEvaluatorEligibilityDecision"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ManagerEvaluatorEligibilityDecision_eligibilityId_effective_idx" ON "ManagerEvaluatorEligibilityDecision"("eligibilityId", "effectiveAt", "id");

-- CreateIndex
CREATE INDEX "ManagerEvaluatorEligibilityDecision_actorId_createdAt_idx" ON "ManagerEvaluatorEligibilityDecision"("actorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerEvaluatorEligibilityDecision_eligibilityId_resulting_key" ON "ManagerEvaluatorEligibilityDecision"("eligibilityId", "resultingVersion");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerEvaluationCycleTransition_idempotencyKey_key" ON "ManagerEvaluationCycleTransition"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ManagerEvaluationCycleTransition_cycleId_effectiveAt_id_idx" ON "ManagerEvaluationCycleTransition"("cycleId", "effectiveAt", "id");

-- CreateIndex
CREATE INDEX "ManagerEvaluationCycleTransition_actorId_createdAt_idx" ON "ManagerEvaluationCycleTransition"("actorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerEvaluationCycleTransition_cycleId_resultingVersion_key" ON "ManagerEvaluationCycleTransition"("cycleId", "resultingVersion");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerEvaluationResponse_idempotencyKey_key" ON "ManagerEvaluationResponse"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerEvaluationResponse_eligibilityId_key" ON "ManagerEvaluationResponse"("eligibilityId");

-- CreateIndex
CREATE INDEX "ManagerEvaluationResponse_managerId_submittedAt_idx" ON "ManagerEvaluationResponse"("managerId", "submittedAt");

-- CreateIndex
CREATE INDEX "ManagerEvaluationResponse_cycleSnapshotId_idx" ON "ManagerEvaluationResponse"("cycleSnapshotId");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerEvaluationResponse_cycleId_evaluatorId_key" ON "ManagerEvaluationResponse"("cycleId", "evaluatorId");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerEvaluationResponse_id_cycleId_key" ON "ManagerEvaluationResponse"("id", "cycleId");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerEvaluationResponse_eligibilityId_cycleId_evaluatorId_key" ON "ManagerEvaluationResponse"("eligibilityId", "cycleId", "evaluatorId");

-- CreateIndex
CREATE INDEX "ManagerCriterionResponse_criterionId_idx" ON "ManagerCriterionResponse"("criterionId");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerCriterionResponse_responseId_criterionId_key" ON "ManagerCriterionResponse"("responseId", "criterionId");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerCriterionResponse_responseId_position_key" ON "ManagerCriterionResponse"("responseId", "position");

-- CreateIndex
CREATE INDEX "ManagerEvaluationSummaryRevision_aiRunId_idx" ON "ManagerEvaluationSummaryRevision"("aiRunId");

-- CreateIndex
CREATE INDEX "ManagerEvaluationSummaryRevision_requestedById_createdAt_idx" ON "ManagerEvaluationSummaryRevision"("requestedById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerEvaluationSummaryRevision_cycleId_revision_key" ON "ManagerEvaluationSummaryRevision"("cycleId", "revision");

-- CreateIndex
CREATE INDEX "ManagerEvaluationSummarySource_responseId_idx" ON "ManagerEvaluationSummarySource"("responseId");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerEvaluationSummarySource_summaryRevisionId_position_key" ON "ManagerEvaluationSummarySource"("summaryRevisionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerEvaluationPrivateIdentityLink_responseId_key" ON "ManagerEvaluationPrivateIdentityLink"("responseId");

-- CreateIndex
CREATE INDEX "ManagerEvaluationPrivateIdentityLink_cycleId_mode_idx" ON "ManagerEvaluationPrivateIdentityLink"("cycleId", "mode");

-- AddForeignKey
ALTER TABLE "ManagerEvaluationTemplate" ADD CONSTRAINT "ManagerEvaluationTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerEvaluationTemplate" ADD CONSTRAINT "ManagerEvaluationTemplate_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerEvaluationTemplate" ADD CONSTRAINT "ManagerEvaluationTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerEvaluationTemplateVersion" ADD CONSTRAINT "ManagerEvaluationTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ManagerEvaluationTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerEvaluationTemplateVersion" ADD CONSTRAINT "ManagerEvaluationTemplateVersion_rubricVersionId_fkey" FOREIGN KEY ("rubricVersionId") REFERENCES "RubricVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerEvaluationTemplateVersion" ADD CONSTRAINT "ManagerEvaluationTemplateVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerEvaluationTemplateVersion" ADD CONSTRAINT "ManagerEvaluationTemplateVersion_activatedById_fkey" FOREIGN KEY ("activatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerEvaluationCriterion" ADD CONSTRAINT "ManagerEvaluationCriterion_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "ManagerEvaluationTemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerEvaluationCriterion" ADD CONSTRAINT "ManagerEvaluationCriterion_rubricCriterionId_fkey" FOREIGN KEY ("rubricCriterionId") REFERENCES "RubricCriterion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerEvaluationVisibilityPolicy" ADD CONSTRAINT "ManagerEvaluationVisibilityPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerEvaluationVisibilityPolicy" ADD CONSTRAINT "ManagerEvaluationVisibilityPolicy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerEvaluationCycle" ADD CONSTRAINT "ManagerEvaluationCycle_employeeEvaluationCycleId_fkey" FOREIGN KEY ("employeeEvaluationCycleId") REFERENCES "EmployeeEvaluationCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerEvaluationCycle" ADD CONSTRAINT "ManagerEvaluationCycle_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerEvaluationCycle" ADD CONSTRAINT "ManagerEvaluationCycle_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerEvaluationCycle" ADD CONSTRAINT "ManagerEvaluationCycle_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "ManagerEvaluationTemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerEvaluationCycle" ADD CONSTRAINT "ManagerEvaluationCycle_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerEvaluationCycleSnapshot" ADD CONSTRAINT "ManagerEvaluationCycleSnapshot_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ManagerEvaluationCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerEvaluationCycleSnapshot" ADD CONSTRAINT "ManagerEvaluationCycleSnapshot_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerEvaluationCycleSnapshot" ADD CONSTRAINT "ManagerEvaluationCycleSnapshot_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerEvaluationCycleSnapshot" ADD CONSTRAINT "ManagerEvaluationCycleSnapshot_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "ManagerEvaluationTemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerEvaluationCycleSnapshot" ADD CONSTRAINT "ManagerEvaluationCycleSnapshot_rubricVersionId_fkey" FOREIGN KEY ("rubricVersionId") REFERENCES "RubricVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerEvaluationCycleSnapshot" ADD CONSTRAINT "ManagerEvaluationCycleSnapshot_visibilityPolicyId_visibili_fkey" FOREIGN KEY ("visibilityPolicyId", "visibilityMode", "visibilityPolicyEnabled") REFERENCES "ManagerEvaluationVisibilityPolicy"("id", "mode", "enabled") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerEvaluatorEligibility" ADD CONSTRAINT "ManagerEvaluatorEligibility_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ManagerEvaluationCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerEvaluatorEligibility" ADD CONSTRAINT "ManagerEvaluatorEligibility_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerEvaluatorEligibilityDecision" ADD CONSTRAINT "ManagerEvaluatorEligibilityDecision_eligibilityId_fkey" FOREIGN KEY ("eligibilityId") REFERENCES "ManagerEvaluatorEligibility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerEvaluatorEligibilityDecision" ADD CONSTRAINT "ManagerEvaluatorEligibilityDecision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerEvaluationCycleTransition" ADD CONSTRAINT "ManagerEvaluationCycleTransition_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ManagerEvaluationCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerEvaluationCycleTransition" ADD CONSTRAINT "ManagerEvaluationCycleTransition_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerEvaluationResponse" ADD CONSTRAINT "ManagerEvaluationResponse_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ManagerEvaluationCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerEvaluationResponse" ADD CONSTRAINT "ManagerEvaluationResponse_cycleSnapshotId_fkey" FOREIGN KEY ("cycleSnapshotId") REFERENCES "ManagerEvaluationCycleSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerEvaluationResponse" ADD CONSTRAINT "ManagerEvaluationResponse_eligibilityId_cycleId_evaluatorI_fkey" FOREIGN KEY ("eligibilityId", "cycleId", "evaluatorId") REFERENCES "ManagerEvaluatorEligibility"("id", "cycleId", "evaluatorId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerEvaluationResponse" ADD CONSTRAINT "ManagerEvaluationResponse_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerEvaluationResponse" ADD CONSTRAINT "ManagerEvaluationResponse_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerCriterionResponse" ADD CONSTRAINT "ManagerCriterionResponse_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "ManagerEvaluationResponse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerCriterionResponse" ADD CONSTRAINT "ManagerCriterionResponse_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "ManagerEvaluationCriterion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerEvaluationSummaryRevision" ADD CONSTRAINT "ManagerEvaluationSummaryRevision_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ManagerEvaluationCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerEvaluationSummaryRevision" ADD CONSTRAINT "ManagerEvaluationSummaryRevision_aiRunId_fkey" FOREIGN KEY ("aiRunId") REFERENCES "AiRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerEvaluationSummaryRevision" ADD CONSTRAINT "ManagerEvaluationSummaryRevision_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerEvaluationSummarySource" ADD CONSTRAINT "ManagerEvaluationSummarySource_summaryRevisionId_fkey" FOREIGN KEY ("summaryRevisionId") REFERENCES "ManagerEvaluationSummaryRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerEvaluationSummarySource" ADD CONSTRAINT "ManagerEvaluationSummarySource_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "ManagerEvaluationResponse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerEvaluationPrivateIdentityLink" ADD CONSTRAINT "ManagerEvaluationPrivateIdentityLink_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ManagerEvaluationCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerEvaluationPrivateIdentityLink" ADD CONSTRAINT "ManagerEvaluationPrivateIdentityLink_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "ManagerEvaluationResponse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



ALTER TABLE "ManagerEvaluationTemplate"
  ADD CONSTRAINT "ManagerEvaluationTemplate_content_check"
    CHECK (length(btrim("key")) > 0 AND length(btrim("name")) > 0 AND "version" > 0);

ALTER TABLE "ManagerEvaluationTemplateVersion"
  ADD CONSTRAINT "ManagerEvaluationTemplateVersion_numbers_check"
    CHECK ("versionNumber" > 0 AND "schemaVersion" > 0 AND "version" > 0),
  ADD CONSTRAINT "ManagerEvaluationTemplateVersion_json_check"
    CHECK (
      jsonb_typeof("ratingScale") = 'array'
      AND jsonb_array_length("ratingScale") = 5
      AND jsonb_typeof("localeAvailability") = 'array'
      AND jsonb_typeof("configuration") = 'object'
    ),
  ADD CONSTRAINT "ManagerEvaluationTemplateVersion_activation_check"
    CHECK (
      ("status" = 'DRAFT' AND "activatedAt" IS NULL AND "activatedById" IS NULL AND "retiredAt" IS NULL)
      OR ("status" = 'ACTIVE' AND "activatedAt" IS NOT NULL AND "activatedById" IS NOT NULL AND "retiredAt" IS NULL)
      OR ("status" = 'RETIRED' AND "activatedAt" IS NOT NULL AND "activatedById" IS NOT NULL
          AND "retiredAt" IS NOT NULL AND "retiredAt" >= "activatedAt")
    );

ALTER TABLE "ManagerEvaluationCriterion"
  ADD CONSTRAINT "ManagerEvaluationCriterion_content_check"
    CHECK (
      length(btrim("stableCriterionId")) > 0
      AND "displayOrder" BETWEEN 0 AND 4
      AND jsonb_typeof("anchorSnapshot") = 'array'
      AND jsonb_array_length("anchorSnapshot") = 5
    );

ALTER TABLE "ManagerEvaluationVisibilityPolicy"
  ADD CONSTRAINT "ManagerEvaluationVisibilityPolicy_versions_check"
    CHECK ("version" > 0 AND "schemaVersion" > 0 AND jsonb_typeof("policy") = 'object'),
  ADD CONSTRAINT "ManagerEvaluationVisibilityPolicy_pilot_modes_check"
    CHECK (
      (
        "mode" = 'IDENTIFIED'
        AND "enabled" = true
        AND "managerCanReadIdentity" = true
        AND "managerCanReadOriginals" = true
        AND "immediateVisibility" = true
      )
      OR (
        "mode" IN ('MANAGER_BLINDED', 'ANONYMOUS_AGGREGATED')
        AND "enabled" = false
        AND "managerCanReadIdentity" = false
        AND "managerCanReadOriginals" = false
        AND "immediateVisibility" = false
      )
    );

ALTER TABLE "ManagerEvaluationCycle"
  ADD CONSTRAINT "ManagerEvaluationCycle_period_check" CHECK ("startsAt" < "endsAt"),
  ADD CONSTRAINT "ManagerEvaluationCycle_versions_check" CHECK ("schemaVersion" > 0 AND "version" > 0),
  ADD CONSTRAINT "ManagerEvaluationCycle_identified_pilot_check" CHECK ("visibilityMode" = 'IDENTIFIED'),
  ADD CONSTRAINT "ManagerEvaluationCycle_terminal_state_check"
    CHECK (
      ("state" = 'CLOSED' AND "openedAt" IS NOT NULL AND "closedAt" IS NOT NULL AND "cancelledAt" IS NULL)
      OR ("state" = 'CANCELLED' AND "closedAt" IS NULL AND "cancelledAt" IS NOT NULL)
      OR ("state" NOT IN ('CLOSED', 'CANCELLED') AND "closedAt" IS NULL AND "cancelledAt" IS NULL)
    );

ALTER TABLE "ManagerEvaluationCycleSnapshot"
  ADD CONSTRAINT "ManagerEvaluationCycleSnapshot_period_check" CHECK ("startsAt" < "endsAt"),
  ADD CONSTRAINT "ManagerEvaluationCycleSnapshot_identified_pilot_check"
    CHECK ("visibilityMode" = 'IDENTIFIED' AND "visibilityPolicyEnabled" = true),
  ADD CONSTRAINT "ManagerEvaluationCycleSnapshot_content_check"
    CHECK (
      "schemaVersion" > 0
      AND jsonb_typeof("ratingScale") = 'array'
      AND jsonb_array_length("ratingScale") = 5
      AND jsonb_typeof("criteriaSnapshot") = 'array'
      AND jsonb_array_length("criteriaSnapshot") = 5
      AND jsonb_typeof("eligibilityRuleSnapshot") = 'object'
      AND jsonb_typeof("localeAvailability") = 'array'
    );

ALTER TABLE "ManagerEvaluatorEligibility"
  ADD CONSTRAINT "ManagerEvaluatorEligibility_content_check"
    CHECK (
      length(btrim("reason")) > 0
      AND "version" > 0
      AND jsonb_typeof("relationshipSnapshot") = 'object'
      AND jsonb_typeof("leaveSnapshot") = 'object'
    );

ALTER TABLE "ManagerEvaluatorEligibilityDecision"
  ADD CONSTRAINT "ManagerEvaluatorEligibilityDecision_content_check"
    CHECK (
      "fromState" <> "toState"
      AND length(btrim("reason")) > 0
      AND "resultingVersion" > 1
    );

ALTER TABLE "ManagerEvaluationCycleTransition"
  ADD CONSTRAINT "ManagerEvaluationCycleTransition_content_check"
    CHECK (
      "fromState" <> "toState"
      AND length(btrim("reason")) > 0
      AND "resultingVersion" > 1
    );

ALTER TABLE "ManagerEvaluationResponse"
  ADD CONSTRAINT "ManagerEvaluationResponse_identified_check"
    CHECK (
      "visibilityMode" = 'IDENTIFIED'
      AND "identifiedNoticeConfirmed" = true
      AND "evaluatorId" <> "managerId"
      AND "visibleToManagerAt" = "submittedAt"
      AND "schemaVersion" > 0
    );

ALTER TABLE "ManagerCriterionResponse"
  ADD CONSTRAINT "ManagerCriterionResponse_content_check"
    CHECK ("rating" BETWEEN 1 AND 5 AND "position" BETWEEN 0 AND 4 AND length("comment") <= 8000);

ALTER TABLE "ManagerEvaluationSummaryRevision"
  ADD CONSTRAINT "ManagerEvaluationSummaryRevision_content_check"
    CHECK (
      "revision" > 0
      AND "schemaVersion" > 0
      AND "visibilityMode" = 'IDENTIFIED'
      AND "periodStartsAt" < "periodEndsAt"
      AND jsonb_typeof("distributions") = 'array'
      AND jsonb_typeof("themes") = 'array'
      AND jsonb_typeof("limitations") = 'array'
      AND length(btrim("promptVersion")) > 0
      AND length(btrim("outputSchemaVersion")) > 0
    );

ALTER TABLE "ManagerEvaluationSummarySource"
  ADD CONSTRAINT "ManagerEvaluationSummarySource_position_check" CHECK ("position" >= 0);

ALTER TABLE "ManagerEvaluationPrivateIdentityLink"
  ADD CONSTRAINT "ManagerEvaluationPrivateIdentityLink_disabled_check"
    CHECK (
      "mode" IN ('MANAGER_BLINDED', 'ANONYMOUS_AGGREGATED')
      AND "enabled" = false
      AND "schemaVersion" > 0
      AND length(btrim("sealedIdentityReference")) > 0
    );

CREATE FUNCTION "prevent_manager_evaluation_history_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'manager evaluation history is append-only' USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "protect_manager_evaluation_template_version"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'manager evaluation template versions are historical records' USING ERRCODE = '55000';
  END IF;
  IF OLD."status" <> 'DRAFT' THEN
    RAISE EXCEPTION 'active or retired manager evaluation template versions are immutable' USING ERRCODE = '55000';
  END IF;
  IF NEW."id" <> OLD."id"
     OR NEW."templateId" <> OLD."templateId"
     OR NEW."rubricVersionId" <> OLD."rubricVersionId"
     OR NEW."versionNumber" <> OLD."versionNumber"
     OR NEW."schemaVersion" <> OLD."schemaVersion"
     OR NEW."createdById" <> OLD."createdById"
     OR NEW."createdAt" <> OLD."createdAt"
     OR NEW."version" <> OLD."version" + 1 THEN
    RAISE EXCEPTION 'manager evaluation template version update requires the next optimistic version' USING ERRCODE = '40001';
  END IF;
  IF NEW."status" NOT IN ('DRAFT', 'ACTIVE') THEN
    RAISE EXCEPTION 'draft manager evaluation template may only remain draft or become active' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "protect_manager_evaluation_cycle"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'manager evaluation cycles are historical records' USING ERRCODE = '55000';
  END IF;
  IF OLD."state" IN ('CLOSED', 'CANCELLED') THEN
    RAISE EXCEPTION 'terminal manager evaluation cycles are immutable' USING ERRCODE = '55000';
  END IF;
  IF NEW."id" <> OLD."id"
     OR NEW."idempotencyKey" <> OLD."idempotencyKey"
     OR NEW."employeeEvaluationCycleId" <> OLD."employeeEvaluationCycleId"
     OR NEW."departmentId" <> OLD."departmentId"
     OR NEW."managerId" <> OLD."managerId"
     OR NEW."templateVersionId" <> OLD."templateVersionId"
     OR NEW."visibilityMode" <> OLD."visibilityMode"
     OR NEW."startsAt" <> OLD."startsAt"
     OR NEW."endsAt" <> OLD."endsAt"
     OR NEW."schemaVersion" <> OLD."schemaVersion"
     OR NEW."createdById" <> OLD."createdById"
     OR NEW."createdAt" <> OLD."createdAt"
     OR NEW."version" <> OLD."version" + 1 THEN
    RAISE EXCEPTION 'manager evaluation cycle update requires the next optimistic version' USING ERRCODE = '40001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "protect_manager_evaluator_eligibility"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'manager evaluator eligibility is historical' USING ERRCODE = '55000';
  END IF;
  IF OLD."state" = 'SUBMITTED' THEN
    RAISE EXCEPTION 'submitted manager evaluator eligibility is immutable' USING ERRCODE = '55000';
  END IF;
  IF NEW."id" <> OLD."id"
     OR NEW."cycleId" <> OLD."cycleId"
     OR NEW."evaluatorId" <> OLD."evaluatorId"
     OR NEW."relationshipSnapshot" <> OLD."relationshipSnapshot"
     OR NEW."leaveSnapshot" <> OLD."leaveSnapshot"
     OR NEW."createdAt" <> OLD."createdAt"
     OR NEW."version" <> OLD."version" + 1 THEN
    RAISE EXCEPTION 'manager evaluator eligibility update requires the next optimistic version' USING ERRCODE = '40001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "enforce_manager_template_exact_five_criteria"() RETURNS trigger AS $$
DECLARE
  criterion_count INTEGER;
BEGIN
  IF NEW."status" = 'ACTIVE' THEN
    SELECT count(*) INTO criterion_count
      FROM "ManagerEvaluationCriterion"
      WHERE "templateVersionId" = NEW."id";
    IF criterion_count <> 5 THEN
      RAISE EXCEPTION 'active manager evaluation templates require exactly five criteria' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "enforce_active_manager_template_criterion_count"() RETURNS trigger AS $$
DECLARE
  target_template_id UUID;
  template_status "ManagerEvaluationTemplateStatus";
  criterion_count INTEGER;
BEGIN
  target_template_id := COALESCE(NEW."templateVersionId", OLD."templateVersionId");
  SELECT "status" INTO template_status
    FROM "ManagerEvaluationTemplateVersion"
    WHERE "id" = target_template_id;
  IF template_status = 'ACTIVE' THEN
    SELECT count(*) INTO criterion_count
      FROM "ManagerEvaluationCriterion"
      WHERE "templateVersionId" = target_template_id;
    IF criterion_count <> 5 THEN
      RAISE EXCEPTION 'active manager evaluation templates require exactly five criteria' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "enforce_manager_response_exact_five_criteria"() RETURNS trigger AS $$
DECLARE
  target_response_id UUID;
  criterion_count INTEGER;
  distinct_criteria INTEGER;
  distinct_positions INTEGER;
  aligned_count INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'ManagerEvaluationResponse' THEN
    target_response_id := COALESCE(NEW."id", OLD."id");
  ELSE
    target_response_id := COALESCE(NEW."responseId", OLD."responseId");
  END IF;

  IF EXISTS (SELECT 1 FROM "ManagerEvaluationResponse" WHERE "id" = target_response_id) THEN
    SELECT count(*), count(DISTINCT criterion_response."criterionId"),
           count(DISTINCT criterion_response."position"),
           count(*) FILTER (
             WHERE criterion."templateVersionId" = snapshot."templateVersionId"
               AND response."cycleId" = snapshot."cycleId"
               AND response."managerId" = snapshot."managerId"
           )
      INTO criterion_count, distinct_criteria, distinct_positions, aligned_count
      FROM "ManagerEvaluationResponse" response
      JOIN "ManagerEvaluationCycleSnapshot" snapshot ON snapshot."id" = response."cycleSnapshotId"
      LEFT JOIN "ManagerCriterionResponse" criterion_response ON criterion_response."responseId" = response."id"
      LEFT JOIN "ManagerEvaluationCriterion" criterion ON criterion."id" = criterion_response."criterionId"
      WHERE response."id" = target_response_id
      GROUP BY response."id";

    IF criterion_count <> 5 OR distinct_criteria <> 5 OR distinct_positions <> 5 OR aligned_count <> 5 THEN
      RAISE EXCEPTION 'submitted manager evaluation responses require exactly five frozen-template criteria' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ManagerEvaluationTemplateVersion_protected"
  BEFORE UPDATE OR DELETE ON "ManagerEvaluationTemplateVersion"
  FOR EACH ROW EXECUTE FUNCTION "protect_manager_evaluation_template_version"();
CREATE TRIGGER "ManagerEvaluationCycle_protected"
  BEFORE UPDATE OR DELETE ON "ManagerEvaluationCycle"
  FOR EACH ROW EXECUTE FUNCTION "protect_manager_evaluation_cycle"();
CREATE TRIGGER "ManagerEvaluatorEligibility_protected"
  BEFORE UPDATE OR DELETE ON "ManagerEvaluatorEligibility"
  FOR EACH ROW EXECUTE FUNCTION "protect_manager_evaluator_eligibility"();

CREATE TRIGGER "ManagerEvaluationCriterion_append_only" BEFORE UPDATE OR DELETE ON "ManagerEvaluationCriterion" FOR EACH ROW EXECUTE FUNCTION "prevent_manager_evaluation_history_mutation"();
CREATE TRIGGER "ManagerEvaluationVisibilityPolicy_append_only" BEFORE UPDATE OR DELETE ON "ManagerEvaluationVisibilityPolicy" FOR EACH ROW EXECUTE FUNCTION "prevent_manager_evaluation_history_mutation"();
CREATE TRIGGER "ManagerEvaluationCycleSnapshot_append_only" BEFORE UPDATE OR DELETE ON "ManagerEvaluationCycleSnapshot" FOR EACH ROW EXECUTE FUNCTION "prevent_manager_evaluation_history_mutation"();
CREATE TRIGGER "ManagerEvaluatorEligibilityDecision_append_only" BEFORE UPDATE OR DELETE ON "ManagerEvaluatorEligibilityDecision" FOR EACH ROW EXECUTE FUNCTION "prevent_manager_evaluation_history_mutation"();
CREATE TRIGGER "ManagerEvaluationCycleTransition_append_only" BEFORE UPDATE OR DELETE ON "ManagerEvaluationCycleTransition" FOR EACH ROW EXECUTE FUNCTION "prevent_manager_evaluation_history_mutation"();
CREATE TRIGGER "ManagerEvaluationResponse_append_only" BEFORE UPDATE OR DELETE ON "ManagerEvaluationResponse" FOR EACH ROW EXECUTE FUNCTION "prevent_manager_evaluation_history_mutation"();
CREATE TRIGGER "ManagerCriterionResponse_append_only" BEFORE UPDATE OR DELETE ON "ManagerCriterionResponse" FOR EACH ROW EXECUTE FUNCTION "prevent_manager_evaluation_history_mutation"();
CREATE TRIGGER "ManagerEvaluationSummaryRevision_append_only" BEFORE UPDATE OR DELETE ON "ManagerEvaluationSummaryRevision" FOR EACH ROW EXECUTE FUNCTION "prevent_manager_evaluation_history_mutation"();
CREATE TRIGGER "ManagerEvaluationSummarySource_append_only" BEFORE UPDATE OR DELETE ON "ManagerEvaluationSummarySource" FOR EACH ROW EXECUTE FUNCTION "prevent_manager_evaluation_history_mutation"();
CREATE TRIGGER "ManagerEvaluationPrivateIdentityLink_append_only" BEFORE UPDATE OR DELETE ON "ManagerEvaluationPrivateIdentityLink" FOR EACH ROW EXECUTE FUNCTION "prevent_manager_evaluation_history_mutation"();

CREATE CONSTRAINT TRIGGER "ManagerEvaluationTemplateVersion_exact_five_criteria"
  AFTER INSERT OR UPDATE ON "ManagerEvaluationTemplateVersion"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
  EXECUTE FUNCTION "enforce_manager_template_exact_five_criteria"();
CREATE CONSTRAINT TRIGGER "ManagerEvaluationCriterion_exact_five_template_criteria"
  AFTER INSERT OR UPDATE OR DELETE ON "ManagerEvaluationCriterion"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
  EXECUTE FUNCTION "enforce_active_manager_template_criterion_count"();
CREATE CONSTRAINT TRIGGER "ManagerEvaluationResponse_exact_five_criteria"
  AFTER INSERT OR UPDATE ON "ManagerEvaluationResponse"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
  EXECUTE FUNCTION "enforce_manager_response_exact_five_criteria"();
CREATE CONSTRAINT TRIGGER "ManagerCriterionResponse_exact_five_criteria"
  AFTER INSERT OR UPDATE OR DELETE ON "ManagerCriterionResponse"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
  EXECUTE FUNCTION "enforce_manager_response_exact_five_criteria"();
