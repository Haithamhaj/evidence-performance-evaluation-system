CREATE TYPE "CoachingInsightState" AS ENUM ('DRAFT', 'REVIEW_REQUIRED', 'DECIDED');
CREATE TYPE "CoachingConfidence" AS ENUM ('SUPPORTED', 'REVIEW_REQUIRED', 'LIMITED');
CREATE TYPE "CoachingInsightDecisionKind" AS ENUM ('ACCEPT', 'EDIT_AND_ACCEPT', 'DEFER', 'REJECT', 'SUPERSEDE');
CREATE TYPE "DevelopmentActionState" AS ENUM ('DRAFT', 'ACCEPTED', 'ACTIVE', 'COMPLETED', 'DEFERRED', 'CANCELLED', 'SUPERSEDED');
CREATE TYPE "DevelopmentActionPrivacy" AS ENUM ('PRIVATE', 'SHARED');
CREATE TYPE "ManagerSupportKind" AS ENUM ('COMMENT', 'RESOURCE', 'APPLICATION_OPPORTUNITY', 'DISCUSSION_REQUEST');
CREATE TYPE "FormalDevelopmentPlanState" AS ENUM ('DRAFT', 'EMPLOYEE_APPROVED', 'MANAGER_AGREED', 'ACTIVE', 'COMPLETED', 'CLOSED', 'WITHDRAWN');
CREATE TYPE "FormalPlanAgreementKind" AS ENUM ('EMPLOYEE_APPROVED', 'MANAGER_AGREED');

