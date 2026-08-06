CREATE TYPE "EvaluationTemplateScope" AS ENUM ('ORGANIZATION', 'DEPARTMENT');
CREATE TYPE "EvaluationTemplateVersionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');
CREATE TYPE "EvaluationTemplateItemKind" AS ENUM ('FIXED_CRITERION', 'PROJECT_CONTRIBUTION');
CREATE TYPE "EmployeeEvaluationCycleState" AS ENUM (
  'DRAFT', 'OPEN_PREPARATION', 'SELF_ASSESSMENT', 'MANAGER_ASSESSMENT',
  'COMPARISON', 'FINALIZATION', 'ACKNOWLEDGMENT', 'CLOSED', 'CANCELLED'
);
CREATE TYPE "EmployeeEvaluationCycleType" AS ENUM ('CALIBRATION_NON_BASELINE', 'STANDARD');
CREATE TYPE "EmployeeEvaluationEligibilityState" AS ENUM (
  'ELIGIBLE', 'EXCLUDED', 'APPROVED_LEAVE', 'PENDING_REVIEW'
);
CREATE TYPE "EmployeeAssessmentKind" AS ENUM ('SELF', 'MANAGER_INITIAL');
CREATE TYPE "EvaluationAcknowledgmentKind" AS ENUM (
  'ACKNOWLEDGED', 'ACKNOWLEDGED_WITH_RESERVATION', 'NO_RESPONSE'
);

CREATE TABLE "EvaluationTemplate" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "departmentId" UUID,
  "scope" "EvaluationTemplateScope" NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "EvaluationTemplate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EvaluationTemplate_version_check" CHECK ("version" > 0),
  CONSTRAINT "EvaluationTemplate_scope_check" CHECK (
    ("scope" = 'ORGANIZATION' AND "departmentId" IS NULL)
    OR ("scope" = 'DEPARTMENT' AND "departmentId" IS NOT NULL)
  ),
  CONSTRAINT "EvaluationTemplate_key_check" CHECK (length(btrim("key")) > 0),
  CONSTRAINT "EvaluationTemplate_name_check" CHECK (length(btrim("name")) > 0)
);

CREATE TABLE "EvaluationTemplateVersion" (
  "id" UUID NOT NULL,
  "templateId" UUID NOT NULL,
  "rubricVersionId" UUID NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "status" "EvaluationTemplateVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "ratingScale" JSONB NOT NULL,
  "weightPolicy" JSONB NOT NULL,
  "evaluationPolicy" JSONB NOT NULL,
  "localeAvailability" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdById" UUID NOT NULL,
  "activatedById" UUID,
  "activatedAt" TIMESTAMPTZ(6),
  "retiredAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "EvaluationTemplateVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EvaluationTemplateVersion_numbers_check" CHECK (
    "versionNumber" > 0 AND "schemaVersion" > 0 AND "version" > 0
  ),
  CONSTRAINT "EvaluationTemplateVersion_json_check" CHECK (
    jsonb_typeof("ratingScale") = 'array'
    AND jsonb_typeof("weightPolicy") = 'object'
    AND jsonb_typeof("evaluationPolicy") = 'object'
    AND jsonb_typeof("localeAvailability") = 'array'
  ),
  CONSTRAINT "EvaluationTemplateVersion_activation_check" CHECK (
    ("status" = 'DRAFT' AND "activatedAt" IS NULL AND "activatedById" IS NULL AND "retiredAt" IS NULL)
    OR ("status" = 'ACTIVE' AND "activatedAt" IS NOT NULL AND "activatedById" IS NOT NULL AND "retiredAt" IS NULL)
    OR ("status" = 'RETIRED' AND "activatedAt" IS NOT NULL AND "activatedById" IS NOT NULL AND "retiredAt" IS NOT NULL AND "retiredAt" >= "activatedAt")
  )
);

CREATE TABLE "EvaluationTemplateItem" (
  "id" UUID NOT NULL,
  "versionId" UUID NOT NULL,
  "stableCriterionId" TEXT NOT NULL,
  "kind" "EvaluationTemplateItemKind" NOT NULL,
  "sectionStableId" TEXT NOT NULL,
  "sectionWeight" INTEGER NOT NULL,
  "criterionWeight" INTEGER,
  "displayOrder" INTEGER NOT NULL,
  "protectedGlobal" BOOLEAN NOT NULL DEFAULT false,
  "mandatory" BOOLEAN NOT NULL DEFAULT true,
  "allowedWeightMinimum" INTEGER,
  "allowedWeightMaximum" INTEGER,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EvaluationTemplateItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EvaluationTemplateItem_stable_ids_check" CHECK (
    length(btrim("stableCriterionId")) > 0 AND length(btrim("sectionStableId")) > 0
  ),
  CONSTRAINT "EvaluationTemplateItem_weights_check" CHECK (
    "sectionWeight" BETWEEN 0 AND 100
    AND ("criterionWeight" IS NULL OR "criterionWeight" BETWEEN 0 AND 100)
    AND ("allowedWeightMinimum" IS NULL OR "allowedWeightMinimum" BETWEEN 0 AND 100)
    AND ("allowedWeightMaximum" IS NULL OR "allowedWeightMaximum" BETWEEN 0 AND 100)
    AND ("allowedWeightMinimum" IS NULL OR "allowedWeightMaximum" IS NULL OR "allowedWeightMinimum" <= "allowedWeightMaximum")
  ),
  CONSTRAINT "EvaluationTemplateItem_kind_check" CHECK (
    ("kind" = 'FIXED_CRITERION' AND "criterionWeight" IS NOT NULL)
    OR ("kind" = 'PROJECT_CONTRIBUTION' AND "criterionWeight" IS NULL)
  ),
  CONSTRAINT "EvaluationTemplateItem_display_order_check" CHECK ("displayOrder" >= 0)
);

