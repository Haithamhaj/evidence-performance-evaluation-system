-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('draft', 'active', 'paused', 'completed', 'archived');

-- CreateEnum
CREATE TYPE "WorkstreamStatus" AS ENUM ('draft', 'active', 'paused', 'completed', 'archived');

-- CreateEnum
CREATE TYPE "ResponsibilityType" AS ENUM ('original', 'acting', 'permanent', 'contributor');

-- CreateEnum
CREATE TYPE "OwnershipTransferKind" AS ENUM ('acting', 'permanent');

-- CreateTable
CREATE TABLE "Project" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "authorizationScopeId" UUID NOT NULL,
    "authorizationScopeType" "ScopeType" NOT NULL DEFAULT 'project',
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectStatusTransition" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "fromStatus" "ProjectStatus" NOT NULL,
    "toStatus" "ProjectStatus" NOT NULL,
    "effectiveAt" TIMESTAMPTZ(6) NOT NULL,
    "actorId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "resultingVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectStatusTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "startsAt" TIMESTAMPTZ(6) NOT NULL,
    "endsAt" TIMESTAMPTZ(6),
    "reason" TEXT NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workstream" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "authorizationScopeId" UUID NOT NULL,
    "authorizationScopeType" "ScopeType" NOT NULL DEFAULT 'workstream',
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "WorkstreamStatus" NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Workstream_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkstreamStatusTransition" (
    "id" UUID NOT NULL,
    "workstreamId" UUID NOT NULL,
    "fromStatus" "WorkstreamStatus" NOT NULL,
    "toStatus" "WorkstreamStatus" NOT NULL,
    "effectiveAt" TIMESTAMPTZ(6) NOT NULL,
    "actorId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "resultingVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkstreamStatusTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkstreamMember" (
    "id" UUID NOT NULL,
    "workstreamId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "startsAt" TIMESTAMPTZ(6) NOT NULL,
    "endsAt" TIMESTAMPTZ(6),
    "reason" TEXT NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkstreamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResponsibilityWindow" (
    "id" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "projectId" UUID,
    "workstreamId" UUID,
    "responsibilityType" "ResponsibilityType" NOT NULL,
    "startsAt" TIMESTAMPTZ(6) NOT NULL,
    "endsAt" TIMESTAMPTZ(6),
    "reason" TEXT NOT NULL,
    "managerDecisionById" UUID,
    "managerDecisionAt" TIMESTAMPTZ(6),
    "managerDecisionReason" TEXT,
    "relatedHandoverReference" TEXT,
    "delegationType" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResponsibilityWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnershipTransfer" (
    "id" UUID NOT NULL,
    "projectId" UUID,
    "workstreamId" UUID,
    "transferKind" "OwnershipTransferKind" NOT NULL,
    "closedWindowId" UUID NOT NULL,
    "newOwnerWindowId" UUID NOT NULL,
    "returnWindowId" UUID,
    "effectiveAt" TIMESTAMPTZ(6) NOT NULL,
    "reason" TEXT NOT NULL,
    "managerDecisionById" UUID NOT NULL,
    "managerDecisionAt" TIMESTAMPTZ(6) NOT NULL,
    "managerDecisionReason" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OwnershipTransfer_pkey" PRIMARY KEY ("id")
);

-- Core value and temporal constraints
ALTER TABLE "Project" ADD CONSTRAINT "Project_version_check"
CHECK ("version" BETWEEN 1 AND 2147483647);
ALTER TABLE "Project" ADD CONSTRAINT "Project_authorization_scope_type_check"
CHECK ("authorizationScopeType" = 'project');
ALTER TABLE "Workstream" ADD CONSTRAINT "Workstream_version_check"
CHECK ("version" BETWEEN 1 AND 2147483647);
ALTER TABLE "Workstream" ADD CONSTRAINT "Workstream_authorization_scope_type_check"
CHECK ("authorizationScopeType" = 'workstream');
ALTER TABLE "ProjectStatusTransition" ADD CONSTRAINT "ProjectStatusTransition_version_check"
CHECK ("resultingVersion" BETWEEN 1 AND 2147483647);
ALTER TABLE "WorkstreamStatusTransition" ADD CONSTRAINT "WorkstreamStatusTransition_version_check"
CHECK ("resultingVersion" BETWEEN 1 AND 2147483647);

