-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('project', 'workstream');

-- CreateEnum
CREATE TYPE "TemplateScopeType" AS ENUM ('organization', 'department');

-- CreateEnum
CREATE TYPE "DocumentTemplateVersionStatus" AS ENUM ('draft', 'active', 'retired');

-- CreateEnum
CREATE TYPE "DocumentSourceType" AS ENUM ('upload', 'external_link', 'github');

-- CreateTable
CREATE TABLE "DocumentTemplate" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "departmentId" UUID,
    "scopeType" "TemplateScopeType" NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "lockVersion" INTEGER NOT NULL DEFAULT 1,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTemplateVersion" (
    "id" UUID NOT NULL,
    "templateId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "DocumentTemplateVersionStatus" NOT NULL DEFAULT 'draft',
    "reason" TEXT NOT NULL,
    "createdById" UUID NOT NULL,
    "activatedAt" TIMESTAMPTZ(6),
    "retiredAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTemplateSection" (
    "id" UUID NOT NULL,
    "templateVersionId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "display" JSONB NOT NULL,
    "required" BOOLEAN NOT NULL,
    "protected" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentTemplateSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadedSource" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "projectId" UUID,
    "workstreamId" UUID,
    "originalFilename" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "detectedType" TEXT NOT NULL,
    "detectedMime" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdById" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadedSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentRecord" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "projectId" UUID,
    "workstreamId" UUID,
    "templateVersionId" UUID NOT NULL,
    "currentVersion" INTEGER NOT NULL DEFAULT 0,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "templateVersionId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVersionSource" (
    "id" UUID NOT NULL,
    "documentVersionId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "sourceType" "DocumentSourceType" NOT NULL,
    "uploadedSourceId" UUID,
    "url" TEXT,
    "externalSourceId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentVersionSource_pkey" PRIMARY KEY ("id")
);

-- Scope, value, and lifecycle constraints
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_scope_check"
CHECK (
  ("scopeType" = 'organization' AND "departmentId" IS NULL)
  OR ("scopeType" = 'department' AND "departmentId" IS NOT NULL)
);
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_lockVersion_check"
CHECK ("lockVersion" BETWEEN 1 AND 2147483647);
ALTER TABLE "DocumentTemplateVersion" ADD CONSTRAINT "DocumentTemplateVersion_version_check"
CHECK ("version" BETWEEN 1 AND 2147483647);
ALTER TABLE "DocumentTemplateVersion" ADD CONSTRAINT "DocumentTemplateVersion_reason_check"
CHECK (length(btrim("reason")) BETWEEN 1 AND 1000);
ALTER TABLE "DocumentTemplateVersion" ADD CONSTRAINT "DocumentTemplateVersion_status_time_check"
CHECK (
  ("status" = 'draft' AND "activatedAt" IS NULL AND "retiredAt" IS NULL)
  OR ("status" = 'active' AND "activatedAt" IS NOT NULL AND "retiredAt" IS NULL)
  OR (
    "status" = 'retired'
    AND "activatedAt" IS NOT NULL
    AND "retiredAt" IS NOT NULL
    AND "activatedAt" <= "retiredAt"
  )
);
ALTER TABLE "DocumentTemplateSection" ADD CONSTRAINT "DocumentTemplateSection_key_check"
CHECK ("key" ~ '^[a-z][a-z0-9_]{0,99}$');
ALTER TABLE "DocumentTemplateSection" ADD CONSTRAINT "DocumentTemplateSection_position_check"
CHECK ("position" BETWEEN 1 AND 2147483647);
ALTER TABLE "UploadedSource" ADD CONSTRAINT "UploadedSource_scope_check"
CHECK (num_nonnulls("projectId", "workstreamId") = 1);
ALTER TABLE "UploadedSource" ADD CONSTRAINT "UploadedSource_metadata_check"
CHECK (
  length(btrim("originalFilename")) BETWEEN 1 AND 255
  AND length(btrim("objectKey")) BETWEEN 1 AND 1000
  AND length(btrim("detectedType")) BETWEEN 1 AND 100
  AND length(btrim("detectedMime")) BETWEEN 1 AND 200
  AND "byteSize" BETWEEN 1 AND 2147483647
  AND "sha256" ~ '^[a-f0-9]{64}$'
  AND length(btrim("reason")) BETWEEN 1 AND 1000
);
ALTER TABLE "DocumentRecord" ADD CONSTRAINT "DocumentRecord_scope_check"
CHECK (num_nonnulls("projectId", "workstreamId") = 1);
ALTER TABLE "DocumentRecord" ADD CONSTRAINT "DocumentRecord_currentVersion_check"
CHECK ("currentVersion" BETWEEN 0 AND 2147483647);
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_version_check"
CHECK ("version" BETWEEN 1 AND 2147483647);
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_reason_check"
CHECK (length(btrim("reason")) BETWEEN 1 AND 1000);
ALTER TABLE "DocumentVersionSource" ADD CONSTRAINT "DocumentVersionSource_position_check"
CHECK ("position" BETWEEN 1 AND 2147483647);
ALTER TABLE "DocumentVersionSource" ADD CONSTRAINT "DocumentVersionSource_shape_check"
CHECK (
  (
    "sourceType" = 'upload'
    AND "uploadedSourceId" IS NOT NULL
    AND "url" IS NULL
    AND "externalSourceId" IS NULL
  )
  OR (
    "sourceType" = 'external_link'
    AND "uploadedSourceId" IS NULL
    AND "url" IS NOT NULL
    AND "externalSourceId" IS NULL
  )
  OR (
    "sourceType" = 'github'
    AND "uploadedSourceId" IS NULL
    AND "url" IS NOT NULL
    AND "externalSourceId" IS NOT NULL
  )
);

-- One stable template aggregate and one active version per governed scope/kind
CREATE UNIQUE INDEX "DocumentTemplate_organization_kind_active_scope_key"
ON "DocumentTemplate"("organizationId", "kind")
WHERE "scopeType" = 'organization' AND "departmentId" IS NULL;
CREATE UNIQUE INDEX "DocumentTemplate_department_kind_active_scope_key"
ON "DocumentTemplate"("departmentId", "kind")
WHERE "scopeType" = 'department' AND "departmentId" IS NOT NULL;
CREATE UNIQUE INDEX "DocumentTemplateVersion_one_active_key"
ON "DocumentTemplateVersion"("templateId")
WHERE "status" = 'active';

-- Historical roots advance only through one-step compare-and-set mutations.
CREATE FUNCTION "guard_document_template_update"() RETURNS trigger AS $$
BEGIN
  IF NEW."lockVersion" <> OLD."lockVersion" + 1
    OR ROW(
      NEW."id", NEW."organizationId", NEW."departmentId", NEW."scopeType",
      NEW."kind", NEW."createdById", NEW."createdAt"
    ) IS DISTINCT FROM ROW(
      OLD."id", OLD."organizationId", OLD."departmentId", OLD."scopeType",
      OLD."kind", OLD."createdById", OLD."createdAt"
    )
  THEN
    RAISE EXCEPTION 'DocumentTemplate history is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "guard_document_template_version_update"() RETURNS trigger AS $$
BEGIN
  IF ROW(
      NEW."id", NEW."templateId", NEW."version", NEW."reason", NEW."createdById", NEW."createdAt"
    ) IS DISTINCT FROM ROW(
      OLD."id", OLD."templateId", OLD."version", OLD."reason", OLD."createdById", OLD."createdAt"
    )
    OR NOT (
      (
        OLD."status" = 'draft' AND NEW."status" = 'active'
        AND OLD."activatedAt" IS NULL AND NEW."activatedAt" IS NOT NULL
        AND OLD."retiredAt" IS NULL AND NEW."retiredAt" IS NULL
      )
      OR (
        OLD."status" = 'active' AND NEW."status" = 'retired'
        AND NEW."activatedAt" IS NOT DISTINCT FROM OLD."activatedAt"
        AND OLD."retiredAt" IS NULL AND NEW."retiredAt" IS NOT NULL
      )
    )
  THEN
    RAISE EXCEPTION 'DocumentTemplateVersion history is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "guard_document_record_update"() RETURNS trigger AS $$
BEGIN
  IF NEW."currentVersion" <> OLD."currentVersion" + 1
    OR ROW(
      NEW."id", NEW."organizationId", NEW."departmentId", NEW."projectId",
      NEW."workstreamId", NEW."templateVersionId", NEW."createdById", NEW."createdAt"
    ) IS DISTINCT FROM ROW(
      OLD."id", OLD."organizationId", OLD."departmentId", OLD."projectId",
      OLD."workstreamId", OLD."templateVersionId", OLD."createdById", OLD."createdAt"
    )
  THEN
    RAISE EXCEPTION 'DocumentRecord history is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "prevent_document_history_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Document history is immutable' USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "DocumentTemplate_guard_update"
BEFORE UPDATE ON "DocumentTemplate"
FOR EACH ROW EXECUTE FUNCTION "guard_document_template_update"();
CREATE TRIGGER "DocumentTemplateVersion_guard_update"
BEFORE UPDATE ON "DocumentTemplateVersion"
FOR EACH ROW EXECUTE FUNCTION "guard_document_template_version_update"();
CREATE TRIGGER "DocumentRecord_guard_update"
BEFORE UPDATE ON "DocumentRecord"
FOR EACH ROW EXECUTE FUNCTION "guard_document_record_update"();

CREATE TRIGGER "DocumentTemplate_prevent_delete"
BEFORE DELETE ON "DocumentTemplate"
FOR EACH ROW EXECUTE FUNCTION "prevent_document_history_mutation"();
CREATE TRIGGER "DocumentTemplateVersion_prevent_delete"
BEFORE DELETE ON "DocumentTemplateVersion"
FOR EACH ROW EXECUTE FUNCTION "prevent_document_history_mutation"();
CREATE TRIGGER "DocumentTemplateSection_prevent_mutation"
BEFORE UPDATE OR DELETE ON "DocumentTemplateSection"
FOR EACH ROW EXECUTE FUNCTION "prevent_document_history_mutation"();
CREATE TRIGGER "UploadedSource_prevent_mutation"
BEFORE UPDATE OR DELETE ON "UploadedSource"
FOR EACH ROW EXECUTE FUNCTION "prevent_document_history_mutation"();
CREATE TRIGGER "DocumentRecord_prevent_delete"
BEFORE DELETE ON "DocumentRecord"
FOR EACH ROW EXECUTE FUNCTION "prevent_document_history_mutation"();
CREATE TRIGGER "DocumentVersion_prevent_mutation"
BEFORE UPDATE OR DELETE ON "DocumentVersion"
FOR EACH ROW EXECUTE FUNCTION "prevent_document_history_mutation"();
CREATE TRIGGER "DocumentVersionSource_prevent_mutation"
BEFORE UPDATE OR DELETE ON "DocumentVersionSource"
FOR EACH ROW EXECUTE FUNCTION "prevent_document_history_mutation"();

-- CreateIndex
CREATE INDEX "DocumentTemplate_organizationId_scopeType_kind_idx" ON "DocumentTemplate"("organizationId", "scopeType", "kind");

-- CreateIndex
CREATE INDEX "DocumentTemplate_departmentId_kind_idx" ON "DocumentTemplate"("departmentId", "kind");

-- CreateIndex
CREATE INDEX "DocumentTemplate_createdById_createdAt_idx" ON "DocumentTemplate"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentTemplateVersion_templateId_status_idx" ON "DocumentTemplateVersion"("templateId", "status");

-- CreateIndex
CREATE INDEX "DocumentTemplateVersion_createdById_createdAt_idx" ON "DocumentTemplateVersion"("createdById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTemplateVersion_templateId_version_key" ON "DocumentTemplateVersion"("templateId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTemplateSection_templateVersionId_key_key" ON "DocumentTemplateSection"("templateVersionId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTemplateSection_templateVersionId_position_key" ON "DocumentTemplateSection"("templateVersionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "UploadedSource_objectKey_key" ON "UploadedSource"("objectKey");

-- CreateIndex
CREATE INDEX "UploadedSource_projectId_createdAt_idx" ON "UploadedSource"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "UploadedSource_workstreamId_createdAt_idx" ON "UploadedSource"("workstreamId", "createdAt");

-- CreateIndex
CREATE INDEX "UploadedSource_departmentId_createdAt_idx" ON "UploadedSource"("departmentId", "createdAt");

-- CreateIndex
CREATE INDEX "UploadedSource_createdById_createdAt_idx" ON "UploadedSource"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "UploadedSource_sha256_idx" ON "UploadedSource"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentRecord_projectId_key" ON "DocumentRecord"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentRecord_workstreamId_key" ON "DocumentRecord"("workstreamId");

-- CreateIndex
CREATE INDEX "DocumentRecord_departmentId_createdAt_idx" ON "DocumentRecord"("departmentId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentRecord_createdById_createdAt_idx" ON "DocumentRecord"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentVersion_createdById_createdAt_idx" ON "DocumentVersion"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentVersion_templateVersionId_idx" ON "DocumentVersion"("templateVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_documentId_version_key" ON "DocumentVersion"("documentId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersionSource_uploadedSourceId_key" ON "DocumentVersionSource"("uploadedSourceId");

-- CreateIndex
CREATE INDEX "DocumentVersionSource_sourceType_idx" ON "DocumentVersionSource"("sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersionSource_documentVersionId_position_key" ON "DocumentVersionSource"("documentVersionId", "position");

-- AddForeignKey
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_departmentId_organizationId_fkey" FOREIGN KEY ("departmentId", "organizationId") REFERENCES "Department"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplateVersion" ADD CONSTRAINT "DocumentTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplateVersion" ADD CONSTRAINT "DocumentTemplateVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplateSection" ADD CONSTRAINT "DocumentTemplateSection_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "DocumentTemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadedSource" ADD CONSTRAINT "UploadedSource_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadedSource" ADD CONSTRAINT "UploadedSource_departmentId_organizationId_fkey" FOREIGN KEY ("departmentId", "organizationId") REFERENCES "Department"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadedSource" ADD CONSTRAINT "UploadedSource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadedSource" ADD CONSTRAINT "UploadedSource_workstreamId_fkey" FOREIGN KEY ("workstreamId") REFERENCES "Workstream"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadedSource" ADD CONSTRAINT "UploadedSource_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRecord" ADD CONSTRAINT "DocumentRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRecord" ADD CONSTRAINT "DocumentRecord_departmentId_organizationId_fkey" FOREIGN KEY ("departmentId", "organizationId") REFERENCES "Department"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRecord" ADD CONSTRAINT "DocumentRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRecord" ADD CONSTRAINT "DocumentRecord_workstreamId_fkey" FOREIGN KEY ("workstreamId") REFERENCES "Workstream"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRecord" ADD CONSTRAINT "DocumentRecord_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "DocumentTemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRecord" ADD CONSTRAINT "DocumentRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "DocumentRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "DocumentTemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersionSource" ADD CONSTRAINT "DocumentVersionSource_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersionSource" ADD CONSTRAINT "DocumentVersionSource_uploadedSourceId_fkey" FOREIGN KEY ("uploadedSourceId") REFERENCES "UploadedSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
