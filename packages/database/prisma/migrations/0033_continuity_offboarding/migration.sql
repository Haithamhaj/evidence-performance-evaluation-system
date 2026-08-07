CREATE TYPE "ContinuityScopeKind" AS ENUM ('PROJECT', 'WORKSTREAM');
CREATE TYPE "LeaveState" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'ACTIVE', 'RETURNED', 'CANCELLED');
CREATE TYPE "LeaveReasonCategory" AS ENUM ('PLANNED_LEAVE', 'UNPLANNED_LEAVE', 'OTHER_APPROVED_ABSENCE');
CREATE TYPE "DelegationState" AS ENUM ('DRAFT', 'PENDING_MANAGER', 'PENDING_DELEGATE', 'ACTIVE', 'EXPIRED', 'RETURNED', 'CANCELLED');
CREATE TYPE "DelegationGapState" AS ENUM ('OPEN', 'RESOLVED');
CREATE TYPE "DelegationGapResolutionKind" AS ENUM ('RESOLVED', 'EMERGENCY_OVERRIDE');
CREATE TYPE "ReturnChoice" AS ENUM ('RETURN', 'EXTEND', 'PERMANENT_TRANSFER');
CREATE TYPE "ReturnHandoverState" AS ENUM ('DRAFT', 'OWNER_CONFIRMED', 'FINALIZED');
CREATE TYPE "ReassignmentCaseState" AS ENUM ('REASSIGNMENT_REQUIRED', 'RESOLVED', 'CANCELLED');
CREATE TYPE "ReassignmentResolutionKind" AS ENUM ('PERMANENT_REASSIGNMENT', 'PAUSE', 'CLOSE', 'MERGE');

CREATE TABLE "LeaveRecord" (
  "id" UUID NOT NULL,
  "employeeId" UUID NOT NULL,
  "departmentId" UUID NOT NULL,
  "state" "LeaveState" NOT NULL DEFAULT 'DRAFT',
  "startsAt" TIMESTAMPTZ(6) NOT NULL,
  "endsAt" TIMESTAMPTZ(6) NOT NULL,
  "reasonCategory" "LeaveReasonCategory" NOT NULL,
  "affectedScopes" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "LeaveRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LeaveRecord_nonempty_check" CHECK ("startsAt" < "endsAt"),
  CONSTRAINT "LeaveRecord_scopes_check" CHECK (jsonb_typeof("affectedScopes") = 'array' AND jsonb_array_length("affectedScopes") > 0)
);

CREATE TABLE "LeaveDecision" (
  "id" UUID NOT NULL, "leaveId" UUID NOT NULL, "managerId" UUID NOT NULL,
  "decision" "LeaveState" NOT NULL, "reason" TEXT NOT NULL, "auditEventId" UUID NOT NULL,
  "decidedAt" TIMESTAMPTZ(6) NOT NULL, "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeaveDecision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LeaveDecision_value_check" CHECK ("decision" IN ('APPROVED', 'REJECTED')),
  CONSTRAINT "LeaveDecision_reason_check" CHECK (length(btrim("reason")) > 0)
);

CREATE TABLE "LeaveTransition" (
  "id" UUID NOT NULL, "leaveId" UUID NOT NULL,
  "fromState" "LeaveState" NOT NULL, "toState" "LeaveState" NOT NULL, "actorId" UUID NOT NULL,
  "reason" TEXT, "auditEventId" UUID NOT NULL, "occurredAt" TIMESTAMPTZ(6) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeaveTransition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeaveEligibilityEffect" (
  "id" UUID NOT NULL, "leaveId" UUID NOT NULL, "employeeId" UUID NOT NULL,
  "startsAt" TIMESTAMPTZ(6) NOT NULL, "endsAt" TIMESTAMPTZ(6) NOT NULL,
  "checkInRequired" BOOLEAN NOT NULL, "negativeRegularitySignal" BOOLEAN NOT NULL,
  "evaluationObligationSuspended" BOOLEAN NOT NULL, "auditEventId" UUID NOT NULL,
  "publishedAt" TIMESTAMPTZ(6) NOT NULL, "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeaveEligibilityEffect_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LeaveEligibilityEffect_neutral_check" CHECK (
    NOT "checkInRequired" AND NOT "negativeRegularitySignal" AND "evaluationObligationSuspended"
  )
);