CREATE TABLE "EvaluationTemplateItemLocale" (
  "id" UUID NOT NULL,
  "itemId" UUID NOT NULL,
  "locale" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "definition" TEXT NOT NULL,
  "anchors" JSONB NOT NULL,
  "examples" JSONB NOT NULL,
  "evidenceGuidance" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EvaluationTemplateItemLocale_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EvaluationTemplateItemLocale_content_check" CHECK (
    length(btrim("locale")) > 0
    AND length(btrim("title")) > 0
    AND length(btrim("definition")) > 0
    AND jsonb_typeof("anchors") = 'array'
    AND jsonb_typeof("examples") = 'array'
    AND jsonb_typeof("evidenceGuidance") = 'array'
  )
);

CREATE TABLE "EmployeeEvaluationCycle" (
  "id" UUID NOT NULL,
  "idempotencyKey" UUID NOT NULL,
  "departmentId" UUID NOT NULL,
  "templateVersionId" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "cycleType" "EmployeeEvaluationCycleType" NOT NULL,
  "state" "EmployeeEvaluationCycleState" NOT NULL DEFAULT 'DRAFT',
  "visibilityMode" "FeedbackVisibilityMode" NOT NULL DEFAULT 'identified',
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
  CONSTRAINT "EmployeeEvaluationCycle_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmployeeEvaluationCycle_period_check" CHECK ("startsAt" < "endsAt"),
  CONSTRAINT "EmployeeEvaluationCycle_versions_check" CHECK (
    "sequence" > 0 AND "schemaVersion" > 0 AND "version" > 0
  ),
  CONSTRAINT "EmployeeEvaluationCycle_first_cycle_calibration_check" CHECK (
    "sequence" <> 1 OR "cycleType" = 'CALIBRATION_NON_BASELINE'
  ),
  CONSTRAINT "EmployeeEvaluationCycle_terminal_state_check" CHECK (
    ("state" = 'CLOSED' AND "openedAt" IS NOT NULL AND "closedAt" IS NOT NULL AND "cancelledAt" IS NULL)
    OR ("state" = 'CANCELLED' AND "closedAt" IS NULL AND "cancelledAt" IS NOT NULL)
    OR ("state" NOT IN ('CLOSED', 'CANCELLED') AND "closedAt" IS NULL AND "cancelledAt" IS NULL)
  )
);

CREATE TABLE "EmployeeEvaluationCycleSnapshot" (
  "id" UUID NOT NULL,
  "cycleId" UUID NOT NULL,
  "templateVersionId" UUID NOT NULL,
  "rubricVersionId" UUID NOT NULL,
  "eligibilitySnapshotId" UUID NOT NULL,
  "cycleType" "EmployeeEvaluationCycleType" NOT NULL,
  "visibilityMode" "FeedbackVisibilityMode" NOT NULL,
  "startsAt" TIMESTAMPTZ(6) NOT NULL,
  "endsAt" TIMESTAMPTZ(6) NOT NULL,
  "ratingScale" JSONB NOT NULL,
  "templateSnapshot" JSONB NOT NULL,
  "localeAvailability" JSONB NOT NULL,
  "configurationVersions" JSONB NOT NULL,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmployeeEvaluationCycleSnapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmployeeEvaluationCycleSnapshot_period_check" CHECK ("startsAt" < "endsAt"),
  CONSTRAINT "EmployeeEvaluationCycleSnapshot_schema_check" CHECK ("schemaVersion" > 0),
  CONSTRAINT "EmployeeEvaluationCycleSnapshot_json_check" CHECK (
    jsonb_typeof("ratingScale") = 'array'
    AND jsonb_typeof("templateSnapshot") = 'object'
    AND jsonb_typeof("localeAvailability") = 'array'
    AND jsonb_typeof("configurationVersions") = 'object'
  )
);

CREATE TABLE "EvaluationAssignment" (
  "id" UUID NOT NULL,
  "cycleId" UUID NOT NULL,
  "employeeId" UUID NOT NULL,
  "managerId" UUID NOT NULL,
  "eligibilityState" "EmployeeEvaluationEligibilityState" NOT NULL,
  "eligibilityReason" TEXT NOT NULL,
  "eligibilityEffectiveAt" TIMESTAMPTZ(6) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "EvaluationAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EvaluationAssignment_version_check" CHECK ("version" > 0),
  CONSTRAINT "EvaluationAssignment_reason_check" CHECK (length(btrim("eligibilityReason")) > 0),
  CONSTRAINT "EvaluationAssignment_distinct_people_check" CHECK ("employeeId" <> "managerId")
);

