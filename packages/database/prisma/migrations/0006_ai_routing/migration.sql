-- Provider-neutral routing uses immutable, exact configuration versions and append-only run traces.
CREATE TYPE "AiProviderLocality" AS ENUM ('local', 'external');
CREATE TYPE "AiDataClassification" AS ENUM ('public', 'internal', 'confidential', 'local_only');
CREATE TYPE "AiRunState" AS ENUM ('succeeded', 'failed', 'quarantined');
CREATE TYPE "AiHumanApprovalState" AS ENUM ('not_required', 'pending');

CREATE FUNCTION "is_safe_ai_reference"(value TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE STRICT
AS $$
  SELECT
    length(value) BETWEEN 3 AND 256
    AND value ~ '^[a-z][a-z0-9._-]{0,63}:([0-9]{1,20}|[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[1-5][A-Fa-f0-9]{3}-[89ABab][A-Fa-f0-9]{3}-[A-Fa-f0-9]{12}|[0-9A-HJKMNP-TV-Z]{26}|[A-Fa-f0-9]{32,64})$'
    AND value !~* '^https?:'
    AND value !~* '(^|[^a-z0-9])(api[-_]?key|bearer|credential|password|secret|token)([^a-z0-9]|$)';
$$;

CREATE FUNCTION "is_safe_ai_reference_array"(items JSONB) RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE STRICT
AS $$
DECLARE
  item JSONB;
BEGIN
  IF jsonb_typeof(items) <> 'array' OR jsonb_array_length(items) NOT BETWEEN 1 AND 50 THEN
    RETURN FALSE;
  END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    IF jsonb_typeof(item) <> 'string' OR NOT "is_safe_ai_reference"(item #>> '{}') THEN
      RETURN FALSE;
    END IF;
  END LOOP;
  RETURN TRUE;
END;
$$;

CREATE TABLE "AiProviderConfig" (
    "id" UUID NOT NULL,
    "providerKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "adapterKey" TEXT NOT NULL,
    "modelKey" TEXT NOT NULL,
    "locality" "AiProviderLocality" NOT NULL,
    "endpoint" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiProviderConfig_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AiProviderConfig_version_check" CHECK ("version" > 0),
    CONSTRAINT "AiProviderConfig_keys_check" CHECK (
      length("providerKey") BETWEEN 1 AND 100 AND "providerKey" = btrim("providerKey")
      AND length("adapterKey") BETWEEN 1 AND 100 AND "adapterKey" = btrim("adapterKey")
      AND length("modelKey") BETWEEN 1 AND 200 AND "modelKey" = btrim("modelKey")
    ),
    CONSTRAINT "AiProviderConfig_endpoint_check" CHECK (
      length("endpoint") BETWEEN 8 AND 2048
      AND "endpoint" !~ '[?#]'
      AND "endpoint" !~ '://[^/]*@'
    ),
    CONSTRAINT "AiProviderConfig_reason_check" CHECK (
      length("reason") BETWEEN 3 AND 500 AND "reason" = btrim("reason")
    )
);

CREATE TABLE "AiOutputSchemaArtifact" (
    "id" UUID NOT NULL,
    "routeKey" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "schemaHash" TEXT NOT NULL,
    "schemaArtifact" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiOutputSchemaArtifact_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AiOutputSchemaArtifact_route_check" CHECK (
      length("routeKey") BETWEEN 1 AND 200 AND "routeKey" = btrim("routeKey")
    ),
    CONSTRAINT "AiOutputSchemaArtifact_version_check" CHECK (
      length("version") BETWEEN 1 AND 128 AND "version" ~ '^[A-Za-z0-9][A-Za-z0-9._-]*$'
    ),
    CONSTRAINT "AiOutputSchemaArtifact_hash_check" CHECK ("schemaHash" ~ '^[a-f0-9]{64}$'),
    CONSTRAINT "AiOutputSchemaArtifact_schema_check" CHECK (jsonb_typeof("schemaArtifact") = 'object')
);

CREATE TABLE "AiRoute" (
    "id" UUID NOT NULL,
    "routeKey" TEXT NOT NULL,
    "level" "ScopeType" NOT NULL,
    "scopeId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiRoute_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AiRoute_routeKey_check" CHECK (length(btrim("routeKey")) BETWEEN 1 AND 200),
    CONSTRAINT "AiRoute_level_check" CHECK ("level" IN ('project', 'department', 'system'))
);

CREATE TABLE "AiRouteConfig" (
    "id" UUID NOT NULL,
    "routeId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiRouteConfig_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AiRouteConfig_version_check" CHECK ("version" > 0),
    CONSTRAINT "AiRouteConfig_reason_check" CHECK (
      length("reason") BETWEEN 3 AND 500 AND "reason" = btrim("reason")
    )
);

CREATE TABLE "AiRouteConfigProvider" (
    "id" UUID NOT NULL,
    "routeConfigId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "providerConfigId" UUID NOT NULL,
    "providerConfigVersion" INTEGER NOT NULL,
    CONSTRAINT "AiRouteConfigProvider_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AiRouteConfigProvider_position_check" CHECK ("position" BETWEEN 0 AND 9),
    CONSTRAINT "AiRouteConfigProvider_version_check" CHECK ("providerConfigVersion" > 0)
);

CREATE TABLE "AiRun" (
    "id" UUID NOT NULL,
    "routeKey" TEXT NOT NULL,
    "routeId" UUID NOT NULL,
    "routeConfigId" UUID NOT NULL,
    "routeConfigVersion" INTEGER NOT NULL,
    "routeLevel" "ScopeType" NOT NULL,
    "scopeId" UUID NOT NULL,
    "routeConfigProviderId" UUID NOT NULL,
    "providerConfigId" UUID NOT NULL,
    "providerConfigVersion" INTEGER NOT NULL,
    "projectScopeId" UUID,
    "projectScopeType" "ScopeType",
    "departmentScopeId" UUID,
    "departmentScopeType" "ScopeType",
    "classification" "AiDataClassification" NOT NULL,
    "inputReference" TEXT NOT NULL,
    "inputSchemaVersion" TEXT NOT NULL,
    "outputSchemaVersion" TEXT NOT NULL,
    "outputSchemaArtifactId" UUID NOT NULL,
    "outputSchemaHash" TEXT NOT NULL,
    "promptTemplateVersion" TEXT NOT NULL,
    "sourceReferences" JSONB NOT NULL,
    "outputReference" TEXT,
    "startedAt" TIMESTAMPTZ(6) NOT NULL,
    "completedAt" TIMESTAMPTZ(6) NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "usage" JSONB,
    "costUsd" DOUBLE PRECISION,
    "state" "AiRunState" NOT NULL,
    "errorCategory" TEXT,
    "fallbackChain" JSONB NOT NULL,
    "humanApprovalState" "AiHumanApprovalState" NOT NULL,
    "correlationId" UUID NOT NULL,
    "validationIssueCodes" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiRun_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AiRun_scope_types_check" CHECK (
      (("projectScopeId" IS NULL AND "projectScopeType" IS NULL)
        OR ("projectScopeId" IS NOT NULL AND "projectScopeType" = 'project'))
      AND (("departmentScopeId" IS NULL AND "departmentScopeType" IS NULL)
        OR ("departmentScopeId" IS NOT NULL AND "departmentScopeType" = 'department'))
    ),
    CONSTRAINT "AiRun_references_check" CHECK (
      "is_safe_ai_reference"("inputReference")
      AND "is_safe_ai_reference_array"("sourceReferences")
      AND ("outputReference" IS NULL OR "is_safe_ai_reference"("outputReference"))
    ),
    CONSTRAINT "AiRun_versions_check" CHECK (
      "routeConfigVersion" > 0
      AND "providerConfigVersion" > 0
      AND length("inputSchemaVersion") BETWEEN 1 AND 128
      AND "inputSchemaVersion" ~ '^[A-Za-z0-9][A-Za-z0-9._-]*$'
      AND length("outputSchemaVersion") BETWEEN 1 AND 128
      AND "outputSchemaVersion" ~ '^[A-Za-z0-9][A-Za-z0-9._-]*$'
      AND length("promptTemplateVersion") BETWEEN 1 AND 128
      AND "promptTemplateVersion" ~ '^[A-Za-z0-9][A-Za-z0-9._-]*$'
      AND "outputSchemaHash" ~ '^[a-f0-9]{64}$'
    ),
    CONSTRAINT "AiRun_timing_check" CHECK ("completedAt" >= "startedAt" AND "latencyMs" >= 0),
    CONSTRAINT "AiRun_cost_check" CHECK ("costUsd" IS NULL OR "costUsd" >= 0),
    CONSTRAINT "AiRun_state_check" CHECK (
      ("state" = 'succeeded' AND "outputReference" IS NOT NULL AND "errorCategory" IS NULL)
      OR ("state" <> 'succeeded' AND "outputReference" IS NULL AND "errorCategory" IS NOT NULL)
    ),
    CONSTRAINT "AiRun_fallback_check" CHECK (jsonb_typeof("fallbackChain") = 'array'),
    CONSTRAINT "AiRun_validation_check" CHECK (
      jsonb_typeof("validationIssueCodes") = 'array' AND jsonb_array_length("validationIssueCodes") <= 50
    )
);

