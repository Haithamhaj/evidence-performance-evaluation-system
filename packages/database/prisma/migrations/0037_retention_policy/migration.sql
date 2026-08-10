BEGIN;

CREATE TYPE "RetentionPolicyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');
CREATE TYPE "RetentionHoldStatus" AS ENUM ('ACTIVE', 'RELEASED');

CREATE TABLE "RetentionPolicyVersion" (
  "id" UUID NOT NULL, "organizationId" UUID NOT NULL, "dataType" TEXT NOT NULL,
  "policyVersion" INTEGER NOT NULL, "status" "RetentionPolicyStatus" NOT NULL DEFAULT 'DRAFT',
  "archiveAfterDays" INTEGER, "hideAfterDays" INTEGER,
  "autoDeleteProtectedHistory" BOOLEAN NOT NULL DEFAULT false,
  "effectiveAt" TIMESTAMPTZ(6) NOT NULL, "retiredAt" TIMESTAMPTZ(6),
  "reason" TEXT NOT NULL, "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RetentionPolicyVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RetentionPolicyVersion_safe_policy_check" CHECK (
    "policyVersion" > 0 AND "autoDeleteProtectedHistory" = false AND
    ("archiveAfterDays" IS NULL OR "archiveAfterDays" > 0) AND
    ("hideAfterDays" IS NULL OR "hideAfterDays" > 0) AND
    ("archiveAfterDays" IS NULL OR "hideAfterDays" IS NULL OR "hideAfterDays" >= "archiveAfterDays") AND
    length(btrim("reason")) > 0)
);

CREATE TABLE "RetentionPolicyTransition" (
  "id" UUID NOT NULL, "policyVersionId" UUID NOT NULL,
  "fromStatus" "RetentionPolicyStatus", "toStatus" "RetentionPolicyStatus" NOT NULL,
  "actorId" UUID NOT NULL, "reason" TEXT NOT NULL, "effectiveAt" TIMESTAMPTZ(6) NOT NULL,
  "resultingVersion" INTEGER NOT NULL, "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RetentionPolicyTransition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RetentionPolicyTransition_valid_check" CHECK ("resultingVersion" > 0 AND length(btrim("reason")) > 0)
);

CREATE TABLE "RetentionHold" (
  "id" UUID NOT NULL, "organizationId" UUID NOT NULL, "dataType" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL, "resourceId" UUID NOT NULL,
  "status" "RetentionHoldStatus" NOT NULL DEFAULT 'ACTIVE', "reason" TEXT NOT NULL,
  "placedById" UUID NOT NULL, "placedAt" TIMESTAMPTZ(6) NOT NULL,
  "releasedById" UUID, "releasedAt" TIMESTAMPTZ(6), "releaseReason" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "RetentionHold_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RetentionHold_state_check" CHECK (
    length(btrim("reason")) > 0 AND
    (("status" = 'ACTIVE' AND "releasedById" IS NULL AND "releasedAt" IS NULL AND "releaseReason" IS NULL) OR
     ("status" = 'RELEASED' AND "releasedById" IS NOT NULL AND "releasedAt" IS NOT NULL AND length(btrim("releaseReason")) > 0)))
);

CREATE UNIQUE INDEX "RetentionPolicyVersion_organizationId_dataType_policyVersio_key" ON "RetentionPolicyVersion"("organizationId", "dataType", "policyVersion");
CREATE INDEX "RetentionPolicyVersion_organizationId_dataType_status_effec_idx" ON "RetentionPolicyVersion"("organizationId", "dataType", "status", "effectiveAt");
CREATE INDEX "RetentionPolicyVersion_createdById_createdAt_idx" ON "RetentionPolicyVersion"("createdById", "createdAt");
CREATE UNIQUE INDEX "RetentionPolicyTransition_policyVersionId_resultingVersion_key" ON "RetentionPolicyTransition"("policyVersionId", "resultingVersion");
CREATE INDEX "RetentionPolicyTransition_actorId_createdAt_idx" ON "RetentionPolicyTransition"("actorId", "createdAt");
CREATE UNIQUE INDEX "RetentionHold_organizationId_dataType_resourceType_resource_key" ON "RetentionHold"("organizationId", "dataType", "resourceType", "resourceId", "status");
CREATE INDEX "RetentionHold_organizationId_dataType_status_placedAt_idx" ON "RetentionHold"("organizationId", "dataType", "status", "placedAt");
CREATE INDEX "RetentionHold_placedById_placedAt_idx" ON "RetentionHold"("placedById", "placedAt");
CREATE INDEX "RetentionHold_releasedById_releasedAt_idx" ON "RetentionHold"("releasedById", "releasedAt");

ALTER TABLE "RetentionPolicyVersion" ADD CONSTRAINT "RetentionPolicyVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RetentionPolicyVersion" ADD CONSTRAINT "RetentionPolicyVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RetentionPolicyTransition" ADD CONSTRAINT "RetentionPolicyTransition_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "RetentionPolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RetentionPolicyTransition" ADD CONSTRAINT "RetentionPolicyTransition_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RetentionHold" ADD CONSTRAINT "RetentionHold_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RetentionHold" ADD CONSTRAINT "RetentionHold_placedById_fkey" FOREIGN KEY ("placedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RetentionHold" ADD CONSTRAINT "RetentionHold_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "reject_retention_history_mutation"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'retention history is append-only' USING ERRCODE = '55000';
END;
$$;
CREATE TRIGGER "RetentionPolicyTransition_append_only" BEFORE UPDATE OR DELETE ON "RetentionPolicyTransition" FOR EACH ROW EXECUTE FUNCTION "reject_retention_history_mutation"();

COMMIT;