ALTER TABLE "ProjectStatusTransition" ADD CONSTRAINT "ProjectStatusTransition_reason_check"
CHECK (length(btrim("reason")) BETWEEN 1 AND 1000);
ALTER TABLE "WorkstreamStatusTransition" ADD CONSTRAINT "WorkstreamStatusTransition_reason_check"
CHECK (length(btrim("reason")) BETWEEN 1 AND 1000);

ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_period_check"
CHECK ("endsAt" IS NULL OR "startsAt" < "endsAt");
ALTER TABLE "WorkstreamMember" ADD CONSTRAINT "WorkstreamMember_period_check"
CHECK ("endsAt" IS NULL OR "startsAt" < "endsAt");
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_reason_check"
CHECK (length(btrim("reason")) BETWEEN 1 AND 1000);
ALTER TABLE "WorkstreamMember" ADD CONSTRAINT "WorkstreamMember_reason_check"
CHECK (length(btrim("reason")) BETWEEN 1 AND 1000);

ALTER TABLE "ResponsibilityWindow" ADD CONSTRAINT "ResponsibilityWindow_one_scope_check"
CHECK (num_nonnulls("projectId", "workstreamId") = 1);
ALTER TABLE "ResponsibilityWindow" ADD CONSTRAINT "ResponsibilityWindow_period_check"
CHECK ("endsAt" IS NULL OR "startsAt" < "endsAt");
ALTER TABLE "ResponsibilityWindow" ADD CONSTRAINT "ResponsibilityWindow_reason_check"
CHECK (
  length(btrim("reason")) BETWEEN 1 AND 1000
  AND ("managerDecisionReason" IS NULL OR length(btrim("managerDecisionReason")) BETWEEN 1 AND 1000)
);
ALTER TABLE "ResponsibilityWindow" ADD CONSTRAINT "ResponsibilityWindow_manager_decision_triad_check"
CHECK (num_nonnulls("managerDecisionById", "managerDecisionAt", "managerDecisionReason") IN (0, 3));
ALTER TABLE "ResponsibilityWindow" ADD CONSTRAINT "ResponsibilityWindow_owner_decision_check"
CHECK (
  "responsibilityType" = 'contributor'
  OR num_nonnulls("managerDecisionById", "managerDecisionAt", "managerDecisionReason") = 3
);
ALTER TABLE "ResponsibilityWindow" ADD CONSTRAINT "ResponsibilityWindow_acting_delegation_check"
CHECK (
  (
    "responsibilityType" = 'acting'
    AND "endsAt" IS NOT NULL
    AND "delegationType" IS NOT NULL
    AND length(btrim("delegationType")) BETWEEN 1 AND 80
  )
  OR ("responsibilityType" <> 'acting' AND "delegationType" IS NULL)
);