CREATE TABLE "HandoverRecord" (
  "id" UUID NOT NULL, "leaveId" UUID NOT NULL, "employeeId" UUID NOT NULL,
  "currentRevisionId" UUID, "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "HandoverRecord_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "HandoverRevision" (
  "id" UUID NOT NULL, "handoverId" UUID NOT NULL, "revision" INTEGER NOT NULL,
  "authorId" UUID NOT NULL, "auditEventId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HandoverRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HandoverRevision_revision_check" CHECK ("revision" > 0)
);
CREATE TABLE "HandoverConfirmation" (
  "id" UUID NOT NULL, "handoverId" UUID NOT NULL, "revisionId" UUID NOT NULL,
  "employeeId" UUID NOT NULL, "confirmedRevision" INTEGER NOT NULL,
  "auditEventId" UUID NOT NULL, "confirmedAt" TIMESTAMPTZ(6) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HandoverConfirmation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HandoverConfirmation_revision_check" CHECK ("confirmedRevision" > 0)
);
CREATE TABLE "HandoverItem" (
  "id" UUID NOT NULL, "revisionId" UUID NOT NULL,
  "scopeKind" "ContinuityScopeKind" NOT NULL, "projectId" UUID, "workstreamId" UUID,
  "currentState" TEXT NOT NULL, "completedWork" TEXT NOT NULL, "openWork" TEXT NOT NULL,
  "blockersAndRisks" TEXT NOT NULL, "immediateNextStep" TEXT NOT NULL, "keyLinks" JSONB NOT NULL,
  "requiredAccess" JSONB NOT NULL, "pendingDecisions" JSONB NOT NULL, "proposedDelegateId" UUID,
  "position" INTEGER NOT NULL, "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HandoverItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HandoverItem_scope_check" CHECK (
    ("scopeKind" = 'PROJECT' AND "projectId" IS NOT NULL AND "workstreamId" IS NULL) OR
    ("scopeKind" = 'WORKSTREAM' AND "workstreamId" IS NOT NULL AND "projectId" IS NULL)
  ),
  CONSTRAINT "HandoverItem_position_check" CHECK ("position" >= 0)
);

CREATE TABLE "Delegation" (
  "id" UUID NOT NULL, "leaveId" UUID NOT NULL, "ownerId" UUID NOT NULL,
  "delegateId" UUID NOT NULL, "managerId" UUID NOT NULL, "handoverRevisionId" UUID NOT NULL,
  "state" "DelegationState" NOT NULL DEFAULT 'DRAFT', "emergency" BOOLEAN NOT NULL DEFAULT false,
  "emergencyReason" TEXT, "emergencyAuditEventId" UUID, "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "Delegation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Delegation_distinct_people_check" CHECK ("ownerId" <> "delegateId"),
  CONSTRAINT "Delegation_emergency_reason_check" CHECK (
    ("emergency" = false AND "emergencyReason" IS NULL AND "emergencyAuditEventId" IS NULL) OR
    ("emergency" = true AND length(btrim("emergencyReason")) > 0 AND "emergencyAuditEventId" IS NOT NULL)
  )
);
CREATE TABLE "DelegationPeriod" (
  "id" UUID NOT NULL, "delegationId" UUID NOT NULL,
  "startsAt" TIMESTAMPTZ(6) NOT NULL, "endsAt" TIMESTAMPTZ(6) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DelegationPeriod_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DelegationPeriod_nonempty_check" CHECK ("startsAt" < "endsAt")
);
CREATE TABLE "DelegationScope" (
  "id" UUID NOT NULL, "delegationId" UUID NOT NULL,
  "scopeKind" "ContinuityScopeKind" NOT NULL, "projectId" UUID, "workstreamId" UUID,
  "action" TEXT NOT NULL, "responsibilityWindowId" UUID,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DelegationScope_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DelegationScope_scope_check" CHECK (
    ("scopeKind" = 'PROJECT' AND "projectId" IS NOT NULL AND "workstreamId" IS NULL) OR
    ("scopeKind" = 'WORKSTREAM' AND "workstreamId" IS NOT NULL AND "projectId" IS NULL)
  ),
  CONSTRAINT "DelegationScope_action_check" CHECK (length(btrim("action")) > 0)
);
CREATE TABLE "DelegateConfirmation" (
  "id" UUID NOT NULL, "delegationId" UUID NOT NULL, "delegateId" UUID NOT NULL,
  "receiptConfirmed" BOOLEAN NOT NULL, "accessConfirmed" BOOLEAN NOT NULL, "auditEventId" UUID NOT NULL,
  "confirmedAt" TIMESTAMPTZ(6) NOT NULL, "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DelegateConfirmation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DelegateConfirmation_truth_check" CHECK ("receiptConfirmed" AND "accessConfirmed")
);
CREATE TABLE "DelegationAccessGap" (
  "id" UUID NOT NULL, "delegationId" UUID NOT NULL, "delegateId" UUID NOT NULL,
  "description" TEXT NOT NULL, "state" "DelegationGapState" NOT NULL DEFAULT 'OPEN',
  "auditEventId" UUID NOT NULL, "reportedAt" TIMESTAMPTZ(6) NOT NULL, "resolvedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DelegationAccessGap_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DelegationAccessGap_description_check" CHECK (length(btrim("description")) > 0)
);
CREATE TABLE "DelegationAccessGapResolution" (
  "id" UUID NOT NULL, "gapId" UUID NOT NULL, "actorId" UUID NOT NULL,
  "kind" "DelegationGapResolutionKind" NOT NULL, "reason" TEXT NOT NULL,
  "auditEventId" UUID NOT NULL, "resolvedAt" TIMESTAMPTZ(6) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DelegationAccessGapResolution_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DelegationAccessGapResolution_reason_check" CHECK (length(btrim("reason")) > 0)
);

