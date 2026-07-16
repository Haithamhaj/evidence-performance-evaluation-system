-- Audit history is owned by migrations and exposed to the application as append/query only.
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorKind" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "effectiveSubjectId" UUID NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" UUID NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" UUID NOT NULL,
    "reason" TEXT,
    "safeDiff" JSONB,
    "correlationId" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AuditEvent_eventType_check"
        CHECK ("eventType" ~ '^[a-z]+(\.[a-z]+)+$'),
    CONSTRAINT "AuditEvent_actor_check"
        CHECK (
            ("actorKind" = 'human' AND "actorId" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
            OR ("actorKind" = 'service' AND "actorId" = 'bootstrap')
        ),
    CONSTRAINT "AuditEvent_scopeType_check"
        CHECK ("scopeType" IN ('system', 'organization', 'department', 'project', 'workstream', 'cycle')),
    CONSTRAINT "AuditEvent_targetType_check" CHECK (length("targetType") > 0),
    CONSTRAINT "AuditEvent_reason_check"
        CHECK ("reason" IS NULL OR (length("reason") BETWEEN 3 AND 500 AND "reason" = btrim("reason"))),
    CONSTRAINT "AuditEvent_source_check"
        CHECK ("source" IN ('api', 'worker', 'seed', 'admin_replay'))
);

CREATE INDEX "AuditEvent_eventType_createdAt_id_idx"
ON "AuditEvent"("eventType", "createdAt", "id");
CREATE INDEX "AuditEvent_actorKind_actorId_createdAt_id_idx"
ON "AuditEvent"("actorKind", "actorId", "createdAt", "id");
CREATE INDEX "AuditEvent_scopeType_scopeId_createdAt_id_idx"
ON "AuditEvent"("scopeType", "scopeId", "createdAt", "id");
CREATE INDEX "AuditEvent_targetType_targetId_createdAt_id_idx"
ON "AuditEvent"("targetType", "targetId", "createdAt", "id");
CREATE INDEX "AuditEvent_correlationId_idx" ON "AuditEvent"("correlationId");
CREATE INDEX "AuditEvent_createdAt_id_idx" ON "AuditEvent"("createdAt", "id");

CREATE FUNCTION "prevent_audit_event_mutation"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'audit events are append-only' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "AuditEvent_append_only"
BEFORE UPDATE OR DELETE ON "AuditEvent"
FOR EACH ROW EXECUTE FUNCTION "prevent_audit_event_mutation"();

REVOKE ALL ON TABLE "AuditEvent" FROM PUBLIC;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'evaluation_app') THEN
        REVOKE ALL ON TABLE "AuditEvent" FROM evaluation_app;
        GRANT SELECT, INSERT ON TABLE "AuditEvent" TO evaluation_app;
    END IF;
END;
$$;