CREATE UNIQUE INDEX "AiProviderConfig_providerKey_version_key" ON "AiProviderConfig"("providerKey", "version");
CREATE UNIQUE INDEX "AiProviderConfig_id_version_key" ON "AiProviderConfig"("id", "version");
CREATE INDEX "AiProviderConfig_providerKey_version_idx" ON "AiProviderConfig"("providerKey", "version" DESC);
CREATE INDEX "AiProviderConfig_createdById_createdAt_idx" ON "AiProviderConfig"("createdById", "createdAt");
CREATE UNIQUE INDEX "AiOutputSchemaArtifact_routeKey_version_key" ON "AiOutputSchemaArtifact"("routeKey", "version");
CREATE UNIQUE INDEX "AiOutputSchemaArtifact_id_version_schemaHash_key" ON "AiOutputSchemaArtifact"("id", "version", "schemaHash");
CREATE INDEX "AiOutputSchemaArtifact_schemaHash_idx" ON "AiOutputSchemaArtifact"("schemaHash");
CREATE UNIQUE INDEX "AiRoute_routeKey_level_scopeId_key" ON "AiRoute"("routeKey", "level", "scopeId");
CREATE UNIQUE INDEX "AiRoute_id_routeKey_level_scopeId_key" ON "AiRoute"("id", "routeKey", "level", "scopeId");
CREATE INDEX "AiRoute_level_scopeId_routeKey_idx" ON "AiRoute"("level", "scopeId", "routeKey");
CREATE UNIQUE INDEX "AiRouteConfig_routeId_version_key" ON "AiRouteConfig"("routeId", "version");
CREATE UNIQUE INDEX "AiRouteConfig_id_routeId_version_key" ON "AiRouteConfig"("id", "routeId", "version");
CREATE INDEX "AiRouteConfig_routeId_version_idx" ON "AiRouteConfig"("routeId", "version" DESC);
CREATE INDEX "AiRouteConfig_createdById_createdAt_idx" ON "AiRouteConfig"("createdById", "createdAt");
CREATE UNIQUE INDEX "AiRouteConfigProvider_routeConfigId_position_key" ON "AiRouteConfigProvider"("routeConfigId", "position");
CREATE UNIQUE INDEX "AiRouteConfigProvider_id_routeConfigId_providerConfigId_pro_key" ON "AiRouteConfigProvider"("id", "routeConfigId", "providerConfigId", "providerConfigVersion");
CREATE INDEX "AiRouteConfigProvider_providerConfigId_providerConfigVersio_idx" ON "AiRouteConfigProvider"("providerConfigId", "providerConfigVersion");
CREATE INDEX "AiRun_correlationId_idx" ON "AiRun"("correlationId");
CREATE INDEX "AiRun_routeId_routeConfigVersion_createdAt_idx" ON "AiRun"("routeId", "routeConfigVersion", "createdAt");
CREATE INDEX "AiRun_routeKey_createdAt_idx" ON "AiRun"("routeKey", "createdAt");
CREATE INDEX "AiRun_state_createdAt_idx" ON "AiRun"("state", "createdAt");
CREATE INDEX "AiRun_scopeId_createdAt_idx" ON "AiRun"("scopeId", "createdAt");
CREATE INDEX "AiRun_projectScopeId_createdAt_idx" ON "AiRun"("projectScopeId", "createdAt");
CREATE INDEX "AiRun_departmentScopeId_createdAt_idx" ON "AiRun"("departmentScopeId", "createdAt");

