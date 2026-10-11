-- Apply once after 009. Existing membership snapshots are preserved.
BEGIN;
ALTER TABLE simus.simulation_sessions ADD COLUMN npc_motion jsonb;
ALTER TABLE simus.participant_sessions ALTER COLUMN npc_motion DROP DEFAULT;

CREATE FUNCTION simus.valid_npc_motion(motion jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE point jsonb; coordinate jsonb; previous_point jsonb; has_distance boolean := false;
BEGIN
  IF jsonb_typeof(motion) IS DISTINCT FROM 'object'
    OR jsonb_typeof(motion->'map_version') IS DISTINCT FROM 'string'
    OR (motion->>'map_version') !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'
    OR jsonb_typeof(motion->'path_version') IS DISTINCT FROM 'string'
    OR (motion->>'path_version') !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'
    OR jsonb_typeof(motion->'speed_mps') IS DISTINCT FROM 'number'
    OR jsonb_typeof(motion->'loop') IS DISTINCT FROM 'boolean'
    OR jsonb_typeof(motion->'points') IS DISTINCT FROM 'array' THEN
    RETURN false;
  END IF;
  IF (motion->>'speed_mps')::numeric < 0 OR (motion->>'speed_mps')::numeric > 100
    OR jsonb_array_length(motion->'points') NOT BETWEEN 2 AND 2048 THEN RETURN false; END IF;
  FOR point IN SELECT value FROM jsonb_array_elements(motion->'points') LOOP
    IF jsonb_typeof(point) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
    IF jsonb_array_length(point) <> 3 THEN RETURN false; END IF;
    FOR coordinate IN SELECT value FROM jsonb_array_elements(point) LOOP
      IF jsonb_typeof(coordinate) IS DISTINCT FROM 'number' THEN RETURN false; END IF;
      IF abs(coordinate::text::numeric) > 1000000 THEN RETURN false; END IF;
    END LOOP;
    IF previous_point IS NOT NULL AND previous_point <> point THEN has_distance := true; END IF;
    previous_point := point;
  END LOOP;
  RETURN has_distance;
END $$;
ALTER TABLE simus.simulation_sessions ADD CONSTRAINT session_npc_motion_valid
  CHECK (npc_motion IS NULL OR simus.valid_npc_motion(npc_motion));

CREATE FUNCTION simus.guard_session_npc_motion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.npc_motion IS DISTINCT FROM OLD.npc_motion
    AND (OLD.status <> 'DRAFT' OR NEW.status <> 'DRAFT') THEN
    RAISE EXCEPTION 'NPC motion can only be configured in DRAFT' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER session_npc_motion BEFORE UPDATE ON simus.simulation_sessions
  FOR EACH ROW EXECUTE FUNCTION simus.guard_session_npc_motion();

CREATE FUNCTION simus.guard_new_npc_motion() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE configured_motion jsonb;
BEGIN
  SELECT npc_motion INTO configured_motion FROM simus.simulation_sessions
    WHERE id=NEW.session_id FOR UPDATE;
  IF configured_motion IS NULL THEN
    RAISE EXCEPTION 'NPC_MOTION_NOT_CONFIGURED' USING ERRCODE='23514';
  END IF;
  IF NEW.npc_motion IS DISTINCT FROM configured_motion THEN
    RAISE EXCEPTION 'NPC motion must match the session configuration' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER npc_motion_snapshot BEFORE INSERT ON simus.participant_sessions
  FOR EACH ROW EXECUTE FUNCTION simus.guard_new_npc_motion();
REVOKE EXECUTE ON FUNCTION simus.guard_session_npc_motion(), simus.guard_new_npc_motion() FROM PUBLIC;
COMMIT;
