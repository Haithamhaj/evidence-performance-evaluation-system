CREATE TYPE "ExperienceDeliveryState" AS ENUM ('queued', 'delivered', 'acknowledged', 'error');

CREATE TABLE "WorkSignalReceipt" (
  "id" UUID NOT NULL,
  "schemaVersion" INTEGER NOT NULL,
  "signalType" TEXT NOT NULL,
  "sourceClass" TEXT NOT NULL,
  "originatingDomain" TEXT NOT NULL,
  "entityRefs" JSONB NOT NULL,
  "actorKind" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "occurredAt" TIMESTAMPTZ(6) NOT NULL,
  "receivedAt" TIMESTAMPTZ(6) NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "recipientId" UUID NOT NULL,
  "correlationId" UUID NOT NULL,
  "freshness" JSONB NOT NULL,
  "deliveryCursor" BIGSERIAL NOT NULL,
  "deliveryState" "ExperienceDeliveryState" NOT NULL DEFAULT 'queued',
  "deliveryAttemptCount" INTEGER NOT NULL DEFAULT 0,
  "replayCount" INTEGER NOT NULL DEFAULT 0,
  "deliveredAt" TIMESTAMPTZ(6),
  "acknowledgedAt" TIMESTAMPTZ(6),
  "lastErrorCode" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "WorkSignalReceipt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkSignalReceipt_closed_taxonomy_check" CHECK (
    "schemaVersion" = 1
    AND ("signalType", "sourceClass") IN (
      ('domain.work_item_changed', 'domain'),
      ('domain.project_context_changed', 'domain'),
      ('domain.update_confirmed', 'domain'),
      ('domain.evidence_state_changed', 'domain'),
      ('domain.research_lifecycle_changed', 'domain'),
      ('domain.continuity_state_changed', 'domain'),
      ('connector.google_context_changed', 'connector'),
      ('connector.github_fact_verified', 'connector'),
      ('scheduled.today_refresh_due', 'scheduled_work_check'),
      ('scheduled.checkin_or_readiness_due', 'scheduled_work_check'),
      ('scheduled.responsibility_expiry_due', 'scheduled_work_check'),
      ('user.capture_submitted', 'user_domain_action'),
      ('user.domain_command_requested', 'user_domain_action'),
      ('user.assistance_requested', 'user_domain_action')
    )
    AND jsonb_typeof("entityRefs") = 'array'
    AND jsonb_array_length("entityRefs") BETWEEN 1 AND 5
    AND jsonb_typeof("freshness") = 'object'
    AND "payloadHash" ~ '^[a-f0-9]{64}$'
    AND "deliveryAttemptCount" >= 0
    AND "replayCount" >= 0
  )
);

CREATE TABLE "ExperienceWorkflowEventReceipt" (
  "id" UUID NOT NULL,
  "schemaVersion" INTEGER NOT NULL,
  "eventType" TEXT NOT NULL,
  "actorId" UUID NOT NULL,
  "recipientId" UUID NOT NULL,
  "entityRef" JSONB NOT NULL,
  "operationId" UUID,
  "idempotencyKey" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "expectedVersion" INTEGER,
  "safeReasonCode" TEXT NOT NULL,
  "correlationId" UUID NOT NULL,
  "occurredAt" TIMESTAMPTZ(6) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExperienceWorkflowEventReceipt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExperienceWorkflowEventReceipt_closed_taxonomy_check" CHECK (
    "schemaVersion" = 1
    AND "eventType" IN (
      'experience.confirm',
      'experience.correct',
      'experience.dismiss',
      'experience.retry',
      'experience.submit',
      'experience.recovery'
    )
    AND "actorId" = "recipientId"
    AND jsonb_typeof("entityRef") = 'object'
    AND "payloadHash" ~ '^[a-f0-9]{64}$'
    AND length(btrim("safeReasonCode")) BETWEEN 1 AND 80
    AND ("expectedVersion" IS NULL OR "expectedVersion" > 0)
    AND ("eventType" <> 'experience.retry' OR "operationId" IS NOT NULL)
    AND (
      "eventType" NOT IN (
        'experience.confirm', 'experience.correct', 'experience.dismiss', 'experience.submit'
      )
      OR "expectedVersion" IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX "WorkSignalReceipt_idempotencyKey_key"
  ON "WorkSignalReceipt"("idempotencyKey");
CREATE UNIQUE INDEX "WorkSignalReceipt_deliveryCursor_key"
  ON "WorkSignalReceipt"("deliveryCursor");
CREATE INDEX "WorkSignalReceipt_recipientId_deliveryState_deliveryCursor_idx"
  ON "WorkSignalReceipt"("recipientId", "deliveryState", "deliveryCursor");
CREATE INDEX "WorkSignalReceipt_deliveryState_createdAt_idx"
  ON "WorkSignalReceipt"("deliveryState", "createdAt");
CREATE INDEX "WorkSignalReceipt_correlationId_idx"
  ON "WorkSignalReceipt"("correlationId");

CREATE UNIQUE INDEX "ExperienceWorkflowEventReceipt_idempotencyKey_key"
  ON "ExperienceWorkflowEventReceipt"("idempotencyKey");
CREATE INDEX "ExperienceWorkflowEventReceipt_recipientId_occurredAt_id_idx"
  ON "ExperienceWorkflowEventReceipt"("recipientId", "occurredAt", "id");
CREATE INDEX "ExperienceWorkflowEventReceipt_correlationId_idx"
  ON "ExperienceWorkflowEventReceipt"("correlationId");

ALTER TABLE "WorkSignalReceipt"
  ADD CONSTRAINT "WorkSignalReceipt_recipientId_fkey"
  FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ExperienceWorkflowEventReceipt"
  ADD CONSTRAINT "ExperienceWorkflowEventReceipt_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ExperienceWorkflowEventReceipt"
  ADD CONSTRAINT "ExperienceWorkflowEventReceipt_recipientId_fkey"
  FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
