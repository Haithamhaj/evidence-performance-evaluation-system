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

CREATE TABLE "RoleAssignment" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "scopeType" "ScopeType" NOT NULL,
    "scopeId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "RoleAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Organization_key_key" ON "Organization"("key");
CREATE UNIQUE INDEX "Department_key_key" ON "Department"("key");
CREATE INDEX "Department_organizationId_idx" ON "Department"("organizationId");
CREATE UNIQUE INDEX "RoleAssignment_userId_role_scopeType_scopeId_key"
ON "RoleAssignment"("userId", "role", "scopeType", "scopeId");
CREATE INDEX "RoleAssignment_userId_idx" ON "RoleAssignment"("userId");
CREATE INDEX "RoleAssignment_scopeType_scopeId_idx" ON "RoleAssignment"("scopeType", "scopeId");

ALTER TABLE "Department"
ADD CONSTRAINT "Department_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RoleAssignment"
ADD CONSTRAINT "RoleAssignment_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
