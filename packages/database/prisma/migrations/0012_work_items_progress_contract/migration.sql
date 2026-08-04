-- CreateEnum
CREATE TYPE "WorkItemStatus" AS ENUM ('planned', 'ready', 'in_progress', 'blocked', 'in_review', 'done', 'cancelled');

-- CreateEnum
CREATE TYPE "WorkItemPriority" AS ENUM ('low', 'normal', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "ProgressScopeKind" AS ENUM ('project', 'workstream');

-- CreateEnum
CREATE TYPE "ProgressContractState" AS ENUM ('draft', 'pending_approval', 'active', 'superseded', 'rejected');

-- CreateEnum
CREATE TYPE "ProgressCalculationKind" AS ENUM ('weighted', 'stage_gate');

-- CreateEnum
CREATE TYPE "ProgressComponentKind" AS ENUM ('milestone', 'deliverable', 'kpi', 'acceptance');

-- CreateEnum
CREATE TYPE "ProgressDirection" AS ENUM ('increase', 'decrease', 'maintain');

-- CreateEnum
CREATE TYPE "ProgressConfirmationMode" AS ENUM ('measured', 'human_confirmed');

-- CreateEnum
CREATE TYPE "ProgressSourceKind" AS ENUM ('document', 'update', 'evidence', 'kpi_measurement', 'human_confirmation');

-- CreateTable
CREATE TABLE "WorkItem" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "workstreamId" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "WorkItemStatus" NOT NULL DEFAULT 'planned',
    "priority" "WorkItemPriority" NOT NULL DEFAULT 'normal',
    "assigneeId" UUID,
    "dueAt" TIMESTAMPTZ(6),
    "requirements" JSONB NOT NULL,
    "acceptanceConditions" JSONB NOT NULL,
    "blocker" TEXT,
    "nextAction" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "WorkItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkItemParticipant" (
    "id" UUID NOT NULL,
    "workItemId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "startsAt" TIMESTAMPTZ(6) NOT NULL,
    "endsAt" TIMESTAMPTZ(6),
    "reason" TEXT NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkItemParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkItemDependency" (
    "id" UUID NOT NULL,
    "workItemId" UUID NOT NULL,
    "dependsOnWorkItemId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkItemDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkItemStatusHistory" (
    "id" UUID NOT NULL,
    "workItemId" UUID NOT NULL,
    "fromStatus" "WorkItemStatus" NOT NULL,
    "toStatus" "WorkItemStatus" NOT NULL,
    "actorId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "resultingVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkItemStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkItemAssignmentHistory" (
    "id" UUID NOT NULL,
    "workItemId" UUID NOT NULL,
    "fromAssigneeId" UUID,
    "toAssigneeId" UUID,
    "actorId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "resultingVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkItemAssignmentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressContract" (
    "id" UUID NOT NULL,
    "scopeKind" "ProgressScopeKind" NOT NULL,
    "projectId" UUID NOT NULL,
    "workstreamId" UUID,
    "sourceDocumentId" UUID NOT NULL,
    "sourceDocumentVersionId" UUID NOT NULL,
    "sourceDocumentVersionNo" INTEGER NOT NULL,
    "calculationKind" "ProgressCalculationKind" NOT NULL,
    "calculationSchemaVersion" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "state" "ProgressContractState" NOT NULL DEFAULT 'draft',
    "ownerId" UUID NOT NULL,
    "approverId" UUID,
    "effectiveAt" TIMESTAMPTZ(6) NOT NULL,
    "approvedAt" TIMESTAMPTZ(6),
    "previousContractId" UUID,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ProgressContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressContractComponent" (
    "id" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" "ProgressComponentKind" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "weight" DECIMAL(7,4),
    "baseline" DECIMAL(20,6),
    "target" DECIMAL(20,6),
    "unit" TEXT,
    "direction" "ProgressDirection",
    "acceptanceConditions" JSONB NOT NULL,
    "requiredEvidence" JSONB NOT NULL,
    "confirmationMode" "ProgressConfirmationMode" NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressContractComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressContractTransition" (
    "id" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "fromState" "ProgressContractState" NOT NULL,
    "toState" "ProgressContractState" NOT NULL,
    "actorId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "resultingVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressContractTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressHumanConfirmation" (
    "id" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "componentId" UUID NOT NULL,
    "satisfied" BOOLEAN NOT NULL,
    "sourceRef" TEXT NOT NULL,
    "actorId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressHumanConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressSnapshot" (
    "id" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "contractVersion" INTEGER NOT NULL,
    "previousPercent" DECIMAL(7,4) NOT NULL,
    "percent" DECIMAL(7,4) NOT NULL,
    "componentState" JSONB NOT NULL,
    "calculationSchemaVersion" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "aiRunId" UUID,
    "correlationId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressSnapshotSource" (
    "id" UUID NOT NULL,
    "snapshotId" UUID NOT NULL,
    "componentId" UUID NOT NULL,
    "sourceKind" "ProgressSourceKind" NOT NULL,
    "sourceId" UUID NOT NULL,
    "sourceVersion" INTEGER NOT NULL,
    "measuredValue" DECIMAL(20,6),
    "satisfied" BOOLEAN,
    "observedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressSnapshotSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkItem_projectId_status_createdAt_idx" ON "WorkItem"("projectId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "WorkItem_workstreamId_status_createdAt_idx" ON "WorkItem"("workstreamId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "WorkItem_assigneeId_status_dueAt_idx" ON "WorkItem"("assigneeId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "WorkItem_createdById_createdAt_idx" ON "WorkItem"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "WorkItemParticipant_workItemId_employeeId_startsAt_endsAt_idx" ON "WorkItemParticipant"("workItemId", "employeeId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "WorkItemParticipant_employeeId_startsAt_endsAt_idx" ON "WorkItemParticipant"("employeeId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "WorkItemDependency_dependsOnWorkItemId_idx" ON "WorkItemDependency"("dependsOnWorkItemId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkItemDependency_workItemId_dependsOnWorkItemId_key" ON "WorkItemDependency"("workItemId", "dependsOnWorkItemId");

-- CreateIndex
CREATE INDEX "WorkItemStatusHistory_actorId_createdAt_idx" ON "WorkItemStatusHistory"("actorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkItemStatusHistory_workItemId_resultingVersion_key" ON "WorkItemStatusHistory"("workItemId", "resultingVersion");

-- CreateIndex
CREATE INDEX "WorkItemAssignmentHistory_actorId_createdAt_idx" ON "WorkItemAssignmentHistory"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkItemAssignmentHistory_toAssigneeId_createdAt_idx" ON "WorkItemAssignmentHistory"("toAssigneeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkItemAssignmentHistory_workItemId_resultingVersion_key" ON "WorkItemAssignmentHistory"("workItemId", "resultingVersion");

-- CreateIndex
CREATE UNIQUE INDEX "ProgressContract_previousContractId_key" ON "ProgressContract"("previousContractId");

-- CreateIndex
CREATE INDEX "ProgressContract_projectId_state_effectiveAt_idx" ON "ProgressContract"("projectId", "state", "effectiveAt");

-- CreateIndex
CREATE INDEX "ProgressContract_workstreamId_state_effectiveAt_idx" ON "ProgressContract"("workstreamId", "state", "effectiveAt");

-- CreateIndex
CREATE INDEX "ProgressContract_sourceDocumentVersionId_idx" ON "ProgressContract"("sourceDocumentVersionId");

-- CreateIndex
CREATE INDEX "ProgressContract_ownerId_state_idx" ON "ProgressContract"("ownerId", "state");

-- CreateIndex
CREATE INDEX "ProgressContractComponent_contractId_kind_idx" ON "ProgressContractComponent"("contractId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "ProgressContractComponent_contractId_position_key" ON "ProgressContractComponent"("contractId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ProgressContractComponent_id_contractId_key" ON "ProgressContractComponent"("id", "contractId");

-- CreateIndex
CREATE INDEX "ProgressContractTransition_actorId_createdAt_idx" ON "ProgressContractTransition"("actorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProgressContractTransition_contractId_resultingVersion_key" ON "ProgressContractTransition"("contractId", "resultingVersion");

-- CreateIndex
CREATE INDEX "ProgressHumanConfirmation_contractId_componentId_createdAt_idx" ON "ProgressHumanConfirmation"("contractId", "componentId", "createdAt");

-- CreateIndex
CREATE INDEX "ProgressHumanConfirmation_actorId_createdAt_idx" ON "ProgressHumanConfirmation"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "ProgressSnapshot_contractId_createdAt_id_idx" ON "ProgressSnapshot"("contractId", "createdAt" DESC, "id");

-- CreateIndex
CREATE INDEX "ProgressSnapshot_actorId_createdAt_idx" ON "ProgressSnapshot"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "ProgressSnapshot_correlationId_idx" ON "ProgressSnapshot"("correlationId");

-- CreateIndex
CREATE INDEX "ProgressSnapshotSource_sourceKind_sourceId_idx" ON "ProgressSnapshotSource"("sourceKind", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgressSnapshotSource_snapshotId_componentId_sourceKind_so_key" ON "ProgressSnapshotSource"("snapshotId", "componentId", "sourceKind", "sourceId", "sourceVersion");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_id_documentId_key" ON "DocumentVersion"("id", "documentId");

-- CreateIndex
CREATE UNIQUE INDEX "Workstream_id_projectId_key" ON "Workstream"("id", "projectId");

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_workstreamId_projectId_fkey" FOREIGN KEY ("workstreamId", "projectId") REFERENCES "Workstream"("id", "projectId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemParticipant" ADD CONSTRAINT "WorkItemParticipant_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemParticipant" ADD CONSTRAINT "WorkItemParticipant_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemParticipant" ADD CONSTRAINT "WorkItemParticipant_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemDependency" ADD CONSTRAINT "WorkItemDependency_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemDependency" ADD CONSTRAINT "WorkItemDependency_dependsOnWorkItemId_fkey" FOREIGN KEY ("dependsOnWorkItemId") REFERENCES "WorkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemStatusHistory" ADD CONSTRAINT "WorkItemStatusHistory_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemStatusHistory" ADD CONSTRAINT "WorkItemStatusHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemAssignmentHistory" ADD CONSTRAINT "WorkItemAssignmentHistory_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemAssignmentHistory" ADD CONSTRAINT "WorkItemAssignmentHistory_fromAssigneeId_fkey" FOREIGN KEY ("fromAssigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemAssignmentHistory" ADD CONSTRAINT "WorkItemAssignmentHistory_toAssigneeId_fkey" FOREIGN KEY ("toAssigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemAssignmentHistory" ADD CONSTRAINT "WorkItemAssignmentHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressContract" ADD CONSTRAINT "ProgressContract_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressContract" ADD CONSTRAINT "ProgressContract_workstreamId_projectId_fkey" FOREIGN KEY ("workstreamId", "projectId") REFERENCES "Workstream"("id", "projectId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressContract" ADD CONSTRAINT "ProgressContract_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "DocumentRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressContract" ADD CONSTRAINT "ProgressContract_sourceDocumentVersionId_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentVersionId", "sourceDocumentId") REFERENCES "DocumentVersion"("id", "documentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressContract" ADD CONSTRAINT "ProgressContract_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressContract" ADD CONSTRAINT "ProgressContract_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressContract" ADD CONSTRAINT "ProgressContract_previousContractId_fkey" FOREIGN KEY ("previousContractId") REFERENCES "ProgressContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressContract" ADD CONSTRAINT "ProgressContract_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressContractComponent" ADD CONSTRAINT "ProgressContractComponent_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "ProgressContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressContractTransition" ADD CONSTRAINT "ProgressContractTransition_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "ProgressContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressContractTransition" ADD CONSTRAINT "ProgressContractTransition_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressHumanConfirmation" ADD CONSTRAINT "ProgressHumanConfirmation_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "ProgressContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressHumanConfirmation" ADD CONSTRAINT "ProgressHumanConfirmation_componentId_contractId_fkey" FOREIGN KEY ("componentId", "contractId") REFERENCES "ProgressContractComponent"("id", "contractId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressHumanConfirmation" ADD CONSTRAINT "ProgressHumanConfirmation_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressSnapshot" ADD CONSTRAINT "ProgressSnapshot_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "ProgressContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressSnapshot" ADD CONSTRAINT "ProgressSnapshot_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressSnapshotSource" ADD CONSTRAINT "ProgressSnapshotSource_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "ProgressSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressSnapshotSource" ADD CONSTRAINT "ProgressSnapshotSource_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "ProgressContractComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Bounded domain constraints
ALTER TABLE "WorkItem"
ADD CONSTRAINT "WorkItem_version_positive" CHECK ("version" > 0),
ADD CONSTRAINT "WorkItem_requirements_array" CHECK (jsonb_typeof("requirements") = 'array'),
ADD CONSTRAINT "WorkItem_acceptance_conditions_array" CHECK (jsonb_typeof("acceptanceConditions") = 'array');

ALTER TABLE "WorkItemParticipant"
ADD CONSTRAINT "WorkItemParticipant_period_valid"
CHECK ("endsAt" IS NULL OR "endsAt" > "startsAt");

ALTER TABLE "WorkItemDependency"
ADD CONSTRAINT "WorkItemDependency_not_self"
CHECK ("workItemId" <> "dependsOnWorkItemId");

ALTER TABLE "ProgressContract"
ADD CONSTRAINT "ProgressContract_scope_valid"
CHECK (
  ("scopeKind" = 'project' AND "workstreamId" IS NULL)
  OR ("scopeKind" = 'workstream' AND "workstreamId" IS NOT NULL)
),
ADD CONSTRAINT "ProgressContract_versions_positive"
CHECK ("version" > 0 AND "sourceDocumentVersionNo" > 0),
ADD CONSTRAINT "ProgressContract_approval_state_valid"
CHECK (
  ("state" IN ('active', 'superseded') AND "approverId" IS NOT NULL AND "approvedAt" IS NOT NULL)
  OR ("state" NOT IN ('active', 'superseded'))
);

ALTER TABLE "ProgressContractComponent"
ADD CONSTRAINT "ProgressContractComponent_position_positive" CHECK ("position" > 0),
ADD CONSTRAINT "ProgressContractComponent_weight_valid"
CHECK ("weight" IS NULL OR ("weight" >= 0 AND "weight" <= 100)),
ADD CONSTRAINT "ProgressContractComponent_evidence_array"
CHECK (jsonb_typeof("requiredEvidence") = 'array'),
ADD CONSTRAINT "ProgressContractComponent_acceptance_array"
CHECK (jsonb_typeof("acceptanceConditions") = 'array'),
ADD CONSTRAINT "ProgressContractComponent_kpi_fields"
CHECK (
  "kind" <> 'kpi'
  OR (
    "baseline" IS NOT NULL
    AND "target" IS NOT NULL
    AND "unit" IS NOT NULL
    AND "direction" IS NOT NULL
  )
),
ADD CONSTRAINT "ProgressContractComponent_measured_only_kpi"
CHECK ("confirmationMode" <> 'measured' OR "kind" = 'kpi');

ALTER TABLE "ProgressSnapshot"
ADD CONSTRAINT "ProgressSnapshot_percent_range"
CHECK (
  "previousPercent" >= 0
  AND "previousPercent" <= 100
  AND "percent" >= 0
  AND "percent" <= 100
),
ADD CONSTRAINT "ProgressSnapshot_contract_version_positive"
CHECK ("contractVersion" > 0);

ALTER TABLE "ProgressSnapshotSource"
ADD CONSTRAINT "ProgressSnapshotSource_version_positive" CHECK ("sourceVersion" > 0),
ADD CONSTRAINT "ProgressSnapshotSource_value_shape"
CHECK (
  ("sourceKind" = 'kpi_measurement' AND "measuredValue" IS NOT NULL)
  OR ("sourceKind" = 'human_confirmation' AND "satisfied" IS NOT NULL)
  OR ("sourceKind" NOT IN ('kpi_measurement', 'human_confirmation'))
);

CREATE UNIQUE INDEX "ProgressContract_project_version_unique"
ON "ProgressContract" ("projectId", "version")
WHERE "scopeKind" = 'project';

CREATE UNIQUE INDEX "ProgressContract_workstream_version_unique"
ON "ProgressContract" ("workstreamId", "version")
WHERE "scopeKind" = 'workstream';

CREATE UNIQUE INDEX "ProgressContract_one_active_project"
ON "ProgressContract" ("projectId")
WHERE "scopeKind" = 'project' AND "state" = 'active';

CREATE UNIQUE INDEX "ProgressContract_one_active_workstream"
ON "ProgressContract" ("workstreamId")
WHERE "scopeKind" = 'workstream' AND "state" = 'active';

-- Protected append-only and versioned history
CREATE FUNCTION "prevent_phase2_history_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Phase 2 history is append-only' USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "guard_progress_contract_update"() RETURNS trigger AS $$
BEGIN
  IF (
    NEW."id" <> OLD."id"
    OR NEW."scopeKind" <> OLD."scopeKind"
    OR NEW."projectId" <> OLD."projectId"
    OR NEW."workstreamId" IS DISTINCT FROM OLD."workstreamId"
    OR NEW."sourceDocumentId" <> OLD."sourceDocumentId"
    OR NEW."sourceDocumentVersionId" <> OLD."sourceDocumentVersionId"
    OR NEW."sourceDocumentVersionNo" <> OLD."sourceDocumentVersionNo"
    OR NEW."calculationKind" <> OLD."calculationKind"
    OR NEW."calculationSchemaVersion" <> OLD."calculationSchemaVersion"
    OR NEW."ownerId" <> OLD."ownerId"
    OR NEW."effectiveAt" <> OLD."effectiveAt"
    OR NEW."previousContractId" IS DISTINCT FROM OLD."previousContractId"
    OR NEW."createdById" <> OLD."createdById"
    OR NEW."createdAt" <> OLD."createdAt"
  ) THEN
    RAISE EXCEPTION 'Progress Contract core fields are immutable' USING ERRCODE = '55000';
  END IF;
  IF NEW."version" <> OLD."version" + 1 THEN
    RAISE EXCEPTION 'Progress Contract transition must increment version once'
      USING ERRCODE = '40001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "validate_progress_contract_activation"() RETURNS trigger AS $$
DECLARE
  component_count INTEGER;
  weight_count INTEGER;
  weight_total NUMERIC;
BEGIN
  IF NEW."state" IN ('pending_approval', 'active') AND OLD."state" <> NEW."state" THEN
    SELECT COUNT(*), COUNT("weight"), COALESCE(SUM("weight"), 0)
      INTO component_count, weight_count, weight_total
      FROM "ProgressContractComponent"
      WHERE "contractId" = NEW."id";
    IF component_count = 0 THEN
      RAISE EXCEPTION 'Progress Contract requires components' USING ERRCODE = '23514';
    END IF;
    IF NEW."calculationKind" = 'weighted'
      AND (weight_count <> component_count OR weight_total <> 100) THEN
      RAISE EXCEPTION 'Weighted Progress Contract must total exactly 100'
        USING ERRCODE = '23514';
    END IF;
    IF NEW."calculationKind" = 'stage_gate' AND weight_count <> 0 THEN
      RAISE EXCEPTION 'Stage-gate Progress Contract cannot contain weights'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "WorkItemStatusHistory_append_only"
BEFORE UPDATE OR DELETE ON "WorkItemStatusHistory"
FOR EACH ROW EXECUTE FUNCTION "prevent_phase2_history_mutation"();
CREATE TRIGGER "WorkItemAssignmentHistory_append_only"
BEFORE UPDATE OR DELETE ON "WorkItemAssignmentHistory"
FOR EACH ROW EXECUTE FUNCTION "prevent_phase2_history_mutation"();
CREATE TRIGGER "ProgressContractTransition_append_only"
BEFORE UPDATE OR DELETE ON "ProgressContractTransition"
FOR EACH ROW EXECUTE FUNCTION "prevent_phase2_history_mutation"();
CREATE TRIGGER "ProgressHumanConfirmation_append_only"
BEFORE UPDATE OR DELETE ON "ProgressHumanConfirmation"
FOR EACH ROW EXECUTE FUNCTION "prevent_phase2_history_mutation"();
CREATE TRIGGER "ProgressSnapshot_append_only"
BEFORE UPDATE OR DELETE ON "ProgressSnapshot"
FOR EACH ROW EXECUTE FUNCTION "prevent_phase2_history_mutation"();
CREATE TRIGGER "ProgressSnapshotSource_append_only"
BEFORE UPDATE OR DELETE ON "ProgressSnapshotSource"
FOR EACH ROW EXECUTE FUNCTION "prevent_phase2_history_mutation"();
CREATE TRIGGER "ProgressContractComponent_append_only"
BEFORE UPDATE OR DELETE ON "ProgressContractComponent"
FOR EACH ROW EXECUTE FUNCTION "prevent_phase2_history_mutation"();
CREATE TRIGGER "ProgressContract_prevent_delete"
BEFORE DELETE ON "ProgressContract"
FOR EACH ROW EXECUTE FUNCTION "prevent_phase2_history_mutation"();
CREATE TRIGGER "ProgressContract_guard_update"
BEFORE UPDATE ON "ProgressContract"
FOR EACH ROW EXECUTE FUNCTION "guard_progress_contract_update"();
CREATE TRIGGER "ProgressContract_validate_activation"
BEFORE UPDATE ON "ProgressContract"
FOR EACH ROW EXECUTE FUNCTION "validate_progress_contract_activation"();
