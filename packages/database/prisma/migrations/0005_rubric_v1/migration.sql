-- Rubric versions and locale content are versioned infrastructure records. Active content is immutable.
CREATE TYPE "RubricStatus" AS ENUM ('draft', 'active', 'retired');
CREATE TYPE "RubricCriterionKind" AS ENUM ('employee', 'project_contribution', 'manager');

CREATE TABLE "RubricVersion" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "version" TEXT NOT NULL,
    "status" "RubricStatus" NOT NULL DEFAULT 'draft',
    "activatedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RubricVersion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RubricVersion_version_check" CHECK (length(btrim("version")) > 0),
    CONSTRAINT "RubricVersion_activation_check"
        CHECK (("status" = 'draft' AND "activatedAt" IS NULL) OR ("status" <> 'draft' AND "activatedAt" IS NOT NULL))
);

CREATE TABLE "RubricLocale" (
    "id" UUID NOT NULL,
    "rubricVersionId" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "status" "RubricStatus" NOT NULL DEFAULT 'draft',
    "activatedAt" TIMESTAMPTZ(6),
    "biasGuidance" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RubricLocale_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RubricLocale_locale_check" CHECK ("locale" ~ '^[a-z]{2}(-[A-Z]{2})?$'),
    CONSTRAINT "RubricLocale_sourceHash_check" CHECK ("sourceHash" ~ '^[a-f0-9]{64}$'),
    CONSTRAINT "RubricLocale_activation_check"
        CHECK (("status" = 'draft' AND "activatedAt" IS NULL) OR ("status" <> 'draft' AND "activatedAt" IS NOT NULL))
);

CREATE TABLE "RubricSection" (
    "id" UUID NOT NULL,
    "rubricLocaleId" UUID NOT NULL,
    "stableId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RubricSection_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RubricSection_stableId_check" CHECK (length(btrim("stableId")) > 0),
    CONSTRAINT "RubricSection_title_check" CHECK (length(btrim("title")) > 0),
    CONSTRAINT "RubricSection_weight_check" CHECK ("weight" BETWEEN 0 AND 100),
    CONSTRAINT "RubricSection_displayOrder_check" CHECK ("displayOrder" >= 0)
);

CREATE TABLE "RubricCriterion" (
    "id" UUID NOT NULL,
    "rubricLocaleId" UUID NOT NULL,
    "sectionId" UUID,
    "stableId" TEXT NOT NULL,
    "kind" "RubricCriterionKind" NOT NULL,
    "title" TEXT NOT NULL,
    "assessmentBasis" TEXT,
    "internalWeight" INTEGER,
    "content" JSONB NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RubricCriterion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RubricCriterion_stableId_check" CHECK (length(btrim("stableId")) > 0),
    CONSTRAINT "RubricCriterion_title_check" CHECK (length(btrim("title")) > 0),
    CONSTRAINT "RubricCriterion_internalWeight_check"
        CHECK ("internalWeight" IS NULL OR "internalWeight" BETWEEN 0 AND 100),
    CONSTRAINT "RubricCriterion_displayOrder_check" CHECK ("displayOrder" >= 0),
    CONSTRAINT "RubricCriterion_section_check"
        CHECK (("kind" = 'manager' AND "sectionId" IS NULL) OR ("kind" <> 'manager' AND "sectionId" IS NOT NULL))
);

CREATE TABLE "RubricAnchor" (
    "id" UUID NOT NULL,
    "criterionId" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RubricAnchor_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RubricAnchor_rating_check" CHECK ("rating" BETWEEN 1 AND 5),
    CONSTRAINT "RubricAnchor_text_check" CHECK (length(btrim("text")) > 0)
);

CREATE UNIQUE INDEX "RubricVersion_organizationId_version_key"
ON "RubricVersion"("organizationId", "version");
CREATE INDEX "RubricVersion_organizationId_status_idx"
ON "RubricVersion"("organizationId", "status");
CREATE UNIQUE INDEX "RubricLocale_rubricVersionId_locale_key"
ON "RubricLocale"("rubricVersionId", "locale");
CREATE INDEX "RubricLocale_rubricVersionId_status_idx"
ON "RubricLocale"("rubricVersionId", "status");
CREATE UNIQUE INDEX "RubricSection_rubricLocaleId_stableId_key"
ON "RubricSection"("rubricLocaleId", "stableId");
CREATE UNIQUE INDEX "RubricSection_rubricLocaleId_displayOrder_key"
ON "RubricSection"("rubricLocaleId", "displayOrder");
CREATE UNIQUE INDEX "RubricCriterion_rubricLocaleId_stableId_key"
ON "RubricCriterion"("rubricLocaleId", "stableId");
CREATE UNIQUE INDEX "RubricCriterion_rubricLocaleId_displayOrder_key"
ON "RubricCriterion"("rubricLocaleId", "displayOrder");
CREATE INDEX "RubricCriterion_sectionId_idx" ON "RubricCriterion"("sectionId");
CREATE UNIQUE INDEX "RubricAnchor_criterionId_rating_key"
ON "RubricAnchor"("criterionId", "rating");

