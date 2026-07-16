-- Administrative replay is the first approved audit event whose canonical
-- domain segment contains an underscore.
ALTER TABLE "AuditEvent" DROP CONSTRAINT "AuditEvent_eventType_check";
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_eventType_check"
CHECK ("eventType" ~ '^[a-z]+(_[a-z]+)*(\.[a-z]+(_[a-z]+)*)+$');

CREATE TYPE "OperationStatus" AS ENUM ('pending', 'running', 'succeeded', 'failed');

CREATE TABLE "Operation" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "jobType" TEXT NOT NULL,
    "jobVersion" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "correlationId" UUID NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "status" "OperationStatus" NOT NULL DEFAULT 'pending',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "resultReference" TEXT,
    "startedAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "Operation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Operation_job_type_check" CHECK (
      length("jobType") BETWEEN 3 AND 100
      AND "jobType" ~ '^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$'
    ),
    CONSTRAINT "Operation_job_version_check" CHECK ("jobVersion" BETWEEN 1 AND 2147483647),
    CONSTRAINT "Operation_idempotency_key_check" CHECK (
      length("idempotencyKey") BETWEEN 3 AND 200
      AND "idempotencyKey" = btrim("idempotencyKey")
      AND "idempotencyKey" ~ '^[a-z0-9][A-Za-z0-9._:/-]*$'
    ),
    CONSTRAINT "Operation_attempt_count_check" CHECK ("attemptCount" >= 0),
    CONSTRAINT "Operation_payload_hash_check" CHECK ("payloadHash" ~ '^[a-f0-9]{64}$'),
    CONSTRAINT "Operation_error_code_check" CHECK (
      "errorCode" IS NULL OR (
        length("errorCode") BETWEEN 3 AND 100
        AND "errorCode" ~ '^[A-Z][A-Z0-9_]*$'
      )
    ),
    CONSTRAINT "Operation_result_reference_check" CHECK (
      "resultReference" IS NULL OR (
        length("resultReference") BETWEEN 3 AND 256
        AND "resultReference" = btrim("resultReference")
        AND "resultReference" !~* '(token|secret|password|credential|bearer|api[-_]?key)'
      )
    ),
    CONSTRAINT "Operation_state_check" CHECK (
      ("status" = 'pending' AND "startedAt" IS NULL AND "completedAt" IS NULL AND "errorCode" IS NULL AND "resultReference" IS NULL)
      OR ("status" = 'running' AND "startedAt" IS NOT NULL AND "completedAt" IS NULL AND "errorCode" IS NULL AND "resultReference" IS NULL)
      OR ("status" = 'succeeded' AND "startedAt" IS NOT NULL AND "completedAt" IS NOT NULL AND "errorCode" IS NULL AND "resultReference" IS NOT NULL)
      OR ("status" = 'failed' AND "startedAt" IS NOT NULL AND "completedAt" IS NOT NULL AND "errorCode" IS NOT NULL AND "resultReference" IS NULL)
    ),
    CONSTRAINT "Operation_timestamp_order_check" CHECK (
      "startedAt" IS NULL OR "completedAt" IS NULL OR "completedAt" >= "startedAt"
    )
);

CREATE UNIQUE INDEX "Operation_idempotencyKey_key" ON "Operation"("idempotencyKey");
CREATE INDEX "Operation_organizationId_status_createdAt_idx" ON "Operation"("organizationId", "status", "createdAt");
CREATE INDEX "Operation_jobType_jobVersion_status_createdAt_idx" ON "Operation"("jobType", "jobVersion", "status", "createdAt");
CREATE INDEX "Operation_status_createdAt_idx" ON "Operation"("status", "createdAt");
CREATE INDEX "Operation_correlationId_idx" ON "Operation"("correlationId");

ALTER TABLE "Operation" ADD CONSTRAINT "Operation_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