CREATE TABLE "EvaluationEligibilityDecision" (
  "id" UUID NOT NULL,
  "idempotencyKey" UUID NOT NULL,
  "assignmentId" UUID NOT NULL,
  "fromState" "EmployeeEvaluationEligibilityState" NOT NULL,
  "toState" "EmployeeEvaluationEligibilityState" NOT NULL,
  "effectiveAt" TIMESTAMPTZ(6) NOT NULL,
  "reason" TEXT NOT NULL,
  "actorId" UUID NOT NULL,
  "resultingVersion" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EvaluationEligibilityDecision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EvaluationEligibilityDecision_version_check" CHECK ("resultingVersion" > 1),
  CONSTRAINT "EvaluationEligibilityDecision_transition_check" CHECK ("fromState" <> "toState"),
  CONSTRAINT "EvaluationEligibilityDecision_reason_check" CHECK (length(btrim("reason")) > 0)
);

CREATE TABLE "EmployeeEvaluationCycleTransition" (
  "id" UUID NOT NULL,
  "idempotencyKey" UUID NOT NULL,
  "cycleId" UUID NOT NULL,
  "fromState" "EmployeeEvaluationCycleState" NOT NULL,
  "toState" "EmployeeEvaluationCycleState" NOT NULL,
  "reason" TEXT NOT NULL,
  "actorId" UUID NOT NULL,
  "resultingVersion" INTEGER NOT NULL,
  "effectiveAt" TIMESTAMPTZ(6) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmployeeEvaluationCycleTransition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmployeeEvaluationCycleTransition_version_check" CHECK ("resultingVersion" > 1),
  CONSTRAINT "EmployeeEvaluationCycleTransition_change_check" CHECK ("fromState" <> "toState"),
  CONSTRAINT "EmployeeEvaluationCycleTransition_reason_check" CHECK (length(btrim("reason")) > 0)
);

CREATE TABLE "Assessment" (
  "id" UUID NOT NULL,
  "assignmentId" UUID NOT NULL,
  "kind" "EmployeeAssessmentKind" NOT NULL,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Assessment_versions_check" CHECK ("schemaVersion" > 0 AND "version" > 0)
);

CREATE TABLE "AssessmentRevision" (
  "id" UUID NOT NULL,
  "idempotencyKey" UUID NOT NULL,
  "assessmentId" UUID NOT NULL,
  "revision" INTEGER NOT NULL,
  "entries" JSONB NOT NULL,
  "aiRunId" UUID,
  "createdById" UUID NOT NULL,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssessmentRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AssessmentRevision_versions_check" CHECK ("revision" > 0 AND "schemaVersion" > 0),
  CONSTRAINT "AssessmentRevision_entries_check" CHECK (jsonb_typeof("entries") = 'array')
);

CREATE TABLE "AssessmentSubmission" (
  "id" UUID NOT NULL,
  "idempotencyKey" UUID NOT NULL,
  "assignmentId" UUID NOT NULL,
  "kind" "EmployeeAssessmentKind" NOT NULL,
  "assessmentId" UUID NOT NULL,
  "revisionId" UUID NOT NULL,
  "cycleSnapshotId" UUID NOT NULL,
  "submittedById" UUID NOT NULL,
  "selfProjectionAccessedBeforeSubmit" BOOLEAN NOT NULL DEFAULT false,
  "confirmedAt" TIMESTAMPTZ(6) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssessmentSubmission_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AssessmentSubmission_independence_check" CHECK (
    "kind" <> 'MANAGER_INITIAL' OR "selfProjectionAccessedBeforeSubmit" = false
  )
);

CREATE TABLE "EvaluationDiscussionEntry" (
  "id" UUID NOT NULL,
  "idempotencyKey" UUID NOT NULL,
  "assignmentId" UUID NOT NULL,
  "actorId" UUID NOT NULL,
  "body" TEXT NOT NULL,
  "sourceReferences" JSONB NOT NULL,
  "resultingVersion" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EvaluationDiscussionEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EvaluationDiscussionEntry_version_check" CHECK ("resultingVersion" > 0),
  CONSTRAINT "EvaluationDiscussionEntry_body_check" CHECK (length(btrim("body")) > 0),
  CONSTRAINT "EvaluationDiscussionEntry_sources_check" CHECK (jsonb_typeof("sourceReferences") = 'array')
);

CREATE TABLE "FinalEvaluationSnapshot" (
  "id" UUID NOT NULL,
  "idempotencyKey" UUID NOT NULL,
  "assignmentId" UUID NOT NULL,
  "cycleId" UUID NOT NULL,
  "employeeId" UUID NOT NULL,
  "managerId" UUID NOT NULL,
  "templateVersionId" UUID NOT NULL,
  "cycleType" "EmployeeEvaluationCycleType" NOT NULL,
  "finalComment" TEXT,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "version" INTEGER NOT NULL DEFAULT 1,
  "finalizedAt" TIMESTAMPTZ(6) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinalEvaluationSnapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FinalEvaluationSnapshot_versions_check" CHECK ("schemaVersion" > 0 AND "version" > 0),
  CONSTRAINT "FinalEvaluationSnapshot_distinct_people_check" CHECK ("employeeId" <> "managerId")
);

