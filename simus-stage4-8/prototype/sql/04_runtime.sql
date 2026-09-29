-- Apply after outputs/sql/01_schema.sql. New prototype database only.
BEGIN;
-- Approval is committed separately, without waiting for an in-flight choice's row lock.
CREATE TABLE simus.session_closures (
 session_id uuid PRIMARY KEY REFERENCES simus.simulation_sessions(id),
 requested_at timestamptz NOT NULL,
 end_mode text NOT NULL CHECK(end_mode IN ('AUTO','MANUAL')),
 admin_id uuid REFERENCES simus.admin_users(id),
 CHECK ((end_mode='AUTO' AND admin_id IS NULL) OR (end_mode='MANUAL' AND admin_id IS NOT NULL))
);
CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON simus.session_closures
 FOR EACH ROW EXECUTE FUNCTION simus.reject_mutation();

CREATE FUNCTION simus.guard_choice_commit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s simus.simulation_sessions;
BEGIN
 -- Shared protocol with manual approval: whichever reaches this gate first wins.
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.session_id::text, 0));
 SELECT * INTO s FROM simus.simulation_sessions WHERE id=NEW.session_id;
 IF s.status <> 'RUNNING' OR clock_timestamp() >= s.scheduled_end_at
    OR NEW.received_at >= s.scheduled_end_at - interval '5 seconds'
    OR EXISTS(SELECT 1 FROM simus.session_closures WHERE session_id=NEW.session_id) THEN
   RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='choice closed before commit';
 END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER choice_commit_gate AFTER INSERT ON simus.choice_records
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION simus.guard_choice_commit();

CREATE FUNCTION simus.freeze_content() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sid uuid;
BEGIN
 sid := CASE WHEN TG_OP='DELETE' THEN OLD.session_id ELSE NEW.session_id END;
 IF EXISTS(SELECT 1 FROM simus.simulation_sessions WHERE id=sid AND status<>'DRAFT')
 OR (TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM simus.simulation_sessions WHERE id=OLD.session_id AND status<>'DRAFT')) THEN
  RAISE EXCEPTION 'session content is frozen';
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['session_situations','session_choices','session_regions','choice_region_effects'] LOOP
 EXECUTE format('CREATE TRIGGER frozen_content BEFORE INSERT OR UPDATE OR DELETE ON simus.%I FOR EACH ROW EXECUTE FUNCTION simus.freeze_content()',t);
 END LOOP;
END $$;
CREATE FUNCTION simus.guard_session() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status <> 'DRAFT' AND
 (NEW.starts_at,NEW.scheduled_end_at,NEW.impact_scale,NEW.rules_snapshot,NEW.expected_participants,NEW.expected_answers_per_person)
 IS DISTINCT FROM
 (OLD.starts_at,OLD.scheduled_end_at,OLD.impact_scale,OLD.rules_snapshot,OLD.expected_participants,OLD.expected_answers_per_person) THEN
 RAISE EXCEPTION 'session settings are frozen'; END IF;
 IF NOT ((OLD.status='DRAFT' AND NEW.status IN ('DRAFT','RUNNING')) OR
 (OLD.status='RUNNING' AND NEW.status='CLOSING') OR (OLD.status='CLOSING' AND NEW.status='FINALIZED')) THEN
 RAISE EXCEPTION 'invalid session transition'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER session_transition BEFORE UPDATE ON simus.simulation_sessions
 FOR EACH ROW EXECUTE FUNCTION simus.guard_session();
CREATE FUNCTION simus.guard_state() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM simus.simulation_sessions WHERE id=NEW.session_id AND status IN ('CLOSING','FINALIZED')) THEN
 RAISE EXCEPTION 'session state is frozen'; END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['city_states','region_states','participant_alignments','participant_sessions'] LOOP
 EXECUTE format('CREATE TRIGGER frozen_state BEFORE INSERT OR UPDATE ON simus.%I FOR EACH ROW EXECUTE FUNCTION simus.guard_state()',t);
 END LOOP;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA simus FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA simus FROM PUBLIC;
COMMIT;
