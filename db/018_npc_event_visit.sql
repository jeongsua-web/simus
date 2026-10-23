-- Port of Phase 1 7ac43f0/016_location_entry_events.sql; release uses 018. NOT APPLIED.
-- Apply once after 015. Additive schema only; existing session/content/ledger rows are preserved.
BEGIN;

CREATE FUNCTION simus.valid_place_id(value text) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT value ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'
$$;

-- Legacy locations without place_id remain valid. New Phase 1 mappings require it in preflight.
ALTER TABLE simus.session_situations ADD CONSTRAINT event_place_id_valid CHECK (
  event_location IS NULL OR NOT (event_location ? 'place_id') OR
  (jsonb_typeof(event_location->'place_id') = 'string'
    AND simus.valid_place_id(event_location->>'place_id'))
);

CREATE FUNCTION simus.guard_event_place() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.event_location IS NULL OR NOT (NEW.event_location ? 'place_id') THEN RETURN NEW; END IF;
  -- Serialize with other content writes and session start, including concurrent first placements.
  PERFORM 1 FROM simus.simulation_sessions WHERE id=NEW.session_id FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM simus.session_situations s
    WHERE s.session_id=NEW.session_id AND s.id<>NEW.id
      AND s.event_location->>'place_id'=NEW.event_location->>'place_id'
      AND ROW(s.event_location->'map_version',s.event_location->'point',s.event_location->'radius_m')
        IS DISTINCT FROM ROW(NEW.event_location->'map_version',NEW.event_location->'point',NEW.event_location->'radius_m')
  ) THEN
    RAISE EXCEPTION 'A place must have one map, point and radius per session' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER event_place_consistency BEFORE INSERT OR UPDATE ON simus.session_situations
  FOR EACH ROW EXECUTE FUNCTION simus.guard_event_place();
REVOKE EXECUTE ON FUNCTION simus.guard_event_place() FROM PUBLIC;

CREATE FUNCTION simus.valid_location_occupancy(value jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE item record; state jsonb; seq numeric; consumed numeric;
BEGIN
  IF jsonb_typeof(value) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
  FOR item IN SELECT key,val FROM jsonb_each(value) AS entry(key,val) LOOP
    state:=item.val;
    IF NOT simus.valid_place_id(item.key) OR jsonb_typeof(state) IS DISTINCT FROM 'object'
      OR jsonb_typeof(state->'inside') IS DISTINCT FROM 'boolean'
      OR jsonb_typeof(state->'entry_seq') IS DISTINCT FROM 'number'
      OR jsonb_typeof(state->'consumed_entry_seq') IS DISTINCT FROM 'number'
    THEN RETURN false; END IF;
    seq:=(state->>'entry_seq')::numeric;
    consumed:=(state->>'consumed_entry_seq')::numeric;
    IF seq<>trunc(seq) OR consumed<>trunc(consumed) OR consumed<0
      OR consumed>seq OR seq>9007199254740991 THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END $$;

ALTER TABLE simus.npc_event_states
  ADD COLUMN location_occupancy jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (simus.valid_location_occupancy(location_occupancy)),
  ADD COLUMN overdue_since timestamptz,
  ADD COLUMN location_evaluated_at timestamptz;

ALTER TABLE simus.npc_events
  ADD COLUMN place_id text CHECK (place_id IS NULL OR simus.valid_place_id(place_id)),
  ADD COLUMN entry_seq bigint CHECK (entry_seq IS NULL OR entry_seq BETWEEN 1 AND 9007199254740991),
  ADD CONSTRAINT event_place_entry_pair CHECK (
    (place_id IS NULL AND entry_seq IS NULL) OR
    (place_id IS NOT NULL AND entry_seq IS NOT NULL AND trigger_kind='LOCATION')
  );
CREATE UNIQUE INDEX npc_events_one_place_entry
  ON simus.npc_events(session_id,participant_id,place_id,entry_seq) WHERE place_id IS NOT NULL;
COMMIT;