ALTER TABLE "RubricVersion" ADD CONSTRAINT "RubricVersion_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RubricLocale" ADD CONSTRAINT "RubricLocale_rubricVersionId_fkey"
FOREIGN KEY ("rubricVersionId") REFERENCES "RubricVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RubricSection" ADD CONSTRAINT "RubricSection_rubricLocaleId_fkey"
FOREIGN KEY ("rubricLocaleId") REFERENCES "RubricLocale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RubricCriterion" ADD CONSTRAINT "RubricCriterion_rubricLocaleId_fkey"
FOREIGN KEY ("rubricLocaleId") REFERENCES "RubricLocale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RubricCriterion" ADD CONSTRAINT "RubricCriterion_sectionId_fkey"
FOREIGN KEY ("sectionId") REFERENCES "RubricSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RubricAnchor" ADD CONSTRAINT "RubricAnchor_criterionId_fkey"
FOREIGN KEY ("criterionId") REFERENCES "RubricCriterion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "prevent_active_rubric_version_mutation"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW."status" <> 'draft' THEN
            RAISE EXCEPTION 'rubric activation must transition from draft' USING ERRCODE = '55000';
        END IF;
        RETURN NEW;
    END IF;
    IF OLD."status" <> 'draft' THEN
        RAISE EXCEPTION 'historical rubric content is immutable' USING ERRCODE = '55000';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW."status" = 'retired' THEN
        RAISE EXCEPTION 'rubric status must transition from draft to active' USING ERRCODE = '55000';
    END IF;
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER "RubricVersion_active_immutable"
BEFORE INSERT OR UPDATE OR DELETE ON "RubricVersion"
FOR EACH ROW EXECUTE FUNCTION "prevent_active_rubric_version_mutation"();

CREATE FUNCTION "prevent_active_rubric_locale_mutation"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW."status" <> 'draft' THEN
            RAISE EXCEPTION 'rubric activation must transition from draft' USING ERRCODE = '55000';
        END IF;
        RETURN NEW;
    END IF;
    IF OLD."status" <> 'draft' THEN
        RAISE EXCEPTION 'historical rubric content is immutable' USING ERRCODE = '55000';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW."status" = 'retired' THEN
        RAISE EXCEPTION 'rubric status must transition from draft to active' USING ERRCODE = '55000';
    END IF;
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER "RubricLocale_active_immutable"
BEFORE INSERT OR UPDATE OR DELETE ON "RubricLocale"
FOR EACH ROW EXECUTE FUNCTION "prevent_active_rubric_locale_mutation"();

CREATE FUNCTION "prevent_active_rubric_child_mutation"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    old_locale_status "RubricStatus";
    new_locale_status "RubricStatus";
BEGIN
    IF TG_OP <> 'INSERT' THEN
        SELECT "status" INTO old_locale_status
        FROM "RubricLocale" WHERE "id" = OLD."rubricLocaleId";
    END IF;
    IF TG_OP <> 'DELETE' THEN
        SELECT "status" INTO new_locale_status
        FROM "RubricLocale" WHERE "id" = NEW."rubricLocaleId";
    END IF;
    IF
        (old_locale_status IS NOT NULL AND old_locale_status <> 'draft')
        OR (new_locale_status IS NOT NULL AND new_locale_status <> 'draft')
    THEN
        RAISE EXCEPTION 'historical rubric content is immutable' USING ERRCODE = '55000';
    END IF;
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER "RubricSection_active_immutable"
BEFORE INSERT OR UPDATE OR DELETE ON "RubricSection"
FOR EACH ROW EXECUTE FUNCTION "prevent_active_rubric_child_mutation"();
CREATE TRIGGER "RubricCriterion_active_immutable"
BEFORE INSERT OR UPDATE OR DELETE ON "RubricCriterion"
FOR EACH ROW EXECUTE FUNCTION "prevent_active_rubric_child_mutation"();

CREATE FUNCTION "prevent_active_rubric_anchor_mutation"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    old_locale_status "RubricStatus";
    new_locale_status "RubricStatus";
BEGIN
    IF TG_OP <> 'INSERT' THEN
        SELECT locale."status" INTO old_locale_status
        FROM "RubricCriterion" AS criterion
        JOIN "RubricLocale" AS locale ON locale."id" = criterion."rubricLocaleId"
        WHERE criterion."id" = OLD."criterionId";
    END IF;
    IF TG_OP <> 'DELETE' THEN
        SELECT locale."status" INTO new_locale_status
        FROM "RubricCriterion" AS criterion
        JOIN "RubricLocale" AS locale ON locale."id" = criterion."rubricLocaleId"
        WHERE criterion."id" = NEW."criterionId";
    END IF;
    IF
        (old_locale_status IS NOT NULL AND old_locale_status <> 'draft')
        OR (new_locale_status IS NOT NULL AND new_locale_status <> 'draft')
    THEN
        RAISE EXCEPTION 'historical rubric content is immutable' USING ERRCODE = '55000';
    END IF;
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER "RubricAnchor_active_immutable"
BEFORE INSERT OR UPDATE OR DELETE ON "RubricAnchor"
FOR EACH ROW EXECUTE FUNCTION "prevent_active_rubric_anchor_mutation"();
