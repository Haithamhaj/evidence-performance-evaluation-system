-- Keep application roles separate from identity-provider groups and scope every assignment explicitly.
CREATE TYPE "Role" AS ENUM (
    'employee',
    'manager',
    'system_administrator',
    'project_owner',
    'workstream_owner',
    'contributor',
    'acting_owner'
);

CREATE TYPE "ScopeType" AS ENUM (
    'system',
    'organization',
    'department',
    'project',
    'workstream'
);

ALTER TABLE "User" ADD COLUMN "pilotKey" TEXT;

ALTER TABLE "User"
ADD CONSTRAINT "User_pilotKey_allowed_check"
CHECK ("pilotKey" IS NULL OR "pilotKey" IN ('pilot-manager', 'system-admin'));

CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Department" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthorizationScope" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "scopeType" "ScopeType" NOT NULL,
    "departmentId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "AuthorizationScope_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AuthorizationScope_department_required_check"
        CHECK ("scopeType" <> 'department' OR "departmentId" IS NOT NULL),
    CONSTRAINT "AuthorizationScope_system_unscoped_check"
        CHECK ("scopeType" <> 'system' OR "departmentId" IS NULL)
);

CREATE TABLE "RoleAssignment" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "scopeType" "ScopeType" NOT NULL,
    "scopeId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "RoleAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Organization_key_key" ON "Organization"("key");
CREATE UNIQUE INDEX "Department_key_key" ON "Department"("key");
CREATE INDEX "Department_organizationId_idx" ON "Department"("organizationId");
CREATE UNIQUE INDEX "User_pilotKey_key" ON "User"("pilotKey");
CREATE UNIQUE INDEX "AuthorizationScope_key_key" ON "AuthorizationScope"("key");
CREATE UNIQUE INDEX "AuthorizationScope_id_scopeType_key"
ON "AuthorizationScope"("id", "scopeType");
CREATE INDEX "AuthorizationScope_departmentId_idx" ON "AuthorizationScope"("departmentId");
CREATE UNIQUE INDEX "RoleAssignment_userId_role_scopeType_scopeId_key"
ON "RoleAssignment"("userId", "role", "scopeType", "scopeId");
CREATE INDEX "RoleAssignment_userId_idx" ON "RoleAssignment"("userId");
CREATE INDEX "RoleAssignment_scopeType_scopeId_idx" ON "RoleAssignment"("scopeType", "scopeId");

ALTER TABLE "Department"
ADD CONSTRAINT "Department_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AuthorizationScope"
ADD CONSTRAINT "AuthorizationScope_departmentId_fkey"
FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RoleAssignment"
ADD CONSTRAINT "RoleAssignment_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RoleAssignment"
ADD CONSTRAINT "RoleAssignment_scopeId_scopeType_fkey"
FOREIGN KEY ("scopeId", "scopeType") REFERENCES "AuthorizationScope"("id", "scopeType")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "prevent_pilot_key_change"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD."pilotKey" IS DISTINCT FROM NEW."pilotKey" THEN
        RAISE EXCEPTION 'pilot user key is immutable' USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "User_pilotKey_immutable"
BEFORE UPDATE OF "pilotKey" ON "User"
FOR EACH ROW EXECUTE FUNCTION "prevent_pilot_key_change"();