CREATE TABLE "FinalEvaluationDecision" (
  "id" UUID NOT NULL,
  "snapshotId" UUID NOT NULL,
  "assignmentId" UUID NOT NULL,
  "templateItemId" UUID NOT NULL,
  "stableCriterionId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "justification" TEXT NOT NULL,
  "sourceReferences" JSONB NOT NULL,
  "managerInitialChangeReason" TEXT,
  "managerId" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinalEvaluationDecision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FinalEvaluationDecision_rating_check" CHECK ("rating" BETWEEN 1 AND 5),
  CONSTRAINT "FinalEvaluationDecision_justification_check" CHECK (length(btrim("justification")) > 0),
  CONSTRAINT "FinalEvaluationDecision_sources_check" CHECK (jsonb_typeof("sourceReferences") = 'array'),
  CONSTRAINT "FinalEvaluationDecision_position_check" CHECK ("position" >= 0),
  CONSTRAINT "FinalEvaluationDecision_stable_id_check" CHECK (length(btrim("stableCriterionId")) > 0)
);

CREATE TABLE "EvaluationAcknowledgment" (
  "id" UUID NOT NULL,
  "idempotencyKey" UUID NOT NULL,
  "assignmentId" UUID NOT NULL,
  "finalSnapshotId" UUID NOT NULL,
  "actorId" UUID NOT NULL,
  "kind" "EvaluationAcknowledgmentKind" NOT NULL,
  "reservation" TEXT,
  "recordedAt" TIMESTAMPTZ(6) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EvaluationAcknowledgment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EvaluationAcknowledgment_reservation_check" CHECK (
    ("kind" = 'ACKNOWLEDGED_WITH_RESERVATION' AND length(btrim("reservation")) > 0)
    OR ("kind" <> 'ACKNOWLEDGED_WITH_RESERVATION' AND "reservation" IS NULL)
  )
);

CREATE INDEX "EvaluationTemplate_organizationId_scope_key_idx" ON "EvaluationTemplate"("organizationId", "scope", "key");
CREATE INDEX "EvaluationTemplate_departmentId_key_idx" ON "EvaluationTemplate"("departmentId", "key");
CREATE INDEX "EvaluationTemplate_createdById_createdAt_idx" ON "EvaluationTemplate"("createdById", "createdAt");
CREATE UNIQUE INDEX "EvaluationTemplate_organizationId_departmentId_key_key" ON "EvaluationTemplate"("organizationId", "departmentId", "key");

CREATE INDEX "EvaluationTemplateVersion_templateId_status_versionNumber_idx" ON "EvaluationTemplateVersion"("templateId", "status", "versionNumber" DESC);
CREATE INDEX "EvaluationTemplateVersion_rubricVersionId_idx" ON "EvaluationTemplateVersion"("rubricVersionId");
CREATE INDEX "EvaluationTemplateVersion_createdById_createdAt_idx" ON "EvaluationTemplateVersion"("createdById", "createdAt");
CREATE INDEX "EvaluationTemplateVersion_activatedById_activatedAt_idx" ON "EvaluationTemplateVersion"("activatedById", "activatedAt");
CREATE UNIQUE INDEX "EvaluationTemplateVersion_templateId_versionNumber_key" ON "EvaluationTemplateVersion"("templateId", "versionNumber");

CREATE INDEX "EvaluationTemplateItem_versionId_sectionStableId_displayOrd_idx" ON "EvaluationTemplateItem"("versionId", "sectionStableId", "displayOrder");
CREATE UNIQUE INDEX "EvaluationTemplateItem_versionId_stableCriterionId_key" ON "EvaluationTemplateItem"("versionId", "stableCriterionId");
CREATE UNIQUE INDEX "EvaluationTemplateItem_versionId_displayOrder_key" ON "EvaluationTemplateItem"("versionId", "displayOrder");
CREATE UNIQUE INDEX "EvaluationTemplateItem_id_stableCriterionId_key" ON "EvaluationTemplateItem"("id", "stableCriterionId");
CREATE INDEX "EvaluationTemplateItemLocale_locale_itemId_idx" ON "EvaluationTemplateItemLocale"("locale", "itemId");
CREATE UNIQUE INDEX "EvaluationTemplateItemLocale_itemId_locale_key" ON "EvaluationTemplateItemLocale"("itemId", "locale");

CREATE UNIQUE INDEX "EmployeeEvaluationCycle_idempotencyKey_key" ON "EmployeeEvaluationCycle"("idempotencyKey");
CREATE INDEX "EmployeeEvaluationCycle_departmentId_state_startsAt_idx" ON "EmployeeEvaluationCycle"("departmentId", "state", "startsAt");
CREATE INDEX "EmployeeEvaluationCycle_templateVersionId_idx" ON "EmployeeEvaluationCycle"("templateVersionId");
CREATE INDEX "EmployeeEvaluationCycle_createdById_createdAt_idx" ON "EmployeeEvaluationCycle"("createdById", "createdAt");
CREATE UNIQUE INDEX "EmployeeEvaluationCycle_departmentId_sequence_key" ON "EmployeeEvaluationCycle"("departmentId", "sequence");

