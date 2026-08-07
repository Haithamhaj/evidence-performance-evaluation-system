-- Allow the scheduled permanent return window created for a continuity
-- delegation to move in either direction when an authorized return or
-- extension decision changes the delegation boundary. The original acting
-- and delegation periods remain append-only history.
CREATE OR REPLACE FUNCTION "protect_continuity_responsibility_period"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'historical period rows cannot be deleted' USING ERRCODE = '55000';
  END IF;
  IF OLD."endsAt" IS NULL
     AND NEW."endsAt" IS NOT NULL
     AND NEW."startsAt" < NEW."endsAt"
     AND (to_jsonb(NEW) - 'endsAt') = (to_jsonb(OLD) - 'endsAt')
  THEN
    RETURN NEW;
  END IF;
  IF OLD."responsibilityType" = 'acting'
     AND OLD."relatedHandoverReference" IS NOT NULL
     AND OLD."endsAt" IS NOT NULL
     AND NEW."endsAt" IS NOT NULL
     AND NEW."endsAt" < OLD."endsAt"
     AND NEW."startsAt" < NEW."endsAt"
     AND (to_jsonb(NEW) - 'endsAt') = (to_jsonb(OLD) - 'endsAt')
  THEN
    RETURN NEW;
  END IF;
  IF OLD."responsibilityType" = 'permanent'
     AND OLD."relatedHandoverReference" IS NOT NULL
     AND OLD."endsAt" IS NULL
     AND NEW."startsAt" <> OLD."startsAt"
     AND (to_jsonb(NEW) - 'startsAt') = (to_jsonb(OLD) - 'startsAt')
  THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'historical period rows may only be closed once' USING ERRCODE = '55000';
END;
$$;