CREATE TABLE "ReturnHandover" (
  "id" UUID NOT NULL, "delegationId" UUID NOT NULL, "actingOwnerId" UUID NOT NULL,
  "originalOwnerId" UUID NOT NULL, "completedWork" TEXT NOT NULL, "decisionsAndChanges" TEXT NOT NULL,
  "openWork" TEXT NOT NULL, "risksAndNextSteps" TEXT NOT NULL,
  "state" "ReturnHandoverState" NOT NULL DEFAULT 'DRAFT', "version" INTEGER NOT NULL DEFAULT 1,
  "choice" "ReturnChoice", "confirmedById" UUID, "confirmedAt" TIMESTAMPTZ(6),
  "finalizedById" UUID, "finalizedAt" TIMESTAMPTZ(6), "auditEventId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReturnHandover_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ReassignmentRequiredCase" (
  "id" UUID NOT NULL, "formerOwnerId" UUID NOT NULL,
  "scopeKind" "ContinuityScopeKind" NOT NULL, "projectId" UUID, "workstreamId" UUID,
  "state" "ReassignmentCaseState" NOT NULL DEFAULT 'REASSIGNMENT_REQUIRED', "auditEventId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "ReassignmentRequiredCase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReassignmentRequiredCase_scope_check" CHECK (
    ("scopeKind" = 'PROJECT' AND "projectId" IS NOT NULL AND "workstreamId" IS NULL) OR
    ("scopeKind" = 'WORKSTREAM' AND "workstreamId" IS NOT NULL AND "projectId" IS NULL)
  )
);
CREATE TABLE "ReassignmentResolution" (
  "id" UUID NOT NULL, "caseId" UUID NOT NULL, "actorId" UUID NOT NULL,
  "kind" "ReassignmentResolutionKind" NOT NULL, "successorId" UUID, "effectiveAt" TIMESTAMPTZ(6) NOT NULL,
  "reason" TEXT NOT NULL, "auditEventId" UUID NOT NULL, "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReassignmentResolution_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReassignmentResolution_successor_check" CHECK (
    ("kind" = 'PERMANENT_REASSIGNMENT' AND "successorId" IS NOT NULL) OR
    ("kind" <> 'PERMANENT_REASSIGNMENT' AND "successorId" IS NULL)
  )
);
CREATE TABLE "ReassignmentQueueItem" (
  "id" UUID NOT NULL, "caseId" UUID NOT NULL, "departmentId" UUID NOT NULL,
  "state" "ReassignmentCaseState" NOT NULL DEFAULT 'REASSIGNMENT_REQUIRED',
  "auditEventId" UUID NOT NULL, "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMPTZ(6),
  CONSTRAINT "ReassignmentQueueItem_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "DeactivationReceipt" (
  "id" UUID NOT NULL, "idempotencyKey" UUID NOT NULL, "userId" UUID NOT NULL,
  "administratorId" UUID NOT NULL, "preservedHistory" BOOLEAN NOT NULL DEFAULT true,
  "auditEventId" UUID NOT NULL, "deactivatedAt" TIMESTAMPTZ(6) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeactivationReceipt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeactivationReceipt_history_check" CHECK ("preservedHistory" = true)
);
CREATE TABLE "RetentionPolicyReference" (
  "id" UUID NOT NULL, "organizationId" UUID NOT NULL, "dataType" TEXT NOT NULL,
  "policyVersion" INTEGER NOT NULL, "archiveOnly" BOOLEAN NOT NULL DEFAULT true,
  "automaticDeletion" BOOLEAN NOT NULL DEFAULT false, "configuredById" UUID NOT NULL,
  "auditEventId" UUID NOT NULL, "effectiveAt" TIMESTAMPTZ(6) NOT NULL, "supersededAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RetentionPolicyReference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RetentionPolicyReference_no_delete_check" CHECK ("archiveOnly" AND NOT "automaticDeletion")
);

