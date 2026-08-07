CREATE TYPE "NotificationDeliveryState" AS ENUM ('PENDING', 'READY', 'SENT', 'RETRY_SCHEDULED', 'FAILED', 'MUTED');
CREATE TYPE "ExportState" AS ENUM ('REQUESTED', 'GENERATING', 'READY', 'FAILED', 'EXPIRED', 'REVOKED');

CREATE TABLE "NotificationIntent" (
  "id" UUID NOT NULL,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "recipientId" UUID NOT NULL,
  "category" TEXT NOT NULL,
  "urgency" TEXT NOT NULL,
  "templateVersion" INTEGER NOT NULL,
  "templateKey" TEXT NOT NULL,
  "templateArguments" JSONB NOT NULL,
  "actionKind" TEXT NOT NULL,
  "actionResourceId" TEXT NOT NULL,
  "sourceEventId" TEXT NOT NULL,
  "sourceEventVersion" INTEGER NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "channels" JSONB NOT NULL,
  "deliverAfter" TIMESTAMPTZ(6) NOT NULL,
  "inAppState" "NotificationDeliveryState" NOT NULL DEFAULT 'PENDING',
  "readAt" TIMESTAMPTZ(6),
  "resolvedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationIntent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationIntent_version_check" CHECK ("schemaVersion" > 0 AND "templateVersion" > 0 AND "sourceEventVersion" > 0),
  CONSTRAINT "NotificationIntent_channels_check" CHECK (jsonb_typeof("channels") = 'array' AND jsonb_array_length("channels") > 0)
);

CREATE TABLE "NotificationPreference" (
  "id" UUID NOT NULL,
  "recipientId" UUID NOT NULL,
  "category" TEXT NOT NULL,
  "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationPreference_version_check" CHECK ("version" > 0)
);

CREATE TABLE "NotificationDeliveryAttempt" (
  "id" UUID NOT NULL,
  "intentId" UUID NOT NULL,
  "channel" TEXT NOT NULL,
  "state" "NotificationDeliveryState" NOT NULL,
  "attempt" INTEGER NOT NULL,
  "providerReceipt" TEXT,
  "failureCategory" TEXT,
  "nextRetryAt" TIMESTAMPTZ(6),
  "correlationId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationDeliveryAttempt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationDeliveryAttempt_attempt_check" CHECK ("attempt" > 0),
  CONSTRAINT "NotificationDeliveryAttempt_channel_check" CHECK ("channel" IN ('IN_APP', 'EMAIL')),
  CONSTRAINT "NotificationDeliveryAttempt_failure_check" CHECK ("failureCategory" IS NULL OR "failureCategory" IN ('TRANSIENT', 'PERMANENT'))
);

CREATE TABLE "ExportRequest" (
  "id" UUID NOT NULL,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "requesterId" UUID NOT NULL,
  "idempotencyKey" UUID NOT NULL,
  "reportType" TEXT NOT NULL,
  "audience" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "locale" TEXT NOT NULL,
  "timezone" TEXT NOT NULL,
  "cycleId" UUID,
  "state" "ExportState" NOT NULL DEFAULT 'REQUESTED',
  "failureCategory" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "ExportRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExportRequest_format_check" CHECK ("format" IN ('HTML', 'PDF')),
  CONSTRAINT "ExportRequest_locale_check" CHECK ("locale" IN ('en', 'ar')),
  CONSTRAINT "ExportRequest_attempt_check" CHECK ("attemptCount" >= 0)
);

CREATE TABLE "ExportManifest" (
  "id" UUID NOT NULL,
  "requestId" UUID NOT NULL,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "projectionVersion" INTEGER NOT NULL,
  "rendererVersion" INTEGER NOT NULL,
  "sourceVersions" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExportManifest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExportManifest_versions_check" CHECK ("schemaVersion" > 0 AND "projectionVersion" > 0 AND "rendererVersion" > 0),
  CONSTRAINT "ExportManifest_sources_check" CHECK (jsonb_typeof("sourceVersions") = 'array' AND jsonb_array_length("sourceVersions") > 0)
);

CREATE TABLE "ExportArtifact" (
  "id" UUID NOT NULL,
  "manifestId" UUID NOT NULL,
  "storageKey" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "byteSize" BIGINT NOT NULL,
  "contentType" TEXT NOT NULL,
  "encrypted" BOOLEAN NOT NULL DEFAULT true,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExportArtifact_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExportArtifact_private_check" CHECK ("encrypted" = true AND "byteSize" >= 0),
  CONSTRAINT "ExportArtifact_expiry_check" CHECK ("expiresAt" > "createdAt")
);

CREATE TABLE "ExportAccessEvent" (
  "id" UUID NOT NULL,
  "artifactId" UUID NOT NULL,
  "actorId" UUID NOT NULL,
  "allowed" BOOLEAN NOT NULL,
  "reason" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "accessedAt" TIMESTAMPTZ(6) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExportAccessEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExportRevocation" (
  "id" UUID NOT NULL,
  "artifactId" UUID NOT NULL,
  "actorId" UUID NOT NULL,
  "reason" TEXT NOT NULL,
  "revokedAt" TIMESTAMPTZ(6) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExportRevocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExportRevocation_reason_check" CHECK (length(btrim("reason")) > 0)
);