CREATE TABLE "CoachingInsight" (
  "id" UUID NOT NULL, "employeeId" UUID NOT NULL, "state" "CoachingInsightState" NOT NULL DEFAULT 'DRAFT',
  "currentRevisionId" UUID, "version" INTEGER NOT NULL DEFAULT 1, "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "CoachingInsight_pkey" PRIMARY KEY ("id"));
CREATE TABLE "CoachingInsightRevision" (
  "id" UUID NOT NULL, "insightId" UUID NOT NULL, "revision" INTEGER NOT NULL, "pattern" TEXT NOT NULL,
  "periodStartsAt" TIMESTAMPTZ(6) NOT NULL, "periodEndsAt" TIMESTAMPTZ(6) NOT NULL, "confidence" "CoachingConfidence" NOT NULL,
  "confidenceBasis" TEXT NOT NULL, "limitations" JSONB NOT NULL, "conflicts" JSONB NOT NULL, "cannotConclude" TEXT NOT NULL,
  "actionDraft" JSONB, "promptVersion" TEXT, "outputSchemaVersion" TEXT, "aiRunId" UUID, "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "CoachingInsightRevision_pkey" PRIMARY KEY ("id"));
CREATE TABLE "CoachingInsightSource" (
  "id" UUID NOT NULL, "insightId" UUID NOT NULL, "revisionId" UUID NOT NULL, "sourceId" UUID NOT NULL,
  "sourceKind" TEXT NOT NULL, "excerpt" TEXT, "position" INTEGER NOT NULL, "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CoachingInsightSource_pkey" PRIMARY KEY ("id"));
CREATE TABLE "CoachingInsightDecision" (
  "id" UUID NOT NULL, "idempotencyKey" UUID NOT NULL, "insightId" UUID NOT NULL, "employeeId" UUID NOT NULL,
  "decision" "CoachingInsightDecisionKind" NOT NULL, "privateReason" TEXT, "personalNote" TEXT, "resultingVersion" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "CoachingInsightDecision_pkey" PRIMARY KEY ("id"));
CREATE TABLE "DevelopmentAction" (
  "id" UUID NOT NULL, "employeeId" UUID NOT NULL, "insightId" UUID, "privacy" "DevelopmentActionPrivacy" NOT NULL DEFAULT 'PRIVATE',
  "state" "DevelopmentActionState" NOT NULL DEFAULT 'DRAFT', "currentRevisionId" UUID, "version" INTEGER NOT NULL DEFAULT 1,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1, "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL, CONSTRAINT "DevelopmentAction_pkey" PRIMARY KEY ("id"));
CREATE TABLE "DevelopmentActionRevision" (
  "id" UUID NOT NULL, "actionId" UUID NOT NULL, "revision" INTEGER NOT NULL, "title" TEXT NOT NULL, "objective" TEXT NOT NULL,
  "expectedBenefit" TEXT NOT NULL, "activity" TEXT NOT NULL, "completionEvidenceDefinition" TEXT NOT NULL, "targetDate" TIMESTAMPTZ(6),
  "projectId" UUID, "researchId" UUID, "workItemId" UUID, "employeeSelectedContext" TEXT, "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "DevelopmentActionRevision_pkey" PRIMARY KEY ("id"));
CREATE TABLE "DevelopmentActionTransition" (
  "id" UUID NOT NULL, "idempotencyKey" UUID NOT NULL, "actionId" UUID NOT NULL, "fromState" "DevelopmentActionState" NOT NULL,
  "toState" "DevelopmentActionState" NOT NULL, "fromPrivacy" "DevelopmentActionPrivacy" NOT NULL, "toPrivacy" "DevelopmentActionPrivacy" NOT NULL,
  "actorId" UUID NOT NULL, "resultingVersion" INTEGER NOT NULL, "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DevelopmentActionTransition_pkey" PRIMARY KEY ("id"));
CREATE TABLE "ManagerSupportEntry" (
  "id" UUID NOT NULL, "idempotencyKey" UUID NOT NULL, "actionId" UUID NOT NULL, "managerId" UUID NOT NULL,
  "kind" "ManagerSupportKind" NOT NULL, "body" TEXT NOT NULL, "resourceUrl" TEXT, "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManagerSupportEntry_pkey" PRIMARY KEY ("id"));
CREATE TABLE "FormalDevelopmentPlan" (
  "id" UUID NOT NULL, "employeeId" UUID NOT NULL, "managerId" UUID NOT NULL, "actionId" UUID, "state" "FormalDevelopmentPlanState" NOT NULL DEFAULT 'DRAFT',
  "currentRevisionId" UUID, "version" INTEGER NOT NULL DEFAULT 1, "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "FormalDevelopmentPlan_pkey" PRIMARY KEY ("id"));
CREATE TABLE "FormalDevelopmentPlanRevision" (
  "id" UUID NOT NULL, "planId" UUID NOT NULL, "revision" INTEGER NOT NULL, "developmentArea" TEXT NOT NULL, "reason" TEXT NOT NULL,
  "expectedBehavior" TEXT NOT NULL, "activities" JSONB NOT NULL, "followUpOwnerId" UUID NOT NULL, "targetDate" TIMESTAMPTZ(6),
  "completionEvidenceDefinition" TEXT NOT NULL, "sourceEvaluationAssignmentId" UUID, "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "FormalDevelopmentPlanRevision_pkey" PRIMARY KEY ("id"));
CREATE TABLE "FormalDevelopmentPlanAgreement" (
  "id" UUID NOT NULL, "idempotencyKey" UUID NOT NULL, "planId" UUID NOT NULL, "revisionId" UUID NOT NULL,
  "kind" "FormalPlanAgreementKind" NOT NULL, "actorId" UUID NOT NULL, "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FormalDevelopmentPlanAgreement_pkey" PRIMARY KEY ("id"));
CREATE TABLE "FormalDevelopmentPlanTransition" (
  "id" UUID NOT NULL, "idempotencyKey" UUID NOT NULL, "planId" UUID NOT NULL, "fromState" "FormalDevelopmentPlanState" NOT NULL,
  "toState" "FormalDevelopmentPlanState" NOT NULL, "actorId" UUID NOT NULL, "resultingVersion" INTEGER NOT NULL,
  "reason" TEXT, "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "FormalDevelopmentPlanTransition_pkey" PRIMARY KEY ("id"));
CREATE TABLE "FormalDevelopmentPlanEvidenceLink" (
  "id" UUID NOT NULL, "planId" UUID NOT NULL, "evidenceId" UUID NOT NULL, "confirmed" BOOLEAN NOT NULL DEFAULT false,
  "confirmedAt" TIMESTAMPTZ(6), "confirmedById" UUID, "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FormalDevelopmentPlanEvidenceLink_pkey" PRIMARY KEY ("id"));

CREATE UNIQUE INDEX "CoachingInsight_currentRevisionId_key" ON "CoachingInsight"("currentRevisionId");
CREATE UNIQUE INDEX "CoachingInsightRevision_insightId_revision_key" ON "CoachingInsightRevision"("insightId", "revision");
CREATE UNIQUE INDEX "CoachingInsightSource_revisionId_sourceId_key" ON "CoachingInsightSource"("revisionId", "sourceId");
CREATE UNIQUE INDEX "CoachingInsightDecision_idempotencyKey_key" ON "CoachingInsightDecision"("idempotencyKey");
CREATE UNIQUE INDEX "DevelopmentAction_currentRevisionId_key" ON "DevelopmentAction"("currentRevisionId");
CREATE UNIQUE INDEX "DevelopmentActionRevision_actionId_revision_key" ON "DevelopmentActionRevision"("actionId", "revision");
CREATE UNIQUE INDEX "DevelopmentActionTransition_idempotencyKey_key" ON "DevelopmentActionTransition"("idempotencyKey");
CREATE UNIQUE INDEX "ManagerSupportEntry_idempotencyKey_key" ON "ManagerSupportEntry"("idempotencyKey");
CREATE UNIQUE INDEX "FormalDevelopmentPlan_currentRevisionId_key" ON "FormalDevelopmentPlan"("currentRevisionId");
CREATE UNIQUE INDEX "FormalDevelopmentPlanRevision_planId_revision_key" ON "FormalDevelopmentPlanRevision"("planId", "revision");
CREATE UNIQUE INDEX "FormalDevelopmentPlanAgreement_idempotencyKey_key" ON "FormalDevelopmentPlanAgreement"("idempotencyKey");
CREATE UNIQUE INDEX "FormalDevelopmentPlanAgreement_planId_revisionId_kind_key" ON "FormalDevelopmentPlanAgreement"("planId", "revisionId", "kind");
CREATE UNIQUE INDEX "FormalDevelopmentPlanTransition_idempotencyKey_key" ON "FormalDevelopmentPlanTransition"("idempotencyKey");
CREATE UNIQUE INDEX "FormalDevelopmentPlanEvidenceLink_planId_evidenceId_key" ON "FormalDevelopmentPlanEvidenceLink"("planId", "evidenceId");
CREATE INDEX "CoachingInsight_employeeId_state_createdAt_idx" ON "CoachingInsight"("employeeId", "state", "createdAt");
CREATE INDEX "CoachingInsightRevision_createdById_createdAt_idx" ON "CoachingInsightRevision"("createdById", "createdAt");
CREATE INDEX "CoachingInsightSource_insightId_revisionId_idx" ON "CoachingInsightSource"("insightId", "revisionId");
CREATE INDEX "CoachingInsightDecision_insightId_createdAt_idx" ON "CoachingInsightDecision"("insightId", "createdAt");
CREATE INDEX "DevelopmentAction_employeeId_privacy_state_createdAt_idx" ON "DevelopmentAction"("employeeId", "privacy", "state", "createdAt");
CREATE INDEX "DevelopmentActionTransition_actionId_createdAt_idx" ON "DevelopmentActionTransition"("actionId", "createdAt");
CREATE INDEX "ManagerSupportEntry_actionId_createdAt_idx" ON "ManagerSupportEntry"("actionId", "createdAt");
CREATE INDEX "FormalDevelopmentPlan_employeeId_state_createdAt_idx" ON "FormalDevelopmentPlan"("employeeId", "state", "createdAt");
CREATE INDEX "FormalDevelopmentPlan_managerId_state_createdAt_idx" ON "FormalDevelopmentPlan"("managerId", "state", "createdAt");
CREATE INDEX "FormalDevelopmentPlanTransition_planId_createdAt_idx" ON "FormalDevelopmentPlanTransition"("planId", "createdAt");

ALTER TABLE "CoachingInsight" ADD CONSTRAINT "CoachingInsight_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CoachingInsightRevision" ADD CONSTRAINT "CoachingInsightRevision_insightId_fkey" FOREIGN KEY ("insightId") REFERENCES "CoachingInsight"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CoachingInsightRevision" ADD CONSTRAINT "CoachingInsightRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CoachingInsightSource" ADD CONSTRAINT "CoachingInsightSource_insightId_fkey" FOREIGN KEY ("insightId") REFERENCES "CoachingInsight"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CoachingInsightDecision" ADD CONSTRAINT "CoachingInsightDecision_insightId_fkey" FOREIGN KEY ("insightId") REFERENCES "CoachingInsight"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CoachingInsightDecision" ADD CONSTRAINT "CoachingInsightDecision_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DevelopmentAction" ADD CONSTRAINT "DevelopmentAction_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DevelopmentActionRevision" ADD CONSTRAINT "DevelopmentActionRevision_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "DevelopmentAction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DevelopmentActionRevision" ADD CONSTRAINT "DevelopmentActionRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DevelopmentActionTransition" ADD CONSTRAINT "DevelopmentActionTransition_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "DevelopmentAction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DevelopmentActionTransition" ADD CONSTRAINT "DevelopmentActionTransition_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManagerSupportEntry" ADD CONSTRAINT "ManagerSupportEntry_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "DevelopmentAction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManagerSupportEntry" ADD CONSTRAINT "ManagerSupportEntry_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FormalDevelopmentPlan" ADD CONSTRAINT "FormalDevelopmentPlan_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FormalDevelopmentPlan" ADD CONSTRAINT "FormalDevelopmentPlan_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FormalDevelopmentPlan" ADD CONSTRAINT "FormalDevelopmentPlan_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "DevelopmentAction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FormalDevelopmentPlanRevision" ADD CONSTRAINT "FormalDevelopmentPlanRevision_planId_fkey" FOREIGN KEY ("planId") REFERENCES "FormalDevelopmentPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FormalDevelopmentPlanRevision" ADD CONSTRAINT "FormalDevelopmentPlanRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FormalDevelopmentPlanAgreement" ADD CONSTRAINT "FormalDevelopmentPlanAgreement_planId_fkey" FOREIGN KEY ("planId") REFERENCES "FormalDevelopmentPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FormalDevelopmentPlanAgreement" ADD CONSTRAINT "FormalDevelopmentPlanAgreement_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FormalDevelopmentPlanTransition" ADD CONSTRAINT "FormalDevelopmentPlanTransition_planId_fkey" FOREIGN KEY ("planId") REFERENCES "FormalDevelopmentPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FormalDevelopmentPlanTransition" ADD CONSTRAINT "FormalDevelopmentPlanTransition_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FormalDevelopmentPlanEvidenceLink" ADD CONSTRAINT "FormalDevelopmentPlanEvidenceLink_planId_fkey" FOREIGN KEY ("planId") REFERENCES "FormalDevelopmentPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
