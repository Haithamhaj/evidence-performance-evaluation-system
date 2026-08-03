-- CreateEnum
CREATE TYPE "GitHubEventVerificationState" AS ENUM ('VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "GitHubAppInstallation" (
  "id" UUID NOT NULL,
  "installationId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "GitHubAppInstallation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GitHubAppInstallation_installationId_key" UNIQUE ("installationId"),
  CONSTRAINT "GitHubAppInstallation_installation_id_nonempty" CHECK (
    char_length(btrim("installationId")) BETWEEN 1 AND 200
  )
);

-- CreateTable
CREATE TABLE "GitHubProjectBinding" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "installationId" UUID NOT NULL,
  "repositoryId" TEXT NOT NULL,
  "boundAt" TIMESTAMPTZ(6) NOT NULL,
  "unboundAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "GitHubProjectBinding_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GitHubProjectBinding_id_installationId_repositoryId_key" UNIQUE ("id", "installationId", "repositoryId"),
  CONSTRAINT "GitHubProjectBinding_repository_id_nonempty" CHECK (
    char_length(btrim("repositoryId")) BETWEEN 1 AND 200
  ),
  CONSTRAINT "GitHubProjectBinding_unbound_after_bound" CHECK (
    "unboundAt" IS NULL OR "unboundAt" >= "boundAt"
  )
);

-- CreateTable
CREATE TABLE "GitHubSourceEvent" (
  "id" UUID NOT NULL,
  "bindingId" UUID NOT NULL,
  "installationId" UUID NOT NULL,
  "repositoryId" TEXT NOT NULL,
  "deliveryId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "occurredAt" TIMESTAMPTZ(6) NOT NULL,
  "verificationState" "GitHubEventVerificationState" NOT NULL,
  "governedFacts" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GitHubSourceEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GitHubSourceEvent_deliveryId_key" UNIQUE ("deliveryId"),
  CONSTRAINT "GitHubSourceEvent_fields_nonempty" CHECK (
    char_length(btrim("repositoryId")) BETWEEN 1 AND 200
    AND char_length(btrim("deliveryId")) BETWEEN 1 AND 200
    AND char_length(btrim("eventType")) BETWEEN 1 AND 200
    AND char_length(btrim("sourceId")) BETWEEN 1 AND 500
    AND char_length(btrim("sourceUrl")) BETWEEN 1 AND 2000
  ),
  CONSTRAINT "GitHubSourceEvent_governed_facts_array" CHECK (
    jsonb_typeof("governedFacts") = 'array'
  )
);

-- CreateTable
CREATE TABLE "GitHubReconciliationCursor" (
  "id" UUID NOT NULL,
  "bindingId" UUID NOT NULL,
  "installationId" UUID NOT NULL,
  "repositoryId" TEXT NOT NULL,
  "cursor" TEXT NOT NULL,
  "lastReconciledAt" TIMESTAMPTZ(6) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "GitHubReconciliationCursor_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GitHubReconciliationCursor_bindingId_key" UNIQUE ("bindingId"),
  CONSTRAINT "GitHubReconciliationCursor_bindingId_installationId_reposit_key" UNIQUE ("bindingId", "installationId", "repositoryId"),
  CONSTRAINT "GitHubReconciliationCursor_fields_nonempty" CHECK (
    char_length(btrim("repositoryId")) BETWEEN 1 AND 200
    AND char_length(btrim("cursor")) BETWEEN 1 AND 2000
  )
);

-- AddForeignKey
ALTER TABLE "GitHubProjectBinding"
ADD CONSTRAINT "GitHubProjectBinding_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GitHubProjectBinding"
ADD CONSTRAINT "GitHubProjectBinding_installationId_fkey"
FOREIGN KEY ("installationId") REFERENCES "GitHubAppInstallation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GitHubSourceEvent"
ADD CONSTRAINT "GitHubSourceEvent_bindingId_installationId_repositoryId_fkey"
FOREIGN KEY ("bindingId", "installationId", "repositoryId")
REFERENCES "GitHubProjectBinding"("id", "installationId", "repositoryId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GitHubReconciliationCursor"
ADD CONSTRAINT "GitHubReconciliationCursor_bindingId_installationId_reposi_fkey"
FOREIGN KEY ("bindingId", "installationId", "repositoryId")
REFERENCES "GitHubProjectBinding"("id", "installationId", "repositoryId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enforce the active binding invariant while preserving prior binding history.
CREATE UNIQUE INDEX "GitHubProjectBinding_one_active_project_repository"
ON "GitHubProjectBinding"("projectId", "repositoryId")
WHERE "unboundAt" IS NULL;

CREATE INDEX "GitHubProjectBinding_project_repository_active_idx"
ON "GitHubProjectBinding"("projectId", "repositoryId", "unboundAt", "boundAt" DESC);

CREATE INDEX "GitHubProjectBinding_installation_repository_active_idx"
ON "GitHubProjectBinding"("installationId", "repositoryId", "unboundAt", "boundAt" DESC);

CREATE INDEX "GitHubSourceEvent_binding_time_idx"
ON "GitHubSourceEvent"("bindingId", "occurredAt" DESC, "id");

CREATE INDEX "GitHubSourceEvent_repository_time_idx"
ON "GitHubSourceEvent"("installationId", "repositoryId", "occurredAt" DESC, "id");

CREATE INDEX "GitHubSourceEvent_source_time_idx"
ON "GitHubSourceEvent"("sourceId", "occurredAt" DESC);

CREATE INDEX "GitHubReconciliationCursor_repository_time_idx"
ON "GitHubReconciliationCursor"("installationId", "repositoryId", "lastReconciledAt" DESC);

CREATE FUNCTION "guard_github_project_binding_update"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'GitHubProjectBinding history is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF OLD."unboundAt" IS NOT NULL
    OR NEW."unboundAt" IS NULL
    OR ROW(
      NEW."id", NEW."projectId", NEW."installationId", NEW."repositoryId", NEW."boundAt", NEW."createdAt"
    ) IS DISTINCT FROM ROW(
      OLD."id", OLD."projectId", OLD."installationId", OLD."repositoryId", OLD."boundAt", OLD."createdAt"
    )
  THEN
    RAISE EXCEPTION 'GitHubProjectBinding history is immutable'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "GitHubProjectBinding_guard_history"
BEFORE UPDATE OR DELETE ON "GitHubProjectBinding"
FOR EACH ROW EXECUTE FUNCTION "guard_github_project_binding_update"();

CREATE FUNCTION "prevent_github_source_event_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'GitHubSourceEvent records are immutable'
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "GitHubSourceEvent_guard_history"
BEFORE UPDATE OR DELETE ON "GitHubSourceEvent"
FOR EACH ROW EXECUTE FUNCTION "prevent_github_source_event_mutation"();