CREATE UNIQUE INDEX "HandoverRecord_leaveId_employeeId_key" ON "HandoverRecord"("leaveId", "employeeId");
CREATE UNIQUE INDEX "LeaveEligibilityEffect_leaveId_key" ON "LeaveEligibilityEffect"("leaveId");
CREATE INDEX "LeaveEligibilityEffect_employeeId_startsAt_endsAt_idx" ON "LeaveEligibilityEffect"("employeeId", "startsAt", "endsAt");
CREATE UNIQUE INDEX "HandoverRecord_currentRevisionId_id_key" ON "HandoverRecord"("currentRevisionId", "id");
CREATE UNIQUE INDEX "HandoverRevision_handoverId_revision_key" ON "HandoverRevision"("handoverId", "revision");
CREATE UNIQUE INDEX "HandoverRevision_id_handoverId_key" ON "HandoverRevision"("id", "handoverId");
CREATE UNIQUE INDEX "HandoverConfirmation_handoverId_revisionId_employeeId_key" ON "HandoverConfirmation"("handoverId", "revisionId", "employeeId");
CREATE INDEX "HandoverConfirmation_handoverId_confirmedAt_idx" ON "HandoverConfirmation"("handoverId", "confirmedAt");
CREATE UNIQUE INDEX "HandoverItem_revisionId_position_key" ON "HandoverItem"("revisionId", "position");
CREATE UNIQUE INDEX "DelegationPeriod_delegationId_startsAt_endsAt_key" ON "DelegationPeriod"("delegationId", "startsAt", "endsAt");
CREATE UNIQUE INDEX "DelegationScope_delegationId_projectId_workstreamId_action_key" ON "DelegationScope"("delegationId", "projectId", "workstreamId", "action");
CREATE INDEX "DelegationScope_responsibilityWindowId_idx" ON "DelegationScope"("responsibilityWindowId");
CREATE UNIQUE INDEX "DelegateConfirmation_delegationId_delegateId_key" ON "DelegateConfirmation"("delegationId", "delegateId");
CREATE UNIQUE INDEX "DelegationAccessGapResolution_gapId_key" ON "DelegationAccessGapResolution"("gapId");
CREATE UNIQUE INDEX "ReassignmentRequiredCase_open_project_key" ON "ReassignmentRequiredCase"("formerOwnerId", "projectId") WHERE "state" = 'REASSIGNMENT_REQUIRED' AND "projectId" IS NOT NULL;
CREATE UNIQUE INDEX "ReassignmentRequiredCase_open_workstream_key" ON "ReassignmentRequiredCase"("formerOwnerId", "workstreamId") WHERE "state" = 'REASSIGNMENT_REQUIRED' AND "workstreamId" IS NOT NULL;
CREATE UNIQUE INDEX "ReassignmentResolution_caseId_key" ON "ReassignmentResolution"("caseId");
CREATE UNIQUE INDEX "ReassignmentQueueItem_caseId_key" ON "ReassignmentQueueItem"("caseId");
CREATE INDEX "ReassignmentQueueItem_departmentId_state_createdAt_idx" ON "ReassignmentQueueItem"("departmentId", "state", "createdAt");
CREATE UNIQUE INDEX "DeactivationReceipt_idempotencyKey_key" ON "DeactivationReceipt"("idempotencyKey");
CREATE UNIQUE INDEX "RetentionPolicyReference_org_type_version_key" ON "RetentionPolicyReference"("organizationId", "dataType", "policyVersion");

