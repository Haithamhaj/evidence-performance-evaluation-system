-- CreateEnum
CREATE TYPE "ConnectedSourceProvider" AS ENUM ('GOOGLE_GMAIL', 'GOOGLE_CALENDAR');

-- CreateEnum
CREATE TYPE "ConnectedSourcePrivacy" AS ENUM ('PRIVATE');

-- CreateEnum
CREATE TYPE "ConnectedSourceReviewState" AS ENUM ('pending', 'reviewed', 'dismissed');

-- CreateEnum
CREATE TYPE "ConnectedSourceExclusionKind" AS ENUM (
    'GMAIL_LABEL',
    'GMAIL_THREAD',
    'CALENDAR',
    'CALENDAR_EVENT_CATEGORY'
);

-- CreateTable
CREATE TABLE "ConnectedWorkAccount" (
    "id" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "credentialRef" TEXT NOT NULL,
    "connectedAt" TIMESTAMPTZ(6) NOT NULL,
    "disconnectedAt" TIMESTAMPTZ(6),
    "contentInaccessibleAt" TIMESTAMPTZ(6),
    "deletionDueAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ConnectedWorkAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectedSourceItem" (
    "id" UUID NOT NULL,
    "connectedWorkAccountId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "provider" "ConnectedSourceProvider" NOT NULL,
    "providerSourceId" TEXT NOT NULL,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL,
    "titleCiphertext" TEXT NOT NULL,
    "titleKeyVersion" TEXT NOT NULL,
    "summaryCiphertext" TEXT,
    "summaryKeyVersion" TEXT,
    "sourceUrl" TEXT,
    "privacy" "ConnectedSourcePrivacy" NOT NULL DEFAULT 'PRIVATE',
    "reviewState" "ConnectedSourceReviewState" NOT NULL DEFAULT 'pending',
    "excluded" BOOLEAN NOT NULL DEFAULT false,
    "retentionExpiresAt" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ConnectedSourceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectedSourceExclusion" (
    "id" UUID NOT NULL,
    "connectedWorkAccountId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "provider" "ConnectedSourceProvider" NOT NULL,
    "kind" "ConnectedSourceExclusionKind" NOT NULL,
    "providerExclusionId" TEXT NOT NULL,
    "revokedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectedSourceExclusion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceProjectLink" (
    "id" UUID NOT NULL,
    "sourceItemId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "linkedById" UUID NOT NULL,
    "linkedAt" TIMESTAMPTZ(6) NOT NULL,
    "unlinkedAt" TIMESTAMPTZ(6),
    "unlinkedById" UUID,
    "unlinkReason" TEXT,

    CONSTRAINT "SourceProjectLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectorSyncCursor" (
    "id" UUID NOT NULL,
    "connectedWorkAccountId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "provider" "ConnectedSourceProvider" NOT NULL,
    "cursorCiphertext" TEXT NOT NULL,
    "cursorKeyVersion" TEXT NOT NULL,
    "lastSuccessfulSyncAt" TIMESTAMPTZ(6) NOT NULL,
    "cursorExpiresAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ConnectorSyncCursor_pkey" PRIMARY KEY ("id")
);

-- Ownership and idempotency indexes
CREATE UNIQUE INDEX "ConnectedWorkAccount_employeeId_key"
ON "ConnectedWorkAccount"("employeeId");

CREATE UNIQUE INDEX "ConnectedWorkAccount_credentialRef_key"
ON "ConnectedWorkAccount"("credentialRef");

CREATE UNIQUE INDEX "ConnectedWorkAccount_id_employeeId_key"
ON "ConnectedWorkAccount"("id", "employeeId");

CREATE INDEX "ConnectedWorkAccount_employeeId_disconnectedAt_idx"
ON "ConnectedWorkAccount"("employeeId", "disconnectedAt");

CREATE INDEX "ConnectedWorkAccount_deletionDueAt_contentInaccessibleAt_idx"
ON "ConnectedWorkAccount"("deletionDueAt", "contentInaccessibleAt");

CREATE UNIQUE INDEX "ConnectedSourceItem_id_employeeId_key"
ON "ConnectedSourceItem"("id", "employeeId");

CREATE UNIQUE INDEX "ConnectedSourceItem_employeeId_provider_providerSourceId_key"
ON "ConnectedSourceItem"("employeeId", "provider", "providerSourceId");

CREATE INDEX "ConnectedSourceItem_owner_review_time_idx"
ON "ConnectedSourceItem"("employeeId", "excluded", "reviewState", "occurredAt" DESC, "id");

CREATE INDEX "ConnectedSourceItem_account_provider_time_idx"
ON "ConnectedSourceItem"("connectedWorkAccountId", "provider", "occurredAt" DESC);

CREATE INDEX "ConnectedSourceItem_retentionExpiresAt_deletedAt_idx"
ON "ConnectedSourceItem"("retentionExpiresAt", "deletedAt");

CREATE INDEX "ConnectedSourceExclusion_owner_active_time_idx"
ON "ConnectedSourceExclusion"("employeeId", "provider", "revokedAt", "createdAt" DESC);

CREATE INDEX "ConnectedSourceExclusion_account_scope_idx"
ON "ConnectedSourceExclusion"(
    "connectedWorkAccountId",
    "provider",
    "kind",
    "providerExclusionId"
);

CREATE UNIQUE INDEX "ConnectedSourceExclusion_one_active_key"
ON "ConnectedSourceExclusion"(
    "connectedWorkAccountId",
    "provider",
    "kind",
    "providerExclusionId"
)
WHERE "revokedAt" IS NULL;

CREATE INDEX "SourceProjectLink_employeeId_unlinkedAt_linkedAt_idx"
ON "SourceProjectLink"("employeeId", "unlinkedAt", "linkedAt" DESC);

CREATE INDEX "SourceProjectLink_projectId_unlinkedAt_linkedAt_idx"
ON "SourceProjectLink"("projectId", "unlinkedAt", "linkedAt" DESC);

CREATE INDEX "SourceProjectLink_sourceItemId_linkedAt_id_idx"
ON "SourceProjectLink"("sourceItemId", "linkedAt", "id");

CREATE UNIQUE INDEX "SourceProjectLink_one_active_key"
ON "SourceProjectLink"("sourceItemId")
WHERE "unlinkedAt" IS NULL;

CREATE UNIQUE INDEX "ConnectorSyncCursor_connectedWorkAccountId_provider_key"
ON "ConnectorSyncCursor"("connectedWorkAccountId", "provider");

CREATE INDEX "ConnectorSyncCursor_owner_provider_sync_idx"
ON "ConnectorSyncCursor"("employeeId", "provider", "lastSuccessfulSyncAt" DESC);

CREATE INDEX "ConnectorSyncCursor_cursorExpiresAt_idx"
ON "ConnectorSyncCursor"("cursorExpiresAt");

-- Privacy and lifecycle checks
ALTER TABLE "ConnectedWorkAccount"
ADD CONSTRAINT "ConnectedWorkAccount_credential_ref_bounded"
CHECK (char_length(btrim("credentialRef")) BETWEEN 1 AND 1000),
ADD CONSTRAINT "ConnectedWorkAccount_disconnect_lifecycle"
CHECK (
    ("disconnectedAt" IS NULL AND "contentInaccessibleAt" IS NULL AND "deletionDueAt" IS NULL)
    OR (
        "disconnectedAt" IS NOT NULL
        AND "contentInaccessibleAt" IS NOT NULL
        AND "contentInaccessibleAt" >= "disconnectedAt"
        AND ("deletionDueAt" IS NULL OR "deletionDueAt" >= "contentInaccessibleAt")
    )
);

ALTER TABLE "ConnectedSourceItem"
ADD CONSTRAINT "ConnectedSourceItem_provider_source_id_bounded"
CHECK (char_length(btrim("providerSourceId")) BETWEEN 1 AND 1000),
ADD CONSTRAINT "ConnectedSourceItem_title_ciphertext_bounded"
CHECK (char_length(btrim("titleCiphertext")) BETWEEN 1 AND 20000),
ADD CONSTRAINT "ConnectedSourceItem_title_key_version_bounded"
CHECK (char_length(btrim("titleKeyVersion")) BETWEEN 1 AND 200),
ADD CONSTRAINT "ConnectedSourceItem_summary_protection_pair"
CHECK (("summaryCiphertext" IS NULL) = ("summaryKeyVersion" IS NULL)),
ADD CONSTRAINT "ConnectedSourceItem_summary_ciphertext_bounded"
CHECK (
    "summaryCiphertext" IS NULL
    OR char_length(btrim("summaryCiphertext")) BETWEEN 1 AND 40000
),
ADD CONSTRAINT "ConnectedSourceItem_summary_key_version_bounded"
CHECK (
    "summaryKeyVersion" IS NULL
    OR char_length(btrim("summaryKeyVersion")) BETWEEN 1 AND 200
),
ADD CONSTRAINT "ConnectedSourceItem_source_url_bounded"
CHECK ("sourceUrl" IS NULL OR char_length(btrim("sourceUrl")) BETWEEN 1 AND 4000),
ADD CONSTRAINT "ConnectedSourceItem_retention_lifecycle"
CHECK (
    "deletedAt" IS NULL
    OR "retentionExpiresAt" IS NULL
    OR "deletedAt" >= "retentionExpiresAt"
);

ALTER TABLE "ConnectedSourceExclusion"
ADD CONSTRAINT "ConnectedSourceExclusion_provider_id_bounded"
CHECK (char_length(btrim("providerExclusionId")) BETWEEN 1 AND 1000),
ADD CONSTRAINT "ConnectedSourceExclusion_provider_kind"
CHECK (
    (
        "provider" = 'GOOGLE_GMAIL'
        AND "kind" IN ('GMAIL_LABEL', 'GMAIL_THREAD')
    )
    OR (
        "provider" = 'GOOGLE_CALENDAR'
        AND "kind" IN ('CALENDAR', 'CALENDAR_EVENT_CATEGORY')
    )
);

ALTER TABLE "SourceProjectLink"
ADD CONSTRAINT "SourceProjectLink_owner_only"
CHECK (
    "linkedById" = "employeeId"
    AND ("unlinkedById" IS NULL OR "unlinkedById" = "employeeId")
),
ADD CONSTRAINT "SourceProjectLink_unlink_lifecycle"
CHECK (
    (
        "unlinkedAt" IS NULL
        AND "unlinkedById" IS NULL
        AND "unlinkReason" IS NULL
    )
    OR (
        "unlinkedAt" IS NOT NULL
        AND "unlinkedById" IS NOT NULL
        AND "unlinkedAt" >= "linkedAt"
        AND char_length(btrim("unlinkReason")) BETWEEN 1 AND 1000
    )
);

ALTER TABLE "ConnectorSyncCursor"
ADD CONSTRAINT "ConnectorSyncCursor_ciphertext_bounded"
CHECK (char_length(btrim("cursorCiphertext")) BETWEEN 1 AND 20000),
ADD CONSTRAINT "ConnectorSyncCursor_key_version_bounded"
CHECK (char_length(btrim("cursorKeyVersion")) BETWEEN 1 AND 200);

-- Historical exclusions and links close once without allowing silent rewrites.
CREATE FUNCTION "guard_connected_source_exclusion_update"() RETURNS trigger AS $$
BEGIN
  IF OLD."revokedAt" IS NOT NULL
    OR NEW."revokedAt" IS NULL
    OR NEW."revokedAt" < OLD."createdAt"
    OR ROW(
      NEW."id",
      NEW."connectedWorkAccountId",
      NEW."employeeId",
      NEW."provider",
      NEW."kind",
      NEW."providerExclusionId",
      NEW."createdAt"
    ) IS DISTINCT FROM ROW(
      OLD."id",
      OLD."connectedWorkAccountId",
      OLD."employeeId",
      OLD."provider",
      OLD."kind",
      OLD."providerExclusionId",
      OLD."createdAt"
    )
  THEN
    RAISE EXCEPTION 'ConnectedSourceExclusion history is immutable'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ConnectedSourceExclusion_guard_update"
BEFORE UPDATE ON "ConnectedSourceExclusion"
FOR EACH ROW EXECUTE FUNCTION "guard_connected_source_exclusion_update"();

CREATE FUNCTION "guard_source_project_link_update"() RETURNS trigger AS $$
BEGIN
  IF OLD."unlinkedAt" IS NOT NULL
    OR NEW."unlinkedAt" IS NULL
    OR ROW(
      NEW."id",
      NEW."sourceItemId",
      NEW."employeeId",
      NEW."projectId",
      NEW."linkedById",
      NEW."linkedAt"
    ) IS DISTINCT FROM ROW(
      OLD."id",
      OLD."sourceItemId",
      OLD."employeeId",
      OLD."projectId",
      OLD."linkedById",
      OLD."linkedAt"
    )
  THEN
    RAISE EXCEPTION 'SourceProjectLink history is immutable'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SourceProjectLink_guard_update"
BEFORE UPDATE ON "SourceProjectLink"
FOR EACH ROW EXECUTE FUNCTION "guard_source_project_link_update"();

CREATE FUNCTION "guard_connected_context_history_delete"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% history cannot be deleted', TG_TABLE_NAME
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ConnectedSourceExclusion_guard_delete"
BEFORE DELETE ON "ConnectedSourceExclusion"
FOR EACH ROW EXECUTE FUNCTION "guard_connected_context_history_delete"();

CREATE TRIGGER "SourceProjectLink_guard_delete"
BEFORE DELETE ON "SourceProjectLink"
FOR EACH ROW EXECUTE FUNCTION "guard_connected_context_history_delete"();

-- Foreign keys preserve employee ownership and historical records
ALTER TABLE "ConnectedWorkAccount"
ADD CONSTRAINT "ConnectedWorkAccount_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ConnectedSourceItem"
ADD CONSTRAINT "ConnectedSourceItem_connectedWorkAccountId_employeeId_fkey"
FOREIGN KEY ("connectedWorkAccountId", "employeeId")
REFERENCES "ConnectedWorkAccount"("id", "employeeId")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "ConnectedSourceItem_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ConnectedSourceExclusion"
ADD CONSTRAINT "ConnectedSourceExclusion_connectedWorkAccountId_employeeId_fkey"
FOREIGN KEY ("connectedWorkAccountId", "employeeId")
REFERENCES "ConnectedWorkAccount"("id", "employeeId")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "ConnectedSourceExclusion_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SourceProjectLink"
ADD CONSTRAINT "SourceProjectLink_sourceItemId_employeeId_fkey"
FOREIGN KEY ("sourceItemId", "employeeId")
REFERENCES "ConnectedSourceItem"("id", "employeeId")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "SourceProjectLink_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "SourceProjectLink_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "SourceProjectLink_linkedById_fkey"
FOREIGN KEY ("linkedById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "SourceProjectLink_unlinkedById_fkey"
FOREIGN KEY ("unlinkedById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ConnectorSyncCursor"
ADD CONSTRAINT "ConnectorSyncCursor_connectedWorkAccountId_employeeId_fkey"
FOREIGN KEY ("connectedWorkAccountId", "employeeId")
REFERENCES "ConnectedWorkAccount"("id", "employeeId")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "ConnectorSyncCursor_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