CREATE UNIQUE INDEX "EmployeeEvaluationCycleSnapshot_cycleId_key" ON "EmployeeEvaluationCycleSnapshot"("cycleId");
CREATE INDEX "EmployeeEvaluationCycleSnapshot_templateVersionId_idx" ON "EmployeeEvaluationCycleSnapshot"("templateVersionId");
CREATE INDEX "EmployeeEvaluationCycleSnapshot_rubricVersionId_idx" ON "EmployeeEvaluationCycleSnapshot"("rubricVersionId");
CREATE INDEX "EmployeeEvaluationCycleSnapshot_eligibilitySnapshotId_idx" ON "EmployeeEvaluationCycleSnapshot"("eligibilitySnapshotId");

CREATE INDEX "EvaluationAssignment_employeeId_cycleId_idx" ON "EvaluationAssignment"("employeeId", "cycleId");
CREATE INDEX "EvaluationAssignment_managerId_cycleId_idx" ON "EvaluationAssignment"("managerId", "cycleId");
CREATE INDEX "EvaluationAssignment_cycleId_eligibilityState_idx" ON "EvaluationAssignment"("cycleId", "eligibilityState");
CREATE UNIQUE INDEX "EvaluationAssignment_cycleId_employeeId_key" ON "EvaluationAssignment"("cycleId", "employeeId");

CREATE UNIQUE INDEX "EvaluationEligibilityDecision_idempotencyKey_key" ON "EvaluationEligibilityDecision"("idempotencyKey");
CREATE INDEX "EvaluationEligibilityDecision_assignmentId_effectiveAt_id_idx" ON "EvaluationEligibilityDecision"("assignmentId", "effectiveAt", "id");
CREATE INDEX "EvaluationEligibilityDecision_actorId_createdAt_idx" ON "EvaluationEligibilityDecision"("actorId", "createdAt");
CREATE UNIQUE INDEX "EvaluationEligibilityDecision_assignmentId_resultingVersion_key" ON "EvaluationEligibilityDecision"("assignmentId", "resultingVersion");

CREATE UNIQUE INDEX "EmployeeEvaluationCycleTransition_idempotencyKey_key" ON "EmployeeEvaluationCycleTransition"("idempotencyKey");
CREATE INDEX "EmployeeEvaluationCycleTransition_cycleId_effectiveAt_id_idx" ON "EmployeeEvaluationCycleTransition"("cycleId", "effectiveAt", "id");
CREATE INDEX "EmployeeEvaluationCycleTransition_actorId_createdAt_idx" ON "EmployeeEvaluationCycleTransition"("actorId", "createdAt");
CREATE UNIQUE INDEX "EmployeeEvaluationCycleTransition_cycleId_resultingVersion_key" ON "EmployeeEvaluationCycleTransition"("cycleId", "resultingVersion");

CREATE INDEX "Assessment_assignmentId_createdAt_idx" ON "Assessment"("assignmentId", "createdAt");
CREATE UNIQUE INDEX "Assessment_assignmentId_kind_key" ON "Assessment"("assignmentId", "kind");
CREATE UNIQUE INDEX "Assessment_id_assignmentId_kind_key" ON "Assessment"("id", "assignmentId", "kind");
CREATE UNIQUE INDEX "AssessmentRevision_idempotencyKey_key" ON "AssessmentRevision"("idempotencyKey");
CREATE INDEX "AssessmentRevision_aiRunId_idx" ON "AssessmentRevision"("aiRunId");
CREATE INDEX "AssessmentRevision_createdById_createdAt_idx" ON "AssessmentRevision"("createdById", "createdAt");
CREATE UNIQUE INDEX "AssessmentRevision_assessmentId_revision_key" ON "AssessmentRevision"("assessmentId", "revision");

CREATE UNIQUE INDEX "AssessmentSubmission_idempotencyKey_key" ON "AssessmentSubmission"("idempotencyKey");
CREATE INDEX "AssessmentSubmission_cycleSnapshotId_idx" ON "AssessmentSubmission"("cycleSnapshotId");
CREATE INDEX "AssessmentSubmission_submittedById_confirmedAt_idx" ON "AssessmentSubmission"("submittedById", "confirmedAt");
CREATE UNIQUE INDEX "AssessmentSubmission_assignmentId_kind_key" ON "AssessmentSubmission"("assignmentId", "kind");
CREATE UNIQUE INDEX "AssessmentSubmission_assessmentId_key" ON "AssessmentSubmission"("assessmentId");
CREATE UNIQUE INDEX "AssessmentSubmission_revisionId_key" ON "AssessmentSubmission"("revisionId");

CREATE UNIQUE INDEX "EvaluationDiscussionEntry_idempotencyKey_key" ON "EvaluationDiscussionEntry"("idempotencyKey");
CREATE INDEX "EvaluationDiscussionEntry_assignmentId_createdAt_id_idx" ON "EvaluationDiscussionEntry"("assignmentId", "createdAt", "id");
CREATE INDEX "EvaluationDiscussionEntry_actorId_createdAt_idx" ON "EvaluationDiscussionEntry"("actorId", "createdAt");
CREATE UNIQUE INDEX "EvaluationDiscussionEntry_assignmentId_resultingVersion_key" ON "EvaluationDiscussionEntry"("assignmentId", "resultingVersion");

