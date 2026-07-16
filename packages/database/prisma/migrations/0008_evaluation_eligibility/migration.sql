CREATE TYPE "FeedbackVisibilityMode" AS ENUM (
  'identified',
  'manager_blinded',
  'anonymous_aggregated'
);

CREATE TYPE "EligibilityState" AS ENUM (
  'active',
  'excluded',
  'approved_leave',
  'pending'
);

CREATE TABLE "EvaluationCycle" (
  "id" UUID NOT NULL,
  "departmentId" UUID NOT NULL,
  "managerId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "visibilityMode" "FeedbackVisibilityMode" NOT NULL,
  "sourceReason" TEXT NOT NULL,
  "effectiveFrom" TIMESTAMPTZ(6) NOT NULL,
  "effectiveTo" TIMESTAMPTZ(6) NOT NULL,
  "openedAt" TIMESTAMPTZ(6),
  "closedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EvaluationCycle_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EvaluationCycle_version_check" CHECK ("version" BETWEEN 1 AND 2147483647),
  CONSTRAINT "EvaluationCycle_reason_check" CHECK (
    length("sourceReason") BETWEEN 3 AND 500 AND "sourceReason" = btrim("sourceReason")
  ),
  CONSTRAINT "EvaluationCycle_effective_period_check" CHECK ("effectiveFrom" < "effectiveTo"),
  CONSTRAINT "EvaluationCycle_close_check" CHECK (
    "closedAt" IS NULL OR ("openedAt" IS NOT NULL AND "closedAt" >= "openedAt")
  )
);

CREATE UNIQUE INDEX "EvaluationCycle_departmentId_version_key"
ON "EvaluationCycle"("departmentId", "version");
CREATE INDEX "EvaluationCycle_managerId_openedAt_idx"
ON "EvaluationCycle"("managerId", "openedAt");
CREATE INDEX "EvaluationCycle_departmentId_openedAt_idx"
ON "EvaluationCycle"("departmentId", "openedAt");

CREATE TABLE "EligibilitySnapshot" (
  "id" UUID NOT NULL,
  "cycleId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "visibilityMode" "FeedbackVisibilityMode" NOT NULL,
  "sourceReason" TEXT NOT NULL,
  "effectiveFrom" TIMESTAMPTZ(6) NOT NULL,
  "effectiveTo" TIMESTAMPTZ(6) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EligibilitySnapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EligibilitySnapshot_version_check" CHECK ("version" BETWEEN 1 AND 2147483647),
  CONSTRAINT "EligibilitySnapshot_reason_check" CHECK (
    length("sourceReason") BETWEEN 3 AND 500 AND "sourceReason" = btrim("sourceReason")
  ),
  CONSTRAINT "EligibilitySnapshot_effective_period_check" CHECK ("effectiveFrom" < "effectiveTo")
);

CREATE UNIQUE INDEX "EligibilitySnapshot_cycleId_key" ON "EligibilitySnapshot"("cycleId");
CREATE UNIQUE INDEX "EligibilitySnapshot_id_cycleId_key" ON "EligibilitySnapshot"("id", "cycleId");

CREATE TABLE "EligibilityEntry" (
  "id" UUID NOT NULL,
  "cycleId" UUID NOT NULL,
  "snapshotId" UUID NOT NULL,
  "employeeId" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "state" "EligibilityState" NOT NULL,
  "sourceReason" TEXT NOT NULL,
  "effectiveFrom" TIMESTAMPTZ(6) NOT NULL,
  "effectiveTo" TIMESTAMPTZ(6) NOT NULL,
  "submittedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "EligibilityEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EligibilityEntry_position_check" CHECK ("position" >= 0),
  CONSTRAINT "EligibilityEntry_version_check" CHECK ("version" BETWEEN 1 AND 2147483647),
  CONSTRAINT "EligibilityEntry_reason_check" CHECK (
    length("sourceReason") BETWEEN 3 AND 500 AND "sourceReason" = btrim("sourceReason")
  ),
  CONSTRAINT "EligibilityEntry_effective_period_check" CHECK ("effectiveFrom" < "effectiveTo"),
  CONSTRAINT "EligibilityEntry_submission_state_check" CHECK (
    "submittedAt" IS NULL OR "state" = 'active'
  )
);

CREATE UNIQUE INDEX "EligibilityEntry_cycleId_employeeId_key"
ON "EligibilityEntry"("cycleId", "employeeId");
CREATE UNIQUE INDEX "EligibilityEntry_snapshotId_position_key"
ON "EligibilityEntry"("snapshotId", "position");
CREATE INDEX "EligibilityEntry_employeeId_cycleId_idx"
ON "EligibilityEntry"("employeeId", "cycleId");
CREATE INDEX "EligibilityEntry_cycleId_state_idx"
ON "EligibilityEntry"("cycleId", "state");