CREATE TABLE "AdminMutationReceipt" (
  "id" UUID NOT NULL,
  "idempotencyKey" UUID NOT NULL,
  "actorId" UUID NOT NULL,
  "capability" TEXT NOT NULL,
  "ownerDomain" TEXT NOT NULL,
  "ownerReceiptId" TEXT NOT NULL,
  "expectedVersion" INTEGER NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminMutationReceipt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdminMutationReceipt_version_check" CHECK ("expectedVersion" > 0)
);

CREATE TABLE "AdminProbeHistory" (
  "id" UUID NOT NULL,
  "dependency" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "nextActionKey" TEXT,
  "correlationId" TEXT NOT NULL,
  "checkedAt" TIMESTAMPTZ(6) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminProbeHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdminProbeHistory_state_check" CHECK ("state" IN ('HEALTHY', 'DEGRADED', 'ACTION_REQUIRED'))
);

CREATE UNIQUE INDEX "NotificationIntent_recipientId_category_dedupeKey_key" ON "NotificationIntent"("recipientId", "category", "dedupeKey");
CREATE INDEX "NotificationIntent_recipientId_readAt_deliverAfter_idx" ON "NotificationIntent"("recipientId", "readAt", "deliverAfter");
CREATE UNIQUE INDEX "NotificationPreference_recipientId_category_key" ON "NotificationPreference"("recipientId", "category");
CREATE UNIQUE INDEX "NotificationDeliveryAttempt_intentId_channel_attempt_key" ON "NotificationDeliveryAttempt"("intentId", "channel", "attempt");
CREATE INDEX "NotificationDeliveryAttempt_state_nextRetryAt_idx" ON "NotificationDeliveryAttempt"("state", "nextRetryAt");
CREATE UNIQUE INDEX "ExportRequest_requesterId_idempotencyKey_key" ON "ExportRequest"("requesterId", "idempotencyKey");
CREATE INDEX "ExportRequest_state_createdAt_idx" ON "ExportRequest"("state", "createdAt");
CREATE UNIQUE INDEX "ExportManifest_requestId_key" ON "ExportManifest"("requestId");
CREATE UNIQUE INDEX "ExportArtifact_manifestId_key" ON "ExportArtifact"("manifestId");
CREATE UNIQUE INDEX "ExportArtifact_storageKey_key" ON "ExportArtifact"("storageKey");
CREATE INDEX "ExportArtifact_expiresAt_idx" ON "ExportArtifact"("expiresAt");
CREATE INDEX "ExportAccessEvent_artifactId_accessedAt_idx" ON "ExportAccessEvent"("artifactId", "accessedAt");
CREATE INDEX "ExportRevocation_artifactId_revokedAt_idx" ON "ExportRevocation"("artifactId", "revokedAt");
CREATE UNIQUE INDEX "AdminMutationReceipt_idempotencyKey_key" ON "AdminMutationReceipt"("idempotencyKey");
CREATE INDEX "AdminProbeHistory_dependency_checkedAt_idx" ON "AdminProbeHistory"("dependency", "checkedAt");

ALTER TABLE "NotificationIntent" ADD CONSTRAINT "NotificationIntent_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NotificationDeliveryAttempt" ADD CONSTRAINT "NotificationDeliveryAttempt_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "NotificationIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExportRequest" ADD CONSTRAINT "ExportRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExportManifest" ADD CONSTRAINT "ExportManifest_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ExportRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExportArtifact" ADD CONSTRAINT "ExportArtifact_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "ExportManifest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExportAccessEvent" ADD CONSTRAINT "ExportAccessEvent_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "ExportArtifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExportAccessEvent" ADD CONSTRAINT "ExportAccessEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExportRevocation" ADD CONSTRAINT "ExportRevocation_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "ExportArtifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExportRevocation" ADD CONSTRAINT "ExportRevocation_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdminMutationReceipt" ADD CONSTRAINT "AdminMutationReceipt_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "reject_operations_history_mutation"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'operations history is append-only' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "NotificationDeliveryAttempt_append_only" BEFORE UPDATE OR DELETE ON "NotificationDeliveryAttempt" FOR EACH ROW EXECUTE FUNCTION "reject_operations_history_mutation"();
CREATE TRIGGER "ExportManifest_append_only" BEFORE UPDATE OR DELETE ON "ExportManifest" FOR EACH ROW EXECUTE FUNCTION "reject_operations_history_mutation"();
CREATE TRIGGER "ExportArtifact_append_only" BEFORE UPDATE OR DELETE ON "ExportArtifact" FOR EACH ROW EXECUTE FUNCTION "reject_operations_history_mutation"();
CREATE TRIGGER "ExportAccessEvent_append_only" BEFORE UPDATE OR DELETE ON "ExportAccessEvent" FOR EACH ROW EXECUTE FUNCTION "reject_operations_history_mutation"();
CREATE TRIGGER "ExportRevocation_append_only" BEFORE UPDATE OR DELETE ON "ExportRevocation" FOR EACH ROW EXECUTE FUNCTION "reject_operations_history_mutation"();
CREATE TRIGGER "AdminMutationReceipt_append_only" BEFORE UPDATE OR DELETE ON "AdminMutationReceipt" FOR EACH ROW EXECUTE FUNCTION "reject_operations_history_mutation"();
CREATE TRIGGER "AdminProbeHistory_append_only" BEFORE UPDATE OR DELETE ON "AdminProbeHistory" FOR EACH ROW EXECUTE FUNCTION "reject_operations_history_mutation"();