CREATE UNIQUE INDEX "FinalEvaluationSnapshot_idempotencyKey_key" ON "FinalEvaluationSnapshot"("idempotencyKey");
CREATE UNIQUE INDEX "FinalEvaluationSnapshot_assignmentId_key" ON "FinalEvaluationSnapshot"("assignmentId");
CREATE INDEX "FinalEvaluationSnapshot_cycleId_finalizedAt_idx" ON "FinalEvaluationSnapshot"("cycleId", "finalizedAt");
CREATE INDEX "FinalEvaluationSnapshot_employeeId_finalizedAt_idx" ON "FinalEvaluationSnapshot"("employeeId", "finalizedAt");
CREATE INDEX "FinalEvaluationSnapshot_managerId_finalizedAt_idx" ON "FinalEvaluationSnapshot"("managerId", "finalizedAt");
CREATE INDEX "FinalEvaluationSnapshot_templateVersionId_idx" ON "FinalEvaluationSnapshot"("templateVersionId");

CREATE INDEX "FinalEvaluationDecision_assignmentId_stableCriterionId_idx" ON "FinalEvaluationDecision"("assignmentId", "stableCriterionId");
CREATE INDEX "FinalEvaluationDecision_templateItemId_idx" ON "FinalEvaluationDecision"("templateItemId");
CREATE INDEX "FinalEvaluationDecision_managerId_createdAt_idx" ON "FinalEvaluationDecision"("managerId", "createdAt");
CREATE UNIQUE INDEX "FinalEvaluationDecision_snapshotId_stableCriterionId_key" ON "FinalEvaluationDecision"("snapshotId", "stableCriterionId");
CREATE UNIQUE INDEX "FinalEvaluationDecision_snapshotId_position_key" ON "FinalEvaluationDecision"("snapshotId", "position");

CREATE UNIQUE INDEX "EvaluationAcknowledgment_idempotencyKey_key" ON "EvaluationAcknowledgment"("idempotencyKey");
CREATE UNIQUE INDEX "EvaluationAcknowledgment_assignmentId_key" ON "EvaluationAcknowledgment"("assignmentId");
CREATE UNIQUE INDEX "EvaluationAcknowledgment_finalSnapshotId_key" ON "EvaluationAcknowledgment"("finalSnapshotId");
CREATE INDEX "EvaluationAcknowledgment_actorId_recordedAt_idx" ON "EvaluationAcknowledgment"("actorId", "recordedAt");