CREATE INDEX "LeaveRecord_employeeId_startsAt_endsAt_idx" ON "LeaveRecord"("employeeId", "startsAt", "endsAt");
CREATE INDEX "LeaveRecord_departmentId_state_startsAt_idx" ON "LeaveRecord"("departmentId", "state", "startsAt");
CREATE INDEX "LeaveDecision_leaveId_decidedAt_id_idx" ON "LeaveDecision"("leaveId", "decidedAt", "id");
CREATE INDEX "LeaveTransition_leaveId_occurredAt_id_idx" ON "LeaveTransition"("leaveId", "occurredAt", "id");
CREATE INDEX "HandoverItem_projectId_revisionId_idx" ON "HandoverItem"("projectId", "revisionId");
CREATE INDEX "HandoverItem_workstreamId_revisionId_idx" ON "HandoverItem"("workstreamId", "revisionId");
CREATE INDEX "Delegation_delegateId_state_createdAt_idx" ON "Delegation"("delegateId", "state", "createdAt");
CREATE INDEX "Delegation_managerId_state_createdAt_idx" ON "Delegation"("managerId", "state", "createdAt");
CREATE INDEX "DelegationPeriod_startsAt_endsAt_idx" ON "DelegationPeriod"("startsAt", "endsAt");
CREATE INDEX "DelegationScope_projectId_action_delegationId_idx" ON "DelegationScope"("projectId", "action", "delegationId");
CREATE INDEX "DelegationScope_workstreamId_action_delegationId_idx" ON "DelegationScope"("workstreamId", "action", "delegationId");
CREATE INDEX "DelegationAccessGap_delegationId_state_reportedAt_idx" ON "DelegationAccessGap"("delegationId", "state", "reportedAt");
CREATE INDEX "ReassignmentRequiredCase_state_createdAt_idx" ON "ReassignmentRequiredCase"("state", "createdAt");
CREATE INDEX "DeactivationReceipt_userId_deactivatedAt_idx" ON "DeactivationReceipt"("userId", "deactivatedAt");
CREATE INDEX "RetentionPolicyReference_org_type_effective_idx" ON "RetentionPolicyReference"("organizationId", "dataType", "effectiveAt");
CREATE INDEX "ReturnHandover_delegationId_createdAt_idx" ON "ReturnHandover"("delegationId", "createdAt");