ALTER TABLE "OwnershipTransfer" ADD CONSTRAINT "OwnershipTransfer_one_scope_check"
CHECK (num_nonnulls("projectId", "workstreamId") = 1);
ALTER TABLE "OwnershipTransfer" ADD CONSTRAINT "OwnershipTransfer_return_window_check"
CHECK (
  ("transferKind" = 'acting' AND "returnWindowId" IS NOT NULL)
  OR ("transferKind" = 'permanent' AND "returnWindowId" IS NULL)
);
ALTER TABLE "OwnershipTransfer" ADD CONSTRAINT "OwnershipTransfer_reason_check"
CHECK (
  length(btrim("reason")) BETWEEN 1 AND 1000
  AND length(btrim("managerDecisionReason")) BETWEEN 1 AND 1000
);

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_no_overlap"
EXCLUDE USING gist (
  "projectId" WITH =,
  "employeeId" WITH =,
  tstzrange("startsAt", "endsAt", '[)') WITH &&
);
ALTER TABLE "WorkstreamMember" ADD CONSTRAINT "WorkstreamMember_no_overlap"
EXCLUDE USING gist (
  "workstreamId" WITH =,
  "employeeId" WITH =,
  tstzrange("startsAt", "endsAt", '[)') WITH &&
);
ALTER TABLE "ResponsibilityWindow" ADD CONSTRAINT "ResponsibilityWindow_no_project_owner_overlap"
EXCLUDE USING gist (
  "projectId" WITH =,
  tstzrange("startsAt", "endsAt", '[)') WITH &&
) WHERE (
  "projectId" IS NOT NULL
  AND "responsibilityType" IN ('original', 'acting', 'permanent')
);
ALTER TABLE "ResponsibilityWindow" ADD CONSTRAINT "ResponsibilityWindow_no_workstream_owner_overlap"
EXCLUDE USING gist (
  "workstreamId" WITH =,
  tstzrange("startsAt", "endsAt", '[)') WITH &&
) WHERE (
  "workstreamId" IS NOT NULL
  AND "responsibilityType" IN ('original', 'acting', 'permanent')
);