ALTER TABLE "AiProviderConfig" ADD CONSTRAINT "AiProviderConfig_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiRoute" ADD CONSTRAINT "AiRoute_scopeId_level_fkey"
FOREIGN KEY ("scopeId", "level") REFERENCES "AuthorizationScope"("id", "scopeType") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiRouteConfig" ADD CONSTRAINT "AiRouteConfig_routeId_fkey"
FOREIGN KEY ("routeId") REFERENCES "AiRoute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiRouteConfig" ADD CONSTRAINT "AiRouteConfig_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiRouteConfigProvider" ADD CONSTRAINT "AiRouteConfigProvider_routeConfigId_fkey"
FOREIGN KEY ("routeConfigId") REFERENCES "AiRouteConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiRouteConfigProvider" ADD CONSTRAINT "AiRouteConfigProvider_providerConfigId_providerConfigVersi_fkey"
FOREIGN KEY ("providerConfigId", "providerConfigVersion") REFERENCES "AiProviderConfig"("id", "version") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_routeId_routeKey_routeLevel_scopeId_fkey"
FOREIGN KEY ("routeId", "routeKey", "routeLevel", "scopeId") REFERENCES "AiRoute"("id", "routeKey", "level", "scopeId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_routeConfigId_routeId_routeConfigVersion_fkey"
FOREIGN KEY ("routeConfigId", "routeId", "routeConfigVersion") REFERENCES "AiRouteConfig"("id", "routeId", "version") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_routeConfigProviderId_routeConfigId_providerConfigId_fkey"
FOREIGN KEY ("routeConfigProviderId", "routeConfigId", "providerConfigId", "providerConfigVersion")
REFERENCES "AiRouteConfigProvider"("id", "routeConfigId", "providerConfigId", "providerConfigVersion") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_projectScopeId_projectScopeType_fkey"
FOREIGN KEY ("projectScopeId", "projectScopeType") REFERENCES "AuthorizationScope"("id", "scopeType") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_departmentScopeId_departmentScopeType_fkey"
FOREIGN KEY ("departmentScopeId", "departmentScopeType") REFERENCES "AuthorizationScope"("id", "scopeType") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_outputSchemaArtifactId_outputSchemaVersion_outputSch_fkey"
FOREIGN KEY ("outputSchemaArtifactId", "outputSchemaVersion", "outputSchemaHash")
REFERENCES "AiOutputSchemaArtifact"("id", "version", "schemaHash") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "prevent_ai_history_mutation"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'AI history is immutable' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "AiProviderConfig_immutable" BEFORE UPDATE OR DELETE ON "AiProviderConfig"
FOR EACH ROW EXECUTE FUNCTION "prevent_ai_history_mutation"();
CREATE TRIGGER "AiOutputSchemaArtifact_immutable" BEFORE UPDATE OR DELETE ON "AiOutputSchemaArtifact"
FOR EACH ROW EXECUTE FUNCTION "prevent_ai_history_mutation"();
CREATE TRIGGER "AiRoute_immutable" BEFORE UPDATE OR DELETE ON "AiRoute"
FOR EACH ROW EXECUTE FUNCTION "prevent_ai_history_mutation"();
CREATE TRIGGER "AiRouteConfig_immutable" BEFORE UPDATE OR DELETE ON "AiRouteConfig"
FOR EACH ROW EXECUTE FUNCTION "prevent_ai_history_mutation"();
CREATE TRIGGER "AiRouteConfigProvider_immutable" BEFORE UPDATE OR DELETE ON "AiRouteConfigProvider"
FOR EACH ROW EXECUTE FUNCTION "prevent_ai_history_mutation"();
CREATE TRIGGER "AiRun_immutable" BEFORE UPDATE OR DELETE ON "AiRun"
FOR EACH ROW EXECUTE FUNCTION "prevent_ai_history_mutation"();
