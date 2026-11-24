BEGIN;
ALTER TABLE simus.npc_events DROP CONSTRAINT npc_events_trigger_kind_check;
ALTER TABLE simus.npc_events ADD CHECK (trigger_kind IN ('LOCATION','DEADLINE','MANUAL'));

CREATE TABLE simus.npc_event_start_requests (
  session_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  request_key uuid NOT NULL,
  PRIMARY KEY (session_id,participant_id,request_key),
  FOREIGN KEY (session_id,participant_id)
    REFERENCES simus.participant_sessions(session_id,participant_id) ON DELETE RESTRICT
);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='simus_app') THEN
    GRANT SELECT, INSERT ON simus.npc_event_start_requests TO simus_app;
  END IF;
END $$;
COMMIT;