-- Required composite keys for organization/department and authorization-scope integrity
CREATE UNIQUE INDEX "Department_id_organizationId_key"
ON "Department"("id", "organizationId");
CREATE UNIQUE INDEX "AuthorizationScope_id_scopeType_departmentId_key"
ON "AuthorizationScope"("id", "scopeType", "departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_authorizationScopeId_key" ON "Project"("authorizationScopeId");

-- CreateIndex
CREATE INDEX "Project_organizationId_departmentId_status_idx" ON "Project"("organizationId", "departmentId", "status");

-- CreateIndex
CREATE INDEX "Project_departmentId_status_createdAt_idx" ON "Project"("departmentId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Project_createdById_createdAt_idx" ON "Project"("createdById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Project_authorizationScopeId_authorizationScopeType_key" ON "Project"("authorizationScopeId", "authorizationScopeType");

-- CreateIndex
CREATE UNIQUE INDEX "Project_authorizationScopeId_authorizationScopeType_departm_key" ON "Project"("authorizationScopeId", "authorizationScopeType", "departmentId");

-- CreateIndex
CREATE INDEX "ProjectStatusTransition_projectId_effectiveAt_id_idx" ON "ProjectStatusTransition"("projectId", "effectiveAt", "id");

-- CreateIndex
CREATE INDEX "ProjectStatusTransition_actorId_createdAt_idx" ON "ProjectStatusTransition"("actorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectStatusTransition_projectId_resultingVersion_key" ON "ProjectStatusTransition"("projectId", "resultingVersion");

-- CreateIndex
CREATE INDEX "ProjectMember_projectId_employeeId_startsAt_endsAt_idx" ON "ProjectMember"("projectId", "employeeId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "ProjectMember_employeeId_startsAt_endsAt_idx" ON "ProjectMember"("employeeId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "ProjectMember_createdById_createdAt_idx" ON "ProjectMember"("createdById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Workstream_authorizationScopeId_key" ON "Workstream"("authorizationScopeId");

-- CreateIndex
CREATE INDEX "Workstream_projectId_status_createdAt_idx" ON "Workstream"("projectId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Workstream_createdById_createdAt_idx" ON "Workstream"("createdById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Workstream_authorizationScopeId_authorizationScopeType_key" ON "Workstream"("authorizationScopeId", "authorizationScopeType");

-- CreateIndex
CREATE INDEX "WorkstreamStatusTransition_workstreamId_effectiveAt_id_idx" ON "WorkstreamStatusTransition"("workstreamId", "effectiveAt", "id");

-- CreateIndex
CREATE INDEX "WorkstreamStatusTransition_actorId_createdAt_idx" ON "WorkstreamStatusTransition"("actorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkstreamStatusTransition_workstreamId_resultingVersion_key" ON "WorkstreamStatusTransition"("workstreamId", "resultingVersion");

-- CreateIndex
CREATE INDEX "WorkstreamMember_workstreamId_employeeId_startsAt_endsAt_idx" ON "WorkstreamMember"("workstreamId", "employeeId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "WorkstreamMember_employeeId_startsAt_endsAt_idx" ON "WorkstreamMember"("employeeId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "WorkstreamMember_createdById_createdAt_idx" ON "WorkstreamMember"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "ResponsibilityWindow_projectId_employeeId_startsAt_endsAt_idx" ON "ResponsibilityWindow"("projectId", "employeeId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "ResponsibilityWindow_workstreamId_employeeId_startsAt_endsA_idx" ON "ResponsibilityWindow"("workstreamId", "employeeId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "ResponsibilityWindow_employeeId_startsAt_endsAt_idx" ON "ResponsibilityWindow"("employeeId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "ResponsibilityWindow_createdById_createdAt_idx" ON "ResponsibilityWindow"("createdById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OwnershipTransfer_closedWindowId_key" ON "OwnershipTransfer"("closedWindowId");

-- CreateIndex
CREATE UNIQUE INDEX "OwnershipTransfer_newOwnerWindowId_key" ON "OwnershipTransfer"("newOwnerWindowId");

-- CreateIndex
CREATE UNIQUE INDEX "OwnershipTransfer_returnWindowId_key" ON "OwnershipTransfer"("returnWindowId");

-- CreateIndex
CREATE INDEX "OwnershipTransfer_projectId_effectiveAt_id_idx" ON "OwnershipTransfer"("projectId", "effectiveAt", "id");

-- CreateIndex
CREATE INDEX "OwnershipTransfer_workstreamId_effectiveAt_id_idx" ON "OwnershipTransfer"("workstreamId", "effectiveAt", "id");

-- CreateIndex
CREATE INDEX "OwnershipTransfer_managerDecisionById_createdAt_idx" ON "OwnershipTransfer"("managerDecisionById", "createdAt");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_departmentId_organizationId_fkey" FOREIGN KEY ("departmentId", "organizationId") REFERENCES "Department"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_authorizationScopeId_authorizationScopeType_depart_fkey" FOREIGN KEY ("authorizationScopeId", "authorizationScopeType", "departmentId") REFERENCES "AuthorizationScope"("id", "scopeType", "departmentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStatusTransition" ADD CONSTRAINT "ProjectStatusTransition_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStatusTransition" ADD CONSTRAINT "ProjectStatusTransition_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workstream" ADD CONSTRAINT "Workstream_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workstream" ADD CONSTRAINT "Workstream_authorizationScopeId_authorizationScopeType_fkey" FOREIGN KEY ("authorizationScopeId", "authorizationScopeType") REFERENCES "AuthorizationScope"("id", "scopeType") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workstream" ADD CONSTRAINT "Workstream_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkstreamStatusTransition" ADD CONSTRAINT "WorkstreamStatusTransition_workstreamId_fkey" FOREIGN KEY ("workstreamId") REFERENCES "Workstream"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkstreamStatusTransition" ADD CONSTRAINT "WorkstreamStatusTransition_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkstreamMember" ADD CONSTRAINT "WorkstreamMember_workstreamId_fkey" FOREIGN KEY ("workstreamId") REFERENCES "Workstream"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkstreamMember" ADD CONSTRAINT "WorkstreamMember_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkstreamMember" ADD CONSTRAINT "WorkstreamMember_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponsibilityWindow" ADD CONSTRAINT "ResponsibilityWindow_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponsibilityWindow" ADD CONSTRAINT "ResponsibilityWindow_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponsibilityWindow" ADD CONSTRAINT "ResponsibilityWindow_workstreamId_fkey" FOREIGN KEY ("workstreamId") REFERENCES "Workstream"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponsibilityWindow" ADD CONSTRAINT "ResponsibilityWindow_managerDecisionById_fkey" FOREIGN KEY ("managerDecisionById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponsibilityWindow" ADD CONSTRAINT "ResponsibilityWindow_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnershipTransfer" ADD CONSTRAINT "OwnershipTransfer_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnershipTransfer" ADD CONSTRAINT "OwnershipTransfer_workstreamId_fkey" FOREIGN KEY ("workstreamId") REFERENCES "Workstream"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnershipTransfer" ADD CONSTRAINT "OwnershipTransfer_closedWindowId_fkey" FOREIGN KEY ("closedWindowId") REFERENCES "ResponsibilityWindow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnershipTransfer" ADD CONSTRAINT "OwnershipTransfer_newOwnerWindowId_fkey" FOREIGN KEY ("newOwnerWindowId") REFERENCES "ResponsibilityWindow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnershipTransfer" ADD CONSTRAINT "OwnershipTransfer_returnWindowId_fkey" FOREIGN KEY ("returnWindowId") REFERENCES "ResponsibilityWindow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnershipTransfer" ADD CONSTRAINT "OwnershipTransfer_managerDecisionById_fkey" FOREIGN KEY ("managerDecisionById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A resource-bound authorization scope cannot change type or department after linkage.
CREATE FUNCTION "protect_resource_authorization_scope"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (OLD."scopeType" IS DISTINCT FROM NEW."scopeType"
      OR OLD."departmentId" IS DISTINCT FROM NEW."departmentId")
     AND (
       EXISTS (SELECT 1 FROM "Project" WHERE "authorizationScopeId" = OLD."id")
       OR EXISTS (SELECT 1 FROM "Workstream" WHERE "authorizationScopeId" = OLD."id")
     ) THEN
    RAISE EXCEPTION 'resource authorization scope type and department are immutable'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "AuthorizationScope_resource_binding_protected"
BEFORE UPDATE OF "scopeType", "departmentId" ON "AuthorizationScope"
FOR EACH ROW EXECUTE FUNCTION "protect_resource_authorization_scope"();

-- A workstream authorization scope must belong to its parent project's department.
CREATE FUNCTION "enforce_workstream_scope_department"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  project_department UUID;
  scope_department UUID;
BEGIN
  SELECT "departmentId" INTO project_department
  FROM "Project" WHERE "id" = NEW."projectId";
  SELECT "departmentId" INTO scope_department
  FROM "AuthorizationScope"
  WHERE "id" = NEW."authorizationScopeId"
    AND "scopeType" = NEW."authorizationScopeType";

  IF project_department IS NULL
     OR scope_department IS NULL
     OR project_department <> scope_department THEN
    RAISE EXCEPTION 'workstream authorization scope must match the project department'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Workstream_scope_department_check"
BEFORE INSERT OR UPDATE OF "projectId", "authorizationScopeId", "authorizationScopeType"
ON "Workstream"
FOR EACH ROW EXECUTE FUNCTION "enforce_workstream_scope_department"();

-- Historical period rows may only be closed once; every other mutation and all deletes are rejected.
CREATE FUNCTION "protect_close_only_period"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'historical period rows cannot be deleted' USING ERRCODE = '55000';
  END IF;
  IF OLD."endsAt" IS NULL
     AND NEW."endsAt" IS NOT NULL
     AND NEW."startsAt" < NEW."endsAt"
     AND (to_jsonb(NEW) - 'endsAt') = (to_jsonb(OLD) - 'endsAt') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'historical period rows may only be closed once' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "ProjectMember_close_only"
BEFORE UPDATE OR DELETE ON "ProjectMember"
FOR EACH ROW EXECUTE FUNCTION "protect_close_only_period"();
CREATE TRIGGER "WorkstreamMember_close_only"
BEFORE UPDATE OR DELETE ON "WorkstreamMember"
FOR EACH ROW EXECUTE FUNCTION "protect_close_only_period"();
CREATE TRIGGER "ResponsibilityWindow_close_only"
BEFORE UPDATE OR DELETE ON "ResponsibilityWindow"
FOR EACH ROW EXECUTE FUNCTION "protect_close_only_period"();

CREATE FUNCTION "protect_immutable_project_history"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'project history is immutable' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "ProjectStatusTransition_immutable"
BEFORE UPDATE OR DELETE ON "ProjectStatusTransition"
FOR EACH ROW EXECUTE FUNCTION "protect_immutable_project_history"();
CREATE TRIGGER "WorkstreamStatusTransition_immutable"
BEFORE UPDATE OR DELETE ON "WorkstreamStatusTransition"
FOR EACH ROW EXECUTE FUNCTION "protect_immutable_project_history"();
CREATE TRIGGER "OwnershipTransfer_immutable"
BEFORE UPDATE OR DELETE ON "OwnershipTransfer"
FOR EACH ROW EXECUTE FUNCTION "protect_immutable_project_history"();

-- Ownership-transfer links must describe the exact, contiguous responsibility change.
CREATE FUNCTION "validate_ownership_transfer"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  closed_window "ResponsibilityWindow"%ROWTYPE;
  new_window "ResponsibilityWindow"%ROWTYPE;
  return_window "ResponsibilityWindow"%ROWTYPE;
BEGIN
  SELECT * INTO STRICT closed_window FROM "ResponsibilityWindow" WHERE "id" = NEW."closedWindowId";
  SELECT * INTO STRICT new_window FROM "ResponsibilityWindow" WHERE "id" = NEW."newOwnerWindowId";

  IF closed_window."projectId" IS DISTINCT FROM NEW."projectId"
     OR closed_window."workstreamId" IS DISTINCT FROM NEW."workstreamId"
     OR new_window."projectId" IS DISTINCT FROM NEW."projectId"
     OR new_window."workstreamId" IS DISTINCT FROM NEW."workstreamId"
     OR closed_window."responsibilityType" NOT IN ('original', 'acting', 'permanent')
     OR closed_window."endsAt" IS DISTINCT FROM NEW."effectiveAt"
     OR new_window."startsAt" IS DISTINCT FROM NEW."effectiveAt"
     OR new_window."managerDecisionById" IS DISTINCT FROM NEW."managerDecisionById"
     OR new_window."managerDecisionAt" IS DISTINCT FROM NEW."managerDecisionAt"
     OR new_window."managerDecisionReason" IS DISTINCT FROM NEW."managerDecisionReason" THEN
    RAISE EXCEPTION 'ownership transfer windows do not match the transfer'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."transferKind" = 'permanent' THEN
    IF new_window."responsibilityType" <> 'permanent'
       OR new_window."endsAt" IS NOT NULL
       OR NEW."returnWindowId" IS NOT NULL THEN
      RAISE EXCEPTION 'permanent transfer cannot contain acting or return data'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF closed_window."responsibilityType" = 'acting' THEN
    RAISE EXCEPTION 'nested acting ownership transfers are not allowed'
      USING ERRCODE = '23514';
  END IF;

  SELECT * INTO STRICT return_window FROM "ResponsibilityWindow" WHERE "id" = NEW."returnWindowId";
  IF new_window."responsibilityType" <> 'acting'
     OR new_window."endsAt" IS NULL
     OR return_window."projectId" IS DISTINCT FROM NEW."projectId"
     OR return_window."workstreamId" IS DISTINCT FROM NEW."workstreamId"
     OR return_window."responsibilityType" <> 'permanent'
     OR return_window."employeeId" IS DISTINCT FROM closed_window."employeeId"
     OR return_window."startsAt" IS DISTINCT FROM new_window."endsAt"
     OR return_window."endsAt" IS NOT NULL
     OR return_window."managerDecisionById" IS DISTINCT FROM NEW."managerDecisionById"
     OR return_window."managerDecisionAt" IS DISTINCT FROM NEW."managerDecisionAt"
     OR return_window."managerDecisionReason" IS DISTINCT FROM NEW."managerDecisionReason" THEN
    RAISE EXCEPTION 'acting transfer return window is invalid'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN NO_DATA_FOUND THEN
    RAISE EXCEPTION 'ownership transfer references a missing responsibility window'
      USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER "OwnershipTransfer_semantics_check"
BEFORE INSERT ON "OwnershipTransfer"
FOR EACH ROW EXECUTE FUNCTION "validate_ownership_transfer"();