ALTER TABLE "LeaveRecord" ADD CONSTRAINT "LeaveRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveDecision" ADD CONSTRAINT "LeaveDecision_leaveId_fkey" FOREIGN KEY ("leaveId") REFERENCES "LeaveRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveDecision" ADD CONSTRAINT "LeaveDecision_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveTransition" ADD CONSTRAINT "LeaveTransition_leaveId_fkey" FOREIGN KEY ("leaveId") REFERENCES "LeaveRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveTransition" ADD CONSTRAINT "LeaveTransition_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveEligibilityEffect" ADD CONSTRAINT "LeaveEligibilityEffect_leaveId_fkey" FOREIGN KEY ("leaveId") REFERENCES "LeaveRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveEligibilityEffect" ADD CONSTRAINT "LeaveEligibilityEffect_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HandoverRecord" ADD CONSTRAINT "HandoverRecord_leaveId_fkey" FOREIGN KEY ("leaveId") REFERENCES "LeaveRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HandoverRecord" ADD CONSTRAINT "HandoverRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HandoverRevision" ADD CONSTRAINT "HandoverRevision_handoverId_fkey" FOREIGN KEY ("handoverId") REFERENCES "HandoverRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HandoverRevision" ADD CONSTRAINT "HandoverRevision_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HandoverRecord" ADD CONSTRAINT "HandoverRecord_currentRevisionId_id_fkey" FOREIGN KEY ("currentRevisionId", "id") REFERENCES "HandoverRevision"("id", "handoverId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HandoverConfirmation" ADD CONSTRAINT "HandoverConfirmation_handoverId_fkey" FOREIGN KEY ("handoverId") REFERENCES "HandoverRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HandoverConfirmation" ADD CONSTRAINT "HandoverConfirmation_revisionId_handoverId_fkey" FOREIGN KEY ("revisionId", "handoverId") REFERENCES "HandoverRevision"("id", "handoverId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HandoverConfirmation" ADD CONSTRAINT "HandoverConfirmation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HandoverItem" ADD CONSTRAINT "HandoverItem_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "HandoverRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HandoverItem" ADD CONSTRAINT "HandoverItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HandoverItem" ADD CONSTRAINT "HandoverItem_workstreamId_fkey" FOREIGN KEY ("workstreamId") REFERENCES "Workstream"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Delegation" ADD CONSTRAINT "Delegation_leaveId_fkey" FOREIGN KEY ("leaveId") REFERENCES "LeaveRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Delegation" ADD CONSTRAINT "Delegation_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Delegation" ADD CONSTRAINT "Delegation_delegateId_fkey" FOREIGN KEY ("delegateId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Delegation" ADD CONSTRAINT "Delegation_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Delegation" ADD CONSTRAINT "Delegation_handoverRevisionId_fkey" FOREIGN KEY ("handoverRevisionId") REFERENCES "HandoverRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DelegationPeriod" ADD CONSTRAINT "DelegationPeriod_delegationId_fkey" FOREIGN KEY ("delegationId") REFERENCES "Delegation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DelegationScope" ADD CONSTRAINT "DelegationScope_delegationId_fkey" FOREIGN KEY ("delegationId") REFERENCES "Delegation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DelegationScope" ADD CONSTRAINT "DelegationScope_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DelegationScope" ADD CONSTRAINT "DelegationScope_workstreamId_fkey" FOREIGN KEY ("workstreamId") REFERENCES "Workstream"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DelegationScope" ADD CONSTRAINT "DelegationScope_responsibilityWindowId_fkey" FOREIGN KEY ("responsibilityWindowId") REFERENCES "ResponsibilityWindow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DelegateConfirmation" ADD CONSTRAINT "DelegateConfirmation_delegationId_fkey" FOREIGN KEY ("delegationId") REFERENCES "Delegation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DelegateConfirmation" ADD CONSTRAINT "DelegateConfirmation_delegateId_fkey" FOREIGN KEY ("delegateId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DelegationAccessGap" ADD CONSTRAINT "DelegationAccessGap_delegationId_fkey" FOREIGN KEY ("delegationId") REFERENCES "Delegation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DelegationAccessGap" ADD CONSTRAINT "DelegationAccessGap_delegateId_fkey" FOREIGN KEY ("delegateId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DelegationAccessGapResolution" ADD CONSTRAINT "DelegationAccessGapResolution_gapId_fkey" FOREIGN KEY ("gapId") REFERENCES "DelegationAccessGap"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DelegationAccessGapResolution" ADD CONSTRAINT "DelegationAccessGapResolution_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnHandover" ADD CONSTRAINT "ReturnHandover_delegationId_fkey" FOREIGN KEY ("delegationId") REFERENCES "Delegation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnHandover" ADD CONSTRAINT "ReturnHandover_actingOwnerId_fkey" FOREIGN KEY ("actingOwnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnHandover" ADD CONSTRAINT "ReturnHandover_originalOwnerId_fkey" FOREIGN KEY ("originalOwnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnHandover" ADD CONSTRAINT "ReturnHandover_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnHandover" ADD CONSTRAINT "ReturnHandover_finalizedById_fkey" FOREIGN KEY ("finalizedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReassignmentRequiredCase" ADD CONSTRAINT "ReassignmentRequiredCase_formerOwnerId_fkey" FOREIGN KEY ("formerOwnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReassignmentRequiredCase" ADD CONSTRAINT "ReassignmentRequiredCase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReassignmentRequiredCase" ADD CONSTRAINT "ReassignmentRequiredCase_workstreamId_fkey" FOREIGN KEY ("workstreamId") REFERENCES "Workstream"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReassignmentResolution" ADD CONSTRAINT "ReassignmentResolution_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ReassignmentRequiredCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReassignmentResolution" ADD CONSTRAINT "ReassignmentResolution_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReassignmentResolution" ADD CONSTRAINT "ReassignmentResolution_successorId_fkey" FOREIGN KEY ("successorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReassignmentQueueItem" ADD CONSTRAINT "ReassignmentQueueItem_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ReassignmentRequiredCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeactivationReceipt" ADD CONSTRAINT "DeactivationReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeactivationReceipt" ADD CONSTRAINT "DeactivationReceipt_administratorId_fkey" FOREIGN KEY ("administratorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RetentionPolicyReference" ADD CONSTRAINT "RetentionPolicyReference_configuredById_fkey" FOREIGN KEY ("configuredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "reject_continuity_history_mutation"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'continuity history is append-only' USING ERRCODE = '55000';
END;
$$;

-- A pending scope is immutable except for its single atomic binding to the
-- responsibility window created during activation. The binding cannot later
-- be changed or removed.
CREATE OR REPLACE FUNCTION "bind_delegation_scope_once"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD."responsibilityWindowId" IS NULL
     AND NEW."responsibilityWindowId" IS NOT NULL
     AND (to_jsonb(NEW) - 'responsibilityWindowId') = (to_jsonb(OLD) - 'responsibilityWindowId')
  THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'continuity history is append-only' USING ERRCODE = '55000';
END;
$$;

-- Continuity creates a planned acting window and its scheduled return together.
-- An authorized early-return transition may shorten that acting window and move
-- the paired future return earlier. All other responsibility history remains
-- under the original close-only rule, and the planned interval is retained in
-- DelegationPeriod/OwnershipTransfer.
CREATE OR REPLACE FUNCTION "protect_continuity_responsibility_period"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'historical period rows cannot be deleted' USING ERRCODE = '55000';
  END IF;
  IF OLD."endsAt" IS NULL
     AND NEW."endsAt" IS NOT NULL
     AND NEW."startsAt" < NEW."endsAt"
     AND (to_jsonb(NEW) - 'endsAt') = (to_jsonb(OLD) - 'endsAt')
  THEN
    RETURN NEW;
  END IF;
  IF OLD."responsibilityType" = 'acting'
     AND OLD."relatedHandoverReference" IS NOT NULL
     AND OLD."endsAt" IS NOT NULL
     AND NEW."endsAt" IS NOT NULL
     AND NEW."endsAt" < OLD."endsAt"
     AND NEW."startsAt" < NEW."endsAt"
     AND (to_jsonb(NEW) - 'endsAt') = (to_jsonb(OLD) - 'endsAt')
  THEN
    RETURN NEW;
  END IF;
  IF OLD."responsibilityType" = 'permanent'
     AND OLD."relatedHandoverReference" IS NOT NULL
     AND OLD."endsAt" IS NULL
     AND NEW."startsAt" < OLD."startsAt"
     AND (to_jsonb(NEW) - 'startsAt') = (to_jsonb(OLD) - 'startsAt')
  THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'historical period rows may only be closed once' USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER "ResponsibilityWindow_close_only" ON "ResponsibilityWindow";
CREATE TRIGGER "ResponsibilityWindow_close_only" BEFORE UPDATE OR DELETE ON "ResponsibilityWindow" FOR EACH ROW EXECUTE FUNCTION "protect_continuity_responsibility_period"();

CREATE TRIGGER "LeaveDecision_append_only" BEFORE UPDATE OR DELETE ON "LeaveDecision" FOR EACH ROW EXECUTE FUNCTION "reject_continuity_history_mutation"();
CREATE TRIGGER "LeaveTransition_append_only" BEFORE UPDATE OR DELETE ON "LeaveTransition" FOR EACH ROW EXECUTE FUNCTION "reject_continuity_history_mutation"();
CREATE TRIGGER "LeaveEligibilityEffect_append_only" BEFORE UPDATE OR DELETE ON "LeaveEligibilityEffect" FOR EACH ROW EXECUTE FUNCTION "reject_continuity_history_mutation"();
CREATE TRIGGER "HandoverRevision_append_only" BEFORE UPDATE OR DELETE ON "HandoverRevision" FOR EACH ROW EXECUTE FUNCTION "reject_continuity_history_mutation"();
CREATE TRIGGER "HandoverItem_append_only" BEFORE UPDATE OR DELETE ON "HandoverItem" FOR EACH ROW EXECUTE FUNCTION "reject_continuity_history_mutation"();
CREATE TRIGGER "HandoverConfirmation_append_only" BEFORE UPDATE OR DELETE ON "HandoverConfirmation" FOR EACH ROW EXECUTE FUNCTION "reject_continuity_history_mutation"();
CREATE TRIGGER "DelegationPeriod_append_only" BEFORE UPDATE OR DELETE ON "DelegationPeriod" FOR EACH ROW EXECUTE FUNCTION "reject_continuity_history_mutation"();
CREATE TRIGGER "DelegationScope_append_only" BEFORE UPDATE OR DELETE ON "DelegationScope" FOR EACH ROW EXECUTE FUNCTION "bind_delegation_scope_once"();
CREATE TRIGGER "DelegateConfirmation_append_only" BEFORE UPDATE OR DELETE ON "DelegateConfirmation" FOR EACH ROW EXECUTE FUNCTION "reject_continuity_history_mutation"();
CREATE TRIGGER "DelegationAccessGap_append_only" BEFORE UPDATE OR DELETE ON "DelegationAccessGap" FOR EACH ROW EXECUTE FUNCTION "reject_continuity_history_mutation"();
CREATE TRIGGER "DelegationAccessGapResolution_append_only" BEFORE UPDATE OR DELETE ON "DelegationAccessGapResolution" FOR EACH ROW EXECUTE FUNCTION "reject_continuity_history_mutation"();
CREATE TRIGGER "ReturnHandover_append_only" BEFORE DELETE ON "ReturnHandover" FOR EACH ROW EXECUTE FUNCTION "reject_continuity_history_mutation"();
CREATE TRIGGER "ReassignmentResolution_append_only" BEFORE UPDATE OR DELETE ON "ReassignmentResolution" FOR EACH ROW EXECUTE FUNCTION "reject_continuity_history_mutation"();
CREATE TRIGGER "DeactivationReceipt_append_only" BEFORE UPDATE OR DELETE ON "DeactivationReceipt" FOR EACH ROW EXECUTE FUNCTION "reject_continuity_history_mutation"();
CREATE TRIGGER "RetentionPolicyReference_append_only" BEFORE UPDATE OR DELETE ON "RetentionPolicyReference" FOR EACH ROW EXECUTE FUNCTION "reject_continuity_history_mutation"();

CREATE OR REPLACE FUNCTION "reject_overlapping_active_delegation"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  current_delegation UUID;
  conflict_exists BOOLEAN;
BEGIN
  current_delegation := (
    to_jsonb(NEW) ->> CASE WHEN TG_TABLE_NAME = 'Delegation' THEN 'id' ELSE 'delegationId' END
  )::UUID;
  SELECT EXISTS (
    SELECT 1
    FROM "Delegation" candidate
    JOIN "DelegationPeriod" candidate_period ON candidate_period."delegationId" = candidate."id"
    JOIN "DelegationScope" candidate_scope ON candidate_scope."delegationId" = candidate."id"
    JOIN "Delegation" current_record ON current_record."id" = current_delegation
    JOIN "DelegationPeriod" current_period ON current_period."delegationId" = current_record."id"
    JOIN "DelegationScope" current_scope ON current_scope."delegationId" = current_record."id"
    WHERE candidate."id" <> current_record."id"
      AND candidate."state" = 'ACTIVE' AND current_record."state" = 'ACTIVE'
      AND candidate_period."startsAt" < current_period."endsAt"
      AND current_period."startsAt" < candidate_period."endsAt"
      AND candidate_scope."action" = current_scope."action"
      AND candidate_scope."projectId" IS NOT DISTINCT FROM current_scope."projectId"
      AND candidate_scope."workstreamId" IS NOT DISTINCT FROM current_scope."workstreamId"
  ) INTO conflict_exists;
  IF conflict_exists THEN
    RAISE EXCEPTION 'overlapping active delegation for exact scope and authority' USING ERRCODE = '23P01';
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER "Delegation_no_active_overlap" AFTER INSERT OR UPDATE OF "state" ON "Delegation" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "reject_overlapping_active_delegation"();
CREATE CONSTRAINT TRIGGER "DelegationPeriod_no_active_overlap" AFTER INSERT ON "DelegationPeriod" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "reject_overlapping_active_delegation"();
CREATE CONSTRAINT TRIGGER "DelegationScope_no_active_overlap" AFTER INSERT ON "DelegationScope" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "reject_overlapping_active_delegation"();
