-- Apply once after 010. Existing content, membership and choice ledger are preserved.
BEGIN;
CREATE FUNCTION simus.valid_event_point(point jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE coordinate jsonb;
BEGIN
  IF jsonb_typeof(point) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  IF jsonb_array_length(point) <> 3 THEN RETURN false; END IF;
  FOR coordinate IN SELECT value FROM jsonb_array_elements(point) LOOP
    IF jsonb_typeof(coordinate) IS DISTINCT FROM 'number' THEN RETURN false; END IF;
    IF abs(coordinate::text::numeric) > 1000000 THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END $$;
CREATE FUNCTION simus.valid_event_location(location jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
BEGIN
  IF jsonb_typeof(location) IS DISTINCT FROM 'object'
    OR jsonb_typeof(location->'map_version') IS DISTINCT FROM 'string'
    OR (location->>'map_version') !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'
    OR location->'point' IS NULL OR NOT simus.valid_event_point(location->'point')
    OR jsonb_typeof(location->'radius_m') IS DISTINCT FROM 'number' THEN RETURN false; END IF;
  RETURN (location->>'radius_m')::numeric > 0 AND (location->>'radius_m')::numeric <= 1000000;
END $$;
ALTER TABLE simus.session_situations
  ADD COLUMN event_location jsonb CHECK (event_location IS NULL OR simus.valid_event_location(event_location)),
  ADD COLUMN is_generic boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT generic_event_has_no_location CHECK (NOT is_generic OR event_location IS NULL);

-- Resuming can prepend one current-position anchor to a 2048-point source route.
CREATE FUNCTION simus.valid_event_resume_motion(motion jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
BEGIN
  IF simus.valid_npc_motion(motion) THEN RETURN true; END IF;
  IF jsonb_typeof(motion->'points') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  IF jsonb_array_length(motion->'points') <> 2049 THEN RETURN false; END IF;
  RETURN simus.valid_event_point(motion->'points'->0)
    AND simus.valid_npc_motion(jsonb_set(motion, '{points}', (motion->'points') - 0));
END $$;

CREATE TABLE simus.npc_event_states (
  session_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  motion_revision bigint NOT NULL DEFAULT 1 CHECK (motion_revision BETWEEN 1 AND 9007199254740991),
  waiting_since timestamptz NOT NULL DEFAULT clock_timestamp(),
  motion_epoch timestamptz NOT NULL DEFAULT clock_timestamp(),
  paused_ms bigint NOT NULL DEFAULT 0 CHECK (paused_ms >= 0),
  resume_motion jsonb CHECK (resume_motion IS NULL OR simus.valid_event_resume_motion(resume_motion)),
  guidance_point jsonb CHECK (guidance_point IS NULL OR simus.valid_event_point(guidance_point)),
  guidance_origin jsonb CHECK (guidance_origin IS NULL OR simus.valid_event_point(guidance_origin)),
  guidance_started_at timestamptz,
  PRIMARY KEY (session_id,participant_id),
  FOREIGN KEY (session_id,participant_id) REFERENCES simus.participant_sessions(session_id,participant_id) ON DELETE RESTRICT,
  CHECK ((guidance_point IS NULL AND guidance_origin IS NULL AND guidance_started_at IS NULL)
    OR (guidance_point IS NOT NULL AND guidance_origin IS NOT NULL AND guidance_started_at IS NOT NULL))
);
CREATE TABLE simus.npc_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  situation_id uuid NOT NULL,
  trigger_kind text NOT NULL CHECK (trigger_kind IN ('LOCATION','DEADLINE')),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','COMPLETED')),
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz,
  UNIQUE (session_id,participant_id,situation_id,id),
  FOREIGN KEY (session_id,participant_id) REFERENCES simus.participant_sessions(session_id,participant_id) ON DELETE RESTRICT,
  FOREIGN KEY (session_id,situation_id) REFERENCES simus.session_situations(session_id,id) ON DELETE RESTRICT,
  CHECK ((status='ACTIVE' AND completed_at IS NULL) OR (status='COMPLETED' AND completed_at >= started_at))
);
CREATE UNIQUE INDEX npc_events_one_active ON simus.npc_events(session_id,participant_id) WHERE status='ACTIVE';
CREATE INDEX npc_events_history ON simus.npc_events(session_id,participant_id,started_at);
ALTER TABLE simus.choice_records ADD COLUMN event_id uuid UNIQUE,
  ADD CONSTRAINT choice_event_membership FOREIGN KEY (session_id,participant_id,situation_id,event_id)
    REFERENCES simus.npc_events(session_id,participant_id,situation_id,id) ON DELETE RESTRICT;
-- Legacy records retain survey uniqueness; event occurrences can reuse authored content.
ALTER TABLE simus.choice_records DROP CONSTRAINT choice_records_session_id_participant_id_situation_id_key;
CREATE UNIQUE INDEX choice_records_legacy_situation ON simus.choice_records(session_id,participant_id,situation_id)
  WHERE event_id IS NULL;
COMMIT;