ALTER TABLE "EvaluationCycle" ADD CONSTRAINT "EvaluationCycle_departmentId_fkey"
FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvaluationCycle" ADD CONSTRAINT "EvaluationCycle_managerId_fkey"
FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EligibilitySnapshot" ADD CONSTRAINT "EligibilitySnapshot_cycleId_fkey"
FOREIGN KEY ("cycleId") REFERENCES "EvaluationCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EligibilityEntry" ADD CONSTRAINT "EligibilityEntry_cycleId_fkey"
FOREIGN KEY ("cycleId") REFERENCES "EvaluationCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EligibilityEntry" ADD CONSTRAINT "EligibilityEntry_snapshotId_cycleId_fkey"
FOREIGN KEY ("snapshotId", "cycleId") REFERENCES "EligibilitySnapshot"("id", "cycleId")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EligibilityEntry" ADD CONSTRAINT "EligibilityEntry_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "protect_evaluation_cycle_snapshot"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'evaluation cycles are historical records' USING ERRCODE = '55000';
  END IF;
  IF OLD."openedAt" IS NULL
     AND NEW."openedAt" IS NOT NULL
     AND NEW."closedAt" IS NULL
     AND NEW."id" = OLD."id"
     AND NEW."departmentId" = OLD."departmentId"
     AND NEW."managerId" = OLD."managerId"
     AND NEW."version" = OLD."version"
     AND NEW."visibilityMode" = OLD."visibilityMode"
     AND NEW."sourceReason" = OLD."sourceReason"
     AND NEW."effectiveFrom" = OLD."effectiveFrom"
     AND NEW."effectiveTo" = OLD."effectiveTo"
     AND NEW."createdAt" = OLD."createdAt" THEN
    RETURN NEW;
  END IF;
  IF OLD."openedAt" IS NOT NULL
     AND OLD."closedAt" IS NULL
     AND NEW."closedAt" IS NOT NULL
     AND NEW."id" = OLD."id"
     AND NEW."departmentId" = OLD."departmentId"
     AND NEW."managerId" = OLD."managerId"
     AND NEW."version" = OLD."version"
     AND NEW."visibilityMode" = OLD."visibilityMode"
     AND NEW."sourceReason" = OLD."sourceReason"
     AND NEW."effectiveFrom" = OLD."effectiveFrom"
     AND NEW."effectiveTo" = OLD."effectiveTo"
     AND NEW."openedAt" = OLD."openedAt"
     AND NEW."createdAt" = OLD."createdAt" THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'opened evaluation cycle configuration is immutable' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "EvaluationCycle_protected"
BEFORE UPDATE OR DELETE ON "EvaluationCycle"
FOR EACH ROW EXECUTE FUNCTION "protect_evaluation_cycle_snapshot"();

CREATE FUNCTION "protect_eligibility_snapshot"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  cycle_record RECORD;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO cycle_record FROM "EvaluationCycle" WHERE "id" = NEW."cycleId";
    IF cycle_record."id" IS NULL
       OR cycle_record."openedAt" IS NOT NULL
       OR cycle_record."closedAt" IS NOT NULL
       OR NEW."version" <> cycle_record."version"
       OR NEW."visibilityMode" <> cycle_record."visibilityMode"
       OR NEW."sourceReason" <> cycle_record."sourceReason"
       OR NEW."effectiveFrom" <> cycle_record."effectiveFrom"
       OR NEW."effectiveTo" <> cycle_record."effectiveTo" THEN
      RAISE EXCEPTION 'eligibility snapshot must copy an unopened cycle' USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'eligibility snapshots are immutable' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "EligibilitySnapshot_immutable"
BEFORE INSERT OR UPDATE OR DELETE ON "EligibilitySnapshot"
FOR EACH ROW EXECUTE FUNCTION "protect_eligibility_snapshot"();

CREATE FUNCTION "protect_eligibility_entry"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  cycle_closed_at TIMESTAMPTZ(6);
  cycle_opened_at TIMESTAMPTZ(6);
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'eligibility entries are historical records' USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT "openedAt", "closedAt" INTO cycle_opened_at, cycle_closed_at
    FROM "EvaluationCycle" WHERE "id" = NEW."cycleId";
    IF cycle_opened_at IS NOT NULL OR cycle_closed_at IS NOT NULL THEN
      RAISE EXCEPTION 'opened cycle eligibility cannot be extended' USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
  END IF;

  SELECT "openedAt", "closedAt" INTO cycle_opened_at, cycle_closed_at
  FROM "EvaluationCycle" WHERE "id" = OLD."cycleId";
  IF cycle_opened_at IS NULL THEN
    RAISE EXCEPTION 'unopened cycle eligibility cannot record transitions' USING ERRCODE = '55000';
  END IF;
  IF cycle_closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'closed cycle eligibility cannot change' USING ERRCODE = '55000';
  END IF;

  IF NEW."id" = OLD."id"
     AND NEW."cycleId" = OLD."cycleId"
     AND NEW."snapshotId" = OLD."snapshotId"
     AND NEW."employeeId" = OLD."employeeId"
     AND NEW."position" = OLD."position"
     AND NEW."version" = OLD."version"
     AND NEW."state" = OLD."state"
     AND NEW."sourceReason" = OLD."sourceReason"
     AND NEW."effectiveFrom" = OLD."effectiveFrom"
     AND NEW."effectiveTo" = OLD."effectiveTo"
     AND OLD."submittedAt" IS NULL
     AND NEW."submittedAt" IS NOT NULL
     AND NEW."createdAt" = OLD."createdAt" THEN
    RETURN NEW;
  END IF;

  IF OLD."state" IN ('pending', 'approved_leave')
     AND NEW."state" = 'excluded'
     AND OLD."submittedAt" IS NULL
     AND NEW."submittedAt" IS NULL
     AND NEW."id" = OLD."id"
     AND NEW."cycleId" = OLD."cycleId"
     AND NEW."snapshotId" = OLD."snapshotId"
     AND NEW."employeeId" = OLD."employeeId"
     AND NEW."position" = OLD."position"
     AND NEW."version" = OLD."version" + 1
     AND NEW."effectiveTo" = OLD."effectiveTo"
     AND NEW."createdAt" = OLD."createdAt" THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'eligibility entry mutation is not permitted' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "EligibilityEntry_protected"
BEFORE INSERT OR UPDATE OR DELETE ON "EligibilityEntry"
FOR EACH ROW EXECUTE FUNCTION "protect_eligibility_entry"();
