-- A restored session deliberately uses an empty search_path. Qualify the nested
-- function call so protected AI reference checks survive an isolated restore.
CREATE OR REPLACE FUNCTION public."is_safe_ai_reference_array"(items JSONB) RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE
  item JSONB;
BEGIN
  IF jsonb_typeof(items) <> 'array' OR jsonb_array_length(items) NOT BETWEEN 1 AND 50 THEN
    RETURN FALSE;
  END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    IF jsonb_typeof(item) <> 'string' OR NOT public."is_safe_ai_reference"(item #>> '{}') THEN
      RETURN FALSE;
    END IF;
  END LOOP;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public."is_valid_project_link_anchors"(items JSONB) RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE
  anchor JSONB;
BEGIN
  IF jsonb_typeof(items) <> 'array' OR jsonb_array_length(items) > 20 THEN
    RETURN FALSE;
  END IF;
  FOR anchor IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    IF jsonb_typeof(anchor) IS DISTINCT FROM 'object'
      OR (SELECT count(*) FROM jsonb_object_keys(anchor)) <> 3
      OR jsonb_typeof(anchor -> 'kind') IS DISTINCT FROM 'string'
      OR jsonb_typeof(anchor -> 'reference') IS DISTINCT FROM 'string'
      OR jsonb_typeof(anchor -> 'conflicts') IS DISTINCT FROM 'boolean'
      OR anchor ->> 'kind' NOT IN (
        'EXPLICIT_USER_MAPPING',
        'CONFIRMED_SENDER_DOMAIN',
        'CALENDAR_CONTEXT',
        'EXPLICIT_PROJECT_REFERENCE',
        'PRIOR_EMPLOYEE_CORRECTION',
        'GOVERNED_REPOSITORY_BINDING'
      )
      OR NOT public."is_safe_ai_reference"(anchor ->> 'reference')
    THEN
      RETURN FALSE;
    END IF;
  END LOOP;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public."has_project_auto_link_authority"(items JSONB) RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE
  independent_kind_count INTEGER;
BEGIN
  IF NOT public."is_valid_project_link_anchors"(items)
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(items) AS entry(anchor)
      WHERE (anchor ->> 'conflicts')::BOOLEAN
    )
  THEN
    RETURN FALSE;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(items) AS entry(anchor)
    WHERE anchor ->> 'kind' = 'EXPLICIT_USER_MAPPING'
  ) THEN
    RETURN TRUE;
  END IF;
  SELECT count(DISTINCT anchor ->> 'kind')
  INTO independent_kind_count
  FROM jsonb_array_elements(items) AS entry(anchor);
  RETURN independent_kind_count >= 2;
END;
$$;