ALTER TABLE "EvaluationTemplate" ADD CONSTRAINT "EvaluationTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvaluationTemplate" ADD CONSTRAINT "EvaluationTemplate_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvaluationTemplate" ADD CONSTRAINT "EvaluationTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvaluationTemplateVersion" ADD CONSTRAINT "EvaluationTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EvaluationTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvaluationTemplateVersion" ADD CONSTRAINT "EvaluationTemplateVersion_rubricVersionId_fkey" FOREIGN KEY ("rubricVersionId") REFERENCES "RubricVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvaluationTemplateVersion" ADD CONSTRAINT "EvaluationTemplateVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvaluationTemplateVersion" ADD CONSTRAINT "EvaluationTemplateVersion_activatedById_fkey" FOREIGN KEY ("activatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvaluationTemplateItem" ADD CONSTRAINT "EvaluationTemplateItem_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "EvaluationTemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvaluationTemplateItemLocale" ADD CONSTRAINT "EvaluationTemplateItemLocale_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "EvaluationTemplateItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EmployeeEvaluationCycle" ADD CONSTRAINT "EmployeeEvaluationCycle_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeEvaluationCycle" ADD CONSTRAINT "EmployeeEvaluationCycle_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "EvaluationTemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeEvaluationCycle" ADD CONSTRAINT "EmployeeEvaluationCycle_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeEvaluationCycleSnapshot" ADD CONSTRAINT "EmployeeEvaluationCycleSnapshot_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "EmployeeEvaluationCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeEvaluationCycleSnapshot" ADD CONSTRAINT "EmployeeEvaluationCycleSnapshot_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "EvaluationTemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeEvaluationCycleSnapshot" ADD CONSTRAINT "EmployeeEvaluationCycleSnapshot_rubricVersionId_fkey" FOREIGN KEY ("rubricVersionId") REFERENCES "RubricVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeEvaluationCycleSnapshot" ADD CONSTRAINT "EmployeeEvaluationCycleSnapshot_eligibilitySnapshotId_fkey" FOREIGN KEY ("eligibilitySnapshotId") REFERENCES "EligibilitySnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EvaluationAssignment" ADD CONSTRAINT "EvaluationAssignment_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "EmployeeEvaluationCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvaluationAssignment" ADD CONSTRAINT "EvaluationAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvaluationAssignment" ADD CONSTRAINT "EvaluationAssignment_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvaluationEligibilityDecision" ADD CONSTRAINT "EvaluationEligibilityDecision_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "EvaluationAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvaluationEligibilityDecision" ADD CONSTRAINT "EvaluationEligibilityDecision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeEvaluationCycleTransition" ADD CONSTRAINT "EmployeeEvaluationCycleTransition_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "EmployeeEvaluationCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeEvaluationCycleTransition" ADD CONSTRAINT "EmployeeEvaluationCycleTransition_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "EvaluationAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentRevision" ADD CONSTRAINT "AssessmentRevision_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentRevision" ADD CONSTRAINT "AssessmentRevision_aiRunId_fkey" FOREIGN KEY ("aiRunId") REFERENCES "AiRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentRevision" ADD CONSTRAINT "AssessmentRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentSubmission" ADD CONSTRAINT "AssessmentSubmission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "EvaluationAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentSubmission" ADD CONSTRAINT "AssessmentSubmission_assessmentId_assignmentId_kind_fkey" FOREIGN KEY ("assessmentId", "assignmentId", "kind") REFERENCES "Assessment"("id", "assignmentId", "kind") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentSubmission" ADD CONSTRAINT "AssessmentSubmission_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "AssessmentRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentSubmission" ADD CONSTRAINT "AssessmentSubmission_cycleSnapshotId_fkey" FOREIGN KEY ("cycleSnapshotId") REFERENCES "EmployeeEvaluationCycleSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentSubmission" ADD CONSTRAINT "AssessmentSubmission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvaluationDiscussionEntry" ADD CONSTRAINT "EvaluationDiscussionEntry_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "EvaluationAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvaluationDiscussionEntry" ADD CONSTRAINT "EvaluationDiscussionEntry_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FinalEvaluationSnapshot" ADD CONSTRAINT "FinalEvaluationSnapshot_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "EvaluationAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinalEvaluationSnapshot" ADD CONSTRAINT "FinalEvaluationSnapshot_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "EmployeeEvaluationCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinalEvaluationSnapshot" ADD CONSTRAINT "FinalEvaluationSnapshot_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinalEvaluationSnapshot" ADD CONSTRAINT "FinalEvaluationSnapshot_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinalEvaluationSnapshot" ADD CONSTRAINT "FinalEvaluationSnapshot_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "EvaluationTemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinalEvaluationDecision" ADD CONSTRAINT "FinalEvaluationDecision_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "FinalEvaluationSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinalEvaluationDecision" ADD CONSTRAINT "FinalEvaluationDecision_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "EvaluationAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinalEvaluationDecision" ADD CONSTRAINT "FinalEvaluationDecision_templateItemId_stableCriterionId_fkey" FOREIGN KEY ("templateItemId", "stableCriterionId") REFERENCES "EvaluationTemplateItem"("id", "stableCriterionId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinalEvaluationDecision" ADD CONSTRAINT "FinalEvaluationDecision_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvaluationAcknowledgment" ADD CONSTRAINT "EvaluationAcknowledgment_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "EvaluationAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvaluationAcknowledgment" ADD CONSTRAINT "EvaluationAcknowledgment_finalSnapshotId_fkey" FOREIGN KEY ("finalSnapshotId") REFERENCES "FinalEvaluationSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvaluationAcknowledgment" ADD CONSTRAINT "EvaluationAcknowledgment_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "prevent_employee_evaluation_history_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "protect_evaluation_template_version"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" <> 'DRAFT' THEN
      RAISE EXCEPTION 'active or retired evaluation template versions are immutable' USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD."status" <> 'DRAFT' THEN
    RAISE EXCEPTION 'active or retired evaluation template versions are immutable' USING ERRCODE = '55000';
  END IF;

  IF NEW."id" <> OLD."id"
     OR NEW."templateId" <> OLD."templateId"
     OR NEW."rubricVersionId" <> OLD."rubricVersionId"
     OR NEW."versionNumber" <> OLD."versionNumber"
     OR NEW."schemaVersion" <> OLD."schemaVersion"
     OR NEW."createdById" <> OLD."createdById"
     OR NEW."createdAt" <> OLD."createdAt"
     OR NEW."version" <> OLD."version" + 1 THEN
    RAISE EXCEPTION 'evaluation template version update requires the next optimistic version' USING ERRCODE = '40001';
  END IF;

  IF NEW."status" NOT IN ('DRAFT', 'ACTIVE') THEN
    RAISE EXCEPTION 'draft evaluation template version may only remain draft or become active' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "protect_employee_evaluation_cycle"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'employee evaluation cycles are historical records' USING ERRCODE = '55000';
  END IF;
  IF OLD."state" IN ('CLOSED', 'CANCELLED') THEN
    RAISE EXCEPTION 'terminal employee evaluation cycles are immutable' USING ERRCODE = '55000';
  END IF;
  IF NEW."id" <> OLD."id"
     OR NEW."idempotencyKey" <> OLD."idempotencyKey"
     OR NEW."departmentId" <> OLD."departmentId"
     OR NEW."templateVersionId" <> OLD."templateVersionId"
     OR NEW."sequence" <> OLD."sequence"
     OR NEW."cycleType" <> OLD."cycleType"
     OR NEW."visibilityMode" <> OLD."visibilityMode"
     OR NEW."startsAt" <> OLD."startsAt"
     OR NEW."endsAt" <> OLD."endsAt"
     OR NEW."schemaVersion" <> OLD."schemaVersion"
     OR NEW."createdById" <> OLD."createdById"
     OR NEW."createdAt" <> OLD."createdAt"
     OR NEW."version" <> OLD."version" + 1 THEN
    RAISE EXCEPTION 'employee evaluation cycle update requires the next optimistic version' USING ERRCODE = '40001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "protect_evaluation_assignment"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'evaluation assignments are historical records' USING ERRCODE = '55000';
  END IF;
  IF NEW."id" <> OLD."id"
     OR NEW."cycleId" <> OLD."cycleId"
     OR NEW."employeeId" <> OLD."employeeId"
     OR NEW."managerId" <> OLD."managerId"
     OR NEW."createdAt" <> OLD."createdAt"
     OR NEW."version" <> OLD."version" + 1 THEN
    RAISE EXCEPTION 'evaluation assignment update requires the next optimistic version' USING ERRCODE = '40001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "protect_assessment_root"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'assessments are historical records' USING ERRCODE = '55000';
  END IF;
  IF EXISTS (SELECT 1 FROM "AssessmentSubmission" submission WHERE submission."assessmentId" = OLD."id") THEN
    RAISE EXCEPTION 'submitted assessments are immutable' USING ERRCODE = '55000';
  END IF;
  IF NEW."id" <> OLD."id"
     OR NEW."assignmentId" <> OLD."assignmentId"
     OR NEW."kind" <> OLD."kind"
     OR NEW."schemaVersion" <> OLD."schemaVersion"
     OR NEW."createdAt" <> OLD."createdAt"
     OR NEW."version" <> OLD."version" + 1 THEN
    RAISE EXCEPTION 'assessment update requires the next optimistic version' USING ERRCODE = '40001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "EvaluationTemplateVersion_protected" BEFORE UPDATE OR DELETE ON "EvaluationTemplateVersion" FOR EACH ROW EXECUTE FUNCTION "protect_evaluation_template_version"();
CREATE TRIGGER "EmployeeEvaluationCycle_protected" BEFORE UPDATE OR DELETE ON "EmployeeEvaluationCycle" FOR EACH ROW EXECUTE FUNCTION "protect_employee_evaluation_cycle"();
CREATE TRIGGER "EvaluationAssignment_protected" BEFORE UPDATE OR DELETE ON "EvaluationAssignment" FOR EACH ROW EXECUTE FUNCTION "protect_evaluation_assignment"();
CREATE TRIGGER "Assessment_protected" BEFORE UPDATE OR DELETE ON "Assessment" FOR EACH ROW EXECUTE FUNCTION "protect_assessment_root"();

CREATE TRIGGER "EvaluationTemplateItem_append_only" BEFORE UPDATE OR DELETE ON "EvaluationTemplateItem" FOR EACH ROW EXECUTE FUNCTION "prevent_employee_evaluation_history_mutation"();
CREATE TRIGGER "EvaluationTemplateItemLocale_append_only" BEFORE UPDATE OR DELETE ON "EvaluationTemplateItemLocale" FOR EACH ROW EXECUTE FUNCTION "prevent_employee_evaluation_history_mutation"();
CREATE TRIGGER "EmployeeEvaluationCycleSnapshot_append_only" BEFORE UPDATE OR DELETE ON "EmployeeEvaluationCycleSnapshot" FOR EACH ROW EXECUTE FUNCTION "prevent_employee_evaluation_history_mutation"();
CREATE TRIGGER "EvaluationEligibilityDecision_append_only" BEFORE UPDATE OR DELETE ON "EvaluationEligibilityDecision" FOR EACH ROW EXECUTE FUNCTION "prevent_employee_evaluation_history_mutation"();
CREATE TRIGGER "EmployeeEvaluationCycleTransition_append_only" BEFORE UPDATE OR DELETE ON "EmployeeEvaluationCycleTransition" FOR EACH ROW EXECUTE FUNCTION "prevent_employee_evaluation_history_mutation"();
CREATE TRIGGER "AssessmentRevision_append_only" BEFORE UPDATE OR DELETE ON "AssessmentRevision" FOR EACH ROW EXECUTE FUNCTION "prevent_employee_evaluation_history_mutation"();
CREATE TRIGGER "AssessmentSubmission_append_only" BEFORE UPDATE OR DELETE ON "AssessmentSubmission" FOR EACH ROW EXECUTE FUNCTION "prevent_employee_evaluation_history_mutation"();
CREATE TRIGGER "EvaluationDiscussionEntry_append_only" BEFORE UPDATE OR DELETE ON "EvaluationDiscussionEntry" FOR EACH ROW EXECUTE FUNCTION "prevent_employee_evaluation_history_mutation"();
CREATE TRIGGER "FinalEvaluationDecision_append_only" BEFORE UPDATE OR DELETE ON "FinalEvaluationDecision" FOR EACH ROW EXECUTE FUNCTION "prevent_employee_evaluation_history_mutation"();
CREATE TRIGGER "FinalEvaluationSnapshot_append_only" BEFORE UPDATE OR DELETE ON "FinalEvaluationSnapshot" FOR EACH ROW EXECUTE FUNCTION "prevent_employee_evaluation_history_mutation"();
CREATE TRIGGER "EvaluationAcknowledgment_append_only" BEFORE UPDATE OR DELETE ON "EvaluationAcknowledgment" FOR EACH ROW EXECUTE FUNCTION "prevent_employee_evaluation_history_mutation"();
