-- Provider-neutral routing uses immutable configuration versions and append-only run traces.
CREATE TYPE "AiProviderLocality" AS ENUM ('local', 'external');
CREATE TYPE "AiDataClassification" AS ENUM ('public', 'internal', 'confidential', 'local_only');
CREATE TYPE "AiRunState" AS ENUM ('succeeded', 'failed', 'quarantined');
CREATE TYPE "AiHumanApprovalState" AS ENUM ('not_required', 'pending');

CREATE TABLE "AiRoute" (
    "id" UUID NOT NULL,
    "routeKey" TEXT NOT NULL,
    "level" "ScopeType" NOT NULL,
    "scopeId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiRoute_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AiRoute_routeKey_check" CHECK (length(btrim("routeKey")) > 0),
    CONSTRAINT "AiRoute_level_check" CHECK ("level" IN ('project', 'department', 'system'))
);

CREATE TABLE "AiRouteConfig" (
    "id" UUID NOT NULL,
    "routeId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "providerChain" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiRouteConfig_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AiRouteConfig_version_check" CHECK ("version" > 0),
    CONSTRAINT "AiRouteConfig_providerChain_check"
        CHECK (jsonb_typeof("providerChain") = 'array' AND jsonb_array_length("providerChain") > 0),
    CONSTRAINT "AiRouteConfig_reason_check"
        CHECK (length("reason") BETWEEN 3 AND 500 AND "reason" = btrim("reason"))
);

CREATE TABLE "AiRun" (
    "id" UUID NOT NULL,
    "routeKey" TEXT NOT NULL,
    "routeId" UUID NOT NULL,
    "routeConfigId" UUID NOT NULL,
    "routeConfigVersion" INTEGER NOT NULL,
    "routeLevel" "ScopeType" NOT NULL,
    "scopeId" UUID NOT NULL,
    "providerKey" TEXT NOT NULL,
    "modelKey" TEXT NOT NULL,
    "classification" "AiDataClassification" NOT NULL,
    "inputReference" TEXT NOT NULL,
    "inputSchemaVersion" TEXT NOT NULL,
    "outputSchemaVersion" TEXT NOT NULL,
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
    CONSTRAINT "AiRun_routeKey_check" CHECK (length(btrim("routeKey")) > 0),
    CONSTRAINT "AiRun_routeLevel_check" CHECK ("routeLevel" IN ('project', 'department', 'system')),
    CONSTRAINT "AiRun_references_check"
        CHECK (length(btrim("inputReference")) > 0 AND jsonb_typeof("sourceReferences") = 'array'),
    CONSTRAINT "AiRun_versions_check"
        CHECK (
            "routeConfigVersion" > 0
            AND length(btrim("inputSchemaVersion")) > 0
            AND length(btrim("outputSchemaVersion")) > 0
            AND length(btrim("promptTemplateVersion")) > 0
        ),
    CONSTRAINT "AiRun_timing_check"
        CHECK ("completedAt" >= "startedAt" AND "latencyMs" >= 0),
    CONSTRAINT "AiRun_cost_check" CHECK ("costUsd" IS NULL OR "costUsd" >= 0),
    CONSTRAINT "AiRun_state_check"
        CHECK (
            ("state" = 'succeeded' AND "outputReference" IS NOT NULL AND "errorCategory" IS NULL)
            OR ("state" <> 'succeeded' AND "outputReference" IS NULL AND "errorCategory" IS NOT NULL)
        ),
    CONSTRAINT "AiRun_fallback_check" CHECK (jsonb_typeof("fallbackChain") = 'array'),
    CONSTRAINT "AiRun_validation_check" CHECK (jsonb_typeof("validationIssueCodes") = 'array')
);

CREATE UNIQUE INDEX "AiRoute_routeKey_level_scopeId_key"
ON "AiRoute"("routeKey", "level", "scopeId");
CREATE INDEX "AiRoute_level_scopeId_routeKey_idx"
ON "AiRoute"("level", "scopeId", "routeKey");
CREATE UNIQUE INDEX "AiRouteConfig_routeId_version_key"
ON "AiRouteConfig"("routeId", "version");
CREATE UNIQUE INDEX "AiRouteConfig_id_routeId_version_key"
ON "AiRouteConfig"("id", "routeId", "version");
CREATE INDEX "AiRouteConfig_routeId_version_idx"
ON "AiRouteConfig"("routeId", "version" DESC);
CREATE INDEX "AiRouteConfig_createdById_createdAt_idx"
ON "AiRouteConfig"("createdById", "createdAt");
CREATE UNIQUE INDEX "AiRun_correlationId_key" ON "AiRun"("correlationId");
CREATE INDEX "AiRun_routeId_routeConfigVersion_createdAt_idx"
ON "AiRun"("routeId", "routeConfigVersion", "createdAt");
CREATE INDEX "AiRun_routeKey_createdAt_idx" ON "AiRun"("routeKey", "createdAt");
CREATE INDEX "AiRun_state_createdAt_idx" ON "AiRun"("state", "createdAt");
CREATE INDEX "AiRun_scopeId_createdAt_idx" ON "AiRun"("scopeId", "createdAt");

ALTER TABLE "AiRoute" ADD CONSTRAINT "AiRoute_scopeId_level_fkey"
FOREIGN KEY ("scopeId", "level") REFERENCES "AuthorizationScope"("id", "scopeType")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiRouteConfig" ADD CONSTRAINT "AiRouteConfig_routeId_fkey"
FOREIGN KEY ("routeId") REFERENCES "AiRoute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiRouteConfig" ADD CONSTRAINT "AiRouteConfig_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_routeConfigId_routeId_routeConfigVersion_fkey"
FOREIGN KEY ("routeConfigId", "routeId", "routeConfigVersion")
REFERENCES "AiRouteConfig"("id", "routeId", "version") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "prevent_ai_route_mutation"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'AI route history is immutable' USING ERRCODE = '55000';
END;
$$;
CREATE TRIGGER "AiRoute_immutable"
BEFORE UPDATE OR DELETE ON "AiRoute"
FOR EACH ROW EXECUTE FUNCTION "prevent_ai_route_mutation"();

CREATE FUNCTION "prevent_ai_route_config_mutation"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'AI route configuration history is immutable' USING ERRCODE = '55000';
END;
$$;
CREATE TRIGGER "AiRouteConfig_immutable"
BEFORE UPDATE OR DELETE ON "AiRouteConfig"
FOR EACH ROW EXECUTE FUNCTION "prevent_ai_route_config_mutation"();

CREATE FUNCTION "prevent_ai_run_mutation"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'AI run history is immutable' USING ERRCODE = '55000';
END;
$$;
CREATE TRIGGER "AiRun_immutable"
BEFORE UPDATE OR DELETE ON "AiRun"
FOR EACH ROW EXECUTE FUNCTION "prevent_ai_run_mutation"();
